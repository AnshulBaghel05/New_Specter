# SPECTER — System Architecture

## High-Level Diagram
```
[Merchant Browser]
      ↓ HTTPS
[specter-web / Vercel]  ←→  [Supabase Auth]
      ↓ REST API (JWT)
[specter-api / Railway]
      ├── FastAPI routers
      ├── Signal Engine dispatcher (Python)
      │     ├── Rule-Based Engine  ← RECON + CIPHER+ fallback
      │     └── AI Engine          ← CIPHER+ primary
      │           └── [Gemini 1.5 Pro API]
      ├── Attribution Engine (Python)
      └── Scraper Scheduler
            ↓ BullMQ jobs
      [Upstash Redis]
            ↓
      [Playwright Workers / Railway]
            ↓
      [Bright Data Proxies]
            ↓
      [Competitor Websites]
            ↓ price_snapshots
      [Supabase PostgreSQL]
            ↑
      [specter-api reads]
            ↓ signals/alerts
      [specter-web dashboard]
```

## Request Flow: Merchant Sees a Signal
1. Merchant opens /signals in browser
2. Next.js renders page shell (RSC), TanStack Query fetches `/api/signals` from specter-api
3. specter-api validates Supabase JWT → reads signals table filtered by merchant_id + plan
4. Returns paginated signal list with confidence, reasoning, SKU name
5. TanStack Query refetches every 60 seconds

## Data Flow: Scrape → Signal
1. BullMQ scheduler (every N minutes by plan) dequeues scrape jobs with `competitorTrackingIds[]`
2. Worker opens URL via Bright Data proxy
3. Parser extracts price + in_stock + currency → price_snapshots row (keyed by competitor_url_id)
4. specter-api `/internal/price-snapshot` fans out: for each competitor_tracking_id in the job,
   find the own_product_id and trigger the signal engine
5. Signal Engine: for a given own_product, fetch latest snapshot from every ENABLED competitor_tracking
5a. RECON: rule-based engine applies RAISE/LOWER/HOLD → signals row (source='rule')
5b. CIPHER+: AI Engine batches own_products (≤50 per call) → Gemini 1.5 Pro → signals row (source='ai', price_suggestion populated)
    └── on Gemini failure (timeout / invalid JSON / quota exhausted): rule-based fallback → signals row (source='rule', ai_fallback=true)
6. If OOS detected (in_stock false): oos_alerts row with competitor_tracking_id + sku_id + Resend email
   (skipped if competitor_tracking.silenced_oos = true)

## Database: Supabase (PostgreSQL 15)
Row-level security (RLS) enabled. All queries go through specter-api (not direct from frontend).

### Core Schema — SKU & Competitor Tracking

```
skus (own products imported from Shopify)
  id | merchant_id | title | handle | current_price | floor_price | ceiling_price | ...

competitor_urls (URL registry — one row per unique domain+path across all merchants)
  id | domain | url_path | last_scraped_at | robots_blocked | currency

competitor_trackings (billing unit — 1 row = 1 SKU consumed)
  id | own_product_id → skus.id
     | competitor_url_id → competitor_urls.id
     | merchant_id → merchants.id   (denormalized for fast plan-limit queries)
     | enabled | silenced_oos
  UNIQUE(own_product_id, competitor_url_id)

price_snapshots (scraper output — URL-level, shared across all trackings of the same URL)
  id | competitor_url_id → competitor_urls.id
     | price | currency | in_stock | scraped_at | needs_review | delete_at
```

**1 SKU = one of your products tracked against one competitor URL** — i.e. one *(product → competitor)* link, which is **one competitor-URL scrape per refresh cycle**. A merchant's SKU count therefore equals both the number of product→competitor links and the number of competitor scrapes per cycle (100 products × 1 competitor = 100 SKUs = 100 scrapes/cycle; 33 products × 3 competitors = 99). The scrape runs against the competitor's URL; the merchant's own store is API-synced, never scraped. The plan limit counts enabled (product × competitor) pairings — not the number of products imported from Shopify.

