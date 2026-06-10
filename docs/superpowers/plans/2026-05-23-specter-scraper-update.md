# SPECTER Scraper Architecture — Documentation Update Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `docs/SCRAPER.md` with the full 3-tier queue architecture (scrape:probe / scrape:http / scrape:playwright) including domain classification, worker specs, proxy split, rate limiting, and data validation pipeline.

**Architecture:** Pure markdown edit — no code changes. The new SCRAPER.md incorporates all existing content (stack, domain batching, per-domain parsers, refresh schedules, retry logic, robots.txt) and adds seven new sections from the approved spec at `docs/superpowers/specs/2026-05-23-specter-scraper-design.md`.

**Tech Stack:** Markdown, git

---

## File Map

```
docs/SCRAPER.md    ← full replacement (only file that changes)
```

---

### Task 1: Replace docs/SCRAPER.md

**Files:**
- Modify: `docs/SCRAPER.md` (full replacement)

- [ ] **Step 1: Read the current file before overwriting**

Run:
```bash
cat docs/SCRAPER.md
```

Confirm the file has these sections (all will be carried forward):
- Stack
- Queue Structure (TypeScript snippet)
- Domain Batching
- Per-Domain Parsers (`ParseResult` interface)
- Plan Refresh Schedules (5-row table: RECON/CIPHER/PHANTOM/PREDATOR/ECLIPSE)
- Retry & Error Handling
- robots.txt Compliance

- [ ] **Step 2: Overwrite docs/SCRAPER.md with new content**

Write the following as the complete file content:

```markdown
# SPECTER — Scraper Architecture

## Stack
- Language: Node.js 20 (TypeScript)
- Queue: BullMQ backed by Upstash Redis
- HTTP client: `got` v14 (probe + HTTP workers)
- Browser: Playwright Chromium via `playwright-extra`
- Stealth: `puppeteer-extra-plugin-stealth`
- Proxies: Bright Data residential (Playwright) + datacenter (probe/HTTP)
- CAPTCHA: 2captcha API
- robots.txt: `robots-parser` npm package

---

## 3-Tier Queue Architecture

Three separate BullMQ queues, all backed by the same Upstash Redis instance. Domain classification state (stored in Redis) determines which queue receives each job at dispatch time.

```
Scheduler (BullMQ repeat jobs by plan tier)
      ↓
[Redis lookup: domain:class:{domain}]
      ├── UNKNOWN      → scrape:probe
      ├── HTTP_OK      → scrape:http
      ├── JS_REQUIRED  → scrape:playwright
      └── BLOCKED      → no job created (merchant already notified)
```

### Queue Roles

| Queue | Purpose | Worker cost | Proxy |
|-------|---------|-------------|-------|
| `scrape:probe` | Classify unknown domains cheaply | Very low (no browser) | Datacenter (GET only) |
| `scrape:http` | Scrape HTTP_OK domains fast | Low (no browser) | Datacenter |
| `scrape:playwright` | Scrape JS_REQUIRED domains | High (Chromium) | Bright Data residential |

### Shared BullMQ Job Options (all queues)

```typescript
// queue.ts
import { Queue } from 'bullmq'
import { redis } from './redis'

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 60_000 },
  removeOnComplete: 100,
  removeOnFail: 500,
}

export const probeQueue = new Queue('scrape:probe', { connection: redis, defaultJobOptions })
export const httpQueue = new Queue('scrape:http', { connection: redis, defaultJobOptions })
export const playwrightQueue = new Queue('scrape:playwright', { connection: redis, defaultJobOptions })
```

### Queue Priority by Plan Tier (applies to all queues)

| Plan | BullMQ priority |
|------|----------------|
| ECLIPSE | 20 |
| PREDATOR | 10 |
| PHANTOM | 5 |
| CIPHER | 3 |
| RECON | 1 |

### Job Shape (shared across all queues)

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

## Domain Batching

Deduplication key: `${domain}:${url_path}`. Before queuing any job:
1. Check Redis for `scrape:lock:${domain}:${url_path}`
2. If lock exists: add `competitorUrlId` to existing job metadata (no new job created)
3. If no lock: create new job, set lock with TTL = plan's scrape interval

This means one outbound request serves all merchants tracking the same competitor URL.

---

## Domain Classification State Machine

Classification is stored in Redis as `domain:class:{domain}` with no TTL (permanent until reclassified by failure patterns or manual ops override).

### States

| State | Redis value | Meaning |
|-------|------------|---------|
| UNKNOWN | (key absent) | Never seen — route to scrape:probe |
| HTTP_OK | `"http_ok"` | SSR/static — price in HTML, use HTTP worker |
| JS_REQUIRED | `"js_required"` | Client-side rendered — needs Playwright |
| BLOCKED | `"blocked"` | robots.txt / hard bot wall — no scraping |

### State Transitions

```
UNKNOWN
  └── [scrape:probe runs]
        ├── price in HTML / SSR signals → HTTP_OK
        ├── JS framework / price absent → JS_REQUIRED
        └── 403 / robots.txt / bot wall → BLOCKED → merchant Resend email

