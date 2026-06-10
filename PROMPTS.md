# SPECTER — Development Prompts

Sequential Claude Code prompts for building SPECTER from scratch.
Each prompt is one focused session. Run them in order — Prompt N assumes
Prompt N-1 is committed and working.

**How to use:** Open Claude Code in the SPECTER repo root. Paste one prompt.
Run `npm run dev` / `uvicorn` after each prompt to verify before moving on.
Read `CLAUDE.md` before starting — it contains critical rules that apply to every session.

---

## Prompt 1: Project Scaffolding & Design System

**Phase:** Phase 0 — Pre-Development | **Repo:** both
**Read first:** `CLAUDE.md`, `docs/TECHSTACK.md`
**Builds on:** Starting point

No code exists yet. This prompt creates both repos from scratch, installs all dependencies, and wires up the design system so every subsequent prompt has a working foundation.

**Your task:** Scaffold specter-web (Next.js 14 App Router + Tailwind + shadcn/ui) and specter-api (FastAPI + Pydantic v2) with all design tokens, ESLint, Prettier, and confirm both dev servers start cleanly.

**Deliverables:**

- `specter-web/` — Next.js 14 app (App Router, TypeScript strict, Tailwind 3.4, shadcn/ui init complete)
- `specter-api/` — FastAPI app skeleton with Pydantic v2, SQLAlchemy 2.0, Alembic installed
- `specter-web/tailwind.config.ts` — design tokens from CLAUDE.md (`bg: '#06070D'`, `surface: '#0D0F1A'`, `border: '#1A1D2E'`, `primary: '#00E87A'`, `text: '#E8EAF0'`, `muted: '#6B7280'`)
- `specter-web/app/globals.css` — CSS custom properties + Tailwind base styles
- `specter-web/lib/utils.ts` — `cn()` utility (clsx + tailwind-merge)

**Key requirements:**

- TypeScript strict mode enabled (`"strict": true` in `tsconfig.json`)
- All three fonts configured via Next.js font system: Syne (display), DM Sans (body), JetBrains Mono (mono)
- shadcn/ui init complete — `components.json` present, `components/ui/` directory exists
- `.env.local` created (not committed) with all keys from CLAUDE.md environment variables section
- `specter-web/` and `specter-api/` each have their own `package.json` / `pyproject.toml`
- Never commit `.env` or `.env.local` (CLAUDE.md critical rule)

**Success criteria:**

- `npm run dev` in specter-web starts without compilation errors; `curl http://localhost:3000` returns 200
- `uvicorn main:app --reload` in specter-api logs `Application startup complete`
- `npm run lint` in specter-web returns zero errors
- `python -c "import fastapi, sqlalchemy, alembic, pydantic; print('ok')"` prints `ok`

---

## Prompt 2: Database Schema & Infrastructure

**Phase:** Phase 0 — Pre-Development | **Repo:** specter-api
**Read first:** `docs/ARCHITECTURE.md`
**Builds on:** Prompt 1

Both repos are scaffolded and dev servers start cleanly. This prompt creates all PostgreSQL tables as SQLAlchemy models with Alembic migrations and configures Supabase and Upstash Redis connections.

**Your task:** Implement all SPECTER database tables as SQLAlchemy 2.0 models, generate and run Alembic migrations against Supabase, and verify Upstash Redis connectivity.

**Deliverables:**

- `specter-api/models/` — SQLAlchemy models: `merchants`, `skus`, `competitor_urls`, `price_snapshots`, `signals`, `oos_alerts`, `price_changes`, `merchant_addons`
- `specter-api/alembic/` — Alembic config + initial migration file
- `specter-api/db.py` — async SQLAlchemy session factory + Supabase connection string from env
- `specter-api/redis_client.py` — Upstash Redis connection (ioredis-compatible URL from `UPSTASH_REDIS_URL` env var)

**Key requirements:**

- `merchants` table: `plan VARCHAR` accepting `'recon' | 'cipher' | 'phantom' | 'predator' | 'eclipse'`; `trial_ends_at TIMESTAMP`; `shopify_access_token VARCHAR` (encrypted); `read_only BOOLEAN DEFAULT false`; `eclipse_interval_ms INTEGER DEFAULT 300000`
- `competitor_urls` table: `robots_blocked BOOLEAN DEFAULT false`
- `price_snapshots` table: `needs_review BOOLEAN DEFAULT false`; `delete_at TIMESTAMP` (NULL = keep; set on PREDATOR downgrade for rows older than 30 days)
- `signals` table: `price_suggestion DECIMAL(10,2)` (NULL when rule-based), `source VARCHAR(4)` ('ai'|'rule'), `ai_fallback BOOLEAN`, `ai_model VARCHAR(32)` — from ARCHITECTURE.md AI Engine section
- `merchant_addons` table: `merchant_id`, `addon_type`, `quantity` columns
- Row-level security (RLS) enabled on all tables in Supabase
- All models importable without circular imports

**Success criteria:**

- `alembic upgrade head` exits 0
- `alembic current` shows the migration as applied
- `python -c "from models.merchants import Merchant; print('ok')"` prints `ok`
- `python -c "from redis_client import redis; print(redis.ping())"` prints `True`

---

## Prompt 3: Homepage Hero & Sections 1–8

**Phase:** Phase 1 — Marketing Site | **Repo:** specter-web
**Read first:** `docs/WEBSITE.md`, `CLAUDE.md`
**Builds on:** Prompt 2

Both repos are scaffolded with the DB schema in place. This prompt builds the first half of the 15-section marketing homepage: nav, the Three.js particle hero, and sections 2 through 8.

**Your task:** Implement `components/marketing/nav.tsx` and section components 1–8 (`hero.tsx` through `competitor-table.tsx`) following WEBSITE.md specs, wired into `app/(marketing)/page.tsx`.

**Deliverables:**

