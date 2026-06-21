# SPECTER — Feature Specifications

## F1: Store Onboarding (Shopify OAuth)
**Description:** Merchant connects their Shopify store via OAuth. SKUs imported automatically.

**Acceptance Criteria:**
1. Merchant clicks "Connect Shopify" on /settings
2. Redirected to Shopify OAuth consent screen
3. On approval, specter-api stores access token encrypted in merchants table
4. specter-api fetches all products via Shopify Admin API, creates skus rows
5. Dashboard shows imported SKU count within 60 seconds
6. On token expiration, merchant sees "Reconnect" prompt (not silent failure)

**Edge Cases:**
- Store with 0 products: show empty state, not error
- Shopify API rate limit hit: queue remaining SKUs, show progress
- Merchant revokes app from Shopify admin: detect on next API call, notify via email

**Dependencies:** Shopify Partner account, specter-api /merchants/shopify/oauth routes

---

## F2: Competitor URL Management
**Description:** Merchant pastes a competitor product URL, selects which of their own products it maps to. This creates a `competitor_tracking` row — the billing unit. **1 SKU = one of your products tracked against one competitor URL** (1 enabled tracking = 1 SKU consumed = one competitor-URL scrape per refresh cycle); the plan limit counts (product × competitor) pairings, not products imported. A merchant's SKU count equals both the number of product→competitor links and the number of competitor scrapes per cycle (e.g. 33 products × 3 competitors = 99 SKUs = 99 scrapes/cycle).

**Acceptance Criteria:**
1. Merchant pastes URL inline on a product row on the /products page (Products tab); the /competitors page is a read-only by-domain lens over the same data
2. specter-api checks two plan limits before saving:
   a. Total `competitor_trackings` for merchant < plan max SKUs → else 402 `sku_limit_reached`
   b. `competitor_trackings` for the selected `own_product_id` < `merchants.max_competitors_per_sku` → else 402 `competitor_limit_reached`