HTTP_OK
  └── [scrape:http runs]
        ├── parse succeeds → stays HTTP_OK
        └── 3 consecutive parse failures → JS_REQUIRED
              └── re-enqueue pending job to scrape:playwright

JS_REQUIRED
  └── [scrape:playwright runs]
        ├── parse succeeds → stays JS_REQUIRED
        └── 3 consecutive failures + CAPTCHA unsolvable → BLOCKED
              └── merchant Resend email

BLOCKED
  └── no scraping; manual unblock only via ops admin endpoint
```

### Probe Heuristics (evaluated in priority order)

The probe worker applies these checks sequentially, stops at first match:

1. `robots.txt` disallows URL path → **BLOCKED** (robots.txt cached in Redis 24hr)
2. Response header `cf-mitigated: challenge` or Cloudflare JS challenge body → **JS_REQUIRED**
3. `<script id="__NEXT_DATA__">` in HTML → **HTTP_OK** (Next.js SSR)
4. `<script type="application/ld+json">` with `schema.org/Product` and `offers.price` → **HTTP_OK**
5. `window.__INITIAL_STATE__` / `ng-version` attribute / `id="__nuxt__"` → **JS_REQUIRED**
6. Price value found via CSS selector (`[data-price]`, `.price`, `#price`, `span.a-price`) → **HTTP_OK**
7. None matched → **JS_REQUIRED** (safe default)

---

## Worker Specifications

### Probe Worker (`workers/probe.ts`)

**Purpose:** Classify unknown domains. Writes no price data.

| Parameter | Value |
|-----------|-------|
| Concurrency | 50 (I/O-bound, no browser) |
| HTTP client | `got` v14, 10s timeout |
| Proxy on HEAD | None |
| Proxy on GET | Datacenter |

**Flow:**
1. HEAD request — inspect headers for bot detection signals
2. If bot wall detected → classify BLOCKED, stop
3. GET request via datacenter proxy
4. Fetch `robots.txt` (check Redis cache `robots:{domain}` first, TTL 24hr)
5. Run heuristics 1–7 in order → write classification to `domain:class:{domain}`
6. Enqueue scrape job to `scrape:http` or `scrape:playwright` based on result
7. If BLOCKED → POST to specter-api `/internal/domain-blocked` → merchant email via Resend

### HTTP Worker (`workers/http.ts`)

**Purpose:** Fast price extraction for HTTP_OK domains.

| Parameter | Value |
|-----------|-------|
| Concurrency | 30 per worker process |
| HTTP client | `got` v14, 15s timeout, brotli/gzip decompression |
| Proxy | Datacenter (~$1.50–2/GB) |
| Parse pipeline | JSON-LD → Open Graph price meta → CSS selectors |

**Flow:**
1. Check per-domain rate limit (see Rate Limiting section)
2. GET via datacenter proxy with spoofed `User-Agent` and `Accept-Language`
3. Run parse pipeline → `ParseResult`
4. Run data validation (see Data Validation section)
5. If valid → write to `price_snapshots`, POST to specter-api
6. If parse fails → increment `domain:http-fail:{domain}` counter
7. If counter reaches 3 → reclassify to `JS_REQUIRED`, re-enqueue to `scrape:playwright`, reset counter

**On HTTP 429:** `moveToDelayed` by `Retry-After` header (default 60s). Does not consume a retry attempt.

### Playwright Worker (`workers/playwright.ts`)

**Purpose:** Full browser scraping for JS-rendered pages.

| Parameter | Value |
|-----------|-------|
| Concurrency | 5 per worker process |
| Browser | Playwright Chromium (headless) via `playwright-extra` |
| Proxy | Bright Data residential ($8.40/GB) |
| Stealth | `puppeteer-extra-plugin-stealth` |

**Resource blocking** (reduces bandwidth and load time):
- Block: images, stylesheets, fonts, media, tracking scripts
- Allow: `document`, `script`, `xhr`, `fetch`
- Implemented via `page.route()`

**Stealth randomisation per browser context:**
- User-agent (desktop Chrome, randomised patch version)
- Viewport (1280–1920 × 720–1080)
- WebGL vendor/renderer strings
- Canvas fingerprint noise
- `navigator.language` and `Accept-Language`

**Browser context reuse:** One Chromium instance per worker process. New context per job. Context closed and refreshed every 50 jobs (prevents memory leak and fingerprint staleness).

**CAPTCHA:** On challenge page detection — screenshot → 2captcha API → inject solution → retry. If 2captcha fails after 2 attempts: job fails, BullMQ handles retry.

---

## Per-Domain Parsers

Located in `scraper/domains/`. Each exports:

```typescript
export interface ParseResult {
  price: number | null
  inStock: boolean
  currency: string
  title: string | null
}

export async function parse(page: Page): Promise<ParseResult>
```

Falls through to `domains/generic.ts` if no domain-specific parser exists.
Generic parser checks in order: JSON-LD `schema.org/Product`, Open Graph price meta, common CSS selectors.

Both HTTP and Playwright workers use the same `ParseResult` interface. HTTP worker passes a parsed HTML document; Playwright worker passes a `Page` object.

---

## Plan Refresh Schedules

