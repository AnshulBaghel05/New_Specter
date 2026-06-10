# Sub-project F: Repricing Confidence & Control — Design Spec

**Date:** 2026-06-03
**Repo:** `specter-web` only (Next.js 14 App Router). No `specter-api` change.
**Part of:** SPECTER Dashboard UX/UI Optimization (sub-project F of A–G).
**Depends on:** Sub-project B (Action/Deep-link layer — `useQueryParams`, URL default-omission, the existing `?sku`/`?source` reprice deep-link) and sub-project D (reuses `ConfidenceMeter` and `priceDeltaPct`/`formatPriceDelta`). A, B, C, D merged.

---

## 1. Purpose

The `/repricing` page lets a CIPHER+ merchant set per-SKU floor/ceiling guardrails and toggle auto-reprice, and shows the latest AI suggestion plus a flat price-change log. It does **not** show **what auto-reprice would actually do** to a price given the current guardrails, has no overview of guardrail coverage, validates bounds only on the server (a 422 after Save), and offers no way to find or triage problem SKUs in a large catalog.

Sub-project F adds **confidence and control**, entirely client-side:

- **Projected price + clamp state** per SKU — what auto-reprice would set right now, and whether the suggestion lands within bounds, gets floor/ceiling-clamped, or has no guardrails.
- **Guardrail coverage header** — guardrails / auto-on / needs-attention counts, with clickable shortcuts.
- **Inline bounds validation** — floor ≤ ceiling and ≥ 0, surfaced before Save (mirrors the server's existing 422).
- **Search, filter, and sort** — find a SKU by title; subset by attention/guardrails/auto/clamp; sort by attention or impact. All URL-driven.
- **Richer change log** — a net-revenue-delta + count summary and a per-row source badge.

## 2. Scope

**In scope (`specter-web` only)**
- Five pure modules in `lib/dashboard/` (preview, coverage, bounds validation, filter/sort+search, change-log summary), unit-tested via TDD.
- New parsers appended to `lib/dashboard/url-params.ts`.
- Two small presentational components; reuse of D's `ConfidenceMeter` and `formatPriceDelta`.
- Wiring of `app/(dashboard)/repricing/page.tsx`.

**Out of scope**
- Any `specter-api` change: no migration, no new/changed endpoint, no plan-gate change, no reprice-pipeline change.
- Persisting clamp state in the change log (the `price_changes` table has no clamp column; populating one would require the untracked reprice worker — excluded, per sub-project D's precedent of not touching the pipeline). Clamp state is shown only in the **preview** (derived client-side), never claimed as historical fact.
- A "manual apply this suggestion now" action (would need a Shopify write endpoint).
- Bulk multi-SKU editing.
- `SignalProvenance` on rows — the repricing `LatestSuggestion` payload carries no `source`/`ai_fallback`, and exposing them is a backend change we excluded. Omitted from F.

## 3. Existing contract (unchanged, for reference)

From `specter-web/lib/api.ts` — no edits to these types are required:

```ts
interface LatestSuggestion { type: string; price_suggestion: number | null; confidence: number; created_at: string }
interface RepriceSKU {
  id: string; title: string
  current_price: number | null
  floor_price: number | null
  ceiling_price: number | null
  auto_reprice_enabled: boolean
  latest_suggestion: LatestSuggestion | null
}
interface RepriceList { global_auto_reprice_enabled: boolean; skus: RepriceSKU[] }
interface PriceChange {
  id: string; sku_id: string; sku_title: string
  old_price: number; new_price: number
  source: string; revenue_delta: number | null; created_at: string
}
```

`latest_suggestion.type` is `'RAISE' | 'LOWER' | 'HOLD'` (string at the type level). "Actionable" throughout this spec means `type` is `RAISE` or `LOWER` **and** `price_suggestion !== null`.

## 4. Pure modules (`lib/dashboard/`, all TDD)

### 4.1 `reprice-preview.ts`

Display-only: what auto-reprice would set **now**, re-clamping the stored suggestion to the SKU's current bounds (the suggestion was clamped at generation time using the bounds that existed then; re-clamping keeps the preview honest if the merchant has since changed guardrails). Independent of auto on/off — the toggle and the coverage module own that.

```ts
import type { RepriceSKU } from '@/lib/api'

export type RepriceState =
  | 'no-action'        // no suggestion, HOLD, or null price_suggestion
  | 'no-guardrails'    // actionable, but neither floor nor ceiling is set
  | 'within'           // actionable, suggestion sits within the set bound(s)
  | 'floor-clamped'    // actionable, suggestion below floor → floor applies
  | 'ceiling-clamped'  // actionable, suggestion above ceiling → ceiling applies

export interface RepricePreview {
  state: RepriceState
  effectivePrice: number | null   // the price auto-reprice would set; null only for 'no-action'
}

export function repricePreview(sku: RepriceSKU): RepricePreview
```

Algorithm (let `s = sku.latest_suggestion`, `p = s?.price_suggestion`, `f = sku.floor_price`, `c = sku.ceiling_price`):
1. Not actionable (`!s || s.type === 'HOLD' || p == null`) → `{ state: 'no-action', effectivePrice: null }`.
2. `f == null && c == null` → `{ state: 'no-guardrails', effectivePrice: p }`.
3. `f != null && p < f` → `{ state: 'floor-clamped', effectivePrice: f }`.
4. `c != null && p > c` → `{ state: 'ceiling-clamped', effectivePrice: c }`.
5. otherwise → `{ state: 'within', effectivePrice: p }`.

(Floor takes precedence over ceiling in the impossible-by-validation case where both would trigger; bounds validation prevents `f > c` from being saved.)

### 4.2 `guardrail-coverage.ts`

```ts
import type { RepriceSKU } from '@/lib/api'

export type GuardrailStatus = 'complete' | 'partial' | 'none'
// complete: floor && ceiling both set; partial: exactly one set; none: neither
export function guardrailStatus(sku: RepriceSKU): GuardrailStatus

// actionable suggestion AND (guardrails not 'complete' OR per-SKU auto disabled)
export function needsAttention(sku: RepriceSKU): boolean

export interface CoverageSummary {
  total: number          // skus.length
  withGuardrails: number // guardrailStatus === 'complete'
  autoOn: number         // auto_reprice_enabled
  needsAttention: number // needsAttention(sku)
}
export function coverageSummary(skus: RepriceSKU[]): CoverageSummary
```

### 4.3 `bounds-validation.ts`

The form holds floor/ceiling as strings; empty string means "unset" (valid).

```ts
// null when valid; otherwise a short human-readable error.
export function validateBounds(floor: string, ceiling: string): string | null
```
Rules, in order:
- A non-empty value that is `NaN` or `< 0` → `"Prices must be 0 or more."`
- Both non-empty and `Number(floor) > Number(ceiling)` → `"Floor cannot exceed ceiling."`
- Else `null`.

Mirrors the server guard (`PATCH /repricing/sku/{id}` → 422 `invalid_bounds`) so the user sees it before saving.

### 4.4 `reprice-filter.ts`

```ts
import type { RepriceSKU } from '@/lib/api'

export type RepriceFilter = 'all' | 'needs-attention' | 'needs-guardrails' | 'auto-on' | 'would-clamp'
export type RepriceSort = 'default' | 'attention' | 'impact'

// Case-insensitive substring match on title. Empty/blank query → unchanged list.
export function searchRepriceSKUs(skus: RepriceSKU[], query: string): RepriceSKU[]

export function filterRepriceSKUs(skus: RepriceSKU[], filter: RepriceFilter): RepriceSKU[]
// 'all' → unchanged
// 'needs-attention'  → needsAttention(sku)
// 'needs-guardrails' → guardrailStatus(sku) !== 'complete'
// 'auto-on'          → sku.auto_reprice_enabled
// 'would-clamp'      → repricePreview(sku).state is 'floor-clamped' | 'ceiling-clamped'

export function sortRepriceSKUs(skus: RepriceSKU[], sort: RepriceSort): RepriceSKU[]   // pure, returns new array
// 'default'   → input order unchanged (returns a copy)
// 'attention' → needsAttention true before false; stable within each group
// 'impact'    → by |priceDeltaPct(current_price, repricePreview(sku).effectivePrice)| desc;
//               SKUs with a null delta (no-action / no current price) sort last; stable among equals
```

`impact` uses the **effective** (post-clamp) price, so the ranking reflects what would actually happen. Composes `repricePreview`, `guardrailStatus`, and D's `priceDeltaPct`.

### 4.5 `change-log-summary.ts`

```ts
import type { PriceChange } from '@/lib/api'
export interface ChangeLogSummary { count: number; netRevenueDelta: number | null }
// count = changes.length; netRevenueDelta = sum of non-null revenue_delta, or null if NONE have one.
export function changeLogSummary(changes: PriceChange[]): ChangeLogSummary
```

## 5. URL params (extend `lib/dashboard/url-params.ts`)

```ts
import type { RepriceFilter, RepriceSort } from '@/lib/dashboard/reprice-filter'

export function parseRepriceFilter(v: string | null): RepriceFilter   // valid value or 'all'
export function parseRepriceSort(v: string | null): RepriceSort       // valid value or 'default'
export function parseSearchQuery(v: string | null): string            // (v ?? '').trim()
```
`RepriceFilter`/`RepriceSort` are defined once in `reprice-filter.ts` and imported here (the `AlertSort` pattern from D). URL keys: `q`, `filter`, `sort` — all default-omitted via sub-project B's merge-not-replace `set` (defaults `''` / `'all'` / `'default'` map to `null`). No collision with the existing `?sku`/`?source` deep-link keys.

## 6. Components (`components/dashboard/`)

### 6.1 `reprice-preview-chip.tsx`
Props `{ preview: RepricePreview; currentPrice: number | null }`. Renders a small state chip + the effective price + `formatPriceDelta(currentPrice, preview.effectivePrice)` when non-null.

| state | label | color |
|-------|-------|-------|
| `within` | "Within bounds" | primary |
| `floor-clamped` | "Floor-clamped" | amber-400 |
| `ceiling-clamped` | "Ceiling-clamped" | amber-400 |
| `no-guardrails` | "No guardrails" | muted, amber outline |
| `no-action` | "—" (or hidden) | muted |

### 6.2 `reprice-coverage.tsx`
Props `{ summary: CoverageSummary; onFilter: (f: RepriceFilter) => void }`. Renders:
`"{withGuardrails}/{total} guardrails · {autoOn} auto-on · {needsAttention} need attention"`.
The **Need Attention** segment is a button → `onFilter('needs-attention')`; the **Auto On** segment is a button → `onFilter('auto-on')`. The guardrails ratio is a plain stat (no 1:1 filter). `needsAttention > 0` renders in rose; `0` in muted.

### 6.3 Reuse from D
`ConfidenceMeter` (`latest_suggestion.confidence` is present) on each row's suggestion, and `formatPriceDelta` inside the preview chip. `SignalProvenance` is **not** used (no provenance fields in `LatestSuggestion`).

## 7. Page wiring (`app/(dashboard)/repricing/page.tsx`)

- Read `q = parseSearchQuery(get('q'))`, `filter = parseRepriceFilter(get('filter'))`, `sort = parseRepriceSort(get('sort'))`.
- `<RepriceCoverage summary={coverageSummary(data.skus)} onFilter={(f) => set({ filter: f === 'all' ? null : f })} />` under the header.
- Controls row above the list: a **Search** input (`onChange` → `set({ q: e.target.value || null })`, `value={q}`), a **Filter** dropdown (All / Needs Attention / Needs Guardrails / Auto On / Would Clamp), a **Sort** dropdown (Default / Needs Attention First / Impact).
- Display pipeline (applied to `data.skus`): `sortRepriceSKUs(filterRepriceSKUs(searchRepriceSKUs(skus, q), filter), sort)` → map to `SKURow`.
- `SKURow` additions: a `ConfidenceMeter` on the suggestion line; a `<RepricePreviewChip preview={repricePreview(sku)} currentPrice={sku.current_price} />`; inline bounds error — compute `const boundsError = validateBounds(floor, ceiling)`, render it below the inputs when non-null, and disable Save when `boundsError` is set (in addition to the existing `dirty`/`saving` checks).
- Change log: a summary line from `changeLogSummary(changes)` (`net +$X.XX over N changes`, color by sign; "—" when `netRevenueDelta` is null) and a `source` badge on each row.
- The existing `?sku`/`?source` deep-link landing (prefill, scroll, highlight, toast) is **unchanged**. It runs against whatever rows render; if a deep-linked SKU is filtered/searched out, the current "isn't in your repricing list" behavior is unaffected (no new coupling between deep-link and the view controls).

## 8. Data flow, loading & errors

- All view state (search/filter/sort) is URL state via sub-project B's `useQueryParams` — shareable, refresh-durable, default-omitted. No new global/Zustand state.
- `error?.status === 403` → existing `UpgradeGate` (backend remains the real plan gate).
- Loading/empty states reuse the page's current markup. Every derived value reads `RepriceSKU`/`PriceChange` fields that already exist; nothing is read that could be absent.

## 9. Testing

Per CLAUDE.md (web) — **test pure logic only**; components and the page are verified by `npx tsc --noEmit` + `npm run build`, not unit tests.

- New pure suites: `reprice-preview.test.ts`, `guardrail-coverage.test.ts`, `bounds-validation.test.ts`, `reprice-filter.test.ts`, `change-log-summary.test.ts`, plus new parser cases in `url-params.test.ts`.
- No component or page tests.
- Full gate: `npm test -- --run` (all prior suites + the new ones), `npm run lint`, `npm run build`.

## 10. Acceptance criteria

- Each SKU row shows a projected-price chip — Within bounds / Floor-clamped / Ceiling-clamped / No guardrails / No action — with the effective price and a Δ% versus current, plus a confidence meter on the suggestion.
- A coverage header shows `withGuardrails/total`, `autoOn`, and `needsAttention`; clicking **Need Attention** applies `?filter=needs-attention` and clicking **Auto On** applies `?filter=auto-on`.
- Entering floor > ceiling (or a negative value) shows an inline error and disables Save before any request is sent.
- The Search box narrows rows by product title; Filter subsets by needs-attention / needs-guardrails / auto-on / would-clamp; Sort offers Default / Needs Attention First / Impact. Search, filter, and sort all round-trip through the URL and restore on reload.
- The change log shows a net-revenue-delta + count summary and a source badge per change.
- `npm test -- --run` passes including the new pure suites; `npm run build` succeeds.

## 11. Implementation notes

- `specter-web` is its own git repo (branch `main`); create branch `repricing-confidence-control`. End commits with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer. Never `git add .`/`-A` — stage explicit paths.
- **Preview layer:** the working tree carries an uncommitted preview/demo layer (`lib/api.ts` previewFn wiring + untracked `lib/preview-data.ts`). F adds no `lib/api.ts` changes, so no clean-blob staging dance is needed this time; just do not stage `lib/api.ts` or `lib/preview-data.ts`. Optionally extend `preview-data.ts` locally (uncommitted) so the demo renders the new chips/coverage, but never commit it.
- Build order: pure modules → URL parsers → components → page wiring, so each layer is tested before its consumer.
- Reuse sub-project B's URL conventions (default-omission, merge-not-replace `set`); do not add local state for the view controls.
- Do not modify plan gating, the repricing endpoints, or the reprice pipeline.
