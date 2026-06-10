# SPECTER — AI-Powered Pricing Engine Design (Sub-project C)

**Date:** 2026-05-23
**Status:** Approved
**Scope:** Gemini-powered signal generation for CIPHER+ merchants alongside existing rule-based engine
**Replaces:** Nothing — extends F4 (Signal Engine) with an AI path

---

## 1. Design Goals

- Deliver richer, context-aware RAISE/LOWER/HOLD signals to CIPHER+ merchants using Gemini 1.5 Pro
- Keep rule-based engine intact for RECON and as silent fallback for CIPHER+
- Add `price_suggestion` (specific recommended price) as a new signal field — only populated by AI path
- Stay within margin targets: Gemini API cost ≤ 5% of tier revenue at ceiling SKU counts
- Zero merchant-visible degradation on Gemini failure — fallback is transparent

---

## 2. Plan Gating

| Plan | Signal Engine |
|------|--------------|
| RECON | Rule-based only (unchanged) |
| CIPHER | AI primary, rule-based fallback |
| PHANTOM | AI primary, rule-based fallback |
| PREDATOR | AI primary, rule-based fallback |
| ECLIPSE | AI primary, rule-based fallback |

`FEATURE_GATES` addition in `specter-api`:
```python
FEATURE_GATES = {
    'auto_reprice':      'cipher',
    'attribution':       'phantom',
    'webhooks':          'phantom',
    'history_90d':       'predator',
    'priority_queue':    'predator',
    'dedicated_workers': 'eclipse',
    'ai_signals':        'cipher',   # new
}
```

---

## 3. System Architecture

### Integration Point

The AI engine shares the same trigger as the existing rule-based signal engine: a Python worker processes `price_snapshot` inserts and dispatches to the correct path based on merchant plan.

```
price_snapshot written
      ↓
[Signal Engine dispatcher]
      ├── merchant.plan == 'recon'
      │         └── rule-based engine (unchanged)
      └── merchant.plan in ['cipher','phantom','predator','eclipse']
                ↓
          [AI Engine]
                ├── Gemini available → signal stored (source='ai')
                └── Gemini fails → rule-based fallback (source='rule', ai_fallback=true)
```

One signal per SKU per cycle. Signal format (RAISE/LOWER/HOLD + confidence + reasoning) is identical whether AI or fallback. `price_suggestion` is populated only on AI path; NULL on fallback.

### Updated Architecture Diagram Addition

```
[specter-api / Railway]
      ├── FastAPI routers
      ├── Signal Engine dispatcher
      │     ├── Rule-Based Engine   ← RECON + fallback
      │     └── AI Engine           ← CIPHER+ (new)
      │           └── [Gemini 1.5 Pro API]
      ├── Attribution Engine (Python)
      └── Scraper Scheduler
```

---

## 4. Batching Strategy

SKUs are grouped into mini-batches of up to 50 per Gemini API call, per merchant, per cycle.

**Why 50:** Balances token efficiency (fewer API calls) with failure isolation (one failed call affects ≤50 SKUs, not all).

**Batching flow:**
1. Collect all SKUs for a CIPHER+ merchant that have new `price_snapshots` in this cycle
2. Sort by SKU ID (deterministic ordering)
3. Split into chunks of 50
4. Dispatch each chunk as one Gemini call (sequential, not parallel — avoid rate limit burst)
5. Collect results, store signals, handle partial failures per-batch

---

## 5. Gemini Prompt Specification

### System Prompt (static — cached by Gemini SDK)

```
You are a pricing intelligence engine for e-commerce merchants.
Analyze competitor price data and return structured JSON signals.
Do not include explanation outside the JSON. Return valid JSON only.
```

### User Prompt (dynamic per batch)

```
Merchant currency: {currency}
Analyze each SKU and return a JSON array with one object per SKU.

SKUs:
[
  {
    "sku_id": "{sku_id}",
    "title": "{title}",
    "merchant_price": {current_price},
    "floor_price": {floor_price},
    "ceiling_price": {ceiling_price},
    "competitors": [
      {
        "domain": "{domain}",
        "price": {price},
        "in_stock": {in_stock},
        "scraped_at": "{scraped_at_iso}"
      }
    ],
    "price_30d_median": {median},
    "price_7d_trend": "rising"|"falling"|"stable"
  }
]

Return JSON only. Schema per SKU:
{
  "sku_id": string,
  "signal": "RAISE" | "LOWER" | "HOLD",
  "confidence": float (0.0–1.0),
  "price_suggestion": number | null,
  "reasoning": string (max 120 characters)
}
```

### Field Notes

- `price_7d_trend`: derived from last 7 days of `price_snapshots` for each competitor URL before the prompt is built. `rising` = latest > 7d-ago by >2%; `falling` = latest < 7d-ago by >2%; `stable` otherwise.
- `price_suggestion`: Gemini recommends a specific price within `[floor_price, ceiling_price]`. If Gemini returns null (e.g., HOLD signal with no action needed), NULL is stored.
- `confidence`: 0.0–1.0. Gemini should weigh number of competitor data points, recency, and trend consistency. Capped at 0.6 when fewer than 2 in-stock competitors are present (mirrors rule-based engine cap).
- `reasoning`: shown to merchant on /signals; must be human-readable, ≤120 characters.

---

## 6. Response Validation

Before storing any Gemini response:

