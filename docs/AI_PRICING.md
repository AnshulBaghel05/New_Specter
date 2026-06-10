# SPECTER — AI Pricing Engine Reference

## Overview

Gemini 1.5 Pro is the primary signal engine for CIPHER+ merchants. SKUs are grouped into mini-batches of ≤50 per Gemini API call after each scrape cycle. The rule-based engine (F4) handles RECON merchants and serves as silent fallback for CIPHER+ when Gemini is unavailable.

**Model:** `gemini-1.5-pro`
**Environment variable:** `GEMINI_API_KEY` (Railway)
**Plan gating:** CIPHER+ only (`ai_signals` feature gate)

---

## Prompt Template

### System Prompt (static — eligible for Gemini context caching)

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
{json_encoded_sku_array}

Return JSON only. Schema per SKU:
{
  "sku_id": string,
  "signal": "RAISE" | "LOWER" | "HOLD",
  "confidence": float (0.0–1.0),
  "price_suggestion": number | null,
  "reasoning": string (max 120 characters)
}
```

### SKU Array Schema (input)

```json
[
  {
    "sku_id": "abc123",
    "title": "Sony WH-1000XM5",
    "merchant_price": 299.00,
    "floor_price": 249.00,
    "ceiling_price": 349.00,
    "competitors": [
      {
        "domain": "amazon.com",
        "price": 279.00,
        "in_stock": true,
        "scraped_at": "2026-05-23T14:00Z"
      },
      {
        "domain": "flipkart.com",
        "price": 289.00,
        "in_stock": false,
        "scraped_at": "2026-05-23T13:50Z"
      }
    ],
    "price_30d_median": 289.00,
    "price_7d_trend": "falling"
  }
]
```

**Field derivation before building the prompt:**
- `price_7d_trend`: compare latest competitor price vs price 7 days ago for the same domain. `rising` = >2% increase; `falling` = >2% decrease; `stable` = within ±2%.
- `price_30d_median`: median of all `price_snapshots.price` values for this competitor_url in the last 30 days.
- `floor_price` / `ceiling_price`: from `skus.floor_price` / `skus.ceiling_price`. If not set by the merchant, omit the field from the SKU object — Gemini will return null for price_suggestion.

---

## Example API Call (Python SDK)

```python
import google.generativeai as genai
import json, os

genai.configure(api_key=os.environ["GEMINI_API_KEY"])

model = genai.GenerativeModel(
    model_name="gemini-1.5-pro",
    system_instruction=(
        "You are a pricing intelligence engine for e-commerce merchants. "
        "Analyze competitor price data and return structured JSON signals. "
        "Do not include explanation outside the JSON. Return valid JSON only."
    )
)

response = model.generate_content(
    f"Merchant currency: USD\nAnalyze each SKU and return a JSON array with one object per SKU.\n\n"
    f"SKUs:\n{json.dumps(sku_batch, indent=2)}\n\n"
    "Return JSON only. Schema per SKU: "
    '{"sku_id": string, "signal": "RAISE"|"LOWER"|"HOLD", '
    '"confidence": float (0.0–1.0), "price_suggestion": number|null, '
    '"reasoning": string (max 120 characters)}',
    generation_config=genai.GenerationConfig(
        response_mime_type="application/json",
        temperature=0.2,
        max_output_tokens=4096,
    ),
)