**SKU count = `COUNT(competitor_trackings WHERE merchant_id = ? AND enabled = true)`**

The signal engine reads price_snapshots via the competitor_url_id chain:
`own_product → competitor_trackings (enabled) → competitor_urls → price_snapshots (latest)`

### Products Workspace — Read Surface (`GET /products`)

The dashboard exposes the full SKU tree through ONE aggregated read endpoint, `GET /products` (router `routers/products.py`). It returns each own product → its enabled competitor trackings (+ latest price snapshot) → the product's latest signal, plus the merchant's SKU usage counters (`sku_used`, `sku_limit`, `max_competitors_per_sku`). Read-only; no schema changes.

Two dashboard tabs are client-side lenses over this single response (shared TanStack cache — one fetch, two views):
- **Products** tab — by-your-product view: add a product, link competitors, watch its RAISE/LOWER/HOLD signal.
- **Competitors** tab — the same data pivoted by competitor domain (per-domain health, avg price gap, in-stock/OOS counts).

Mutations (create SKU, link/remove competitor, silence OOS) reuse the existing `/skus` and `/competitors/track` endpoints and invalidate the `products` query so both lenses stay in sync.

## Secrets Management
- Vercel env: Supabase URL + anon key, specter-api URL, PostHog key
- Railway env: Supabase URL+key, `SUPABASE_JWT_SECRET`, Upstash URL, Bright Data creds, Razorpay keys, Resend key, 2captcha key, Gemini API key (`GEMINI_API_KEY`), `ENCRYPTION_KEY` (Shopify token encryption), Shopify OAuth creds, AWS S3 (future)

## Subscription Tier Handling

### Database Tier Enum
`merchants.plan` column accepts these values:

```sql
-- Valid values for merchants.plan
'recon' | 'cipher' | 'phantom' | 'predator' | 'eclipse'
-- Trial state stored separately: merchants.trial_ends_at TIMESTAMP
-- Add-ons stored in: merchant_addons (merchant_id, addon_type, quantity)
```

### Plan Limits

| Plan | Max SKUs | Max Competitors/Product | `max_competitors_per_sku` DB value |
|------|----------|--------------------------|-------------------------------------|
| RECON | 100 | 3 | 3 |
| CIPHER | 500 | 5 | 5 |
| PHANTOM | 1,000 | 8 | 8 |
| PREDATOR | 2,000 | 12 | 12 |
| ECLIPSE | Custom | Custom | NULL (unlimited) |

**Enforcement (server-side only):** On `POST /competitors/track`:
1. `COUNT(competitor_trackings WHERE merchant_id = ?)` ≥ plan max SKUs → 402 `sku_limit_reached`
2. `COUNT(competitor_trackings WHERE own_product_id = ? AND enabled = true)` ≥ `merchants.max_competitors_per_sku` → 402 `competitor_limit_reached`

Frontend shows a meter and upgrade prompt; the actual gate is in specter-api.

### Plan Gating Flow
```
[Request arrives at specter-api]
      ↓
[Supabase JWT validated → merchant_id extracted]
      ↓
[merchants.plan + merchants.trial_ends_at read from DB]
      ↓
[FastAPI plan_gate middleware checks feature against plan]
      ↓ ALLOWED                    ↓ DENIED
[Handler executes]         [403 {"error": "upgrade_required",
                                  "required_plan": "cipher"}]
```