- `components/marketing/nav.tsx` — sticky, blur backdrop nav; logo left, links center, "Start Free Trial" CTA right; Tools mega-dropdown on hover; hamburger mobile menu
- `components/marketing/hero.tsx` — Three.js (React Three Fiber) particle field, "Know Before They Move" headline, waitlist CTA button
- `components/marketing/social-proof.tsx`
- `components/marketing/problem.tsx` — 3-card grid: Manual checking (8hr/wk), Missed OOS windows (2–7 day), Enterprise gap
- `components/marketing/product-demo.tsx` — animated RAISE/LOWER/HOLD signal cards with Framer Motion
- `components/marketing/oos-feature.tsx` — OOS timeline animation
- `components/marketing/attribution-feature.tsx` — Recharts bar chart animation (mock data)
- `components/marketing/domain-batching.tsx`
- `components/marketing/competitor-table.tsx`
- `app/(marketing)/page.tsx` — imports and renders sections 1–8 in sequence

**Key requirements:**

- Three.js / React Three Fiber ONLY imported in `(marketing)/page.tsx` components — never in dashboard or tool pages (CLAUDE.md critical rule)
- Lenis smooth scroll added to `app/layout.tsx` wrapping the root
- GSAP ScrollTrigger scroll-reveal animations on section entry
- Framer Motion `initial={{ opacity: 0, y: 20 }}` transitions on component mount
- All design tokens used via Tailwind classes (`bg-bg`, `bg-surface`, `text-primary`, etc.)
- `cn()` from `lib/utils.ts` used for all conditional class merging (CLAUDE.md critical rule)

**Success criteria:**

- `npm run build` exits 0 with no TypeScript errors
- `npm run lint` exits 0
- `curl http://localhost:3000` returns 200; particle hero visible in browser with animation

---

## Prompt 4: Homepage Sections 9–15 & Auth Pages

**Phase:** Phase 1 — Marketing Site | **Repo:** specter-web
**Read first:** `docs/WEBSITE.md`, `docs/PRICING.md`
**Builds on:** Prompt 3

Sections 1–8 of the marketing homepage are complete. This prompt adds sections 9–15 (pricing through footer) and the Clerk-powered auth pages.

**Your task:** Build marketing section components 9–15 and wire them into `app/(marketing)/page.tsx`, then add Clerk sign-in/sign-up pages and the dashboard auth middleware.

**Deliverables:**

- `components/marketing/pricing-section.tsx` — 5-tier cards with monthly/annual toggle, free trial badge
- `components/marketing/integrations.tsx`
- `components/marketing/tools-cta.tsx` — 6-tool grid with icons, 1-line descriptions, links
- `components/marketing/testimonials.tsx`
- `components/marketing/faq.tsx` — shadcn `Accordion` component
- `components/marketing/final-cta.tsx`
- `components/marketing/footer.tsx`
- `app/(auth)/sign-in/[[...sign-in]]/page.tsx` — Clerk `<SignIn />` component
- `app/(auth)/sign-up/[[...sign-up]]/page.tsx` — Clerk `<SignUp />` component
- `middleware.ts` — `clerkMiddleware()` protecting `/dashboard/*`

**Key requirements:**

