# SPECTER — Scraper Architecture Design (Sub-project B)

**Date:** 2026-05-23
**Status:** Approved
**Scope:** Enterprise-grade scraping architecture for MVP scale (100K–3M fetches/day, ~500 merchants)
**Replaces:** Scraper sections of `docs/SCRAPER.md` (full replacement planned in implementation)

---

## 1. Design Goals

- Handle 100K–3M URL fetches/day with the existing Railway + Upstash Redis + BullMQ stack
- Minimize Playwright (browser) usage — expensive and slow — by routing static/SSR pages to a lightweight HTTP worker
- Never scrape the same URL twice in one interval window (domain batching, already implemented)
- Classify domains automatically so routing decisions are self-healing over time
- Keep implementation complexity proportional to MVP scale — no Kafka, no Kubernetes, no regional workers

---

## 2. Three-Tier Queue Architecture

Three separate BullMQ queues, all backed by the same Upstash Redis instance. Each queue has a dedicated worker type. Domain classification state determines which queue a job enters at dispatch time.

```
Scheduler (BullMQ repeat jobs by plan tier)
      ↓
[Domain class lookup: Redis domain:class:{domain}]
      ├── UNKNOWN    → scrape:probe
      ├── HTTP_OK    → scrape:http
      ├── JS_REQUIRED → scrape:playwright
      └── BLOCKED    → no job created; merchant already notified
```

### Queue Roles

| Queue | Purpose | Worker cost | Proxy type |
|-------|---------|-------------|-----------|
| `scrape:probe` | Classify unknown domains cheaply | Very low (no browser) | Datacenter (GET only) |
| `scrape:http` | Scrape HTTP_OK domains fast | Low (no browser) | Datacenter |
| `scrape:playwright` | Scrape JS_REQUIRED domains | High (Chromium) | Bright Data residential |

### Shared BullMQ Configuration (all queues)

```typescript
const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 60_000 },
  removeOnComplete: 100,
  removeOnFail: 500,
}
```

Priority by plan tier applies to all queues:

| Plan | BullMQ priority |
|------|----------------|
| ECLIPSE | 20 |
| PREDATOR | 10 |
| PHANTOM | 5 |
| CIPHER | 3 |
| RECON | 1 |

### Job Shape

All three queues share the same job payload type:

```typescript
export type ScrapeJob = {
  url: string
  domain: string
  urlPath: string
  competitorUrlIds: string[]  // all merchants tracking this URL
  plan: 'recon' | 'cipher' | 'phantom' | 'predator' | 'eclipse'
}
```

---

## 3. Domain Classification State Machine

### States

| State | Meaning | Stored value |
|-------|---------|-------------|
| `UNKNOWN` | Never seen before | (key absent from Redis) |
| `HTTP_OK` | Static/SSR — HTTP fetch sufficient | `"http_ok"` |
| `JS_REQUIRED` | Client-side rendered — needs Playwright | `"js_required"` |
| `BLOCKED` | Hard bot wall / robots.txt / repeated failure | `"blocked"` |

**Redis key:** `domain:class:{domain}` (e.g., `domain:class:amazon.in`)
**No TTL** — classification is permanent until reclassified by observed failure patterns or manual override.

### State Transitions

```
UNKNOWN
  └── [scrape:probe runs]
        ├── price found in HTML / SSR signals → HTTP_OK
        ├── JS framework detected / price absent from HTML → JS_REQUIRED
        └── 403 / robots.txt blocked / bot wall → BLOCKED

HTTP_OK
  └── [scrape:http runs]
        ├── parse succeeds → stays HTTP_OK
        └── 3 consecutive parse failures → JS_REQUIRED
              └── pending repeat job migrated to scrape:playwright

JS_REQUIRED
  └── [scrape:playwright runs]
        ├── parse succeeds → stays JS_REQUIRED
        └── 3 consecutive failures + CAPTCHA unsolvable → BLOCKED
              └── merchant notified via Resend

BLOCKED
  └── no scraping
        └── merchant notified at block time
        └── manual unblock only (ops admin endpoint)
```

### Probe Heuristics (evaluated in priority order)

