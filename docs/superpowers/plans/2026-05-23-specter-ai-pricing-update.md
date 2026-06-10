# SPECTER AI Pricing Engine — Documentation Update Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update four documentation files to reflect the AI-powered pricing engine design — Gemini 1.5 Pro signal generation for CIPHER+ merchants with rule-based fallback.

**Architecture:** Pure markdown edits — no code changes. Spec at `docs/superpowers/specs/2026-05-23-specter-ai-pricing-design.md`. FEATURES.md gets a new F11 feature spec. ARCHITECTURE.md gets diagram, data flow, FEATURE_GATES, schema, and env var updates. PRICING.md gets Gemini cost rows and recalculated margins. A new AI_PRICING.md is created as the operational reference for prompt engineering, caching, rate limits, and ops runbook.

**Tech Stack:** Markdown, git

---

## File Map

```
docs/FEATURES.md         ← append F11: AI Pricing Engine (CIPHER+)
docs/ARCHITECTURE.md     ← 6 targeted edits: diagram, data flow, FEATURE_GATES, signals schema, Redis keys, env var
docs/PRICING.md          ← insert Gemini API cost row, update Total COGS and Gross Margin, update margin floor
docs/AI_PRICING.md       ← new file: prompt template, example request/response, validation, rate limiting, caching, cost, ops runbook
```

---

### Task 1: Add F11 to docs/FEATURES.md

**Files:**
- Modify: `docs/FEATURES.md`

- [ ] **Step 1: Read the current file**

Run:
```bash
cat docs/FEATURES.md
```

Confirm the file currently ends at `## F10: ECLIPSE Enterprise Features`. F11 must not already exist.

- [ ] **Step 2: Append F11 section**

Append the following after the last line of `docs/FEATURES.md`:

```markdown

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
```

- [ ] **Step 3: Verify**

Confirm these strings are present in `docs/FEATURES.md`:
- `## F11: AI Pricing Engine (CIPHER+)`
- `source='ai', ai_model='gemini-1.5-pro'`
- `` ai:signal:{sku_id}:{snapshot_hash} ``
- `scrape:ai-errors`

- [ ] **Step 4: Commit**

```bash
git add docs/FEATURES.md
git commit -m "docs: add F11 AI Pricing Engine feature spec — Gemini 1.5 Pro, CIPHER+ gating, rule-based fallback"
```

---

### Task 2: Update docs/ARCHITECTURE.md

**Files:**
- Modify: `docs/ARCHITECTURE.md`

Six targeted edits in order. Read the file first, then apply each edit sequentially.

- [ ] **Step 1: Read the current file**

Run:
```bash
cat docs/ARCHITECTURE.md
```

- [ ] **Step 2: Update High-Level Diagram**

Find and replace these two lines inside the diagram block:

Old:
```
      ├── Signal Engine (Python)
      ├── Attribution Engine (Python)
```

New:
```
      ├── Signal Engine dispatcher (Python)
      │     ├── Rule-Based Engine  ← RECON + CIPHER+ fallback
      │     └── AI Engine          ← CIPHER+ primary
      │           └── [Gemini 1.5 Pro API]
      ├── Attribution Engine (Python)
```

- [ ] **Step 3: Update Data Flow — Scrape → Signal**

Find and replace steps 4 and 5:

Old:
```
4. Signal Engine reads latest price_snapshots for all competitor_urls of each sku_id
5. Applies RAISE/LOWER/HOLD logic → signals row
```

New:
```
4. Signal Engine dispatcher reads merchant.plan for each affected merchant
5a. RECON: rule-based engine applies RAISE/LOWER/HOLD → signals row (source='rule')
5b. CIPHER+: AI Engine batches SKUs (≤50 per call) → Gemini 1.5 Pro → signals row (source='ai', price_suggestion populated)
    └── on Gemini failure (timeout / invalid JSON / quota exhausted): rule-based fallback → signals row (source='rule', ai_fallback=true)
```

- [ ] **Step 4: Update FEATURE_GATES**

Find and replace the closing of the FEATURE_GATES dict:

Old:
```python
    'dedicated_workers': 'eclipse',
}
```

New:
```python
    'dedicated_workers': 'eclipse',
    'ai_signals':        'cipher',
}
```

- [ ] **Step 5: Add AI Engine schema section**

Append the following after the `### Add-On Handling` section (at the end of the file):

```markdown

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
```

- [ ] **Step 6: Update Secrets Management**

Find and replace the Railway env line:

Old:
```
- Railway env: Supabase URL+key, Upstash URL, Bright Data creds, Razorpay keys, Clerk secret, Resend key, 2captcha key, AWS S3 (future)
```

New:
```
- Railway env: Supabase URL+key, Upstash URL, Bright Data creds, Razorpay keys, Clerk secret, Resend key, 2captcha key, Gemini API key (`GEMINI_API_KEY`), AWS S3 (future)
```

- [ ] **Step 7: Verify**

Confirm these strings are present in `docs/ARCHITECTURE.md`:
- `Rule-Based Engine  ← RECON + CIPHER+ fallback`
- `5b. CIPHER+: AI Engine batches SKUs`
- `'ai_signals':        'cipher'`
- `price_suggestion  DECIMAL(10,2)`
- `ai:signal:{sku_id}:{snapshot_hash}`
- `GEMINI_API_KEY`