- Pricing cards show exact tier data from PRICING.md: RECON $79/100 SKUs/6hr, CIPHER $249/500 SKUs/3hr, PHANTOM $699/1,000 SKUs/2hr, PREDATOR $1,799/2,000 SKUs/1hr, ECLIPSE Custom
- Annual toggle applies 20% discount to RECON/CIPHER/PHANTOM/PREDATOR; ECLIPSE shows "Contact sales" — no toggle
- shadcn `Accordion` from `components/ui/accordion.tsx` used for FAQ (do not hand-edit shadcn components)
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` in `.env.local` match middleware config

**Success criteria:**

- `npm run build` exits 0
- localhost:3000 renders all 15 sections without layout breaks
- `/sign-in` loads the Clerk sign-in widget without errors
- Visiting `/dashboard` without auth session redirects to `/sign-in`

---

## Prompt 5: Six Free Calculator Tools

**Phase:** Phase 1 — Marketing Site | **Repo:** specter-web
**Read first:** `docs/TOOLS.md`
**Builds on:** Prompt 4

The full 15-section marketing site is live. This prompt builds all 6 client-side calculator tools as standalone Next.js pages with pure browser math and Vitest unit tests.

**Your task:** Implement all 6 tool pages under `app/tools/` with a shared layout component, calculation logic in `lib/tools/`, Vitest unit tests for every formula, and zero API calls.

**Deliverables:**

- `components/tools/tool-layout.tsx` — shared wrapper: hero pill → calculator card → results panel → SPECTER CTA
- `app/tools/amazon-fba-calculator/page.tsx`
- `app/tools/shopify-profit-calculator/page.tsx`
- `app/tools/shipping-calculator/page.tsx`
- `app/tools/price-position-analyzer/page.tsx`
- `app/tools/roas-calculator/page.tsx`
- `app/tools/inventory-reorder-calculator/page.tsx`
- `lib/tools/fba.ts`, `shopify-profit.ts`, `shipping.ts`, `price-position.ts`, `roas.ts`, `inventory.ts` — pure calculation functions (no side effects)
- `lib/tools/shipping-rates.ts` — static carrier rate tables (UPS, FedEx, USPS, DHL) — no API calls
- `__tests__/tools/` — Vitest unit tests for every formula in TOOLS.md

**Key requirements:**

- ZERO API calls from any tool page — never call specter-api from tool pages (CLAUDE.md critical rule)
- FBA: dimensional weight = `(L × W × H) / 139`; billable = `max(actual, dim)`; `net_profit = selling_price - product_cost - fulfillment_fee - referral_fee - monthly_storage`
- Shopify: `true_profit = gross_profit - shopify_fees - processing_fees - app_spend - returns_cost - shipping_total - ad_spend`
- Inventory: Wilson EOQ = `sqrt((2 × annual_demand × order_cost) / holding_cost)`; z-scores = `{90%: 1.28, 95%: 1.645, 99%: 2.326}`
- Vitest unit tests cover: FBA net_profit, Shopify true_profit, shipping dim_weight, price position gap_pct + signal, ROAS break_even_roas, EOQ, safety_stock
- Do NOT add tests for marketing section or tool layout components (CLAUDE.md critical rule)

**Success criteria:**

- `npm test` exits 0 with all formula unit tests passing
- `npm run build` exits 0; all 6 tool routes appear in build output
- localhost:3000/tools/amazon-fba-calculator loads and calculates correctly with sample inputs

---

## Prompt 6: BullMQ Queue Architecture & Scheduler

**Phase:** Phase 2 — Scraping Engine | **Repo:** specter-api
**Read first:** `docs/SCRAPER.md`
**Builds on:** Prompt 5

The full marketing site and tools are live. This prompt builds the BullMQ queue infrastructure and the scheduler that dispatches scrape jobs by plan tier and domain classification — the backbone of SPECTER's scraping engine.

**Your task:** Implement all BullMQ queues, the `ScrapeJob` type, plan priority mapping, domain batching lock, and scheduler repeat jobs dispatched by `domain:class:{domain}` Redis state.

**Deliverables:**

- `scraper/queue.ts` — all 6 queues: `scrape:probe`, `scrape:http`, `scrape:playwright`, `scrape:dead-letter`, `scrape:validation-errors`, `scrape:ai-errors`; shared `defaultJobOptions` (attempts: 3, exponential backoff delay: 60000, removeOnComplete: 100, removeOnFail: 500)
- `scraper/types.ts` — `ScrapeJob` type: `{ url, domain, urlPath, competitorUrlIds: string[], plan: 'recon' | 'cipher' | 'phantom' | 'predator' | 'eclipse' }`
- `scraper/scheduler.ts` — BullMQ repeat jobs per plan tier; reads `domain:class:{domain}` Redis key to route to correct queue; domain batching lock logic
- `scraper/redis.ts` — Upstash Redis connection for BullMQ

**Key requirements:**

- Plan BullMQ priorities: ECLIPSE=20, PREDATOR=10, PHANTOM=5, CIPHER=3, RECON=1
- Repeat intervals: RECON=21600000ms, CIPHER=10800000ms, PHANTOM=7200000ms, PREDATOR=3600000ms, ECLIPSE=merchant-configured (default 300000ms)
- Domain batching: check `scrape:lock:{domain}:{urlPath}` before queuing; if lock exists, add `competitorUrlId` to existing job metadata (no new job); if no lock, create job + set lock with TTL = plan interval
- `plan` field in `ScrapeJob` is lowercase ('recon', not 'RECON') — priority lookup via `PLAN_PRIORITY[job.plan.toUpperCase()]`
- `scrape:ai-errors` queue has NO worker — ops inspection only; still must be instantiated
- BLOCKED domains: no job created

**Success criteria:**

- `npx ts-node scraper/scheduler.ts` starts without TypeScript errors
- `scraper/types.ts` exports `ScrapeJob` type with correct shape
- BullMQ queues instantiate without errors (verify via `queue.getJobCounts()`)
- Domain batching logic: second call for same `domain:urlPath` updates existing job, does not create second job

---

## Prompt 7: Probe Worker & Domain Classification

**Phase:** Phase 2 — Scraping Engine | **Repo:** specter-api
**Read first:** `docs/SCRAPER.md`
**Builds on:** Prompt 6

Queue infrastructure and scheduler are in place. This prompt builds the probe worker that classifies unknown domains cheaply via HEAD + GET before routing to the correct scrape queue.

**Your task:** Build `workers/probe.ts` — a BullMQ worker (concurrency 50) that runs HEAD bot detection, GET via datacenter proxy, robots.txt caching, and 7 classification heuristics to write `domain:class:{domain}` and notify specter-api on BLOCKED domains.

**Deliverables:**

- `scraper/workers/probe.ts` — concurrency 50; HEAD → GET flow; heuristics 1–7; writes `domain:class:{domain}`; enqueues follow-up job; POSTs to specter-api on BLOCKED
- `scraper/workers/robots.ts` — `robots-parser` wrapper with Redis cache (`robots:{domain}`, 24hr TTL)

**Key requirements:**

- Heuristics applied in exact order (stop at first match): (1) robots.txt disallowed → BLOCKED; (2) `cf-mitigated: challenge` header or Cloudflare JS challenge body → JS_REQUIRED; (3) `<script id="__NEXT_DATA__">` → HTTP_OK; (4) JSON-LD `schema.org/Product` with `offers.price` → HTTP_OK; (5) `window.__INITIAL_STATE__` / `ng-version` / `id="__nuxt__"` → JS_REQUIRED; (6) CSS selectors `[data-price]`, `.price`, `#price`, `span.a-price` found → HTTP_OK; (7) none matched → JS_REQUIRED
- BLOCKED via bot wall (HEAD step): POST `/internal/domain-blocked` to specter-api; do NOT set `robots_blocked` flag
- BLOCKED via robots.txt (heuristic 1): POST `/internal/domain-blocked` to specter-api AND set `competitor_urls.robots_blocked = true`
- HEAD uses no proxy; GET uses datacenter proxy
- Concurrency: 50 (I/O-bound, no browser)

**Success criteria:**

- Worker processes a test job without TypeScript errors
- `domain:class:{domain}` Redis key written after probe completes
- Heuristic 3 (`__NEXT_DATA__`) correctly classifies a Next.js SSR domain as HTTP_OK
- Heuristic 1 (robots.txt) triggers BLOCKED and caches result in `robots:{domain}` with 24hr TTL

---

## Prompt 8: HTTP Worker & Data Validation

**Phase:** Phase 2 — Scraping Engine | **Repo:** specter-api
**Read first:** `docs/SCRAPER.md`
**Builds on:** Prompt 7