The probe worker applies these checks sequentially and stops at the first match:

1. `robots.txt` disallow for URL path → **BLOCKED** (robots.txt cached in Redis 24hr)
2. Response header `cf-mitigated: challenge` or Cloudflare JS challenge body detected → **JS_REQUIRED**
3. `<script id="__NEXT_DATA__">` in HTML body → **HTTP_OK** (Next.js SSR — price is in HTML)
4. `<script type="application/ld+json">` containing `schema.org/Product` with `offers.price` → **HTTP_OK**
5. `window.__INITIAL_STATE__` / `ng-version` attribute / `id="__nuxt__"` in HTML → **JS_REQUIRED**
6. Price value found via CSS selector scan (`[data-price]`, `.price`, `#price`, `span.a-price`) → **HTTP_OK**
7. None of the above matched → **JS_REQUIRED** (safe default; Playwright can always handle it)

---

## 4. Worker Specifications

### 4.1 Probe Worker (`workers/probe.ts`)

**Purpose:** Classify unknown domains. No price data written.

| Parameter | Value |
|-----------|-------|
| Concurrency | 50 (I/O-bound, no browser) |
| HTTP client | `got` v14, 10s timeout |
| Proxy on HEAD | None |
| Proxy on GET | Datacenter |

**Flow:**
1. HEAD request to URL — inspect response headers for bot detection signals
2. If HEAD suggests bot wall → classify BLOCKED, stop
3. GET request via datacenter proxy
4. Fetch and parse `robots.txt` (check Redis cache first)
5. Run heuristics 1–7 in order → determine classification
6. Write classification to Redis `domain:class:{domain}`
7. Enqueue original scrape job to `scrape:http` or `scrape:playwright` based on result
8. If BLOCKED: POST to `specter-api /internal/domain-blocked` → merchant Resend email

---

### 4.2 HTTP Worker (`workers/http.ts`)

**Purpose:** Fast price extraction for HTTP_OK domains.

| Parameter | Value |
|-----------|-------|
| Concurrency | 30 per worker process |
| HTTP client | `got` v14, 15s timeout, brotli/gzip decompression |
| Proxy | Datacenter pool (~$1.50–2/GB) |
| Parse pipeline | JSON-LD → Open Graph price meta → CSS selectors |

**Flow:**
1. Check per-domain rate limit (Redis sliding window — see Section 5)
2. GET request via datacenter proxy with spoofed `User-Agent` and `Accept-Language` headers
3. Run parse pipeline → `ParseResult`
4. Run data validation (see Section 6)
5. If valid: write to `price_snapshots`, POST result to specter-api
6. If parse fails: increment failure counter `domain:http-fail:{domain}`
7. If failure counter reaches 3: reclassify domain to `JS_REQUIRED`, re-enqueue job to `scrape:playwright`, reset counter

**On HTTP 429:** `moveToDelayed` by `Retry-After` header value (or 60s default). Does not consume a retry attempt.

---

### 4.3 Playwright Worker (`workers/playwright.ts`)

**Purpose:** Full browser scraping for JS-rendered pages.

| Parameter | Value |
|-----------|-------|
| Concurrency | 5 per worker process |
| Browser | Playwright Chromium (headless) |
| Proxy | Bright Data residential ($8.40/GB) |
| Stealth | `playwright-extra` + `puppeteer-extra-plugin-stealth` |

**Resource blocking** (reduces bandwidth and load time):
- Images, stylesheets, fonts, media, tracking scripts blocked via `page.route()`
- Only `document`, `script`, `xhr`, `fetch` request types allowed

**Stealth randomisation** (per browser context):
- User-agent string (desktop Chrome, randomised patch version)
- Viewport dimensions (within realistic range: 1280–1920 × 720–1080)
- WebGL vendor/renderer strings
- Canvas fingerprint noise
- `navigator.language` and `Accept-Language` header

**Browser context reuse:** One Chromium instance per worker process. New context per job (not per process). Context is closed and a fresh one opened after every 50 jobs to prevent memory leak and fingerprint staleness.

**CAPTCHA handling:** On challenge page detection, capture screenshot, submit to 2captcha API, inject solution token, retry page load. If 2captcha fails after 2 attempts: job fails normally (BullMQ handles retry).

