# Attribution Clarity & Drill-down — Design Spec

> Dashboard UX optimization **sub-project G** (last in the A→G sequence). Web-only enhancement to the `/attribution` page (F8 / PHANTOM+). Builds on sub-project B (deep-link / URL view-state), D (enrichment conventions), and F (pure-helper + tests + thin-page pattern).

**Date:** 2026-06-03
**Repo:** `specter-web` only — NO backend, migration, plan-gate, or pipeline change.

---

## 1. Goal

Turn `/attribution` from a single time-series bar chart + 3 totals into a page that answers **which products** and **which changes** drove the revenue impact — derived entirely from existing API responses.

## 2. Problem

The current page (`app/(dashboard)/attribution/page.tsx`) shows:
- 3 stat cards: Recovered / Lost / Net impact
- A 7/30/90-day range selector (`?days=`, default 30)
- One bar chart (date vs `revenue_delta`)
- A CSV export button

It answers *when* revenue moved, never *which products* or *which individual changes*. It is noticeably thinner than `/signals` and `/repricing`.

## 3. Data sources (both already exist)

| Hook | Returns | Role |
|------|---------|------|
| `useAttribution(days)` | `{ series: [{date, revenue_delta}], total_recovered, total_lost, net }` — server-computed over `source=='auto'`, range-scoped, non-null delta | **Source of truth for $ totals and the chart** |
| `usePriceChanges()` | last **100** `PriceChange` rows (all sources), newest-first: `{ id, sku_id, sku_title, old_price, new_price, source, revenue_delta, created_at }` | Derives the breakdown + day drill-down |

Both endpoints are callable on this page: `/repricing/changes` is CIPHER-gated and PHANTOM ⊇ CIPHER, so a PHANTOM merchant (the minimum for `/attribution`) always has access.

### 3.1 Alignment rule (chart-as-truth, leaderboard-as-lens)

The chart is authoritative. The leaderboard/drill-down are an **investigative lens** derived from the recent change log, filtered to match the chart's story:

```
accounted = changes filtered to:
    source === 'auto'
    AND revenue_delta !== null
    AND created_at >= (now − days)
```

The leaderboard is **never claimed to penny-reconcile** with the chart net. On very high-volume 90-day windows the 100-row cap means older qualifying changes may not be loaded — surfaced via the partial-data disclaimer (§5.1).

### 3.2 Day-bucketing

`usePriceChanges` `created_at` is tz-aware **UTC** ISO (e.g. `2026-05-28T14:03:00+00:00`). The server groups the chart by `created_at.date()` (UTC date). The client must match: `dayKey(iso) = iso.slice(0, 10)`. This guarantees drill-down rows line up with the bar they came from.

---

## 4. Pure helper modules

Each module is a pure function set with a colocated `.test.ts` (Vitest). No React, no I/O.

### 4.1 `lib/dashboard/attribution-breakdown.ts`

```ts
import type { PriceChange } from '@/lib/api'

export type BreakdownSort = 'net' | 'recovered' | 'lost' | 'count'

export interface SkuBreakdown {
  sku_id: string
  sku_title: string
  recovered: number   // sum of positive deltas
  lost: number        // sum of negative deltas (<= 0)
  net: number         // recovered + lost
  count: number       // number of accounted changes
}

// Shared filtered base: auto + non-null delta + within the trailing `days` window.
export function attributionAccountedChanges(
  changes: PriceChange[],
  days: number,
  now?: number,            // epoch ms; defaults to Date.now() — injectable for tests
): PriceChange[]

// Group accounted changes by SKU.
export function skuBreakdown(accounted: PriceChange[]): SkuBreakdown[]

// Fully deterministic sort (total order — never jitters between renders).
// Every chain ends in `sku_title ASC` so equal-value rows have a stable position.
//   net:       net DESC       → recovered DESC → sku_title ASC
//   recovered: recovered DESC → net DESC       → sku_title ASC
//   lost:      lost ASC (most-negative first) → net ASC → sku_title ASC
//   count:     count DESC     → net DESC       → sku_title ASC
export function sortSkuBreakdown(rows: SkuBreakdown[], sort: BreakdownSort): SkuBreakdown[]

// Total accounted-change count (for the 4th stat card).
export function totalChangeCount(rows: SkuBreakdown[]): number

// True when the raw change response is exactly at the 100-row cap — i.e. there
// MAY be older qualifying changes beyond what was loaded. (The response can
// never exceed 100, so === 100 is the precise truncation signal.)
export function isBreakdownPartial(rawCount: number): boolean   // rawCount === 100
```