Probe worker classifies domains into Redis state. This prompt builds the HTTP worker that fast-scrapes HTTP_OK domains using `got` v14 and validates parsed data before writing to `price_snapshots`.

**Your task:** Build `workers/http.ts` with per-domain rate limiting, `got` v14 GET via datacenter proxy, parse pipeline (JSON-LD → Open Graph → CSS), and the 5-rule data validation pipeline gating writes to `price_snapshots`.

**Deliverables:**

- `scraper/workers/http.ts` — concurrency 30; rate limit check; got v14 GET with brotli/gzip; parse pipeline; validation; price_snapshot POST; failure counter logic
- `scraper/workers/rate-limiter.ts` — sliding 60s window counter (`ratelimit:{domain}`), defaults table, ops override via `ratelimit:config:{domain}` Redis hash
- `scraper/domains/generic.ts` — `parseHtml(html: string): ParseResult` (sync, no browser); covers JSON-LD, Open Graph price meta, CSS selectors

**Key requirements:**

- Parse pipeline order: JSON-LD (`schema.org/Product` + `offers.price`) → Open Graph `og:price:amount` → CSS selectors (`[data-price]`, `.price`, `#price`, `span.a-price`)
- Data validation — all 5 rules must pass to write: `price > 0 && isFinite(price)`; `price < 1_000_000`; currency normalised to ISO 4217 (Rs./₹→INR, £→GBP, €→EUR, $→USD); `inStock` is strict boolean; price change >90% vs previous → write with `needs_review = true` (not suppressed)
- On validation failure: log to `scrape:validation-errors` queue (not a BullMQ job failure)
- On HTTP 429: `moveToDelayed` by `Retry-After` value (default 60s) — does NOT consume a retry attempt
- Failure counter `domain:http-fail:{domain}`: increment on parse fail; DEL (reset) on any successful parse; at 3 → reclassify to JS_REQUIRED, re-enqueue to `scrape:playwright`
- Rate limits (requests/min): `amazon.*`=6, `flipkart.com`=10, Shopify stores=30, unknown=20

**Success criteria:**

- `npm test` passes for HTTP worker unit tests (validation rules, currency normalisation, parse pipeline order)
- Worker processes a static HTML fixture with JSON-LD price → writes price_snapshot row
- Invalid HTML (no price) logs to `scrape:validation-errors` queue; job does NOT fail
- `domain:http-fail:{domain}` counter increments on parse failure and resets on success

---

## Prompt 9: Playwright Worker & Per-Domain Parsers

**Phase:** Phase 2 — Scraping Engine | **Repo:** specter-api
**Read first:** `docs/SCRAPER.md`
**Builds on:** Prompt 8

HTTP worker handles static/SSR sites; JS-rendered sites are routed to Playwright. This prompt builds the Playwright worker with full stealth configuration, browser context reuse, 2captcha CAPTCHA solving, and the per-domain parser system.

**Your task:** Build `workers/playwright.ts` with `playwright-extra` + stealth plugin, resource blocking, per-context stealth randomisation, browser context refresh every 50 jobs, 2captcha integration, and the `scraper/domains/` parser routing system.

**Deliverables:**

- `scraper/workers/playwright.ts` — concurrency 5; playwright-extra + puppeteer-extra-plugin-stealth; resource blocking via `page.route()`; stealth randomisation; context reuse every 50 jobs; CAPTCHA detection + 2captcha API
- `scraper/domains/generic.ts` — adds `parse(page: Page): Promise<ParseResult>` alongside `parseHtml(html: string): ParseResult` from Prompt 8 (both exported from same file)
- `scraper/domains/index.ts` — domain router: given a domain string, returns the correct parser module; falls through to `generic` if no specific parser exists

**Key requirements:**

- Resource blocking: block `image`, `stylesheet`, `font`, `media`, tracking scripts; allow `document`, `script`, `xhr`, `fetch` — implemented via `page.route()`
- Stealth randomisation per new context: random desktop Chrome User-Agent (random patch version), viewport 1280–1920 × 720–1080, WebGL vendor/renderer strings, canvas fingerprint noise, `navigator.language` + `Accept-Language` header
- Context lifecycle: one Chromium instance per worker process; new context per job; close and create fresh context every 50 jobs
- CAPTCHA: detect challenge page → screenshot → 2captcha API → inject solution → retry; if 2captcha fails after 2 attempts → job fails (BullMQ retry mechanism handles backoff)
- Proxy: Bright Data ISP residential for all Playwright jobs
- `generic.ts` exports BOTH `parse(page: Page)` (async, Playwright) AND `parseHtml(html: string)` (sync, HTTP) — HTTP worker uses `parseHtml`, Playwright worker uses `parse`

**Success criteria:**

- `npx ts-node scraper/workers/playwright.ts` starts without TypeScript errors
- `scraper/domains/generic.ts` exports both `parse` and `parseHtml` functions
- `scraper/domains/index.ts` returns `generic` module for an unrecognized domain
- Resource blocking verified: image requests return `abort` in route handler

---

## Prompt 10: Rule-Based Signal Engine

**Phase:** Phase 3 — Signal & AI Engine | **Repo:** specter-api
**Read first:** `docs/FEATURES.md` (F4), `docs/ARCHITECTURE.md`
**Builds on:** Prompt 9

Scrapers write `price_snapshots` rows after each job. This prompt builds the Python rule-based signal engine that reads new snapshots for RECON merchants and emits RAISE/LOWER/HOLD signals with confidence scoring, duplicate suppression, and OOS detection.

**Your task:** Implement the rule-based signal engine (F4), a signal dispatcher that routes by merchant plan, and OOS detection writing to `oos_alerts`.

**Deliverables:**

