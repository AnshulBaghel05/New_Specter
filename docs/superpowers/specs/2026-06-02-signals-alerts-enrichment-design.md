# Sub-project D: Signals + Alerts Enrichment — Design Spec

**Date:** 2026-06-02
**Repos:** `specter-api` (FastAPI, Postgres/SQLAlchemy + Alembic) and `specter-web` (Next.js 14 App Router)
**Part of:** SPECTER Dashboard UX/UI Optimization (sub-project D of A–G)
**Depends on:** Sub-project B (Action/Deep-link layer, merged) — reuses `useQueryParams`, the URL default-omission convention, and `repricingHref`. Sub-projects A & C merged.

---

## 1. Purpose

The Signals and Alerts list pages already have filters and "Review & act" deep-links (from B/C). This sub-project adds **analytical depth and power-user control** to both:

- **Signals:** server-side sort (Newest / Highest confidence) and a confidence threshold filter; per-type counts on the filter tabs; a confidence meter with High/Med/Low tiers; explicit AI/Rule provenance; a percentage price delta beside the suggested price; and Today/Yesterday/Earlier day-grouping in the default Newest view.
- **Alerts:** client-side sort (Newest / Oldest / Domain); a summary header (active · resolved); per-alert out-of-stock duration; and an urgency accent for long-running (>24h) active alerts.

## 2. Scope

**In scope**
- specter-api: add `sort` + `min_confidence` query params to `GET /signals`; add `current_price` to each signal and per-type `counts` to the list response; an Alembic migration adding two `sku_id`-leading composite indexes on `signals`; pytest coverage.
- specter-web: extend the `useSignals` hook and `Signal`/`SignalList` types; new pure modules (confidence tiers, signal day-grouping, alert helpers, price delta) and new URL parsers; two small presentational components; wiring of the Signals and Alerts pages.

**Out of scope**
- Alerts pagination (alerts come back un-paginated; sort is client-side).
- Any change to the signal-generation pipeline, the `/signals/summary` endpoint, or plan gating.
- A separate products fetch for price context — `current_price` is sourced from the existing SKU join.

## 3. specter-api changes

### 3.1 `GET /signals` (`routers/signals.py`)

New params (additive; `type` unchanged):

```python
from typing import Literal

@router.get("", response_model=SignalListOut)
async def list_signals(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    type: str | None = Query(None, description="Filter by RAISE | LOWER | HOLD"),
    sort: Literal["recent", "confidence"] = Query("recent"),
    min_confidence: float = Query(0.0, ge=0.0, le=1.0),
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> SignalListOut:
```

Behavior:
- **`min_confidence`** is applied to the shared `base` query (`.where(Signal.confidence >= min_confidence)`) **before** the count, so `total` and pagination reflect the threshold. `0.0` matches all (default unchanged).
- **`sort`** drives ordering: `"confidence"` → `order_by(Signal.confidence.desc(), Signal.created_at.desc())`; `"recent"` → `order_by(Signal.created_at.desc())` (current behavior). `Literal` rejects unknown values with 422 (the web client only ever sends valid values).
- **`current_price`**: the query already joins `SKU` for the title; also select `SKU.current_price` and include it on each `SignalOut`.
- **`counts`**: one additional aggregate query over the same window **and** `min_confidence` scope but **without** the `type` filter, `GROUP BY Signal.type`, returning `{raise, lower, hold}`. Lets every filter tab show its true total regardless of the active `type`.
- The plan-based history window and `type` filter compose with all of the above.

Updated schemas:

```python
class SignalOut(BaseModel):
    id: str
    sku_id: str
    sku_title: str
    type: str
    confidence: float
    reasoning: str | None
    price_suggestion: float | None
    current_price: float | None   # NEW — from the SKU join
    source: str
    ai_fallback: bool
    created_at: str

class SignalTypeCounts(BaseModel):
    raise_: int = 0   # serialized as "raise" via alias (see note)
    lower: int = 0
    hold: int = 0

class SignalListOut(BaseModel):
    items: list[SignalOut]
    total: int
    limit: int
    offset: int
    counts: SignalTypeCounts   # NEW
```

Note: `raise` is a Python keyword, so the field is `raise_` with `serialization_alias="raise"` (and `model_config = ConfigDict(populate_by_name=True)`); the JSON key the client sees is `"raise"`. `lower`/`hold` are plain.

### 3.2 Alembic migration `0006_signal_indexes.py`

The `signals` table currently has no secondary indexes (only the `id` PK). Every signals query is merchant-scoped (join `skus` on `sku_id`, filter `created_at`, order by `created_at`/`confidence`), so the effective indexes are `sku_id`-leading composites:

```python
def upgrade() -> None:
    op.create_index("ix_signals_sku_id_created_at", "signals",
                    ["sku_id", sa.text("created_at DESC")])
    op.create_index("ix_signals_sku_id_confidence", "signals",
                    ["sku_id", sa.text("confidence DESC")])

def downgrade() -> None:
    op.drop_index("ix_signals_sku_id_confidence", table_name="signals")
    op.drop_index("ix_signals_sku_id_created_at", table_name="signals")
```