3. URL upserted into `competitor_urls` (unique on domain + url_path); `competitor_trackings` row created
4. First scrape job queued immediately (not on next scheduled run)
5. Merchant sees "Tracking" status within 5 minutes; SKU usage meter increments by 1
6. Merchant can delete a tracking; `competitor_trackings.enabled` set to false (soft delete), scraping stops within 1 job cycle
7. Merchant can **permanently delete a product** (`DELETE /skus/{id}`) — a hard cascade (price_changes → signals → oos_alerts → competitor_trackings → sku) that also reschedules any competitor URL left untracked, gated in the UI behind a typed title-confirmation modal. Distinct from the per-tracking soft delete above. SKU usage drops automatically (it's `COUNT(enabled trackings)`).
8. Each product carries a **currency** (ISO-4217, default USD), chosen in the add/edit form; used for display and as the target for competitor-price FX normalization (see F4).
7. Merchant can silence OOS alerts per tracking (`competitor_trackings.silenced_oos = true`) without deleting the tracking

**Edge Cases:**
- Same competitor URL mapped to two different own products: allowed — creates two `competitor_tracking` rows sharing one `competitor_url` row (domain batching still merges scrape jobs)
- Same URL added to same own product twice: rejected (UNIQUE constraint on `own_product_id + competitor_url_id`), frontend shows "Already tracking this competitor for this product"
- Competitor limit hit for a product: 402 response; frontend shows upgrade prompt with "Track up to {next_plan_limit} competitors per product on {next_plan}"
- SKU limit hit (total trackings): 402 response; frontend shows SKU usage meter at 100% with upgrade CTA
- robots.txt blocks scraping: show "Cannot track this URL" with explanation; tracking row not created
- URL returns 404: mark as failed, notify merchant

**Dependencies:** F3 (Scraper Engine)

---

## F3: Scraper Engine
**Description:** BullMQ job queue with Playwright workers scrapes competitor URLs on plan-defined schedules.

**Acceptance Criteria:**
1. RECON URLs scraped every 6hr; CIPHER every 3hr; PHANTOM every 2hr; PREDATOR every 1hr; ECLIPSE every 5–15min
2. Domain batching: same URL tracked by multiple merchants = 1 scrape job
3. Each scrape: price + in_stock extracted, price_snapshot row inserted
4. Raw HTML saved to Supabase Storage (path: {domain}/{url_path}/{timestamp}.html)
5. Failed scrape: retry 3x with exponential backoff (1min, 5min, 15min)
6. After 3 consecutive failures: dead-letter queue + merchant email notification
7. robots.txt checked before first scrape of any new domain

**Edge Cases:**
- CAPTCHA encountered: 2captcha fallback, max 3 attempts
- Price not found in HTML: log parse failure, do not insert snapshot, alert ops
- Playwright timeout (>30s): treated as failure, triggers retry

**Dependencies:** Upstash Redis (BullMQ), Bright Data proxy, Supabase Storage

---

## F4: Signal Engine
**Description:** Python service aggregates scraped prices from all enabled competitor_trackings for an own_product, then emits RAISE/LOWER/HOLD.

**Acceptance Criteria:**
1. Signal generated within 5 minutes of price_snapshot insert
2. Competitor data set = latest price_snapshot for each `competitor_tracking` where `enabled = true` and own_product_id matches
2a. **Currency normalization:** each competitor snapshot price (`price_snapshots.currency`) is FX-converted into the product's `skus.currency` (via `services/fx.py`) before any comparison below — so all of `current_price`, median, and competitor prices are like-for-like. Rates are USD-pivot, Redis-cached live over a static fallback; an un-mappable currency passes through unchanged (never breaks the cycle).
3. RAISE: any competitor in the data set has price > merchant `current_price` AND `in_stock = true`
4. LOWER: merchant `current_price` > 5% above median price of all in-stock competitors in the data set
5. HOLD: merchant price within ±2% of median competitor price
6. Confidence score (0–1) = min(1.0, enabled_tracking_count / 5). Capped at 0.6 when fewer than 2 in-stock competitors present
7. Duplicate suppression: same signal type not re-emitted within 1hr for same SKU (own_product)
8. Signals viewable on /signals with reasoning text

**Edge Cases:**
- Only 1 competitor tracking enabled: confidence capped at 0.6
- All competitors in enabled trackings are OOS: HOLD signal (insufficient data for RAISE)
- Merchant has no floor/ceiling set: signal generated but auto-reprice disabled
- A tracking is disabled mid-cycle: excluded from current and future signal calculations immediately

**Dependencies:** F3 (price_snapshots via competitor_trackings → competitor_urls), PostgreSQL

---

## F5: OOS Alerts
**Description:** Notify merchant within 15 minutes when a competitor goes out of stock.

**Acceptance Criteria:**
1. OOS detected: in_stock transitions from true → false in price_snapshots
2. oos_alerts row inserted within the scrape cycle (1hr for PREDATOR, 2hr for PHANTOM, 3hr for CIPHER, 6hr for RECON; ECLIPSE: per merchant-configured interval, 5–15min)
3. Email sent via Resend within 2 minutes of oos_alerts insert
4. Email includes: competitor name, OOS'd SKU, suggested action (raise price), direct link to /repricing
5. Alert resolved automatically when competitor restocks (in_stock → true)
6. Merchant can silence a specific competitor URL's OOS alerts

**Edge Cases:**
- Competitor flaps in/out of stock within same scrape cycle: deduplicate, send 1 alert
- Merchant email bounces: log, do not retry more than 1x

**Dependencies:** F3 (scraper), Resend API

---

## F6: Dashboard Overview
**Description:** Single-screen overview showing signals today, revenue recovered (MTD), active OOS alerts.

**Acceptance Criteria:**
1. Shows count of RAISE/LOWER/HOLD signals in last 24hr
2. Shows revenue recovered MTD (sum of price_changes.revenue_delta where source='auto')
3. Shows count of active OOS alerts (oos_alerts where resolved_at IS NULL)
4. Signal feed shows last 10 signals with type badge, SKU name, time ago
5. Data refreshes every 60 seconds via TanStack Query
6. Empty state shown for new accounts with 0 signals (not broken UI)

**Dependencies:** F4 (signals), F5 (oos_alerts), F7 (attribution for revenue counter)

---

## F7: Auto-Reprice Rules (CIPHER+)
**Description:** Merchant sets floor/ceiling prices per SKU; SPECTER auto-applies price changes based on signals.

**Acceptance Criteria:**
1. Only available on CIPHER and above plans
2. Merchant sets floor_price and ceiling_price per SKU on /repricing
3. When RAISE signal fires: new price = min(lowest_instock_competitor_price - $0.01, ceiling_price); lowest_instock_competitor_price = min price among all in-stock tracked competitors for that SKU
4. When LOWER signal fires: new price = max(median_competitor_price - $0.01, floor_price)
5. Price change applied via Shopify Admin API within 5 minutes of signal
6. price_changes row inserted with old_price, new_price, signal_id, source='auto'
7. Merchant can disable auto-reprice globally or per-SKU

**Edge Cases:**
- Suggested price below floor_price: apply floor_price, log as "floor-clamped"
- Shopify API call fails: retry 3x, then mark price_change as failed, notify merchant
- Merchant revokes Shopify token mid-repricing: stop all auto-reprice, send reconnect email

**Dependencies:** F4 (signals), Shopify Admin API, CIPHER+ plan check

---

## F8: Revenue Attribution (PHANTOM+)
**Description:** Show exact dollar impact per price change over trailing 30 days.

**Acceptance Criteria:**
1. Only available on PHANTOM and above plans
2. revenue_delta calculated as: (new_price - old_price) × units_sold_in_next_24hr
3. Units sold fetched from Shopify Orders API post-price-change
4. /attribution page shows bar chart: date vs. revenue_delta
5. Total "recovered" and "lost" tallied separately
6. CSV export of attribution data

**Edge Cases:**
- Shopify Orders API unavailable: show last known data with "data delayed" badge
- Price changed multiple times in 24hr: attribute to most recent change only

**Dependencies:** F7 (price_changes), Shopify Orders API, PHANTOM+ plan check

---

## F9: PREDATOR+ Priority Features
**Description:** Priority scrape queue, 90-day price history, and priority support channel for PREDATOR tier.

**Acceptance Criteria:**
1. Only available on PREDATOR and above plans
2. PREDATOR scrape jobs inserted at queue priority 10 (vs priority 1 for lower tiers); processed before lower-tier jobs when worker capacity is contested
3. price_snapshots data retained for 90 days for PREDATOR merchants (vs 30 days for RECON/CIPHER/PHANTOM)
4. /signals and /attribution pages show date range picker allowing up to 90-day lookback on PREDATOR
5. PREDATOR merchants have a dedicated Slack channel invite sent on onboarding
6. Support tickets from PREDATOR merchants tagged `priority` in the ops queue; 24hr response SLA
7. Priority badge visible in /settings to confirm tier status

**Edge Cases:**
- Merchant downgrades from PREDATOR: historical data beyond 30 days retained for 7 days then deleted
- Queue is empty: priority level irrelevant; all jobs process normally

**Dependencies:** F3 (Scraper Engine), F4 (Signal Engine), F8 (Revenue Attribution — /attribution page must exist for 90-day date picker), Slack workspace for support channel

---

## F10: ECLIPSE Enterprise Features
**Description:** Dedicated infrastructure, uptime SLA, and white-glove onboarding for ECLIPSE tier.

**Acceptance Criteria:**
1. Only available on ECLIPSE plan
2. ECLIPSE merchants get dedicated Railway worker instances (not shared with lower tiers); configured via ECLIPSE_WORKER_URL env var
3. Dedicated workers refresh on merchant-configured interval between 5–15 minutes (set in /settings)
4. 99.9% monthly uptime SLA documented in contract; SPECTER ops monitors with PagerDuty alert at <99.9%
5. White-glove onboarding: SPECTER team member completes Shopify OAuth and first 20 competitor URL mappings on behalf of merchant within 48hr of contract signing; Slack channel invite (F9 AC#5) is subsumed — ECLIPSE merchant joins a dedicated ECLIPSE Slack channel instead
6. Custom contract and NET-30 invoicing via Razorpay; no self-serve signup flow
7. ECLIPSE account marked in DB (`merchants.plan = 'eclipse'`); all PREDATOR features inherited except F9 AC#5 (Slack invite replaced by ECLIPSE-specific channel per AC#5 above)

**Edge Cases:**
- Dedicated worker goes down: fall back to shared workers automatically; notify merchant within 15min
- Custom refresh interval conflicts with domain's rate limit: system falls back to 15-minute interval (the maximum allowed) and alerts merchant; SPECTER ops team resolves the domain-specific configuration manually

**Dependencies:** F3 (Scraper Engine), F9 (PREDATOR+ features), Railway dedicated instance provisioning

---

## F11: AI Pricing Engine (CIPHER+)
**Description:** Gemini 1.5 Pro generates RAISE/LOWER/HOLD signals for CIPHER+ merchants alongside a specific price suggestion. Rule-based engine (F4) handles RECON and serves as silent fallback when Gemini is unavailable.

**Acceptance Criteria:**
1. Only available on CIPHER and above plans
2. After each price_snapshot batch, affected CIPHER+ merchant SKUs are grouped into mini-batches of ≤50 and sent to Gemini 1.5 Pro
3. Each AI signal includes: type (RAISE/LOWER/HOLD), confidence (0.0–1.0), reasoning (≤120 chars displayed on /signals), price_suggestion (specific price within [floor_price, ceiling_price], or null)
4. Signals stored with source='ai', ai_model='gemini-1.5-pro', ai_fallback=false
5. On Gemini failure (timeout >10s after 1 retry, invalid JSON response, or quota exceeded): rule-based engine fires silently for affected SKUs; signals stored with source='rule', ai_fallback=true — merchant sees no visible difference
6. HTTP 429 from Gemini: batch moved to delayed queue using Retry-After header value; no retry count consumed
7. Response cache: Redis key `ai:signal:{sku_id}:{snapshot_hash}` with TTL = plan refresh interval; if competitor prices unchanged since last cycle, cached signal returned without calling Gemini
8. price_suggestion clamped to [floor_price, ceiling_price] if Gemini returns a value outside merchant-configured bounds
9. confidence capped at 0.6 when fewer than 2 in-stock competitors present (matches F4 rule-based cap)
10. Fallback events logged to `scrape:ai-errors` BullMQ queue (fields: merchant_id, batch_size, error_type, timestamp) — inspectable by ops without redeploy
11. `ai:fallback:count:{merchant_id}` Redis counter tracks fallbacks in sliding 24hr window; ops alert fires when any merchant exceeds 50% fallback rate in 24hr
12. RECON merchants: no change — F4 rule-based engine runs unchanged

**Edge Cases:**
- Gemini returns partial batch (some SKU IDs missing): store AI signals for returned SKUs, run rule-based fallback for missing SKUs
- price_suggestion outside [floor_price, ceiling_price]: clamp silently, store clamped value
- Gemini quota exhausted: all CIPHER+ merchants fall back to rule-based; ops PagerDuty alert fires; no merchant notification (transparent fallback)
- Merchant downgrades from CIPHER to RECON mid-cycle: in-flight Gemini batch completes normally, subsequent cycles use rule-based only

**Dependencies:** F4 (Signal Engine — rule-based logic retained), F3 (price_snapshots), `GEMINI_API_KEY` Railway env var, CIPHER+ plan check

---

## Free-Tool PLG & Freemium Workspace Feature Matrix (2026-05-30)

> Design: `docs/superpowers/specs/2026-05-30-free-tools-plg-redesign-design.md`.

### Free / Email / Paid matrix (all 6 tools)
| Capability | Layer | Plan |
|---|---|---|
| Core calc + hero + 3 supporting + full breakdown accordion | Free | — |
| PDF / print report; Quick Answer; FAQ; formulas; schema | Free | — |
| Free teasers: 2 of 6 ROAS benchmarks, 1-box packaging, basic LTV | Free | — |
| Save result + shareable link | Email | FREE account |
| Scenario compare | Email | FREE account |
| CSV download | Email | FREE account |
| One enhanced insight per tool | Email | FREE account |
| Live competitor prices + real signal; automatic monitoring + alerts | Paid | RECON |
| Auto-reprice; batch analysis; full optimizer catalogs; bulk/scheduled export | Paid | CIPHER |
| Attribution; cohort LTV; 90-day history/trends | Paid | PHANTOM+ |

### F-FREE: Free Dashboard Workspace (freemium tier)
**Acceptance Criteria:**
1. A `free` plan exists beneath RECON in `PLAN_HIERARCHY`; sign-up grants `free` (no trial).
2. Starting a 14-day trial is an explicit action that sets `plan='recon'` + `trial_ends_at`.
3. Trial expiry without payment downgrades to `free` (not read-only); tracked SKUs paused, 30-day retention.
4. Dashboard shows a **Tools** tab usable by `free` accounts: the 6 calculators + account-backed saved history, scenarios, in-app CSV, enhanced insights.
5. Signals/Competitors/Alerts/Repricing/Attribution render as preview tabs for `free`: real UI + demo data, blurred, with a tier-specific "see your data" CTA.
6. Server-side `plan_gate` returns 403 `{error:'upgrade_required', required_plan}` for `free` on all paid endpoints (already enforced).
7. Free Overview shows welcome + tool shortcuts + usage summary + contextual upgrade prompts.
8. In-workspace PQL trigger fires after N tool checks ("…SPECTER monitors these automatically").
9. Public `/tools/*` unchanged and crawlable; dashboard Tools tab is `noindex`.

### F-GATE: Value-first lead-capture gate
**Acceptance Criteria:**
1. Core answer (hero + 3 supporting + full breakdown) is fully usable with no email and no payment.
2. Layer-1 email prompt appears only after the user edits an input, expands the breakdown, or clicks save/compare/CSV — never on initial pre-filled load.
3. Pre-filled inputs visibly tagged "Example."
4. Gate is dismissable ("recalculate manually"); suppressed 7 days after dismissal (localStorage).
5. No content removed from the DOM by gating (SEO/AEO preserved).

**Dependencies:** existing `email-capture-gate`, `locked-section`, `demo-mode-panel`, `scenario-panel`, `export-bar`, `share-result`, `embed-code` components; `plan_gate` (specter-api); new `saved_calculations` table.