- `specter-api/signals/rule_engine.py` — RAISE/LOWER/HOLD logic, confidence scoring, 1hr duplicate suppression
- `specter-api/signals/dispatcher.py` — triggered on `price_snapshot` insert; reads `merchant.plan`; routes RECON → rule engine; CIPHER+ → AI engine stub (placeholder for Prompt 11)
- `specter-api/signals/oos_detector.py` — detects `in_stock` true→false transition; writes `oos_alerts` row; deduplicates within same scrape cycle

**Key requirements:**

- RAISE: any tracked competitor `price > merchant.current_price` AND competitor `in_stock = true`
- LOWER: `merchant.current_price > 1.05 × median(all tracked competitor prices)`
- HOLD: merchant price within ±2% of median competitor price
- Confidence score 0–1: capped at 0.6 when fewer than 2 in-stock competitors present
- Duplicate suppression: Redis key `signal:dedup:{sku_id}:{signal_type}` with TTL 3600s — same signal not re-emitted within 1hr
- Signals written with `source='rule'`, `ai_fallback=False`, `price_suggestion=None`
- OOS deduplication: if in_stock flips true→false→true within same cycle, send 1 alert only

**Success criteria:**

- `pytest signals/test_rule_engine.py` passes — RAISE, LOWER, HOLD each correctly triggered from fixture data
- Duplicate suppression test: calling engine twice in <1hr for same SKU + signal type inserts only 1 row
- OOS detection test: in_stock true→false transition inserts `oos_alerts` row
- All signals have `source='rule'` and `ai_fallback=False` in DB

---

## Prompt 11: Gemini AI Signal Engine

**Phase:** Phase 3 — Signal & AI Engine | **Repo:** specter-api
**Read first:** `docs/AI_PRICING.md`, `docs/FEATURES.md` (F11)
**Builds on:** Prompt 10

Rule-based signal engine handles RECON merchants and serves as fallback. This prompt builds the Gemini AI engine for CIPHER+ merchants — mini-batch Gemini calls, response validation, Redis response caching, transparent fallback to rule-based, and ops metrics.

**Your task:** Implement the Gemini AI signal engine: ≤50 SKU mini-batches, prompt construction per AI_PRICING.md, response validation, SHA-256 Redis cache, fallback logic writing to `scrape:ai-errors`, and ops counter — then wire into the dispatcher from Prompt 10.

**Deliverables:**

- `specter-api/signals/ai_engine.py` — Gemini 1.5 Pro mini-batch, prompt construction, response validation, price_suggestion clamping, signals written with `source='ai'`
- `specter-api/signals/cache.py` — SHA-256 hash, Redis cache read/write (`ai:signal:{sku_id}:{snapshot_hash}`, TTL = plan interval)
- `specter-api/signals/fallback.py` — rule engine for affected SKUs on Gemini failure; logs to `scrape:ai-errors` BullMQ queue; increments `ai:fallback:count:{merchant_id}` Redis counter (sliding 24hr window)

**Key requirements:**

- Batching: sort SKUs by SKU ID, chunk into ≤50, dispatch sequentially (NOT parallel — avoid rate limit burst)
- Cache hash formula: `hashlib.sha256(json.dumps(sorted(competitors, key=lambda c: c['domain']), sort_keys=True, separators=(',', ':')).encode()).hexdigest()` — excludes `scraped_at` field, sorts by domain alphabetically
- Cache TTL by plan: CIPHER=10800s, PHANTOM=7200s, PREDATOR=3600s, ECLIPSE=merchant-configured interval
- Response validation (all must pass per SKU): valid JSON array; `signal` in `['RAISE','LOWER','HOLD']`; `confidence` float 0.0–1.0; `reasoning` non-empty string; `price_suggestion` clamped to `[floor_price, ceiling_price]` if non-null
- Fallback triggers: timeout >10s → 1 retry after 3s → fallback; invalid JSON → no retry, fallback batch; HTTP 429 → `moveToDelayed` by `Retry-After` (no retry count consumed); quota exceeded → fallback all + ops PagerDuty alert
- `scrape:ai-errors` queue entry fields: `merchant_id`, `batch_size`, `error_type`, `timestamp` — written from Python using `bullmq-python` library (or direct BullMQ-compatible Redis key format); the queue is defined in TypeScript (Prompt 6) but any language can enqueue using BullMQ's Redis data structure
- `confidence` capped at 0.6 when fewer than 2 in-stock competitors (mirrors rule-based engine)

**Success criteria:**

- `pytest signals/test_ai_engine.py` passes — mock Gemini returns valid JSON; signals stored with `source='ai'`
- Cache hit test: second call with same `snapshot_hash` returns cached signal without calling Gemini
- Fallback test: Gemini timeout → rule-based fires → signal stored with `source='rule'`, `ai_fallback=True`
- `scrape:ai-errors` queue receives one entry per fallback event

---

## Prompt 12: Auth, Plan Gating & Core API Routes

**Phase:** Phase 4 — Dashboard & Core Product | **Repo:** both
**Read first:** `docs/FEATURES.md` (F1–F2), `docs/ARCHITECTURE.md`
**Builds on:** Prompt 11

Signal engine is complete for all tiers. This prompt wires Clerk JWT into specter-api, implements `FEATURE_GATES` plan gating, builds core API routers (merchants, SKUs, competitors), and adds the Shopify OAuth onboarding flow.

**Your task:** Implement Clerk JWT middleware, plan gate middleware with `FEATURE_GATES`, merchants/SKUs/competitors FastAPI routers, Shopify OAuth flow, and TanStack Query hooks in specter-web.

**Deliverables:**