---

## 5. Per-Domain Rate Limiting

Implemented as a Redis sliding window counter. Applied in all three workers before making any outbound request.

**Redis key:** `ratelimit:{domain}` (sliding 60-second window, counter expires after window)

**Default limits (requests per minute):**

| Domain pattern | Limit/min |
|---------------|----------|
| `amazon.com`, `amazon.in`, `amazon.*` | 6 |
| `flipkart.com` | 10 |
| Detected Shopify stores (`myshopify.com` or `Shopify` in headers) | 30 |
| Unknown / generic | 20 |

**Ops override:** Per-domain config stored in Redis hash `ratelimit:config:{domain}`. Takes precedence over defaults. Writable via admin endpoint without redeploy.

**On limit exceeded:** BullMQ `moveToDelayed` by remaining window time. No retry count consumed. Worker logs `rate_limited` event.

---

## 6. Data Validation Pipeline

Runs after every parse result, before writing to `price_snapshots`. A failed validation does not fail the BullMQ job — the job completes, the write is skipped, and the failure is logged.

**Validation rules (all must pass):**

1. `price > 0 && isFinite(price)` — rejects nulls, NaN, negative values
2. `price < 1_000_000` — sanity ceiling; flags scraper bugs
3. `currency` is a valid ISO 4217 three-letter code — normalized before check:
   - `Rs.` / `₹` → `INR`
   - `£` → `GBP`
   - `€` → `EUR`
   - `$` → `USD` (default; can be overridden by domain config)
4. `inStock` is a strict boolean (not null, undefined, or string)
5. Price change > 90% vs most recent valid snapshot for same URL → write to DB with `needs_review = true` flag; do not suppress (legitimate sales can be 50%+ off, but flag for ops visibility)

**On validation failure:**
- Log to `scrape:validation-errors` queue (BullMQ dead-letter, inspectable by ops)
- If a `competitor_url` has 0 valid snapshots in 24hr: POST to specter-api `/internal/parse-stalled` → Resend email to merchant

---

## 7. Proxy Configuration Summary

| Worker | Proxy type | Provider | Est. cost/GB |
|--------|-----------|----------|-------------|
| Probe (HEAD) | None | — | $0 |
| Probe (GET) | Datacenter | Bright Data DC or Smartproxy | ~$1.50–2 |
| HTTP | Datacenter | Bright Data DC or Smartproxy | ~$1.50–2 |
| Playwright | Residential | Bright Data ISP | $8.40 |

Cost impact vs Sub-project A unit economics: HTTP_OK domains (estimated 40–60% of merchant URLs) use datacenter proxies. This improves gross margins above the values documented in `docs/PRICING.md` (which assumed residential for all scrapes). No update to PRICING.md needed — conservative estimate is intentional.

---

## 8. Dependency Stack Additions

New npm packages required (not in current `SCRAPER.md` stack):

| Package | Version | Purpose |
|---------|---------|---------|
| `got` | v14 | HTTP client for probe + HTTP workers |
| `playwright-extra` | latest | Playwright plugin system |
| `puppeteer-extra-plugin-stealth` | latest | Fingerprint randomisation for Playwright |
| `robots-parser` | v3 | robots.txt parsing (already noted in SCRAPER.md) |

Existing packages retained: `bullmq`, `playwright`, Bright Data proxy SDK/config, 2captcha client.

---

## 9. Files to Update

| File | Change |
|------|--------|
| `docs/SCRAPER.md` | Full replacement — incorporate this architecture |

No other files change. `docs/ARCHITECTURE.md` already references SCRAPER.md for priority tables and add-on handling.

---

## 10. Out of Scope

- Crawlee orchestration framework (adds complexity without benefit at MVP scale)
- Regional worker pools / geographic distribution
- RabbitMQ (BullMQ + Upstash Redis is sufficient)
- Scrapy or Python-based scraping (Node.js stack maintained)
- AI-powered parser selection (Sub-project C covers AI integration)
- Dedicated ECLIPSE worker infrastructure (covered in FEATURES.md F10 — separate Railway service)