`ix_signals_sku_id_created_at` serves the join + window filter + default Newest ordering (and plain `sku_id` lookups, as the leading column); `ix_signals_sku_id_confidence` serves `sort=confidence`. Bare single-column or `(type, …)` indexes are intentionally omitted (not selective for merchant-scoped queries; `type` has cardinality 3).

### 3.3 Tests — `routers/test_signals.py`

Following `routers/test_products.py` patterns (async client + seeded DB). Assertions:
- `min_confidence=0.7` returns only signals ≥0.70 and `total` reflects the filtered count.
- `sort=confidence` orders results by confidence descending.
- Default (no `sort`) stays newest-first.
- `counts` returns correct per-type totals over the window, respects `min_confidence`, and is independent of the `type` filter.
- `current_price` is populated from the SKU.
- An invalid `sort` value yields 422.

## 4. specter-web changes

### 4.1 `lib/api.ts`

```ts
export interface Signal {
  /* …existing… */
  current_price: number | null   // NEW
}

export interface SignalTypeCounts { raise: number; lower: number; hold: number }

export interface SignalList {
  items: Signal[]
  total: number
  limit: number
  offset: number
  counts: SignalTypeCounts   // NEW
}

export function useSignals(opts?: {
  limit?: number
  offset?: number
  type?: SignalType
  sort?: 'recent' | 'confidence'    // NEW
  minConfidence?: number            // NEW (0–1)
}): UseQueryResult<SignalList, ApiError>
```
- Append `sort` to the query string only when `=== 'confidence'`, and `min_confidence` only when `> 0` (default requests stay byte-identical to today). `queryKeys.signals(opts)` already keys off the whole opts object.
- Preview fixtures (`lib/preview-data.ts`) gain `current_price` on signals and a `counts` object — **but do not modify preview wiring beyond adding these fields** (the controller will confirm preview-data edits are acceptable; if preview wiring is off-limits at execution time, the page degrades gracefully because counts/current_price are read defensively).

### 4.2 Pure modules (all unit-tested via TDD)

**`lib/dashboard/confidence.ts`**
```ts
export type ConfidenceTier = 'high' | 'medium' | 'low'
// high ≥ 0.80, medium 0.50–0.79, low < 0.50
export function confidenceTier(confidence: number): ConfidenceTier
```

**`lib/dashboard/price-delta.ts`**
```ts
// (suggestion − current) / current * 100, or null when not computable.
export function priceDeltaPct(current: number | null, suggestion: number | null): number | null
// "+4.1%" / "−3.0%", or null when priceDeltaPct is null.
export function formatPriceDelta(current: number | null, suggestion: number | null): string | null
```
Null when `current`/`suggestion` is null or `current <= 0`. One decimal place, explicit sign.

**`lib/dashboard/group-signals.ts`**
```ts
import type { Signal } from '@/lib/api'
export interface SignalDayGroup { label: 'Today' | 'Yesterday' | 'Earlier'; items: Signal[] }
// Buckets by local calendar day of created_at vs now. Preserves input order
// within each group; returns only non-empty groups, ordered Today→Yesterday→Earlier.
export function groupSignalsByDay(signals: Signal[], now?: Date): SignalDayGroup[]
```

**`lib/dashboard/alert-helpers.ts`**
```ts
import type { OOSAlert } from '@/lib/api'
export type AlertSort = 'recent' | 'oldest' | 'domain'
export const OOS_URGENT_HOURS = 24

export function oosDurationMs(a: OOSAlert, now?: Date): number       // active: now−detected; resolved: resolved−detected
export function formatOosDuration(ms: number): string               // "3d" | "5h" | "12m" (min "1m")
export function isUrgentOOS(a: OOSAlert, now?: Date): boolean        // status active && duration > OOS_URGENT_HOURS
export function sortAlerts(alerts: OOSAlert[], sort: AlertSort): OOSAlert[]   // pure, returns new array
export function alertCounts(alerts: OOSAlert[]): { active: number; resolved: number }
```

**`lib/dashboard/url-params.ts`** (extend; tests added to `url-params.test.ts`)
```ts
export function parseSignalSort(v: string | null): 'recent' | 'confidence'   // default 'recent'
export function parseMinConfidence(v: string | null): number                 // '0.5'|'0.7'|'0.9' → that; else 0
export function parseAlertSort(v: string | null): AlertSort                   // default 'recent'
```
`AlertSort` is imported from `alert-helpers.ts` (single definition, like `DomainSort` in sub-project B).

### 4.3 Components (`components/dashboard/`)

**`confidence-meter.tsx`** — props `{ confidence: number }`. A thin bar (styled like `SkuMeter`) filled to `confidence%` plus a tier label, color-mapped from `confidenceTier`: high→primary, medium→amber-400, low→muted. Also shows the numeric `% conf.`