- `specter-api/auth/clerk.py` — validates Clerk JWT from `Authorization: Bearer` header; extracts `merchant_id`
- `specter-api/auth/plan_gate.py` — `requires_plan(feature, merchant_plan) -> bool`; `FEATURE_GATES` dict; `PLAN_HIERARCHY` list; 403 response on denial
- `specter-api/routers/merchants.py` — merchant profile CRUD; `GET /merchants/shopify/oauth`; `GET /merchants/shopify/callback`
- `specter-api/routers/skus.py` — list/create SKUs; SKU count; floor/ceiling price update per SKU
- `specter-api/routers/competitors.py` — add/list/delete competitor URLs; validate reachability; queue probe job immediately on add
- `specter-web/lib/api.ts` — TanStack Query hooks for merchants, SKUs, and competitors endpoints (signals and alerts hooks added in Prompt 13 when those routers exist)

**Key requirements:**

- `FEATURE_GATES` dict exactly: `auto_reprice: 'cipher'`, `attribution: 'phantom'`, `webhooks: 'phantom'`, `history_90d: 'predator'`, `priority_queue: 'predator'`, `dedicated_workers: 'eclipse'`, `ai_signals: 'cipher'`
- 403 format on plan gate denial: `{"error": "upgrade_required", "required_plan": "cipher"}`
- Shopify OAuth callback: store access token encrypted in `merchants.shopify_access_token`; trigger SKU import job; return redirect to dashboard
- First competitor URL scrape: `POST /competitors` queues a probe job immediately (not on next scheduled run) — F2 AC#4
- Token expiry detection: on any Shopify API 401, mark merchant for reconnect; dashboard shows "Reconnect" prompt (not silent failure) — F1 AC#6
- Plan gating enforced server-side in specter-api; frontend shows upgrade prompts only as UI — backend is the gate (CLAUDE.md critical rule)

**Success criteria:**

- `GET /skus` returns 401 without valid Clerk JWT
- `GET /skus` with valid JWT + insufficient plan for a gated feature returns 403 with `upgrade_required`
- `POST /competitors` with a valid URL queues a probe job immediately (visible in BullMQ job counts)
- `pytest routers/test_merchants.py` passes (JWT validation, plan gate, Shopify OAuth mock)

---

## Prompt 13: Dashboard Pages: Signals, Competitors & Alerts

**Phase:** Phase 4 — Dashboard & Core Product | **Repo:** both
**Read first:** `docs/FEATURES.md` (F3–F6)
**Builds on:** Prompt 12

Auth, plan gating, and core routers are wired. This prompt builds the four primary dashboard pages — overview, signals feed, competitor management, and OOS alert log — all pulling live data from specter-api with 60s refetch.

**Your task:** Build `/dashboard`, `/signals`, `/competitors`, and `/alerts` Next.js pages with TanStack Query 60s refetch, add the specter-api signal and alert router endpoints, and implement the shared dashboard component library.

**Deliverables:**

- `specter-api/routers/signals.py` — paginated signal list filtered by `merchant_id` + plan; last-24hr RAISE/LOWER/HOLD counts
- `specter-api/routers/alerts.py` — OOS alert list (active + resolved); `PATCH /alerts/{id}/silence`
- `specter-web/app/(dashboard)/dashboard/page.tsx` — stat cards: RAISE/LOWER/HOLD counts (24hr), revenue recovered MTD, active OOS count; last 10 signal feed
- `specter-web/app/(dashboard)/signals/page.tsx` — paginated signal feed with type badge, SKU name, confidence, reasoning, time-ago
- `specter-web/app/(dashboard)/competitors/page.tsx` — URL list with status badges (Tracking / Failed / Blocked); add URL form; delete button
- `specter-web/app/(dashboard)/alerts/page.tsx` — OOS alert log with resolve status; silence toggle per URL
- `specter-web/components/dashboard/signal-badge.tsx`, `stat-card.tsx`, `empty-state.tsx`

**Key requirements:**

- TanStack Query `refetchInterval: 60_000` on all dashboard data hooks — F6 AC#5
- Empty state component shown for new accounts (0 signals, 0 competitors, 0 alerts) — not a broken/blank screen — F6 AC#6
- Signal feed shows: type badge (color-coded RAISE=green/LOWER=red/HOLD=gray), SKU name, confidence %, reasoning text, time-ago
- Competitor page shows "Cannot track this URL" with explanation for `robots_blocked = true` URLs — F2 edge case
- Revenue recovered MTD: `SUM(price_changes.revenue_delta WHERE source='auto')` — F6 AC#2; returns 0 on new accounts (repricer built in Prompt 14 writes these rows — show $0 with empty state, not an error)
- OOS alert auto-resolves on `in_stock` true transition (handled by specter-api) — F5 AC#5
- Extend `specter-web/lib/api.ts` from Prompt 12 with signals and alerts TanStack Query hooks

**Success criteria:**

- `npm run build` exits 0
- `/dashboard` loads with empty state (no seeded data) without errors or blank sections
- TanStack Query refetch visible in browser Network tab at 60s intervals
- `GET /signals` returns 200 with paginated list filtered by authenticated merchant_id

---

## Prompt 14: Attribution, Repricing, OOS Emails & Settings

**Phase:** Phase 4 — Dashboard & Core Product | **Repo:** both
**Read first:** `docs/FEATURES.md` (F7–F8), `docs/AI_PRICING.md`
**Builds on:** Prompt 13

Core dashboard pages are complete. This prompt builds the auto-repricing engine (CIPHER+), revenue attribution (PHANTOM+), their dashboard pages, transactional email notifications, and the /settings page.

**Your task:** Implement the auto-reprice service, attribution engine, `/repricing` and `/attribution` pages, Resend email notifications for OOS/scrape-failure/domain-blocked events, and the `/settings` page.

**Deliverables:**