### 4.2 `lib/dashboard/attribution-day.ts`

```ts
import type { PriceChange } from '@/lib/api'

export function dayKey(iso: string): string   // iso.slice(0, 10), UTC date

// Accounted changes on a given YYYY-MM-DD, sorted by |revenue_delta| desc (biggest movers first).
export function changesOnDay(accounted: PriceChange[], day: string): PriceChange[]
```

### 4.3 `lib/dashboard/attribution-insight.ts`

```ts
import type { AttributionChart } from '@/lib/api'
import type { SkuBreakdown } from '@/lib/dashboard/attribution-breakdown'

export interface AttributionInsight {
  net: number
  days: number
  bestDay: { date: string; value: number } | null   // max revenue_delta day, null if no positive day
  positiveDays: number                               // series entries with revenue_delta > 0
  totalDays: number                                  // series.length
  topProduct: { sku_title: string; net: number } | null  // breakdown max net, null if none > 0
}

export function attributionInsight(
  chart: AttributionChart,
  breakdown: SkuBreakdown[],
  days: number,
): AttributionInsight

// Headline string; omits clauses gracefully when parts are null.
// e.g. "Net +$3,240 over 30d · best +$412 on May 28 · 21/30 days positive · top: Aurora Headphones"
export function formatInsight(insight: AttributionInsight): string
```

### 4.4 `lib/dashboard/url-params.ts` (append, like F)

```ts
import type { BreakdownSort } from '@/lib/dashboard/attribution-breakdown'

export function parseBreakdownSort(v: string | null): BreakdownSort  // default 'net'
export function parseDay(v: string | null): string | null            // validates /^\d{4}-\d{2}-\d{2}$/, else null
```

(`days` keeps using the existing `parseDays`.)

---

## 5. Components

### 5.1 `components/dashboard/attribution-insight-line.tsx`
Renders `formatInsight(insight)` as a muted headline above the stat cards. Rendered only when the chart has data.

### 5.2 Design note — no source badge
A source badge was considered but **dropped as redundant**: the `accounted` filter is `source==='auto'` only (§3.1), so every leaderboard and drill-down row is necessarily `auto`. A badge that always shows the same label adds no information. The page header already states the page covers automatic price changes. (YAGNI — keeps scope tight.)

### 5.3 `components/dashboard/attribution-day-panel.tsx`
The drill-down panel, shown when `?day` is set to a valid series date:
- Header: `<formatted date> · N changes` + dismiss control (✕ → `set({ day: null })`).
- One row per change from `changesOnDay`: product title, `old→new` price, colored `revenue_delta` (primary if ≥0, rose if <0).
- Each row links to `/repricing?sku=<sku_id>`.

---

## 6. Page integration (`app/(dashboard)/attribution/page.tsx`)

Vertical flow (single-page progressive, approved mockup):

