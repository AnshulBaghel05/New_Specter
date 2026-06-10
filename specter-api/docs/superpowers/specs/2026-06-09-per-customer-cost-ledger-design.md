# Per-Customer Cost Ledger — Design Spec (Audit Fix #4)

**Date:** 2026-06-09
**Repo:** specter-api (+ scraper)
**Status:** Approved (design), pending implementation

## Problem

`COST_ANALYSIS.md` models cost-to-serve per plan but warns the numbers are
"modeled estimates, not invoices" and explicitly recommends (#6) replacing them
with **measured per-customer cost**. There is **no production cost tracking** of
any kind today (audit finding, 2026-06-09). Without it we cannot tell which
customers are margin-negative, cannot verify the batching multiplier that the
whole business model depends on, and cannot price ECLIPSE/PREDATOR from real
data.

## Key insight — shared-crawl attribution

After Audit #2, one CompetitorURL is fetched **once** per due time and the result
fans out to every merchant tracking it. Cost is therefore incurred **once per
fetch** but must be attributed across the **N distinct merchants** sharing that
crawl. The ingest pipeline already carries everything needed: `proxy_tier`,
`merchant_cycle_ids` (the distinct merchants), and the scrape outcome. So each
scrape's cost is **split `/N`** and accrued to each sharing merchant. This makes
the "batching multiplier" measurable: a URL shared by 5 merchants costs each 1/5.

AI cost is already per-merchant (signal batches run per merchant), so it is
attributed whole, with no split.

## Scope (v1)

Three attributable marginal drivers — **proxy bandwidth, AI tokens, CAPTCHA
solves**. Deferred: email/notification cost, marginal compute, retry-multiplier
modeling, per-account payment fees.

## Storage — hybrid

- **`merchant_cost_daily`** (source of truth): one row per
  `(merchant_id, date, cost_type)` with `cost_usd`, `units`, `sample_count`.
  Scales to 10M+ scrapes/day because the hot path only touches Redis counters; a
  flush job rolls them up daily.
- **`cost_event_sample`** (1% sample): raw rows for calibrating the byte/cost
  estimates against the rollups and spot-checking attribution.

## Components

### 1. `services/cost_model.py` — pure rates + math

Versioned unit-rate table, env-overridable (defaults from `COST_ANALYSIS.md`
appendix). `cost_type` ∈ `{proxy, ai, captcha}`.

- Rates (uniform bytes×$/GB model): `PROXY_USD_PER_GB = {datacenter, residential}`
  with datacenter cheap and residential the dominant ~$8.40/GB; `CAPTCHA_USD_PER_SOLVE`;
  `AI_USD_PER_1M = {flash:{in,out}, pro:{in,out}}` from the COST_ANALYSIS appendix.
  Exact numeric defaults pinned in the plan; all overridable via `COST_RATE_*` env.
- `scrape_cost_usd(tier: str, resp_bytes: int, captcha_solved: bool) -> dict`
  returning `{proxy: x, captcha: y}` (captcha 0 when not solved; tier `none` →
  proxy 0).
- `ai_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float`.
- `split(cost: float, n: int) -> float` = `cost / max(n, 1)`.
- `monthly_revenue_usd(plan: str) -> float` (RECON 79, CIPHER 249, PHANTOM 699,
  PREDATOR 1799, FREE 0; ECLIPSE/unknown → 0, flagged as "custom").

### 2. `services/cost_ledger.py` — accrual + flush

Redis counter keys (string, `INCRBYFLOAT`):
`cost:daily:{merchant_id}:{YYYY-MM-DD}:{cost_type}` and a parallel
`…:{cost_type}:units` counter. TTL ~40 days (past the flush window).

- `record_scrape_cost(redis, merchant_ids, tier, resp_bytes, captcha_solved, rng=random)`:
  compute via `cost_model`, `split` proxy+captcha across the **distinct**
  merchant_ids, `INCRBYFLOAT` each merchant's `proxy`/`captcha` counters, and with
  probability `SAMPLE_RATE` (0.01, `rng`-injected for tests) record a
  `cost_event_sample` row per merchant. Wrapped best-effort — never raises into
  the caller.
- `record_ai_cost(redis, merchant_id, model, input_tokens, output_tokens)`:
  whole AI cost to one merchant's `ai` counter (+ sample).
- `flush_daily(session, redis, date) -> int`: scan the day's counters, **upsert**
  into `merchant_cost_daily`, return rows written. Idempotent (upsert on the
  `(merchant_id, date, cost_type)` unique key).

### 3. Models + migration `alembic/versions/0010_cost_ledger.py`

`MerchantCostDaily(merchant_id FK, date, cost_type, cost_usd, units, sample_count,
updated_at)` with a unique constraint on `(merchant_id, date, cost_type)`;
`CostEventSample(merchant_id FK, created_at, cost_type, proxy_tier, units,
cost_usd, domain)`. Supabase SQL mirror.

### 4. Pipeline instrumentation

- **Scraper** (`scraper/workers/http.ts`, `playwright.ts`, and the
  `buildSnapshotBody`/`postScrapeFailed` shapes): add `resp_bytes` (HTTP body
  length / browser content length — a documented estimate; the sample ledger
  calibrates it) and `captcha_solved` to the snapshot and scrape-failed payloads.
  `probe.ts` failures carry tier too.
- **`routers/internal.py`**: `SnapshotIn`/`ScrapeFailedIn` gain `resp_bytes` +
  `captcha_solved`; the snapshot and scrape-failed handlers call
  `record_scrape_cost(redis, [mc.merchant_id for mc in merchant_cycle_ids], tier,
  resp_bytes, captcha_solved)`. Best-effort, after the cycle/audit writes.
- **`signals/ai_engine.py`**: after a Gemini batch, call `record_ai_cost` with the
  batch's token usage and the merchant.

### 5. Margin read — `services/cost_margin.py` + `routers/cost.py`

- `merchant_margins(session, date_from, date_to) -> list[MerchantMargin]`:
  aggregate `merchant_cost_daily` by merchant + cost_type, join `merchants.plan`,
  compute `revenue = monthly_revenue_usd(plan)` pro-rated to the window,
  `cost_to_serve = sum(costs)`, `gross_margin = (rev - cost)/rev`, and a
  `margin_negative` flag.
- `GET /admin/cost/margin?from=&to=` guarded by an `ADMIN_API_KEY` header
  (`require_admin` dependency — a constant-time compare; **separate** from the
  scraper's HMAC ingest auth). Returns the per-merchant margin list + totals.

### 6. Flush process

Provide `flush_daily` (tested) and a thin `run_cost_flush.py` script. **Defer**
the cron/scheduler wiring to the infra wave (consistent with #1/#2 — verifiable
logic ships now, scheduling later).

## Data flow

```
scrape fetch (worker) → resp_bytes + captcha_solved + proxy_tier in payload
  → POST /internal/{price-snapshot|scrape-failed}  (carries merchant_cycle_ids)
    → record_scrape_cost(redis, merchants, tier, bytes, captcha)
        → split /N → INCRBYFLOAT cost:daily:{m}:{date}:{proxy|captcha}
        → 1% → cost_event_sample row
AI batch (ai_engine) → record_ai_cost(redis, merchant, model, in, out)
flush_daily(session, redis, date) → upsert merchant_cost_daily   [daily job — deferred wiring]
GET /admin/cost/margin → cost_margin.merchant_margins() → per-customer margin
```

## Error handling

- All accrual is **best-effort**: `record_scrape_cost`/`record_ai_cost` wrap their
  body in try/except and log-and-continue so cost accounting never fails an ingest
  or a signal write.
- `flush_daily` upserts → safe to re-run (idempotent); a missed day can be
  re-flushed from surviving Redis counters within the TTL window.
- Redis down → counters are simply not incremented for that window (cost
  under-counted, never a crash); the sample ledger and rollups degrade gracefully.

## Testing (no live DB / browser / network)

- `services/test_cost_model.py` — proxy/captcha/AI math at known rates; tier
  `none` → 0; split rounding; revenue map.
- `services/test_cost_ledger.py` — split across distinct merchants; exact counter
  keys + INCRBYFLOAT amounts (mocked Redis); deterministic 1% sampling via
  injected `rng`; `record_*` swallow Redis errors; `flush_daily` upsert (mocked
  session) writes the expected rows.
- `services/test_cost_margin.py` — seeded rollups → correct per-merchant margin +
  `margin_negative` flag + revenue proration.
- `routers/test_cost.py` — `/admin/cost/margin` 401 without/with-wrong
  `ADMIN_API_KEY`, 200 with the key.
- `routers/test_internal.py` (extend) — snapshot + scrape-failed with
  `resp_bytes`/`captcha_solved` invoke `record_scrape_cost` with the split
  merchant set (patched).
- Scraper: `tsc --noEmit` clean + existing vitest green after payload additions
  (assert the new fields appear in `buildSnapshotBody` output).

## Out of scope

- Email/compute/retry/payment-fee cost lines (future v2 — would extend the
  taxonomy and rate table only).
- The flush **scheduler** process (cron) — logic + script ship; wiring deferred.
- Customer-facing cost display — this is internal margin-protection tooling.
