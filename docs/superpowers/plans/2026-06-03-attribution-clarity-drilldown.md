# Attribution Clarity & Drill-down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `specter-web`'s `/attribution` page from a single time-series chart into a page that answers *which products* and *which days* created the revenue impact — web-only, derived from existing API responses.

**Architecture:** Three pure helper modules (`attribution-breakdown`, `attribution-day`, `attribution-insight`) + two URL parsers do all logic, each with colocated Vitest tests. Two thin presentational components (`attribution-insight-line`, `attribution-day-panel`) and a page rewrite compose them. The chart's server totals stay authoritative; the per-SKU leaderboard and day drill-down are derived client-side from `usePriceChanges()` (last-100 change log) filtered to `source==='auto'` + non-null delta + within the selected range.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind, Recharts, TanStack Query, Vitest. Spec: `docs/superpowers/specs/2026-06-03-attribution-clarity-drilldown-design.md`.

**Working directory for all commands:** `C:\Users\manoj\New Specter\specter-web`

**Critical constraints (from CLAUDE.md + project memory):**
- Test **pure logic only** — no component/page tests. Verify components/page via `npx tsc --noEmit` and `npm run build`.
- **NEVER** stage `lib/api.ts` or `lib/preview-data.ts` (uncommitted preview layer). This plan does not modify them.
- Never touch `app/tools/price-position-analyzer/page.tsx` (unrelated WIP).
- Stage only exact paths — never `git add .` / `git add -A`.
- Commit trailer on every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Vitest does NOT type-check (esbuild transpile). Pure modules are verified by `npx vitest run`; `.tsx` by `npx tsc --noEmit`.

**Reference shapes (already in `lib/api.ts`, do NOT redefine):**
```ts
export interface PriceChange {
  id: string; sku_id: string; sku_title: string
  old_price: number; new_price: number
  source: string; revenue_delta: number | null; created_at: string
}
export interface DailyPoint { date: string; revenue_delta: number }
export interface AttributionChart {
  series: DailyPoint[]; total_recovered: number; total_lost: number; net: number
}
export function useAttribution(days?: number): UseQueryResult<AttributionChart, ApiError>
export function usePriceChanges(): UseQueryResult<PriceChange[], ApiError>
export async function downloadAttributionCsv(): Promise<boolean>
```

---

### Task 1: `attribution-breakdown.ts` — accounted filter, per-SKU grouping, sort, totals