- `specter-api/services/repricer.py` — applies price changes via Shopify Admin API; floor/ceiling enforcement; writes `price_changes` row; 3x retry on Shopify failure
- `specter-api/services/attribution.py` — fetches Shopify Orders API 24hr post-change; computes `revenue_delta`; updates `price_changes.revenue_delta`
- `specter-api/routers/repricing.py` — floor/ceiling CRUD (CIPHER+ gated); price change history endpoint
- `specter-api/routers/attribution.py` — bar chart data endpoint: date vs revenue_delta (PHANTOM+ gated); CSV export endpoint
- `specter-api/services/email.py` — Resend SDK wrapper: OOS alert email, scrape failure email, domain-blocked email
- `specter-web/app/(dashboard)/repricing/page.tsx` — CIPHER+ gated; floor/ceiling inputs per SKU; AI price suggestion display; price change log
- `specter-web/app/(dashboard)/attribution/page.tsx` — PHANTOM+ gated; Recharts bar chart; "recovered" vs "lost" totals; CSV export button
- `specter-web/app/(dashboard)/settings/page.tsx` — Shopify connect/reconnect button; plan tier badge; notification preferences

**Key requirements:**

- RAISE formula: `new_price = min(min_instock_competitor_price - 0.01, ceiling_price)` — F7 AC#3
- LOWER formula: `new_price = max(median_competitor_price - 0.01, floor_price)` — F7 AC#4
- Price change applied within 5 minutes of signal via Shopify Admin API — F7 AC#5
- `revenue_delta = (new_price - old_price) × units_sold_in_next_24hr` — F8 AC#2
- OOS email sent via Resend within 2 minutes of `oos_alerts` insert; includes: competitor name, OOS'd SKU, direct link to /repricing — F5 AC#3–4
- `/repricing` shows 403-based upgrade prompt when accessed with RECON plan (plan gate enforced in specter-api, frontend renders upgrade UI)
- CSV export: `Content-Disposition: attachment; filename="attribution.csv"` with date, sku, old_price, new_price, revenue_delta columns

**Success criteria:**

- `pytest services/test_repricer.py` passes — floor-clamp test, ceiling-clamp test, Shopify API mock 3x retry
- `pytest services/test_attribution.py` passes — revenue_delta calculation correct with fixture order data
- `npm run build` exits 0
- `/repricing` renders upgrade prompt when JWT has RECON plan; renders floor/ceiling form for CIPHER plan

---

## Prompt 15: Razorpay Billing & Subscriptions

**Phase:** Phase 5 — Production | **Repo:** specter-api
**Read first:** `docs/PRICING.md`, `docs/FEATURES.md`
**Builds on:** Prompt 14

Dashboard, repricing, and attribution are complete. This prompt wires in Razorpay so merchants can self-serve subscribe, upgrade, downgrade, add add-ons, and receive trial expiry reminders.

**Your task:** Implement Razorpay subscription creation, `POST /billing/webhook` handler, plan upgrade/downgrade logic, add-on management, and scheduled trial expiry emails at day 12 and day 14 via Resend.

**Deliverables:**

- `specter-api/routers/billing.py` — `POST /billing/subscribe`, `POST /billing/upgrade`, `POST /billing/downgrade`, `POST /billing/addon`, `DELETE /billing/addon/{id}`, `POST /billing/webhook`
- `specter-api/services/billing.py` — Razorpay Python SDK wrapper; webhook HMAC-SHA256 signature verification
- `specter-api/services/trial_monitor.py` — scheduled job: sends day-12 and day-14 reminder emails; sets account to read-only on day 15 without payment

**Key requirements:**

- Webhook signature verified with Razorpay webhook secret before processing any event — reject unsigned requests with 400
- Plan upgrade: immediate on `subscription.activated` / `subscription.charged` webhook; update `merchants.plan` in DB
- Plan downgrade: immediate; SKUs above new plan limit set `active=false` (not deleted); all `merchant_addons` rows deleted immediately on downgrade — PRICING.md
- Annual discount 20%: applied via Razorpay plan ID selection (separate monthly/annual plan IDs in env); ECLIPSE has no self-serve flow
- Add-on cap: max 3 active `merchant_addons` rows per merchant; 4th add-on rejected with `{"error": "addon_limit_reached"}`
- Trial expiry day 15 without payment: `merchants.read_only = true`; scraper scheduler skips read-only merchants
- Trial reminder emails via Resend: day-12 "2 days left"; day-14 "Last day — add payment today"

**Success criteria:**

- `pytest routers/test_billing.py` passes — webhook signature verification (valid + tampered), plan switch, add-on cap enforcement
- Simulated `subscription.activated` webhook → `merchants.plan` updated in DB
- Simulated downgrade → SKUs above limit have `active=false`; all add-ons deleted
- Trial expiry job test: Resend called with correct template at day 12 and day 14 (mock Resend)

---

## Prompt 16: PREDATOR & ECLIPSE Enterprise Features

**Phase:** Phase 5 — Production | **Repo:** specter-api
**Read first:** `docs/FEATURES.md` (F9–F10)
**Builds on:** Prompt 15

Billing is complete. This prompt adds the final enterprise tier features: PREDATOR priority enforcement, 90-day data retention, date range pickers, and ECLIPSE dedicated worker routing.

**Your task:** Implement PREDATOR 90-day retention, date range query params on /signals and /attribution, data retention job by tier, and ECLIPSE dedicated worker routing with shared-worker fallback.

**Deliverables:**

- `specter-api/routers/signals.py` — add `date_from` / `date_to` query params; PREDATOR+ allows 90-day range; all others capped at 30-day range
- `specter-api/services/retention.py` — scheduled job: delete `price_snapshots` older than 90 days for PREDATOR/ECLIPSE merchants; 30 days for all others; on PREDATOR downgrade, retain excess data for 7 more days then delete
- `specter-api/workers/eclipse_router.py` — routes ECLIPSE scrape jobs to `ECLIPSE_WORKER_URL` env var; on 503/timeout from dedicated worker → re-queue to shared scrape:playwright; sends merchant notification within 15 min of failure
- `specter-web/app/(dashboard)/signals/page.tsx` — add shadcn DateRangePicker for PREDATOR+; non-PREDATOR users see 30-day max and upgrade prompt for wider range

**Key requirements:**