Plan gate middleware (Python):
```python
PLAN_HIERARCHY = ['recon', 'cipher', 'phantom', 'predator', 'eclipse']

FEATURE_GATES = {
    'auto_reprice':      'cipher',
    'attribution':       'phantom',
    'webhooks':          'phantom',
    'history_90d':       'predator',
    'priority_queue':    'predator',
    'dedicated_workers': 'eclipse',
    'ai_signals':        'cipher',
}

# Competitor limit per own product — looked up from merchants.max_competitors_per_sku.
# Set automatically when plan changes (billing webhook handler).
PLAN_COMPETITOR_LIMITS = {
    'recon':    3,
    'cipher':   5,
    'phantom':  8,
    'predator': 12,
    'eclipse':  None,  # unlimited — custom contract
}

def requires_plan(feature: str, merchant_plan: str) -> bool:
    min_plan = FEATURE_GATES[feature]
    return PLAN_HIERARCHY.index(merchant_plan) >= PLAN_HIERARCHY.index(min_plan)
```

### Scrape Job Priority by Plan
PREDATOR and ECLIPSE jobs are inserted at higher BullMQ priority (10 and 20 respectively). When scraper workers are at capacity, higher-priority jobs process first. See SCRAPER.md for full priority table.

### Add-On Handling
Speed boost add-ons are stored per-SKU-group in `merchant_addons`. The scraper scheduler checks `merchant_addons` before queuing to determine the effective refresh interval for each SKU group — may differ from the base plan interval. Max 3 active add-on subscriptions per account; each add-on type counts as one subscription.

### AI Engine — Schema & Infrastructure

New columns on the existing `signals` table:

```sql
price_suggestion  DECIMAL(10,2)  -- Gemini's recommended price; NULL when source='rule'
source            VARCHAR(4)     -- 'ai' | 'rule'
ai_fallback       BOOLEAN        -- true when AI failed and rule engine fired
ai_model          VARCHAR(32)    -- 'gemini-1.5-pro'; NULL when source='rule'
```

New Redis keys:

```
ai:signal:{sku_id}:{snapshot_hash}    TTL = plan refresh interval  (response cache)
ai:fallback:count:{merchant_id}       sliding 24hr window counter   (ops metric)
```

New BullMQ queue (ops inspection only — no worker processes jobs from this queue):

```typescript
export const aiErrorsQueue = new Queue('scrape:ai-errors', { connection: redis })
```

---

## Free Plan State & Tools Workspace (2026-05-30)
> Design: `docs/superpowers/specs/2026-05-30-free-tools-plg-redesign-design.md` (Phase 5).

### Plan hierarchy change
```
PLAN_HIERARCHY = ['free', 'recon', 'cipher', 'phantom', 'predator', 'eclipse']
```
- `merchants.plan` gains the value `'free'` (key `free`, user-facing "Free"). No DB enum change needed (plan is a String column).
- `auth/supabase.py` `get_current_merchant`: first sign-in creates `plan='free'` (was `'recon'` with trial). No `read_only` on creation.
- Starting a trial sets `plan='recon'` + `trial_ends_at`. Trial-expiry job sets `plan='free'` (replaces the read-only 402 lockout path).
- `plan_gate` already 403s `upgrade_required` for any plan below the required tier — `free` falls through cleanly with no new logic.

### New table: `saved_calculations`
```
id                UUID PK        default gen_random_uuid()
created_at        TIMESTAMPTZ    default now()
merchant_id       UUID FK → merchants(id)   NOT NULL
tool_id           VARCHAR(48)    NOT NULL   -- 'price-position', 'amazon-fba', ...
label             VARCHAR(120)   NULL       -- user-named, optional
inputs            JSONB          NOT NULL   -- tool input state
results           JSONB          NOT NULL   -- computed output snapshot
```
Backs the dashboard Tools tab's saved history + account-backed scenarios (today `ScenarioPanel` is localStorage-only). The FREE plan consumes **no** SKU/competitor/scrape limits — the calculators are client-side; nothing is scraped.

### Surfaces
- Dashboard gains a **Tools** tab (reuses the same calculator components as public `/tools/*`).
- Public `/tools/*` unchanged and crawlable; dashboard Tools tab is `noindex` (behind auth).
- Platform tabs (Signals/Competitors/Alerts/Repricing/Attribution) render preview/demo-data state for `free` accounts via existing `demo-mode-panel` + `locked-section`.