**Files:**
- Create: `lib/dashboard/attribution-breakdown.ts`
- Test: `lib/dashboard/attribution-breakdown.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/dashboard/attribution-breakdown.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  attributionAccountedChanges,
  skuBreakdown,
  sortSkuBreakdown,
  totalChangeCount,
  isBreakdownPartial,
  formatSignedUsd,
  type SkuBreakdown,
} from './attribution-breakdown'
import type { PriceChange } from '@/lib/api'

const NOW = Date.UTC(2026, 5, 3, 12, 0, 0) // 2026-06-03T12:00:00Z

function pc(p: Partial<PriceChange> = {}): PriceChange {
  return {
    id: 'pc',
    sku_id: 's1',
    sku_title: 'Widget',
    old_price: 100,
    new_price: 110,
    source: 'auto',
    revenue_delta: 10,
    created_at: '2026-06-03T00:00:00+00:00',
    ...p,
  }
}

function row(p: Partial<SkuBreakdown> = {}): SkuBreakdown {
  return { sku_id: 's', sku_title: 'A', recovered: 0, lost: 0, net: 0, count: 0, ...p }
}

describe('attributionAccountedChanges', () => {
  it('keeps only auto, non-null delta, within range', () => {
    const list = [
      pc({ id: 'a', source: 'auto', revenue_delta: 5 }),
      pc({ id: 'b', source: 'manual', revenue_delta: 5 }),
      pc({ id: 'c', source: 'auto', revenue_delta: null }),
      pc({ id: 'd', source: 'auto', revenue_delta: 5, created_at: '2026-04-01T00:00:00+00:00' }),
    ]
    const out = attributionAccountedChanges(list, 30, NOW)
    expect(out.map((c) => c.id)).toEqual(['a'])
  })

  it('includes a change exactly at the cutoff boundary', () => {
    const cutoffIso = new Date(NOW - 7 * 86_400_000).toISOString()
    const out = attributionAccountedChanges([pc({ id: 'edge', created_at: cutoffIso })], 7, NOW)
    expect(out.map((c) => c.id)).toEqual(['edge'])
  })
})

describe('skuBreakdown', () => {
  it('groups by sku, splitting recovered vs lost and summing net + count', () => {
    const out = skuBreakdown([
      pc({ sku_id: 's1', sku_title: 'Widget', revenue_delta: 20 }),
      pc({ sku_id: 's1', sku_title: 'Widget', revenue_delta: -5 }),
      pc({ sku_id: 's2', sku_title: 'Gadget', revenue_delta: 8 }),
    ])
    const widget = out.find((r) => r.sku_id === 's1')!
    expect(widget).toMatchObject({ recovered: 20, lost: -5, net: 15, count: 2 })
    const gadget = out.find((r) => r.sku_id === 's2')!
    expect(gadget).toMatchObject({ recovered: 8, lost: 0, net: 8, count: 1 })
  })

  it('rounds to cents (no float drift)', () => {
    const out = skuBreakdown([
      pc({ revenue_delta: 0.1 }),
      pc({ revenue_delta: 0.2 }),
    ])
    expect(out[0].net).toBe(0.3)
  })
})

describe('sortSkuBreakdown', () => {
  it('net: net desc, then recovered desc, then title asc', () => {
    const rows = [
      row({ sku_id: 'a', sku_title: 'Beta', net: 10, recovered: 10 }),
      row({ sku_id: 'b', sku_title: 'Alpha', net: 10, recovered: 10 }),
      row({ sku_id: 'c', sku_title: 'Gamma', net: 10, recovered: 20 }),
      row({ sku_id: 'd', sku_title: 'Delta', net: 5, recovered: 5 }),
    ]
    expect(sortSkuBreakdown(rows, 'net').map((r) => r.sku_id)).toEqual(['c', 'b', 'a', 'd'])
  })

  it('lost: most-negative first, then net asc, then title asc', () => {
    const rows = [
      row({ sku_id: 'a', sku_title: 'Beta', lost: -5, net: -5 }),
      row({ sku_id: 'b', sku_title: 'Alpha', lost: -20, net: -20 }),
      row({ sku_id: 'c', sku_title: 'Gamma', lost: -20, net: -10 }),
    ]
    expect(sortSkuBreakdown(rows, 'lost').map((r) => r.sku_id)).toEqual(['b', 'c', 'a'])
  })

  it('count: count desc, then net desc, then title asc', () => {
    const rows = [
      row({ sku_id: 'a', sku_title: 'Beta', count: 3, net: 1 }),
      row({ sku_id: 'b', sku_title: 'Alpha', count: 3, net: 9 }),
      row({ sku_id: 'c', sku_title: 'Gamma', count: 1, net: 50 }),
    ]
    expect(sortSkuBreakdown(rows, 'count').map((r) => r.sku_id)).toEqual(['b', 'a', 'c'])
  })

  it('recovered: recovered desc, then net desc, then title asc', () => {
    const rows = [
      row({ sku_id: 'a', sku_title: 'Beta', recovered: 10, net: 2 }),
      row({ sku_id: 'b', sku_title: 'Alpha', recovered: 10, net: 8 }),
    ]
    expect(sortSkuBreakdown(rows, 'recovered').map((r) => r.sku_id)).toEqual(['b', 'a'])
  })

  it('does not mutate the input array', () => {
    const rows = [row({ sku_id: 'a', net: 1 }), row({ sku_id: 'b', net: 2 })]
    sortSkuBreakdown(rows, 'net')
    expect(rows.map((r) => r.sku_id)).toEqual(['a', 'b'])
  })
})

describe('totalChangeCount', () => {
  it('sums counts across rows', () => {
    expect(totalChangeCount([row({ count: 3 }), row({ count: 4 })])).toBe(7)
  })
})

describe('isBreakdownPartial', () => {
  it('true only at exactly 100', () => {
    expect(isBreakdownPartial(99)).toBe(false)
    expect(isBreakdownPartial(100)).toBe(true)
  })
})

describe('formatSignedUsd', () => {
  it('positive gets +$, negative gets unicode minus', () => {
    expect(formatSignedUsd(420)).toBe('+$420.00')
    expect(formatSignedUsd(-210.5)).toBe('−$210.50')
    expect(formatSignedUsd(0)).toBe('+$0.00')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/dashboard/attribution-breakdown.test.ts`
Expected: FAIL — "Failed to resolve import './attribution-breakdown'".

- [ ] **Step 3: Write the implementation**

Create `lib/dashboard/attribution-breakdown.ts`:

```ts
// Per-SKU aggregation of attributed (auto) price changes — the leaderboard's source.
// The chart endpoint stays authoritative for totals; this is a "where did it come
// from" lens derived from the recent change log.

import type { PriceChange } from '@/lib/api'

export type BreakdownSort = 'net' | 'recovered' | 'lost' | 'count'

export interface SkuBreakdown {
  sku_id: string
  sku_title: string
  recovered: number // sum of positive deltas (>= 0)
  lost: number // sum of negative deltas (<= 0)
  net: number // recovered + lost
  count: number // number of accounted changes
}

// Filter the change log to what the attribution chart counts: auto source,
// non-null revenue_delta, created within the trailing `days` window.
export function attributionAccountedChanges(
  changes: PriceChange[],
  days: number,
  now: number = Date.now(),
): PriceChange[] {
  const cutoff = now - days * 86_400_000
  return changes.filter(
    (c) =>
      c.source === 'auto' &&
      c.revenue_delta !== null &&
      new Date(c.created_at).getTime() >= cutoff,
  )
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function skuBreakdown(accounted: PriceChange[]): SkuBreakdown[] {
  const map = new Map<string, SkuBreakdown>()
  for (const c of accounted) {
    const delta = c.revenue_delta ?? 0
    let r = map.get(c.sku_id)
    if (!r) {
      r = { sku_id: c.sku_id, sku_title: c.sku_title, recovered: 0, lost: 0, net: 0, count: 0 }
      map.set(c.sku_id, r)
    }
    if (delta >= 0) r.recovered += delta
    else r.lost += delta
    r.net += delta
    r.count += 1
  }
  return [...map.values()].map((r) => ({
    ...r,
    recovered: round2(r.recovered),
    lost: round2(r.lost),
    net: round2(r.net),
  }))
}

function byTitle(a: SkuBreakdown, b: SkuBreakdown): number {
  return a.sku_title.localeCompare(b.sku_title)
}

// Fully deterministic (total order) — equal-value rows resolve down to sku_title asc.
export function sortSkuBreakdown(rows: SkuBreakdown[], sort: BreakdownSort): SkuBreakdown[] {
  const copy = [...rows]
  switch (sort) {
    case 'recovered':
      return copy.sort((a, b) => b.recovered - a.recovered || b.net - a.net || byTitle(a, b))
    case 'lost':
      return copy.sort((a, b) => a.lost - b.lost || a.net - b.net || byTitle(a, b))
    case 'count':
      return copy.sort((a, b) => b.count - a.count || b.net - a.net || byTitle(a, b))
    case 'net':
    default:
      return copy.sort((a, b) => b.net - a.net || b.recovered - a.recovered || byTitle(a, b))
  }
}

export function totalChangeCount(rows: SkuBreakdown[]): number {
  return rows.reduce((sum, r) => sum + r.count, 0)
}

// True when the raw change response is exactly at the 100-row cap — older
// qualifying changes MAY exist beyond what was loaded.
export function isBreakdownPartial(rawCount: number): boolean {
  return rawCount === 100
}

// "+$420.00" / "−$210.50" — unicode minus (U+2212), matching price-delta.ts.
export function formatSignedUsd(n: number): string {
  const sign = n < 0 ? '−' : '+'
  return `${sign}$${Math.abs(n).toFixed(2)}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/dashboard/attribution-breakdown.test.ts`
Expected: PASS — all suites green.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/attribution-breakdown.ts lib/dashboard/attribution-breakdown.test.ts
git commit -m "$(cat <<'EOF'
feat(attribution): add per-SKU breakdown, sort, totals helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `attribution-day.ts` — UTC day key, day label, changes-on-day

**Files:**
- Create: `lib/dashboard/attribution-day.ts`
- Test: `lib/dashboard/attribution-day.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/dashboard/attribution-day.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { dayKey, formatDayLabel, changesOnDay } from './attribution-day'
import type { PriceChange } from '@/lib/api'

function pc(p: Partial<PriceChange> = {}): PriceChange {
  return {
    id: 'pc', sku_id: 's', sku_title: 'Widget',
    old_price: 100, new_price: 110, source: 'auto',
    revenue_delta: 10, created_at: '2026-05-28T14:03:00+00:00',
    ...p,
  }
}

describe('dayKey', () => {
  it('returns the UTC date slice', () => {
    expect(dayKey('2026-05-28T14:03:00+00:00')).toBe('2026-05-28')
    expect(dayKey('2026-12-01T00:00:00Z')).toBe('2026-12-01')
  })
})

describe('formatDayLabel', () => {
  it('renders Mon D from YYYY-MM-DD (locale-independent)', () => {
    expect(formatDayLabel('2026-05-28')).toBe('May 28')
    expect(formatDayLabel('2026-01-03')).toBe('Jan 3')
    expect(formatDayLabel('2026-12-31')).toBe('Dec 31')
  })
})