- PREDATOR BullMQ priority 10 confirmed in scheduler (set in Prompt 6) — verify, do not change
- 90-day date picker max: PREDATOR/ECLIPSE plan → allow `date_from` up to 90 days ago; CIPHER/PHANTOM → cap at 30 days ago; reject out-of-range with 400 + `{"error": "range_exceeds_plan", "max_days": 30}`
- PREDATOR downgrade: `price_snapshots` older than 30 days → set `delete_at = NOW() + INTERVAL '7 days'`; retention job respects `delete_at`
- ECLIPSE refresh interval: 5–15 min, merchant-configured in `/settings`; stored in `merchants.eclipse_interval_ms`
- Priority badge in `/settings` for PREDATOR+ — shown from `merchant.plan` value in JWT

**Success criteria:**

- `pytest routers/test_signals.py` passes — 90-day range allowed for PREDATOR; 30-day max for CIPHER (400 on wider request)
- `pytest services/test_retention.py` passes — rows older than correct threshold deleted by tier
- ECLIPSE router fallback test: mocked `ECLIPSE_WORKER_URL` returns 503 → job re-queued to `scrape:playwright` shared queue

---

## Prompt 17: Railway Deployment & Observability

**Phase:** Phase 5 — Production | **Repo:** both
**Read first:** `docs/ARCHITECTURE.md`, `docs/DEVPLAN.md`
**Builds on:** Prompt 16

All features are implemented and tested locally. This prompt deploys specter-api to Railway and specter-web to Vercel, wires Sentry and PostHog, adds `/health` endpoints, and configures Bull Board for ops queue inspection.

**Your task:** Configure Railway services, deploy both apps, set all production env vars, add `/health` liveness check, wire Sentry error tracking and PostHog analytics, and expose Bull Board at `/ops/queues`.

**Deliverables:**

- `specter-api/railway.toml` — Railway service config with `startCommand` and `healthcheckPath: /health`
- `specter-api/routers/health.py` — `GET /health` → checks DB (`SELECT 1`) + Redis (`PING`); returns `{"status":"ok","db":"ok","redis":"ok"}`; returns 503 if either check fails
- `specter-api/main.py` — Sentry SDK init before app startup; all routers registered including health
- `specter-web/app/providers.tsx` — PostHog `<PHProvider>` wrapping children; `identify()` called on Clerk auth
- `specter-web/instrumentation.ts` — Sentry Next.js instrumentation file
- `scraper/bull-board.ts` — Bull Board Express adapter mounted at `/ops/queues`; HTTP Basic Auth from `BULL_BOARD_USER` + `BULL_BOARD_PASS` env vars

**Key requirements:**

- `/health` returns 200 only when both DB `SELECT 1` and Redis `PING` succeed; returns 503 otherwise
- Sentry `merchant_id` added to scope on every request via Clerk JWT middleware
- PostHog identifies user on Clerk auth session; events include `merchant_id` property
- Bull Board shows all 6 queues: `scrape:probe`, `scrape:http`, `scrape:playwright`, `scrape:dead-letter`, `scrape:validation-errors`, `scrape:ai-errors`
- All Railway env vars set from ARCHITECTURE.md Secrets Management section; all Vercel env vars set from CLAUDE.md env section
- Never commit env files (CLAUDE.md critical rule)

**Success criteria:**

- `curl https://specter-api.railway.app/health` returns `{"status":"ok","db":"ok","redis":"ok"}`
- `curl https://<vercel-url>.vercel.app` returns 200
- Bull Board accessible at Railway URL `/ops/queues` with correct credentials
- Sentry receives a test event from production (trigger `1/0` in a dev route, verify, then remove)

---

## Prompt 18: CI/CD Pipeline & Launch Checklist

**Phase:** Phase 5 — Production | **Repo:** both
**Read first:** `docs/DEVPLAN.md`
**Builds on:** Prompt 17

Both apps are deployed to production. This final prompt sets up automated CI/CD so every PR is validated before merge, and completes the pre-launch checklist before beta user onboarding.

**Your task:** Configure GitHub Actions CI (lint + type-check + test on PR) and deploy (Vercel + Railway on merge to main), add a pre-commit hook blocking bad commits, and verify every pre-launch checklist item.

**Deliverables:**

- `.github/workflows/ci.yml` — triggered on pull_request: ESLint + `tsc --noEmit` on specter-web; `pytest` on specter-api; `npm test` for scraper unit tests
- `.github/workflows/deploy.yml` — triggered on push to `main`: Vercel deploy (specter-web) via Vercel GitHub Action; Railway deploy (specter-api) via Railway GitHub Action
- `.husky/pre-commit` — runs `npm run lint` then `npm test` in specter-web before every commit; blocks commit on non-zero exit

**Key requirements:**

- CI fails (non-zero exit) if any of: ESLint errors, TypeScript type errors, any pytest failure, any Vitest failure — PR cannot be merged with CI red
- Deploy workflow triggers ONLY on push to `main` — not on PRs
- Pre-commit hook blocks commit if `npm run lint` exits non-zero
- `.env` and `.env.local` confirmed absent from git history — verify with `git ls-files | grep .env` returns empty
- Pre-launch checklist — verify all 7 before first beta invite: (1) `GET /health` returns 200; (2) Sentry receiving production events; (3) at least 1 Playwright scrape completed successfully end-to-end; (4) at least 1 signal generated from a real price_snapshot; (5) Razorpay `subscription.activated` webhook processed correctly; (6) Resend OOS email delivered to test inbox; (7) Clerk sign-up → /dashboard full flow works end-to-end

**Success criteria:**

- Open a test PR with a lint error → CI workflow runs → lint step fails → PR shows red status check
- Fix the lint error → CI passes → merge to `main` → deploy workflow triggers and both apps redeploy
- `git commit` in specter-web with a lint error → pre-commit hook blocks with non-zero exit
- `git ls-files | grep "\.env"` returns no results
- All 7 pre-launch checklist items verified and checked off