1. **Header** — unchanged (title + Export CSV).
2. **Insight line** (§5.1) — when `hasData`.
3. **Stat cards** — now **four**: Recovered, Lost, Net, **Changes** (`totalChangeCount(breakdown)`).
4. **Range selector** — unchanged (`?days`).
5. **Chart** — bars become **clickable**: clicking a bar `set({ day: <point.date> })`; the selected day's bar is highlighted (brighter fill / outline via its `Cell`). Clicking the selected bar again or the panel dismiss clears it.
6. **Day drill-down panel** (§5.3) — when `parseDay(get('day'))` is set and matches a series date.
7. **Top movers leaderboard:**
   - Sort dropdown bound to `?sku_sort` (`net` | `recovered` | `lost` | `count`), default `net`.
   - Columns: **Product | Recovered | Lost | Net | Changes** (recovered primary-tinted, lost rose-tinted, net colored by sign).
   - Per row: primary **"Review & Act" → `/repricing?sku=<sku_id>`** (action); secondary subtle **"View product" → `/products?q=<encodeURIComponent(sku_title)>`** (inspection).
   - **Partial-data disclaimer:** when `isBreakdownPartial(rawChanges.length)`, render a muted line under the leaderboard heading: *"Breakdown is based on the most recent available changes and may not include older changes in this range."*
   - **Empty state:** when `accounted` is empty (e.g. only manual/ai changes, or none in range) even though the chart has server data, show a muted note: *"No auto-reprice changes in this range to break down."*

### 6.1 URL view-state
`?days` (existing) + `?day=YYYY-MM-DD` + `?sku_sort` — all via `useQueryParams` with default-omission, consistent with sub-project B. No scroll jump (`router.replace`).

### 6.2 Derivation pipeline (in page)
```
rawChanges = usePriceChanges().data ?? []
accounted  = attributionAccountedChanges(rawChanges, days)
breakdown  = sortSkuBreakdown(skuBreakdown(accounted), parseBreakdownSort(get('sku_sort')))
insight    = attributionInsight(chartData, skuBreakdown(accounted), days)
```

---

## 7. Testing

- **Pure helpers only** (Vitest): `attribution-breakdown`, `attribution-day`, `attribution-insight`, and the new `url-params` parsers. Cover: range/source/null filtering, grouping math, each sort order **plus its tie-breaker chain** (equal-value rows resolve deterministically down to `sku_title ASC`), `dayKey` UTC slicing, `changesOnDay` ordering, insight clause omission, `formatInsight` copy, `isBreakdownPartial` at exactly 100 (false at 99, true at 100).
- **Page + components** verified by `npx tsc --noEmit` + `npm run build`. **No component/page tests** (per CLAUDE.md — test pure logic only).

## 8. Explicitly out of scope (web-only constraint)

- Range-scoped CSV — `/attribution/export.csv` ignores `days`; left as-is.
- Per-change `units_sold` — not in the API.
- "Data delayed" badge (F8 edge case) — needs a backend freshness signal.
- Period-over-period comparison / forecasting.

## 9. Preview-layer constraint (in force)

`specter-web` working tree carries an **uncommitted** preview/demo layer: `lib/api.ts` (modified, `previewFn` wiring) + untracked `lib/preview-data.ts`. G adds no `lib/api.ts` change. Never stage/commit `lib/api.ts` or `lib/preview-data.ts`. Leave the WIP `app/tools/price-position-analyzer/page.tsx` untouched. If the leaderboard needs preview data to render under `NEXT_PUBLIC_PREVIEW`, `previewPriceChanges` already exists in `lib/preview-data.ts` and is wired through `usePriceChanges`.

## 10. File summary

**Create:**
- `lib/dashboard/attribution-breakdown.ts` (+ `.test.ts`)
- `lib/dashboard/attribution-day.ts` (+ `.test.ts`)
- `lib/dashboard/attribution-insight.ts` (+ `.test.ts`)
- `components/dashboard/attribution-insight-line.tsx`
- `components/dashboard/attribution-day-panel.tsx`

**Modify:**
- `lib/dashboard/url-params.ts` (+ `.test.ts`) — append `parseBreakdownSort`, `parseDay`
- `app/(dashboard)/attribution/page.tsx` — integration