| Plan | Interval | ms value | BullMQ repeat |
|------|----------|----------|---------------|
| RECON | 6hr | 21,600,000 | `{ every: 21600000 }` |
| CIPHER | 3hr | 10,800,000 | `{ every: 10800000 }` |
| PHANTOM | 2hr | 7,200,000 | `{ every: 7200000 }` |
| PREDATOR | 1hr | 3,600,000 | `{ every: 3600000 }` |
| ECLIPSE | 5–15min | 300,000–900,000 | `{ every: eclipseIntervalMs }` (merchant-configured, default 300000) |

---

## Per-Domain Rate Limiting

Redis sliding window counter applied in all three workers before any outbound request.

**Redis key:** `ratelimit:{domain}` (sliding 60-second window)

**Default limits (requests per minute):**

| Domain pattern | Limit/min |
|---------------|----------|
| `amazon.com`, `amazon.in`, `amazon.*` | 6 |
| `flipkart.com` | 10 |
| Shopify stores (`myshopify.com` or `Shopify` in response headers) | 30 |
| Unknown / generic | 20 |

**Ops override:** Per-domain config in Redis hash `ratelimit:config:{domain}` — takes precedence over defaults. Writable via admin endpoint without redeploy.

**On limit exceeded:** `moveToDelayed` by remaining window time. No retry count consumed.

---

## Data Validation Pipeline

Runs after every parse, before writing to `price_snapshots`. Failed validation does not fail the BullMQ job — write is skipped and failure is logged.

**Validation rules (all must pass to write):**

1. `price > 0 && isFinite(price)` — rejects null, NaN, negative
2. `price < 1_000_000` — sanity ceiling; flags scraper bugs
3. `currency` normalised to ISO 4217 three-letter code:
   - `Rs.` / `₹` → `INR` | `£` → `GBP` | `€` → `EUR` | `$` → `USD`
4. `inStock` is strict boolean (not null, undefined, or string)
5. Price change > 90% vs previous snapshot → write with `needs_review = true` (not suppressed)

**On validation failure:**
- Log to `scrape:validation-errors` BullMQ queue (inspectable by ops)
- If `competitor_url` has 0 valid snapshots in 24hr → POST to specter-api `/internal/parse-stalled` → merchant Resend email

---

## Proxy Configuration

| Worker | Proxy type | Est. cost/GB |
|--------|-----------|-------------|
| Probe (HEAD) | None | $0 |
| Probe (GET) | Datacenter | ~$1.50–2 |
| HTTP | Datacenter | ~$1.50–2 |
| Playwright | Bright Data residential | $8.40 |

HTTP_OK domains (estimated 40–60% of merchant URLs) use datacenter proxies, improving margins above the conservative values in `docs/PRICING.md`.

---

## Retry & Error Handling

- 3 retries per job, exponential backoff starting at 1 minute (applies to all queues)
- After 3 failures: job moves to `scrape:dead-letter` queue; POST to specter-api `/internal/scrape-failed`
- specter-api sends merchant email notification via Resend
- Domain-level failure tracking separate from job-level retry (see HTTP Worker flow above)

---

## robots.txt Compliance

On probe of any new domain:
1. Fetch `https://{domain}/robots.txt`
2. Parse with `robots-parser` npm package
3. If disallowed: classify BLOCKED, set `competitor_urls.robots_blocked = true`, notify merchant
4. Cache result in Redis key `robots:{domain}` with 24hr TTL
```

- [ ] **Step 3: Verify file renders correctly**

Open `docs/SCRAPER.md` and confirm all of the following are present:

- [ ] Stack section lists `got`, `playwright-extra`, `puppeteer-extra-plugin-stealth`
- [ ] 3-Tier Queue Architecture section with all 3 queue names and routing diagram
- [ ] Queue priority table (ECLIPSE=20 through RECON=1)
- [ ] `ScrapeJob` TypeScript type with `plan` field
- [ ] Domain batching section (unchanged from original)
- [ ] Domain Classification State Machine with 4 states and transitions
- [ ] 7 probe heuristics in numbered list
- [ ] Probe Worker spec (concurrency: 50)
- [ ] HTTP Worker spec (concurrency: 30)
- [ ] Playwright Worker spec (concurrency: 5) with stealth + resource blocking
- [ ] `ParseResult` interface (unchanged from original)
- [ ] Plan Refresh Schedules table (5 rows, RECON–ECLIPSE)
- [ ] Per-Domain Rate Limiting section with Redis key and limits table
- [ ] Data Validation Pipeline with 5 numbered rules and currency normalization
- [ ] Proxy Configuration table (4 rows)
- [ ] Retry & Error Handling (unchanged from original)
- [ ] robots.txt Compliance (unchanged from original)
- [ ] No references to old queue name `scrape` (replaced by `scrape:probe`, `scrape:http`, `scrape:playwright`)
- [ ] No references to SCOUT, SNIPER, or APEX tier names

- [ ] **Step 4: Commit**

```bash
git add docs/SCRAPER.md
git commit -m "docs: replace SCRAPER.md with 3-tier queue architecture (probe/http/playwright), domain classification, rate limiting, data validation"
```