**`signal-provenance.tsx`** — props `{ source: 'ai' | 'rule'; aiFallback: boolean }`. A tiny tag: `ai && !aiFallback` → ✨ "AI" (primary); `ai && aiFallback` → "AI·fallback" (amber, with a `title` explaining the AI call fell back to rules); `rule` → "Rule" (muted).

### 4.4 Signals page (`app/(dashboard)/signals/page.tsx`)

- Read `sort = parseSignalSort(get('sort'))`, `minConfidence = parseMinConfidence(get('min'))`; pass both to `useSignals({ limit, offset, type, sort, minConfidence })`. `type`/`page` unchanged.
- **Filter tabs show counts** from `data.counts`: `All ({raise+lower+hold}) · Raise ({raise}) · Lower ({lower}) · Hold ({hold})`. Read defensively (`data?.counts`) so a missing field renders the label alone.
- **Sort dropdown** (Newest / Highest confidence) → `set({ sort: v === 'recent' ? null : v, page: null })`.
- **Min-confidence dropdown**, labels `All · 50%+ · 70%+ · 90%+` (values 0/0.5/0.7/0.9) → `set({ min: v === 0 ? null : String(v), page: null })`.
- Rows: `ConfidenceMeter` replaces the bare "% conf."; `SignalProvenance` replaces the conditional sparkle; suggested price shows `formatPriceDelta(current_price, price_suggestion)` appended when non-null. "Review & act" deep-link unchanged.
- When `sort === 'recent'`, render `groupSignalsByDay(signals, new Date())` with `Today/Yesterday/Earlier` subheadings; when `'confidence'`, render a flat list. Pagination line stays.

### 4.5 Alerts page (`app/(dashboard)/alerts/page.tsx`)

- Read `sort = parseAlertSort(get('sort'))`; apply `sortAlerts(alerts, sort)` client-side. **Sort dropdown** (Newest / Oldest / Domain) → `set({ sort: v === 'recent' ? null : v })`. Existing status filter unchanged and composes (status is the server query; sort is client-side on the result).
- **Summary header**: `{active} active · {resolved} resolved` from `alertCounts(alerts)`.
- Each row shows **OOS duration**: `out of stock for {formatOosDuration(oosDurationMs(a))}` (active) / the existing resolved copy. Rows where `isUrgentOOS(a)` get a brighter accent (`border-rose-400/50 bg-rose-400/[0.07]`). Silence toggle + deep-link unchanged.

## 5. Data flow, loading & errors

- All controls are URL state via sub-project B's `useQueryParams` (shareable, refresh-durable, default-omitted). Signals sort/threshold round-trip through the server query; Alerts sort is client-side over the returned set.
- Loading/empty/error states reuse each page's existing markup. `counts`/`current_price` are read defensively so the UI never crashes if absent.
- No new global state.

## 6. Testing

Per CLAUDE.md (web) — **test pure logic only**; components/pages verified by `npx tsc --noEmit` + `npm run build`.

- **specter-api:** `routers/test_signals.py` (pytest) — sort, min_confidence, counts, current_price, composition with type, 422 on bad sort. Migration verified via `alembic upgrade head` and `alembic downgrade -1`.
- **specter-web pure suites:** `confidence.test.ts`, `price-delta.test.ts`, `group-signals.test.ts`, `alert-helpers.test.ts`, and new parser cases in `url-params.test.ts`.
- No component/page tests.

## 7. Acceptance criteria

- Signals: changing Sort to "Highest confidence" reorders the full result set (server-side) and switches to a flat list; "Newest" restores Today/Yesterday/Earlier grouping. The min-confidence dropdown filters server-side and updates `total` + counts. Filter tabs show per-type counts. Each row shows a confidence meter (High/Med/Low color), an AI/Rule/AI·fallback tag, and a `$X.XX (±Y.Y%)` delta when a current price and suggestion exist. All controls are reflected in the URL and restore on reload.
- Alerts: Sort dropdown reorders (newest/oldest/domain); the header shows active/resolved counts; each row shows OOS duration; active alerts older than 24h are visually accented.
- specter-api: `GET /signals` accepts `sort`/`min_confidence`, returns `current_price` + `counts`, rejects invalid `sort` with 422; the migration applies and reverts cleanly.
- `npm test -- --run` passes including the new pure suites; `npm run build` succeeds; specter-api signal tests pass.

## 8. Implementation notes

- **specter-web** is its own git repo (branch `main`); new branch `signals-alerts-enrichment`. **specter-api** is a separate repo with mostly-untracked source — stage by explicit path, never `git add .`/`-A`. End commits with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.
- Build backend → web pure modules → components → page wiring, so each layer is tested before its consumer.
- Reuse sub-project B's URL conventions (default-omission, merge-not-replace `set`); do not add local state for view controls.
- Do not modify plan gating, the signal pipeline, or `/signals/summary`.