describe('changesOnDay', () => {
  it('keeps only that UTC day, sorted by |delta| desc', () => {
    const list = [
      pc({ id: 'a', created_at: '2026-05-28T01:00:00+00:00', revenue_delta: 50 }),
      pc({ id: 'b', created_at: '2026-05-28T23:00:00+00:00', revenue_delta: -120 }),
      pc({ id: 'c', created_at: '2026-05-29T00:00:00+00:00', revenue_delta: 999 }),
    ]
    expect(changesOnDay(list, '2026-05-28').map((c) => c.id)).toEqual(['b', 'a'])
  })

  it('empty when no change matches', () => {
    expect(changesOnDay([pc({ created_at: '2026-05-29T00:00:00+00:00' })], '2026-05-28')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/dashboard/attribution-day.test.ts`
Expected: FAIL — "Failed to resolve import './attribution-day'".

- [ ] **Step 3: Write the implementation**

Create `lib/dashboard/attribution-day.ts`:

```ts
// Day-bucketing for the chart drill-down. The chart groups server-side by the
// UTC date of created_at, so the client must match (iso.slice(0,10)).

import type { PriceChange } from '@/lib/api'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

// "2026-05-28" -> "May 28". Pure string math (no Date) so it is timezone-safe.
export function formatDayLabel(day: string): string {
  const [, m, d] = day.split('-').map(Number)
  const month = MONTHS[(m ?? 1) - 1] ?? ''
  return `${month} ${d ?? ''}`.trim()
}

// Accounted changes on a given YYYY-MM-DD, biggest movers first.
export function changesOnDay(accounted: PriceChange[], day: string): PriceChange[] {
  return accounted
    .filter((c) => dayKey(c.created_at) === day)
    .sort((a, b) => Math.abs(b.revenue_delta ?? 0) - Math.abs(a.revenue_delta ?? 0))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/dashboard/attribution-day.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/attribution-day.ts lib/dashboard/attribution-day.test.ts
git commit -m "$(cat <<'EOF'
feat(attribution): add day-key, day-label, changes-on-day helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `attribution-insight.ts` — insight derivation + headline copy

**Files:**
- Create: `lib/dashboard/attribution-insight.ts`
- Test: `lib/dashboard/attribution-insight.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/dashboard/attribution-insight.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { attributionInsight, formatInsight } from './attribution-insight'
import type { AttributionChart } from '@/lib/api'
import type { SkuBreakdown } from './attribution-breakdown'

function chart(p: Partial<AttributionChart> = {}): AttributionChart {
  return {
    series: [
      { date: '2026-05-26', revenue_delta: 100 },
      { date: '2026-05-27', revenue_delta: -40 },
      { date: '2026-05-28', revenue_delta: 412 },
    ],
    total_recovered: 512,
    total_lost: -40,
    net: 472,
    ...p,
  }
}

function row(p: Partial<SkuBreakdown> = {}): SkuBreakdown {
  return { sku_id: 's', sku_title: 'A', recovered: 0, lost: 0, net: 0, count: 0, ...p }
}

describe('attributionInsight', () => {
  it('computes bestDay, positiveDays, totalDays, topProduct', () => {
    const out = attributionInsight(chart(), [row({ sku_title: 'Aurora', net: 300 }), row({ sku_title: 'Drift', net: -10 })], 30)
    expect(out).toMatchObject({
      net: 472,
      days: 30,
      bestDay: { date: '2026-05-28', value: 412 },
      positiveDays: 2,
      totalDays: 3,
      topProduct: { sku_title: 'Aurora', net: 300 },
    })
  })

  it('bestDay null when no positive day; topProduct null when none > 0', () => {
    const out = attributionInsight(
      chart({ series: [{ date: '2026-05-26', revenue_delta: -5 }], net: -5, total_recovered: 0, total_lost: -5 }),
      [row({ sku_title: 'Drift', net: -10 })],
      7,
    )
    expect(out.bestDay).toBeNull()
    expect(out.topProduct).toBeNull()
    expect(out.positiveDays).toBe(0)
  })
})

describe('formatInsight', () => {
  it('full headline with all clauses', () => {
    const insight = attributionInsight(chart(), [row({ sku_title: 'Aurora', net: 300 })], 30)
    expect(formatInsight(insight)).toBe(
      'Net +$472 over 30d · best +$412 on May 28 · 2/3 days positive · top: Aurora',
    )
  })

  it('omits bestDay and topProduct clauses when null; thousands separator on net', () => {
    const insight = attributionInsight(
      chart({ series: [{ date: '2026-05-26', revenue_delta: -5 }], net: -3240, total_recovered: 0, total_lost: -3240 }),
      [],
      7,
    )
    expect(formatInsight(insight)).toBe('Net −$3,240 over 7d · 0/1 days positive')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/dashboard/attribution-insight.test.ts`
Expected: FAIL — "Failed to resolve import './attribution-insight'".

- [ ] **Step 3: Write the implementation**

Create `lib/dashboard/attribution-insight.ts`:

```ts
// Plain-English headline above the chart. Pure derivation + formatting.

import type { AttributionChart } from '@/lib/api'
import type { SkuBreakdown } from '@/lib/dashboard/attribution-breakdown'
import { formatDayLabel } from '@/lib/dashboard/attribution-day'

export interface AttributionInsight {
  net: number
  days: number
  bestDay: { date: string; value: number } | null
  positiveDays: number
  totalDays: number
  topProduct: { sku_title: string; net: number } | null
}

export function attributionInsight(
  chart: AttributionChart,
  breakdown: SkuBreakdown[],
  days: number,
): AttributionInsight {
  let bestDay: { date: string; value: number } | null = null
  let positiveDays = 0
  for (const p of chart.series) {
    if (p.revenue_delta > 0) {
      positiveDays += 1
      if (bestDay === null || p.revenue_delta > bestDay.value) {
        bestDay = { date: p.date, value: p.revenue_delta }
      }
    }
  }

  let topProduct: { sku_title: string; net: number } | null = null
  for (const r of breakdown) {
    if (r.net > 0 && (topProduct === null || r.net > topProduct.net)) {
      topProduct = { sku_title: r.sku_title, net: r.net }
    }
  }

  return {
    net: chart.net,
    days,
    bestDay,
    positiveDays,
    totalDays: chart.series.length,
    topProduct,
  }
}

// "+$3,240" / "−$100" — whole dollars, thousands-grouped, unicode minus.
function money(n: number): string {
  const sign = n < 0 ? '−' : '+'
  const whole = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}$${whole}`
}

export function formatInsight(insight: AttributionInsight): string {
  const parts = [`Net ${money(insight.net)} over ${insight.days}d`]
  if (insight.bestDay) {
    parts.push(`best ${money(insight.bestDay.value)} on ${formatDayLabel(insight.bestDay.date)}`)
  }
  parts.push(`${insight.positiveDays}/${insight.totalDays} days positive`)
  if (insight.topProduct) {
    parts.push(`top: ${insight.topProduct.sku_title}`)
  }
  return parts.join(' · ')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/dashboard/attribution-insight.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/attribution-insight.ts lib/dashboard/attribution-insight.test.ts
git commit -m "$(cat <<'EOF'
feat(attribution): add insight derivation + headline formatter

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: URL parsers — `parseBreakdownSort`, `parseDay`

**Files:**
- Modify: `lib/dashboard/url-params.ts` (append parsers + import)
- Test: `lib/dashboard/url-params.test.ts` (append cases + imports)

- [ ] **Step 1: Write the failing test**

Append to the import block at the top of `lib/dashboard/url-params.test.ts` — change:

```ts
  parseRepriceFilter,
  parseRepriceSort,
  parseSearchQuery,
} from './url-params'
```
to:
```ts
  parseRepriceFilter,
  parseRepriceSort,
  parseSearchQuery,
  parseBreakdownSort,
  parseDay,
} from './url-params'
```

Then append these suites to the end of `lib/dashboard/url-params.test.ts`:

```ts
describe('parseBreakdownSort', () => {
  it('accepts known sorts', () => {
    expect(parseBreakdownSort('recovered')).toBe('recovered')
    expect(parseBreakdownSort('lost')).toBe('lost')
    expect(parseBreakdownSort('count')).toBe('count')
    expect(parseBreakdownSort('net')).toBe('net')
  })
  it('defaults to net for unknown/null', () => {
    expect(parseBreakdownSort(null)).toBe('net')
    expect(parseBreakdownSort('bogus')).toBe('net')
  })
})

describe('parseDay', () => {
  it('accepts a YYYY-MM-DD string', () => {
    expect(parseDay('2026-05-28')).toBe('2026-05-28')
  })
  it('rejects malformed / null', () => {
    expect(parseDay(null)).toBeNull()
    expect(parseDay('2026-5-8')).toBeNull()
    expect(parseDay('2026-05-28T00:00')).toBeNull()
    expect(parseDay('garbage')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/dashboard/url-params.test.ts`
Expected: FAIL — `parseBreakdownSort`/`parseDay` are not exported.

- [ ] **Step 3: Write the implementation**

In `lib/dashboard/url-params.ts`, add this import alongside the existing type imports at the top (after the `RepriceFilter, RepriceSort` import line):

```ts
import type { BreakdownSort } from '@/lib/dashboard/attribution-breakdown'
```

Then append to the end of `lib/dashboard/url-params.ts`:

```ts
export function parseBreakdownSort(v: string | null): BreakdownSort {
  return v === 'recovered' || v === 'lost' || v === 'count' ? v : 'net'
}

export function parseDay(v: string | null): string | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/dashboard/url-params.test.ts`
Expected: PASS — all existing suites plus the two new ones.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/url-params.ts lib/dashboard/url-params.test.ts
git commit -m "$(cat <<'EOF'
feat(attribution): add breakdown-sort and day URL parsers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `attribution-insight-line.tsx` component

**Files:**
- Create: `components/dashboard/attribution-insight-line.tsx`

No unit test (presentational — per CLAUDE.md). Verify with `tsc`.

- [ ] **Step 1: Write the component**

Create `components/dashboard/attribution-insight-line.tsx`:

```tsx
import { formatInsight, type AttributionInsight } from '@/lib/dashboard/attribution-insight'

export default function AttributionInsightLine({ insight }: { insight: AttributionInsight }) {
  return <p className="font-body text-sm text-text">{formatInsight(insight)}</p>
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS — no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/attribution-insight-line.tsx
git commit -m "$(cat <<'EOF'
feat(attribution): add insight-line component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `attribution-day-panel.tsx` component

**Files:**
- Create: `components/dashboard/attribution-day-panel.tsx`

No unit test (presentational). Verify with `tsc`.

- [ ] **Step 1: Write the component**

Create `components/dashboard/attribution-day-panel.tsx`:

```tsx
import Link from 'next/link'
import { X } from 'lucide-react'
import type { PriceChange } from '@/lib/api'
import { formatDayLabel } from '@/lib/dashboard/attribution-day'
import { formatSignedUsd } from '@/lib/dashboard/attribution-breakdown'
import { cn } from '@/lib/utils'

export default function AttributionDayPanel({
  day,
  changes,
  onDismiss,
}: {
  day: string
  changes: PriceChange[]
  onDismiss: () => void
}) {
  return (
    <section className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-text">
          {formatDayLabel(day)} · {changes.length} change{changes.length === 1 ? '' : 's'}
        </h3>
        <button
          onClick={onDismiss}
          aria-label="Dismiss day details"
          className="text-muted hover:text-text transition-colors"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {changes.length === 0 ? (
        <p className="font-body text-sm text-muted">No attributed changes on this day.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {changes.map((c) => {
            const delta = c.revenue_delta ?? 0
            return (
              <li key={c.id} className="flex items-center gap-4">
                <Link
                  href={`/repricing?sku=${c.sku_id}`}
                  className="min-w-0 flex-1 font-body text-sm text-text truncate hover:text-primary transition-colors"
                >
                  {c.sku_title}
                </Link>
                <span className="font-mono text-xs text-muted tabular-nums shrink-0">
                  ${c.old_price.toFixed(2)} → ${c.new_price.toFixed(2)}
                </span>
                <span
                  className={cn(
                    'font-mono text-xs tabular-nums w-20 text-right shrink-0',
                    delta >= 0 ? 'text-primary' : 'text-rose-400',
                  )}
                >
                  {formatSignedUsd(delta)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS — no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/attribution-day-panel.tsx
git commit -m "$(cat <<'EOF'
feat(attribution): add day drill-down panel component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Rewrite `attribution/page.tsx` — insight line, 4 cards, clickable chart, drill-down, leaderboard

**Files:**
- Modify (full replace): `app/(dashboard)/attribution/page.tsx`

No unit test (page — per CLAUDE.md). Verify with `tsc` + `build`.

- [ ] **Step 1: Replace the page**

Replace the entire contents of `app/(dashboard)/attribution/page.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { TrendingUp, TrendingDown, Download, Sigma, Hash } from 'lucide-react'
import { useAttribution, usePriceChanges, downloadAttributionCsv } from '@/lib/api'
import UpgradeGate from '@/components/dashboard/upgrade-gate'
import StatCard from '@/components/dashboard/stat-card'
import EmptyState from '@/components/dashboard/empty-state'
import AttributionInsightLine from '@/components/dashboard/attribution-insight-line'
import AttributionDayPanel from '@/components/dashboard/attribution-day-panel'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { useQueryParams } from '@/lib/dashboard/use-query-params'
import { parseDays, parseBreakdownSort, parseDay } from '@/lib/dashboard/url-params'
import {
  attributionAccountedChanges,
  skuBreakdown,
  sortSkuBreakdown,
  totalChangeCount,
  isBreakdownPartial,
  formatSignedUsd,
} from '@/lib/dashboard/attribution-breakdown'
import { attributionInsight } from '@/lib/dashboard/attribution-insight'
import { changesOnDay } from '@/lib/dashboard/attribution-day'

const RANGES = [7, 30, 90] as const
const SORTS = [
  { value: 'net', label: 'Net' },
  { value: 'recovered', label: 'Recovered' },
  { value: 'lost', label: 'Lost' },
  { value: 'count', label: 'Changes' },
] as const

function usd(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toFixed(2)}`
}

export default function AttributionPage() {
  const { get, set } = useQueryParams()
  const days = parseDays(get('days'))
  const sort = parseBreakdownSort(get('sku_sort'))
  const selectedDay = parseDay(get('day'))
  const { data, isLoading, error } = useAttribution(days)
  const { data: rawChanges } = usePriceChanges()
  const [downloading, setDownloading] = useState(false)

  // 403 → render the upgrade gate (backend is the real gate).
  if (error?.status === 403) {
    return (
      <UpgradeGate
        requiredPlan={error.body?.required_plan ?? 'phantom'}
        feature="Revenue attribution"
        description="See exactly how much revenue each automatic price change recovered or cost you, day by day, with a CSV export for your bookkeeping."
      />
    )
  }

  async function handleExport() {
    setDownloading(true)
    const id = toast.loading('Preparing export…')
    try {
      const ok = await downloadAttributionCsv()
      if (ok) {
        toast.success('Export ready', { id })
      } else {
        toast.error('Export failed — your plan may not include attribution exports.', { id })
      }
    } finally {
      setDownloading(false)
    }
  }

  const hasData = !!data && data.series.length > 0
  const changes = rawChanges ?? []
  const accounted = attributionAccountedChanges(changes, days)
  const breakdownRaw = skuBreakdown(accounted)
  const breakdown = sortSkuBreakdown(breakdownRaw, sort)
  const insight = data ? attributionInsight(data, breakdownRaw, days) : null
  const showDayPanel = !!selectedDay && !!data && data.series.some((p) => p.date === selectedDay)
  const dayChanges = selectedDay ? changesOnDay(accounted, selectedDay) : []

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Attribution</h1>
          <p className="font-body text-sm text-muted mt-1">
            Revenue impact of every automatic price change, attributed over the 24 hours
            after the change applied.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={downloading || !hasData}
          className="flex items-center gap-2 shrink-0 px-4 py-2 rounded-xl bg-surface border border-border font-body text-sm text-text hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Download size={15} aria-hidden="true" />
          {downloading ? 'Exporting…' : 'Export CSV'}
        </button>
      </header>

      {hasData && insight && <AttributionInsightLine insight={insight} />}

      {/* Summary stat cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Recovered"
          value={data ? usd(data.total_recovered) : '—'}
          icon={TrendingUp}
          accent="primary"
        />
        <StatCard
          label="Lost"
          value={data ? usd(-Math.abs(data.total_lost)) : '—'}
          icon={TrendingDown}
          accent="rose"
        />
        <StatCard
          label="Net impact"
          value={data ? usd(data.net) : '—'}
          icon={Sigma}
          accent={data && data.net < 0 ? 'rose' : 'primary'}
        />
        <StatCard
          label="Changes"
          value={totalChangeCount(breakdownRaw)}
          icon={Hash}
          accent="muted"
        />
      </section>

      {/* Range selector */}
      <div className="flex items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => set({ days: r === 30 ? null : String(r) })}
            className={
              'px-3 py-1.5 rounded-lg font-body text-xs font-medium transition-colors ' +
              (days === r
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:text-text hover:bg-border/40')
            }
          >
            {r}d
          </button>
        ))}
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="h-72 rounded-2xl bg-surface border border-border animate-pulse" />
      ) : !hasData ? (
        <EmptyState
          icon={TrendingUp}
          title="No attributed changes yet"
          description="Once auto-reprice applies a price change and 24 hours of sales data come in, the revenue impact shows up here."
          cta={{ label: 'Configure repricing', href: '/repricing' }}
        />
      ) : (
        <section className="bg-surface border border-border rounded-2xl p-5">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fill: '#6B7280', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                tickLine={false}
                axisLine={{ stroke: '#1A1D2E' }}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis
                tick={{ fill: '#6B7280', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${v}`}
                width={48}
              />
              <Tooltip
                cursor={{ fill: '#1A1D2E55' }}
                contentStyle={{
                  background: '#0D0F1A',
                  border: '1px solid #1A1D2E',
                  borderRadius: 12,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                }}
                labelStyle={{ color: '#E8EAF0' }}
                formatter={(value: number) => [usd(value), 'Revenue Δ']}
              />
              <Bar
                dataKey="revenue_delta"
                radius={[4, 4, 0, 0]}
                className="cursor-pointer"
                onClick={(d: { date?: string }) =>
                  d?.date && set({ day: d.date === selectedDay ? null : d.date })
                }
              >
                {data.series.map((point, i) => (
                  <Cell
                    key={i}
                    fill={point.revenue_delta >= 0 ? '#00E87A' : '#FB7185'}
                    fillOpacity={selectedDay && point.date !== selectedDay ? 0.35 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Day drill-down */}
      {showDayPanel && (
        <AttributionDayPanel
          day={selectedDay!}
          changes={dayChanges}
          onDismiss={() => set({ day: null })}
        />
      )}

      {/* Top movers leaderboard */}
      {hasData && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-semibold text-text">Top movers</h2>
            <label className="flex items-center gap-2">
              <span className="font-body text-xs text-muted">Sort</span>
              <select
                value={sort}
                onChange={(e) => set({ sku_sort: e.target.value === 'net' ? null : e.target.value })}
                className="bg-surface border border-border rounded-lg px-2 py-1 font-body text-xs text-text"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {isBreakdownPartial(changes.length) && (
            <p className="font-body text-xs text-muted">
              Breakdown is based on the most recent available changes and may not include
              older changes in this range.
            </p>
          )}

          {breakdown.length === 0 ? (
            <p className="font-body text-sm text-muted">
              No auto-reprice changes in this range to break down.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="hidden sm:grid grid-cols-[1fr_5rem_5rem_5rem_3.5rem] gap-4 px-4 font-body text-xs text-muted">
                <span>Product</span>
                <span className="text-right">Recovered</span>
                <span className="text-right">Lost</span>
                <span className="text-right">Net</span>
                <span className="text-right">Changes</span>
              </div>
              {breakdown.map((row) => (
                <div
                  key={row.sku_id}
                  className="grid grid-cols-[1fr_5rem_5rem_5rem_3.5rem] items-center gap-4 bg-surface border border-border rounded-xl px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-body text-sm text-text truncate">{row.sku_title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <Link
                        href={`/repricing?sku=${row.sku_id}`}
                        className="font-body text-xs text-primary hover:underline"
                      >
                        Review &amp; act
                      </Link>
                      <Link
                        href={`/products?q=${encodeURIComponent(row.sku_title)}`}
                        className="font-body text-xs text-muted hover:text-text transition-colors"
                      >
                        View product
                      </Link>
                    </div>
                  </div>
                  <span className="text-right font-mono text-xs tabular-nums text-primary">
                    {usd(row.recovered)}
                  </span>
                  <span className="text-right font-mono text-xs tabular-nums text-rose-400">
                    {usd(row.lost)}
                  </span>
                  <span
                    className={cn(
                      'text-right font-mono text-xs tabular-nums',
                      row.net >= 0 ? 'text-primary' : 'text-rose-400',
                    )}
                  >
                    {formatSignedUsd(row.net)}
                  </span>
                  <span className="text-right font-mono text-xs tabular-nums text-muted">
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS — no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS — build completes; the `/attribution` route is listed.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/attribution/page.tsx"
git commit -m "$(cat <<'EOF'
feat(attribution): insight line, changes card, clickable chart, day drill-down, top-movers leaderboard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit suite**

Run: `npm test -- --run`
Expected: PASS — all prior suites plus the new `attribution-breakdown`, `attribution-day`, `attribution-insight` suites and the appended `url-params` cases. (Baseline before this plan: 346 tests.)

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: No new warnings attributable to the files created/modified in this plan (pre-existing warnings in `amazon-fba-calculator`, `email-capture-gate` are unrelated and acceptable).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS — `/attribution` compiles and is listed in the route table.

- [ ] **Step 4: No commit** — verification only.

---

## Self-Review

**1. Spec coverage**
- §3.1 accounted filter → Task 1 `attributionAccountedChanges`. ✓
- §3.2 UTC day-bucketing → Task 2 `dayKey`. ✓
- §4.1 breakdown / sort tie-breakers / totalChangeCount / isBreakdownPartial → Task 1. ✓
- §4.2 day helpers + `formatDayLabel` → Task 2. ✓
- §4.3 insight + `formatInsight` → Task 3. ✓
- §4.4 `parseBreakdownSort`, `parseDay` → Task 4. ✓
- §5.1 insight-line component → Task 5. ✓
- §5.3 day-panel component → Task 6. ✓
- §6 page (insight line, 4th Changes card, clickable+highlighted chart, drill-down, leaderboard 4 cols, deep-links, partial disclaimer, empty state) → Task 7. ✓
- §6.1 URL view-state (`days`/`day`/`sku_sort`, default-omitted) → Task 4 + Task 7. ✓
- §7 pure-only tests + tsc/build verification → Tasks 1–4 (vitest), 5–8 (tsc/build). ✓
- §8 out-of-scope items → none implemented. ✓
- §5.2 source badge → intentionally dropped (spec note). ✓

**2. Placeholder scan** — no TBD/TODO/"similar to"; every code step shows complete code. ✓

**3. Type consistency**
- `SkuBreakdown` shape identical across Tasks 1, 3, 7. ✓
- `BreakdownSort` union (`'net'|'recovered'|'lost'|'count'`) consistent in Tasks 1, 4, 7 (`SORTS` values match). ✓
- `formatSignedUsd` (cents, exported from `attribution-breakdown`) reused by Tasks 6 & 7; insight's whole-dollar `money` is private to `attribution-insight`. No collision. ✓
- `AttributionInsight` produced in Task 3, consumed by Task 5/7. ✓
- `formatDayLabel` exported in Task 2, imported by Task 3 (insight) and Task 6 (panel). No import cycle (`attribution-day` imports nothing from `attribution-insight`/`attribution-breakdown`). ✓
- Page uses `usd()` for the Recovered/Lost/Net cards and Recovered/Lost columns (matches existing display), `formatSignedUsd()` only for the Net column + day panel deltas. Consistent. ✓