1. Parse as JSON — on parse failure, entire batch falls back to rule-based
2. Verify returned array length matches input length — missing SKUs run rule-based individually
3. Per SKU: `signal` must be one of `RAISE`, `LOWER`, `HOLD`; `confidence` must be 0.0–1.0; `reasoning` non-empty string
4. `price_suggestion` must be within `[floor_price, ceiling_price]` if non-null — clamp silently if outside bounds (Gemini arithmetic errors)
5. Any SKU failing validation: rule-based fallback for that SKU only

---

## 7. Fallback Logic & Error Handling

### Fallback Triggers

| Trigger | Retry | Action |
|---------|-------|--------|
| Gemini timeout (>10s) | 1 retry after 3s | Fallback entire batch |
| Invalid JSON response | No retry | Fallback entire batch |
| Partial response (missing SKUs) | No retry | AI for valid SKUs, fallback for missing |
| HTTP 429 (rate limit) | `moveToDelayed` by `Retry-After` | No retry count consumed |
| HTTP 500 / API unavailable | 1 retry after 3s | Fallback + ops alert |
| Quota exceeded | No retry | Fallback all batches + ops PagerDuty alert |

### Fallback Flow

```
Gemini call fails
      ↓
[1 retry if applicable]
      ↓ still fails
[Rule-based engine runs for affected SKUs]
      ↓
signals stored: source='rule', ai_fallback=true
      ↓
ops metric incremented: ai_fallback_count:{merchant_id} (Redis, 24hr window)
      ↓
fallback event logged to scrape:ai-errors BullMQ queue
```

### Ops Visibility

- `scrape:ai-errors` BullMQ queue: captures every fallback with `merchant_id`, `batch_size`, `error_type`, `timestamp` — inspectable without redeploy
- `ai:fallback:count:{merchant_id}` Redis key: sliding 24hr counter; ops threshold alert at >50% fallback rate for any merchant in any 24hr window

---

## 8. Response Caching

**Redis key:** `ai:signal:{sku_id}:{snapshot_hash}`
**TTL:** Equal to merchant's plan refresh interval (CIPHER=3hr, PHANTOM=2hr, PREDATOR=1hr, ECLIPSE=min configured interval)
**Hash:** SHA-256 of the sorted competitor prices + in_stock values for this SKU in this cycle

**Cache hit:** Skip Gemini call for this SKU; return cached signal directly. Reduces API calls when competitor prices are unchanged between cycles (common for stable domains).

**Cache miss:** Gemini call proceeds normally; result cached on success.

---

## 9. Data Model

### `signals` Table — New Columns

```sql
-- Added to existing signals table
price_suggestion  DECIMAL(10,2)  -- Gemini's recommended price; NULL when source='rule'
source            VARCHAR(4)     -- 'ai' | 'rule'
ai_fallback       BOOLEAN        -- true when AI failed and rule engine fired
ai_model          VARCHAR(32)    -- 'gemini-1.5-pro'; NULL when source='rule'
```

### New Redis Keys

```
ai:signal:{sku_id}:{snapshot_hash}    TTL = plan refresh interval  (response cache)
ai:fallback:count:{merchant_id}       sliding 24hr window counter   (ops metric)
```

### New Environment Variable (Railway)

```
GEMINI_API_KEY=
```

---

## 10. Cost Analysis

**Gemini 1.5 Pro pricing (at time of design):**
- Input: ~$0.075 / 1M tokens
- Output: ~$0.30 / 1M tokens

**Token estimate per SKU:**
- Input: ~400 tokens (SKU data + prompt structure)
- Output: ~80 tokens (JSON response object)

**Per 50-SKU batch:** ~20,000 input + ~4,000 output = ~$0.003/call

**Monthly cost ceiling (no caching benefit):**

| Plan | SKUs | Refresh | Batches/cycle | Cycles/day | Calls/day | Cost/month |
|------|------|---------|--------------|-----------|-----------|-----------|
| CIPHER | 500 | 3hr | 10 | 8 | 80 | ~$7.20 |
| PHANTOM | 1,000 | 2hr | 20 | 12 | 240 | ~$21.60 |
| PREDATOR | 2,000 | 1hr | 40 | 24 | 960 | ~$86.40 |

**As % of tier revenue:** CIPHER 2.9% / PHANTOM 3.1% / PREDATOR 4.8% — all within 80%+ margin floor.

**Caching impact:** Estimated 40–60% cache hit rate on stable domains reduces real-world cost to approximately half the ceiling figures above.

---

## 11. Documentation Deliverables

| File | Change |
|------|--------|
| `docs/superpowers/specs/2026-05-23-specter-ai-pricing-design.md` | This document (new) |
| `docs/FEATURES.md` | Add F11: AI Pricing Engine |
| `docs/ARCHITECTURE.md` | Add AI Engine to diagram + data flow; add `ai_signals: cipher` to FEATURE_GATES; add schema columns; add GEMINI_API_KEY env var |
| `docs/AI_PRICING.md` | New — prompt template, example request/response, cost analysis, rate limiting, caching, ops runbook |
| `docs/PRICING.md` | Add Gemini API cost row to unit economics table |

No code changes. All tasks are markdown edits. One commit per file.

---

## 12. Out of Scope

- A/B testing framework (AI vs rule-based signal quality comparison) — Phase 2
- Merchant-visible `source` field on /signals dashboard — Phase 2 (ops-internal only for now)
- Fine-tuning Gemini on SPECTER-specific price data — Phase 2
- Switching to a different AI provider (OpenAI, Claude) — architecture supports it via `ai_model` column, no redesign needed
- Per-SKU Gemini calls — mini-batch chosen; per-SKU would require redesign of batching layer