- [ ] **Step 8: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: update ARCHITECTURE.md — AI engine layer, signals schema, FEATURE_GATES ai_signals, GEMINI_API_KEY"
```

---

### Task 3: Update docs/PRICING.md

**Files:**
- Modify: `docs/PRICING.md`

Unit economics math (verified against spec):
- Gemini 1.5 Pro: ~$0.003 per 50-SKU batch (20K input + 4K output tokens)
- CIPHER ceiling: 10 batches × 8 cycles/day × 30 days × $0.003 = **~$7.20/mo**
- PHANTOM ceiling: 20 × 12 × 30 × $0.003 = **~$21.60/mo**
- PREDATOR ceiling: 40 × 24 × 30 × $0.003 = **~$86.40/mo**
- Updated COGS: CIPHER $14.20+$7.20=**$21.40** / PHANTOM $26.90+$21.60=**$48.50** / PREDATOR $76.98+$86.40=**$163.38**
- Updated margins: CIPHER (249−21.40)/249=**91.4%** / PHANTOM (699−48.50)/699=**93.1%** / PREDATOR (1799−163.38)/1799=**90.9%**
- Margin floor at 2× batching + Gemini ceiling: CIPHER (249−49.75)/249=**80.0%** / PHANTOM (699−143.00)/699=**79.5%** / PREDATOR (1799−556.50)/1799=**69.1%**

- [ ] **Step 1: Read the current file**

Run:
```bash
cat docs/PRICING.md
```

- [ ] **Step 2: Insert Gemini cost row and update COGS + Margin**

Find and replace these three rows at the bottom of the Unit Economics table:

Old:
```
| Email + notifications | $0.50 | $0.75 | $1.00 | $1.50 |
| **Total COGS** | **~$4.51** | **~$14.20** | **~$26.90** | **~$76.98** |
| **Gross Margin** | **94.3%** | **94.3%** | **96.1%** | **95.7%** |
```

New:
```
| Email + notifications | $0.50 | $0.75 | $1.00 | $1.50 |
| Gemini API cost (ceiling) | $0 | ~$7.20 | ~$21.60 | ~$86.40 |
| **Total COGS** | **~$4.51** | **~$21.40** | **~$48.50** | **~$163.38** |
| **Gross Margin** | **94.3%** | **91.4%** | **93.1%** | **90.9%** |
```

- [ ] **Step 3: Add caching footnote**

Append the following sentence immediately after the updated table (on its own line, before the `Proxy model:` line):

```
Gemini API costs shown at ceiling (zero cache hits). Expected 40–60% cache hit rate on stable domains reduces real-world AI costs to approximately: CIPHER ~$3.60–4.32/mo, PHANTOM ~$10.80–12.96/mo, PREDATOR ~$43.20–51.84/mo. RECON uses rule-based engine only — no Gemini cost.
```

- [ ] **Step 4: Update margin floor table row**

Find and replace:

Old:
```
| Margin floor | 91.4% | 82.9% | 82.6% | 73.9% |
```

New:
```
| Margin floor | 91.4% | 80.0% | 79.5% | 69.1% |
```

- [ ] **Step 5: Update PREDATOR minimum batching note**

Find and replace:

Old:
```
PREDATOR requires minimum 3× URL batching for 80%+ margin. Monitor and enforce URL overlap before onboarding PREDATOR accounts.
```

New:
```
Gemini costs included at ceiling (no caching). PHANTOM margin floor (79.5%) recovers to 80%+ with 40%+ Gemini cache hit rate. PREDATOR requires minimum 4× URL batching for 80%+ margin with AI engine active (vs 3× without AI). Monitor URL overlap before onboarding PREDATOR accounts. See AI_PRICING.md for caching strategy.
```

- [ ] **Step 6: Verify**

Confirm these strings are present in `docs/PRICING.md`:
- `Gemini API cost (ceiling)`
- `~$163.38`
- `90.9%`
- `40–60% cache hit rate`
- `PREDATOR requires minimum 4× URL batching`

- [ ] **Step 7: Commit**

```bash
git add docs/PRICING.md
git commit -m "docs: update PRICING.md — add Gemini API cost row, recalculate COGS/margins, update margin floor"
```

---

### Task 4: Create docs/AI_PRICING.md

**Files:**
- Create: `docs/AI_PRICING.md`

- [ ] **Step 1: Write the complete file**

Create `docs/AI_PRICING.md` with the following content:

```markdown
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

**Hash computation:** SHA-256 of the JSON-serialised sorted array of `{domain, price, in_stock}` for all competitors of this SKU in the current scrape cycle.

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
redis-cli --scan --pattern "ai:signal:*" | xargs redis-cli DEL
```

Flush only one merchant's cached signals (if per-merchant prompt change):
```bash
# No direct way — flush all and let cache warm naturally over 1–2 cycles
redis-cli --scan --pattern "ai:signal:*" | xargs redis-cli DEL
```

### Updating the Gemini Model Version

1. Update `ai_model` string in the AI Engine service (e.g., `gemini-1.5-pro` → `gemini-2.0-pro`)
2. Flush response cache so all SKUs re-call Gemini on next cycle:
   ```bash
   redis-cli --scan --pattern "ai:signal:*" | xargs redis-cli DEL
   ```
3. Monitor `scrape:ai-errors` queue and fallback rate for the first 2 cycles after update
4. Update the `ai_model` column default value in `signals` table via Alembic migration in `specter-api`
```

- [ ] **Step 2: Verify**

Confirm these strings are present in `docs/AI_PRICING.md`:
- `## Prompt Template`
- `response_mime_type="application/json"`
- `## Response Validation`
- `ai:signal:{sku_id}:{snapshot_hash}`
- `## Rate Limiting`
- `## Response Caching`
- `## Cost Analysis`
- `## Ops Runbook`
- `RESOURCE_EXHAUSTED`

- [ ] **Step 3: Commit**

```bash
git add docs/AI_PRICING.md
git commit -m "docs: create AI_PRICING.md — prompt template, example call, caching, rate limiting, cost analysis, ops runbook"
```