signals = json.loads(response.text)
```

### Example Response (2-SKU batch)

```json
[
  {
    "sku_id": "abc123",
    "signal": "LOWER",
    "confidence": 0.78,
    "price_suggestion": 275.00,
    "reasoning": "Amazon in-stock at $279 — undercut by $4 to capture price-sensitive buyers while maintaining margin"
  },
  {
    "sku_id": "def456",
    "signal": "HOLD",
    "confidence": 0.55,
    "price_suggestion": null,
    "reasoning": "Only 1 competitor tracked, currently out of stock — insufficient data to recommend price change"
  }
]
```

---

## Response Validation

Applied to every Gemini response before storing signals:

1. Parse as JSON — on parse failure, fallback entire batch to rule-based engine
2. Verify returned array length matches input — missing SKUs run rule-based fallback individually
3. Per SKU: `signal` must be `RAISE`, `LOWER`, or `HOLD`; `confidence` must be 0.0–1.0; `reasoning` must be a non-empty string
4. `price_suggestion` must be within `[floor_price, ceiling_price]` if non-null — clamp silently if out of bounds; log a warning
5. `confidence` capped at 0.6 if fewer than 2 in-stock competitors present (applied after Gemini response, same cap as F4 rule-based engine)

---

## Rate Limiting

**Gemini 1.5 Pro quotas (pay-as-you-go):**
- 360 requests per minute (RPM)
- 4,000,000 tokens per minute (TPM)

**SPECTER peak load estimate (500 CIPHER+ merchants, all cycling simultaneously):**
- 500 merchants × 10 batches/cycle = 5,000 calls per 3hr cycle = 27.8 calls/minute
- Token rate: 27.8 × 24,000 tokens/call = 667,200 tokens/minute

Both are well within quota at MVP scale (≤500 merchants).

**HTTP 429 handling:** `moveToDelayed` using the `Retry-After` value from the Gemini response header. No retry count consumed. Ops metric key `ai:rate-limited:{minute}` incremented for monitoring.

**Quota depletion (daily limit exhausted):** All CIPHER+ merchants fall back to rule-based for the remainder of the day. Ops PagerDuty alert fires. No merchant-facing notification — fallback is transparent.

---

## Response Caching

**Purpose:** Skip Gemini calls when competitor prices are unchanged since the last cycle. Expected 40–60% hit rate on stable domains.

**Redis key:** `ai:signal:{sku_id}:{snapshot_hash}`

**TTL by plan:**
| Plan | TTL |
|------|-----|
| CIPHER | 10,800s (3hr) |
| PHANTOM | 7,200s (2hr) |
| PREDATOR | 3,600s (1hr) |
| ECLIPSE | merchant-configured interval |

**Hash computation:** SHA-256 of the canonical JSON of competitors sorted alphabetically by domain, excluding `scraped_at`. Python: `hashlib.sha256(json.dumps(sorted(competitors, key=lambda c: c['domain']), sort_keys=True, separators=(',', ':')).encode()).hexdigest()`. This ensures identical competitor states always produce the same hash regardless of scrape timing.

**On cache hit:** Return cached `{signal, confidence, price_suggestion, reasoning}` directly; skip Gemini call. Signal stored with `source='ai'`, `ai_model='gemini-1.5-pro'` — cached signals are treated as AI signals, not rule-based.

**Cache invalidation:** TTL-based only. Any competitor price change produces a new hash, which is a natural cache miss. No manual invalidation needed during normal operation.

---

## Cost Analysis

**Gemini 1.5 Pro pricing:**
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens

**Per 50-SKU batch:** ~20,000 input + ~4,000 output tokens = ~$0.003/call

**Monthly cost at ceiling (zero cache hits):**

| Plan | SKUs | Refresh | Batches/cycle | Cycles/day | Cost/day | Cost/month |
|------|------|---------|--------------|-----------|---------|-----------|
| CIPHER | 500 | 3hr | 10 | 8 | $0.24 | ~$7.20 |
| PHANTOM | 1,000 | 2hr | 20 | 12 | $0.72 | ~$21.60 |
| PREDATOR | 2,000 | 1hr | 40 | 24 | $2.88 | ~$86.40 |

**Expected cost with 50% cache hit rate:**

| Plan | Cost/month |
|------|-----------|
| CIPHER | ~$3.60 |
| PHANTOM | ~$10.80 |
| PREDATOR | ~$43.20 |

**As % of tier revenue (ceiling / 50% cache):** CIPHER 2.9% / 1.4% — PHANTOM 3.1% / 1.5% — PREDATOR 4.8% / 2.4%

---

## Ops Runbook

### Monitor Fallback Rate

**Redis key:** `ai:fallback:count:{merchant_id}` (sliding 24hr counter)

Check fallback count for a merchant:
```bash
redis-cli GET "ai:fallback:count:{merchant_id}"
# Compare against total cycles in 24hr: CIPHER=8, PHANTOM=12, PREDATOR=24
# Alert threshold: >50% of cycles are fallbacks
```

Inspect recent fallback events (via BullMQ dashboard / Bull Board):
```
Queue: scrape:ai-errors
Fields per event: merchant_id, batch_size, error_type, timestamp
```

### Quota Exceeded Response

1. Gemini returns HTTP 429 with `reason: RESOURCE_EXHAUSTED` (distinct from rate-limit 429)
2. All in-flight batches fall back to rule-based; signals stored with `ai_fallback=true`
3. PagerDuty alert fires (configure webhook in Railway monitoring)
4. Request quota increase via Google AI Studio console
5. Quota resets at midnight UTC — no manual action needed after reset

### Cache Management

View whether a cache entry exists for a SKU:
```bash
redis-cli EXISTS "ai:signal:{sku_id}:{snapshot_hash}"
```

Force full cache flush (run after prompt template changes):
```bash
redis-cli --scan --pattern "ai:signal:*" | xargs -r redis-cli DEL
```

### Updating the Gemini Model Version

1. Update `ai_model` string in the AI Engine service (e.g., `gemini-1.5-pro` → `gemini-2.0-pro`)
2. Flush response cache so all SKUs re-call Gemini on next cycle:
   ```bash
   redis-cli --scan --pattern "ai:signal:*" | xargs -r redis-cli DEL
   ```
3. Monitor `scrape:ai-errors` queue and fallback rate for the first 2 cycles after update
4. Update the `ai_model` column default value in `signals` table via Alembic migration in `specter-api`
