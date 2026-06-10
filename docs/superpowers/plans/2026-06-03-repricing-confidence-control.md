# Repricing Confidence & Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client-side projected-price preview, guardrail coverage, inline bounds validation, and search/filter/sort to the `/repricing` page (sub-project F of the Dashboard UX A–G effort).

**Architecture:** Five pure modules in `lib/dashboard/` (TDD), three appended URL parsers, two small presentational components reusing D's `ConfidenceMeter`/`formatPriceDelta`, and a rewrite of `app/(dashboard)/repricing/page.tsx` that wires them together. `specter-web` only — no backend, migration, plan-gate, or pipeline change.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Vitest, Tailwind. Reuses sub-project B's `useQueryParams` and sub-project D's `confidence`/`price-delta` modules and `ConfidenceMeter` component.

**Spec:** `docs/superpowers/specs/2026-06-03-repricing-confidence-control-design.md`

---

## Conventions for every task

- Work in `specter-web/` (its own git repo, branch `main`). **Create the branch first** (Task 0).
- Pure-logic files are tested with Vitest (`npx vitest run <path>`). Vitest transpiles without type-checking, so the page/components are verified with `npx tsc --noEmit` instead.
- **Never** `git add .` / `git add -A` — stage the exact paths shown. Do **not** stage `lib/api.ts` or `lib/preview-data.ts` (uncommitted preview layer).
- End every commit message with the trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Existing types (already in `lib/api.ts`, do not edit): `RepriceSKU { id; title; current_price: number|null; floor_price: number|null; ceiling_price: number|null; auto_reprice_enabled: boolean; latest_suggestion: LatestSuggestion|null }`, `LatestSuggestion { type: string; price_suggestion: number|null; confidence: number; created_at: string }`, `PriceChange { id; sku_id; sku_title; old_price: number; new_price: number; source: string; revenue_delta: number|null; created_at: string }`.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `lib/dashboard/reprice-preview.ts` | Pure: re-clamp suggestion to current bounds → state + effective price |
| `lib/dashboard/guardrail-coverage.ts` | Pure: per-SKU guardrail status / needs-attention + list summary |
| `lib/dashboard/bounds-validation.ts` | Pure: floor/ceiling string validation → error message or null |
| `lib/dashboard/reprice-filter.ts` | Pure: search / filter / sort over the SKU list |
| `lib/dashboard/change-log-summary.ts` | Pure: count + net revenue delta over price changes |
| `lib/dashboard/url-params.ts` (modify) | Append `parseRepriceFilter` / `parseRepriceSort` / `parseSearchQuery` |
| `components/dashboard/reprice-preview-chip.tsx` | Presentational: the projected-price chip |
| `components/dashboard/reprice-coverage.tsx` | Presentational: clickable coverage header |
| `app/(dashboard)/repricing/page.tsx` (modify) | Wire coverage, controls, preview, validation, log summary |

---

### Task 0: Create the feature branch

- [ ] **Step 1: Branch off main**

```bash
cd specter-web
git checkout main
git checkout -b repricing-confidence-control
git status
```
Expected: on branch `repricing-confidence-control`; the only changes are the pre-existing uncommitted preview layer (`lib/api.ts`, `lib/preview-data.ts`) and the WIP `app/tools/price-position-analyzer/page.tsx` — leave those untouched.

---

### Task 1: `reprice-preview.ts` — projected price + clamp state

**Files:**
- Create: `specter-web/lib/dashboard/reprice-preview.ts`
- Test: `specter-web/lib/dashboard/reprice-preview.test.ts`

- [ ] **Step 1: Write the failing test**

`specter-web/lib/dashboard/reprice-preview.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { repricePreview } from './reprice-preview'
import type { RepriceSKU, LatestSuggestion } from '@/lib/api'

function sug(p: Partial<LatestSuggestion> = {}): LatestSuggestion {
  return { type: 'RAISE', price_suggestion: 120, confidence: 0.9, created_at: '2026-06-01T00:00:00Z', ...p }
}
function sku(p: Partial<RepriceSKU> = {}): RepriceSKU {
  return {
    id: 's', title: 'Widget', current_price: 100,
    floor_price: null, ceiling_price: null,
    auto_reprice_enabled: false, latest_suggestion: null,
    ...p,
  }
}

describe('repricePreview', () => {
  it('no suggestion → no-action', () => {
    expect(repricePreview(sku({ latest_suggestion: null }))).toEqual({ state: 'no-action', effectivePrice: null })
  })

  it('HOLD → no-action', () => {
    expect(repricePreview(sku({ latest_suggestion: sug({ type: 'HOLD' }) }))).toEqual({ state: 'no-action', effectivePrice: null })
  })

  it('null price_suggestion → no-action', () => {
    expect(repricePreview(sku({ latest_suggestion: sug({ price_suggestion: null }) }))).toEqual({ state: 'no-action', effectivePrice: null })
  })

  it('actionable but no bounds → no-guardrails, effective = suggestion', () => {
    expect(repricePreview(sku({ latest_suggestion: sug({ price_suggestion: 120 }) }))).toEqual({ state: 'no-guardrails', effectivePrice: 120 })
  })

  it('suggestion below floor → floor-clamped', () => {
    const s = sku({ floor_price: 90, ceiling_price: 130, latest_suggestion: sug({ type: 'LOWER', price_suggestion: 80 }) })
    expect(repricePreview(s)).toEqual({ state: 'floor-clamped', effectivePrice: 90 })
  })

  it('suggestion above ceiling → ceiling-clamped', () => {
    const s = sku({ floor_price: 90, ceiling_price: 130, latest_suggestion: sug({ price_suggestion: 150 }) })
    expect(repricePreview(s)).toEqual({ state: 'ceiling-clamped', effectivePrice: 130 })
  })

  it('suggestion within both bounds → within', () => {
    const s = sku({ floor_price: 90, ceiling_price: 130, latest_suggestion: sug({ price_suggestion: 120 }) })
    expect(repricePreview(s)).toEqual({ state: 'within', effectivePrice: 120 })
  })

  it('only floor set, suggestion above it → within', () => {
    const s = sku({ floor_price: 90, ceiling_price: null, latest_suggestion: sug({ price_suggestion: 120 }) })
    expect(repricePreview(s)).toEqual({ state: 'within', effectivePrice: 120 })
  })

  it('only ceiling set, suggestion below it → within', () => {
    const s = sku({ floor_price: null, ceiling_price: 130, latest_suggestion: sug({ price_suggestion: 120 }) })
    expect(repricePreview(s)).toEqual({ state: 'within', effectivePrice: 120 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd specter-web && npx vitest run lib/dashboard/reprice-preview.test.ts`
Expected: FAIL — cannot resolve `./reprice-preview`.

- [ ] **Step 3: Write the implementation**

`specter-web/lib/dashboard/reprice-preview.ts`:
```ts
// Display-only preview of what auto-reprice would set NOW for a SKU, given its
// current guardrails. Re-clamps the stored suggestion to the current floor/ceiling
// so the preview stays honest if the merchant changed bounds after the signal fired.
// Independent of auto on/off (the toggle and guardrail-coverage own that).

import type { RepriceSKU } from '@/lib/api'

export type RepriceState =
  | 'no-action'
  | 'no-guardrails'
  | 'within'
  | 'floor-clamped'
  | 'ceiling-clamped'

export interface RepricePreview {
  state: RepriceState
  effectivePrice: number | null
}

export function repricePreview(sku: RepriceSKU): RepricePreview {
  const s = sku.latest_suggestion
  const p = s?.price_suggestion ?? null
  if (!s || s.type === 'HOLD' || p === null) {
    return { state: 'no-action', effectivePrice: null }
  }
  const f = sku.floor_price
  const c = sku.ceiling_price
  if (f === null && c === null) {
    return { state: 'no-guardrails', effectivePrice: p }
  }
  if (f !== null && p < f) {
    return { state: 'floor-clamped', effectivePrice: f }
  }
  if (c !== null && p > c) {
    return { state: 'ceiling-clamped', effectivePrice: c }
  }
  return { state: 'within', effectivePrice: p }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd specter-web && npx vitest run lib/dashboard/reprice-preview.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
cd specter-web
git add lib/dashboard/reprice-preview.ts lib/dashboard/reprice-preview.test.ts
git commit -m "feat(repricing): add repricePreview clamp-state helper" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `guardrail-coverage.ts` — status, needs-attention, summary

**Files:**
- Create: `specter-web/lib/dashboard/guardrail-coverage.ts`
- Test: `specter-web/lib/dashboard/guardrail-coverage.test.ts`

- [ ] **Step 1: Write the failing test**

`specter-web/lib/dashboard/guardrail-coverage.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { guardrailStatus, needsAttention, coverageSummary } from './guardrail-coverage'
import type { RepriceSKU, LatestSuggestion } from '@/lib/api'

function sug(p: Partial<LatestSuggestion> = {}): LatestSuggestion {
  return { type: 'RAISE', price_suggestion: 120, confidence: 0.9, created_at: '2026-06-01T00:00:00Z', ...p }
}
function sku(p: Partial<RepriceSKU> = {}): RepriceSKU {
  return {
    id: 's', title: 'Widget', current_price: 100,
    floor_price: null, ceiling_price: null,
    auto_reprice_enabled: false, latest_suggestion: null,
    ...p,
  }
}

describe('guardrailStatus', () => {
  it('both bounds → complete', () => {
    expect(guardrailStatus(sku({ floor_price: 90, ceiling_price: 130 }))).toBe('complete')
  })
  it('one bound → partial', () => {
    expect(guardrailStatus(sku({ floor_price: 90 }))).toBe('partial')
    expect(guardrailStatus(sku({ ceiling_price: 130 }))).toBe('partial')
  })
  it('no bounds → none', () => {
    expect(guardrailStatus(sku())).toBe('none')
  })
})

describe('needsAttention', () => {
  it('actionable + incomplete guardrails → true', () => {
    expect(needsAttention(sku({ floor_price: 90, latest_suggestion: sug() }))).toBe(true)
  })
  it('actionable + complete + auto on → false', () => {
    expect(needsAttention(sku({ floor_price: 90, ceiling_price: 130, auto_reprice_enabled: true, latest_suggestion: sug() }))).toBe(false)
  })
  it('actionable + complete + auto OFF → true', () => {
    expect(needsAttention(sku({ floor_price: 90, ceiling_price: 130, auto_reprice_enabled: false, latest_suggestion: sug() }))).toBe(true)
  })
  it('HOLD suggestion → false', () => {
    expect(needsAttention(sku({ latest_suggestion: sug({ type: 'HOLD' }) }))).toBe(false)
  })
  it('no suggestion → false', () => {
    expect(needsAttention(sku({ floor_price: 90 }))).toBe(false)
  })
})

describe('coverageSummary', () => {
  it('aggregates the list', () => {
    const skus = [
      sku({ floor_price: 90, ceiling_price: 130, auto_reprice_enabled: true, latest_suggestion: sug() }), // complete, auto on, not attention
      sku({ floor_price: 90, auto_reprice_enabled: true, latest_suggestion: sug() }),                      // partial → attention
      sku({ auto_reprice_enabled: false }),                                                                // none, no suggestion → not attention
    ]
    expect(coverageSummary(skus)).toEqual({ total: 3, withGuardrails: 1, autoOn: 2, needsAttention: 1 })
  })
  it('empty list', () => {
    expect(coverageSummary([])).toEqual({ total: 0, withGuardrails: 0, autoOn: 0, needsAttention: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd specter-web && npx vitest run lib/dashboard/guardrail-coverage.test.ts`
Expected: FAIL — cannot resolve `./guardrail-coverage`.

- [ ] **Step 3: Write the implementation**

`specter-web/lib/dashboard/guardrail-coverage.ts`:
```ts
// Per-SKU guardrail status and the page-level coverage summary.

import type { RepriceSKU } from '@/lib/api'

export type GuardrailStatus = 'complete' | 'partial' | 'none'

export function guardrailStatus(sku: RepriceSKU): GuardrailStatus {
  const hasFloor = sku.floor_price !== null
  const hasCeiling = sku.ceiling_price !== null
  if (hasFloor && hasCeiling) return 'complete'
  if (hasFloor || hasCeiling) return 'partial'
  return 'none'
}

function isActionable(sku: RepriceSKU): boolean {
  const s = sku.latest_suggestion
  return !!s && (s.type === 'RAISE' || s.type === 'LOWER') && s.price_suggestion !== null
}

// An actionable suggestion that can't yet act safely: guardrails incomplete OR
// per-SKU auto disabled. (Global auto is shown by the page's global toggle.)
export function needsAttention(sku: RepriceSKU): boolean {
  if (!isActionable(sku)) return false
  return guardrailStatus(sku) !== 'complete' || !sku.auto_reprice_enabled
}

export interface CoverageSummary {
  total: number
  withGuardrails: number
  autoOn: number
  needsAttention: number
}

export function coverageSummary(skus: RepriceSKU[]): CoverageSummary {
  let withGuardrails = 0
  let autoOn = 0
  let attention = 0
  for (const sku of skus) {
    if (guardrailStatus(sku) === 'complete') withGuardrails++
    if (sku.auto_reprice_enabled) autoOn++
    if (needsAttention(sku)) attention++
  }
  return { total: skus.length, withGuardrails, autoOn, needsAttention: attention }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd specter-web && npx vitest run lib/dashboard/guardrail-coverage.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
cd specter-web
git add lib/dashboard/guardrail-coverage.ts lib/dashboard/guardrail-coverage.test.ts
git commit -m "feat(repricing): add guardrail status + coverage summary helpers" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `bounds-validation.ts` — inline floor/ceiling validation

**Files:**
- Create: `specter-web/lib/dashboard/bounds-validation.ts`
- Test: `specter-web/lib/dashboard/bounds-validation.test.ts`

- [ ] **Step 1: Write the failing test**

`specter-web/lib/dashboard/bounds-validation.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { validateBounds } from './bounds-validation'

describe('validateBounds', () => {
  it('both empty → null', () => {
    expect(validateBounds('', '')).toBeNull()
  })
  it('floor < ceiling → null', () => {
    expect(validateBounds('10', '20')).toBeNull()
  })
  it('floor === ceiling → null', () => {
    expect(validateBounds('10', '10')).toBeNull()
  })
  it('only floor set → null', () => {
    expect(validateBounds('10', '')).toBeNull()
  })
  it('only ceiling set → null', () => {
    expect(validateBounds('', '20')).toBeNull()
  })
  it('floor > ceiling → error', () => {
    expect(validateBounds('20', '10')).toBe('Floor cannot exceed ceiling.')
  })
  it('negative floor → error', () => {
    expect(validateBounds('-5', '')).toBe('Prices must be 0 or more.')
  })
  it('negative ceiling → error', () => {
    expect(validateBounds('', '-5')).toBe('Prices must be 0 or more.')
  })
  it('non-numeric → error', () => {
    expect(validateBounds('abc', '')).toBe('Prices must be 0 or more.')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd specter-web && npx vitest run lib/dashboard/bounds-validation.test.ts`
Expected: FAIL — cannot resolve `./bounds-validation`.

- [ ] **Step 3: Write the implementation**

`specter-web/lib/dashboard/bounds-validation.ts`:
```ts
// Inline validation for the floor/ceiling text inputs. Empty string = unset (valid).
// Mirrors the server guard (PATCH /repricing/sku/{id} → 422 invalid_bounds).

export function validateBounds(floor: string, ceiling: string): string | null {
  const hasFloor = floor.trim() !== ''
  const hasCeiling = ceiling.trim() !== ''
  const f = Number(floor)
  const c = Number(ceiling)
  if (hasFloor && (Number.isNaN(f) || f < 0)) return 'Prices must be 0 or more.'
  if (hasCeiling && (Number.isNaN(c) || c < 0)) return 'Prices must be 0 or more.'
  if (hasFloor && hasCeiling && f > c) return 'Floor cannot exceed ceiling.'
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd specter-web && npx vitest run lib/dashboard/bounds-validation.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
cd specter-web
git add lib/dashboard/bounds-validation.ts lib/dashboard/bounds-validation.test.ts
git commit -m "feat(repricing): add inline bounds validation helper" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `reprice-filter.ts` — search, filter, sort

**Files:**
- Create: `specter-web/lib/dashboard/reprice-filter.ts`
- Test: `specter-web/lib/dashboard/reprice-filter.test.ts`

Depends on Tasks 1, 2 and D's `lib/dashboard/price-delta.ts` (`priceDeltaPct`).

- [ ] **Step 1: Write the failing test**

`specter-web/lib/dashboard/reprice-filter.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { searchRepriceSKUs, filterRepriceSKUs, sortRepriceSKUs } from './reprice-filter'
import type { RepriceSKU, LatestSuggestion } from '@/lib/api'

function sug(p: Partial<LatestSuggestion> = {}): LatestSuggestion {
  return { type: 'RAISE', price_suggestion: 120, confidence: 0.9, created_at: '2026-06-01T00:00:00Z', ...p }
}
function sku(p: Partial<RepriceSKU> = {}): RepriceSKU {
  return {
    id: 's', title: 'Widget', current_price: 100,
    floor_price: null, ceiling_price: null,
    auto_reprice_enabled: false, latest_suggestion: null,
    ...p,
  }
}

describe('searchRepriceSKUs', () => {
  const list = [sku({ id: 'a', title: 'Blue Widget' }), sku({ id: 'b', title: 'Red Gadget' })]
  it('blank query returns all', () => {
    expect(searchRepriceSKUs(list, '   ')).toHaveLength(2)
  })
  it('case-insensitive title match', () => {
    expect(searchRepriceSKUs(list, 'widget').map((s) => s.id)).toEqual(['a'])
  })
  it('no match → empty', () => {
    expect(searchRepriceSKUs(list, 'zzz')).toEqual([])
  })
})

describe('filterRepriceSKUs', () => {
  const complete = sku({ id: 'complete', floor_price: 90, ceiling_price: 130, auto_reprice_enabled: true, latest_suggestion: sug() })
  const partial = sku({ id: 'partial', floor_price: 90, auto_reprice_enabled: true, latest_suggestion: sug() })
  const clamp = sku({ id: 'clamp', floor_price: 90, ceiling_price: 110, latest_suggestion: sug({ price_suggestion: 150 }) })
  const list = [complete, partial, clamp]

  it('all → unchanged', () => {
    expect(filterRepriceSKUs(list, 'all')).toHaveLength(3)
  })
  it('needs-guardrails → incomplete only', () => {
    expect(filterRepriceSKUs(list, 'needs-guardrails').map((s) => s.id)).toEqual(['partial', 'clamp'])
  })
  it('auto-on → enabled only', () => {
    expect(filterRepriceSKUs(list, 'auto-on').map((s) => s.id)).toEqual(['complete', 'partial'])
  })
  it('would-clamp → clamped only', () => {
    expect(filterRepriceSKUs(list, 'would-clamp').map((s) => s.id)).toEqual(['clamp'])
  })
  it('needs-attention → actionable & (incomplete or auto-off)', () => {
    expect(filterRepriceSKUs(list, 'needs-attention').map((s) => s.id)).toEqual(['partial', 'clamp'])
  })
})

describe('sortRepriceSKUs', () => {
  it('default returns a new array in original order', () => {
    const list = [sku({ id: 'a' }), sku({ id: 'b' })]
    const out = sortRepriceSKUs(list, 'default')
    expect(out).not.toBe(list)
    expect(out.map((s) => s.id)).toEqual(['a', 'b'])
  })
  it('attention puts needs-attention first, stable within groups', () => {
    const calm = sku({ id: 'calm', floor_price: 90, ceiling_price: 130, auto_reprice_enabled: true, latest_suggestion: sug() })
    const hot = sku({ id: 'hot', floor_price: 90, latest_suggestion: sug() }) // partial → attention
    const out = sortRepriceSKUs([calm, hot], 'attention')
    expect(out.map((s) => s.id)).toEqual(['hot', 'calm'])
  })
  it('impact orders by |delta%| desc with no-action last', () => {
    const big = sku({ id: 'big', current_price: 100, floor_price: 90, ceiling_price: 200, latest_suggestion: sug({ price_suggestion: 150 }) }) // +50%
    const small = sku({ id: 'small', current_price: 100, floor_price: 90, ceiling_price: 200, latest_suggestion: sug({ price_suggestion: 110 }) }) // +10%
    const none = sku({ id: 'none', latest_suggestion: null })
    const out = sortRepriceSKUs([small, none, big], 'impact')
    expect(out.map((s) => s.id)).toEqual(['big', 'small', 'none'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd specter-web && npx vitest run lib/dashboard/reprice-filter.test.ts`
Expected: FAIL — cannot resolve `./reprice-filter`.

- [ ] **Step 3: Write the implementation**

`specter-web/lib/dashboard/reprice-filter.ts`:
```ts
// Pure search / filter / sort over the repricing SKU list. All URL-driven on the page.

import type { RepriceSKU } from '@/lib/api'
import { repricePreview } from '@/lib/dashboard/reprice-preview'
import { guardrailStatus, needsAttention } from '@/lib/dashboard/guardrail-coverage'
import { priceDeltaPct } from '@/lib/dashboard/price-delta'

export type RepriceFilter = 'all' | 'needs-attention' | 'needs-guardrails' | 'auto-on' | 'would-clamp'
export type RepriceSort = 'default' | 'attention' | 'impact'

export function searchRepriceSKUs(skus: RepriceSKU[], query: string): RepriceSKU[] {
  const q = query.trim().toLowerCase()
  if (q === '') return skus
  return skus.filter((s) => s.title.toLowerCase().includes(q))
}

export function filterRepriceSKUs(skus: RepriceSKU[], filter: RepriceFilter): RepriceSKU[] {
  switch (filter) {
    case 'needs-attention':
      return skus.filter(needsAttention)
    case 'needs-guardrails':
      return skus.filter((s) => guardrailStatus(s) !== 'complete')
    case 'auto-on':
      return skus.filter((s) => s.auto_reprice_enabled)
    case 'would-clamp':
      return skus.filter((s) => {
        const st = repricePreview(s).state
        return st === 'floor-clamped' || st === 'ceiling-clamped'
      })
    case 'all':
    default:
      return skus
  }
}

function impactMagnitude(sku: RepriceSKU): number | null {
  const pct = priceDeltaPct(sku.current_price, repricePreview(sku).effectivePrice)
  return pct === null ? null : Math.abs(pct)
}

export function sortRepriceSKUs(skus: RepriceSKU[], sort: RepriceSort): RepriceSKU[] {
  const out = [...skus]
  if (sort === 'attention') {
    // needs-attention first; Array.sort is stable so within-group order is preserved.
    out.sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)))
  } else if (sort === 'impact') {
    out.sort((a, b) => {
      const ma = impactMagnitude(a)
      const mb = impactMagnitude(b)
      if (ma === null && mb === null) return 0
      if (ma === null) return 1 // nulls last
      if (mb === null) return -1
      return mb - ma
    })
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd specter-web && npx vitest run lib/dashboard/reprice-filter.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
cd specter-web
git add lib/dashboard/reprice-filter.ts lib/dashboard/reprice-filter.test.ts
git commit -m "feat(repricing): add search / filter / sort helpers" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `change-log-summary.ts` — count + net revenue delta

**Files:**
- Create: `specter-web/lib/dashboard/change-log-summary.ts`
- Test: `specter-web/lib/dashboard/change-log-summary.test.ts`

- [ ] **Step 1: Write the failing test**

`specter-web/lib/dashboard/change-log-summary.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { changeLogSummary } from './change-log-summary'
import type { PriceChange } from '@/lib/api'

function change(p: Partial<PriceChange> = {}): PriceChange {
  return {
    id: 'c', sku_id: 's', sku_title: 'Widget',
    old_price: 100, new_price: 110, source: 'signal',
    revenue_delta: null, created_at: '2026-06-01T00:00:00Z',
    ...p,
  }
}

describe('changeLogSummary', () => {
  it('empty → count 0, null net', () => {
    expect(changeLogSummary([])).toEqual({ count: 0, netRevenueDelta: null })
  })
  it('all null deltas → count N, null net', () => {
    expect(changeLogSummary([change(), change()])).toEqual({ count: 2, netRevenueDelta: null })
  })
  it('sums non-null deltas', () => {
    const out = changeLogSummary([change({ revenue_delta: 12.5 }), change({ revenue_delta: -2.5 }), change({ revenue_delta: null })])
    expect(out.count).toBe(3)
    expect(out.netRevenueDelta).toBeCloseTo(10)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd specter-web && npx vitest run lib/dashboard/change-log-summary.test.ts`
Expected: FAIL — cannot resolve `./change-log-summary`.

- [ ] **Step 3: Write the implementation**

`specter-web/lib/dashboard/change-log-summary.ts`:
```ts
// Summary line for the price-change log: how many changes and the net revenue impact.

import type { PriceChange } from '@/lib/api'

export interface ChangeLogSummary {
  count: number
  netRevenueDelta: number | null
}

export function changeLogSummary(changes: PriceChange[]): ChangeLogSummary {
  let sum = 0
  let any = false
  for (const c of changes) {
    if (c.revenue_delta !== null) {
      sum += c.revenue_delta
      any = true
    }
  }
  return { count: changes.length, netRevenueDelta: any ? sum : null }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd specter-web && npx vitest run lib/dashboard/change-log-summary.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd specter-web
git add lib/dashboard/change-log-summary.ts lib/dashboard/change-log-summary.test.ts
git commit -m "feat(repricing): add change-log summary helper" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: URL parsers (`url-params.ts`)

**Files:**
- Modify: `specter-web/lib/dashboard/url-params.ts`
- Modify: `specter-web/lib/dashboard/url-params.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `specter-web/lib/dashboard/url-params.test.ts`. First ensure the import line at the top of the file also imports the three new functions (add them to the existing import from `./url-params`):
```ts
import {
  // …existing imports…
  parseRepriceFilter,
  parseRepriceSort,
  parseSearchQuery,
} from './url-params'
```
Then append these describe blocks at the end of the file:
```ts
describe('parseRepriceFilter', () => {
  it('accepts known values', () => {
    expect(parseRepriceFilter('needs-attention')).toBe('needs-attention')
    expect(parseRepriceFilter('needs-guardrails')).toBe('needs-guardrails')
    expect(parseRepriceFilter('auto-on')).toBe('auto-on')
    expect(parseRepriceFilter('would-clamp')).toBe('would-clamp')
  })
  it('defaults to all', () => {
    expect(parseRepriceFilter(null)).toBe('all')
    expect(parseRepriceFilter('bogus')).toBe('all')
  })
})

describe('parseRepriceSort', () => {
  it('accepts known values', () => {
    expect(parseRepriceSort('attention')).toBe('attention')
    expect(parseRepriceSort('impact')).toBe('impact')
  })
  it('defaults to default', () => {
    expect(parseRepriceSort(null)).toBe('default')
    expect(parseRepriceSort('bogus')).toBe('default')
  })
})

describe('parseSearchQuery', () => {
  it('trims and defaults to empty', () => {
    expect(parseSearchQuery(null)).toBe('')
    expect(parseSearchQuery('  hat  ')).toBe('hat')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd specter-web && npx vitest run lib/dashboard/url-params.test.ts`
Expected: FAIL — `parseRepriceFilter` / `parseRepriceSort` / `parseSearchQuery` are not exported.

- [ ] **Step 3: Add the parsers**

In `specter-web/lib/dashboard/url-params.ts`, add this import alongside the existing type imports at the top:
```ts
import type { RepriceFilter, RepriceSort } from '@/lib/dashboard/reprice-filter'
```
Then append at the end of the file:
```ts
export function parseRepriceFilter(v: string | null): RepriceFilter {
  return v === 'needs-attention' || v === 'needs-guardrails' || v === 'auto-on' || v === 'would-clamp'
    ? v
    : 'all'
}

export function parseRepriceSort(v: string | null): RepriceSort {
  return v === 'attention' || v === 'impact' ? v : 'default'
}

export function parseSearchQuery(v: string | null): string {
  return (v ?? '').trim()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd specter-web && npx vitest run lib/dashboard/url-params.test.ts`
Expected: PASS (existing cases + 8 new).

- [ ] **Step 5: Commit**

```bash
cd specter-web
git add lib/dashboard/url-params.ts lib/dashboard/url-params.test.ts
git commit -m "feat(repricing): add reprice filter/sort/search URL parsers" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: `RepricePreviewChip` component

**Files:**
- Create: `specter-web/components/dashboard/reprice-preview-chip.tsx`

- [ ] **Step 1: Write the component**

`specter-web/components/dashboard/reprice-preview-chip.tsx`:
```tsx
import type { RepricePreview, RepriceState } from '@/lib/dashboard/reprice-preview'
import { formatPriceDelta } from '@/lib/dashboard/price-delta'
import { cn } from '@/lib/utils'

const LABEL: Record<RepriceState, string> = {
  within: 'Within bounds',
  'floor-clamped': 'Floor-clamped',
  'ceiling-clamped': 'Ceiling-clamped',
  'no-guardrails': 'No guardrails',
  'no-action': '—',
}

const STYLE: Record<RepriceState, string> = {
  within: 'border-primary/25 bg-primary/10 text-primary',
  'floor-clamped': 'border-amber-400/30 bg-amber-400/10 text-amber-400',
  'ceiling-clamped': 'border-amber-400/30 bg-amber-400/10 text-amber-400',
  'no-guardrails': 'border-amber-400/30 text-muted',
  'no-action': 'border-border text-muted',
}

export default function RepricePreviewChip({
  preview,
  currentPrice,
}: {
  preview: RepricePreview
  currentPrice: number | null
}) {
  const { state, effectivePrice } = preview
  if (state === 'no-action') {
    return <span className="font-mono text-xs text-muted">—</span>
  }
  const delta = formatPriceDelta(currentPrice, effectivePrice)
  return (
    <span className="flex items-center gap-2">
      <span
        className={cn(
          'inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs',
          STYLE[state],
        )}
      >
        {LABEL[state]}
      </span>
      {effectivePrice !== null && (
        <span className="font-mono text-xs text-text tabular-nums">
          → ${effectivePrice.toFixed(2)}
          {delta && <span className="text-muted"> ({delta})</span>}
        </span>
      )}
    </span>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd specter-web && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd specter-web
git add components/dashboard/reprice-preview-chip.tsx
git commit -m "feat(repricing): add RepricePreviewChip component" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: `RepriceCoverage` component

**Files:**
- Create: `specter-web/components/dashboard/reprice-coverage.tsx`

- [ ] **Step 1: Write the component**

`specter-web/components/dashboard/reprice-coverage.tsx`:
```tsx
import type { CoverageSummary } from '@/lib/dashboard/guardrail-coverage'
import type { RepriceFilter } from '@/lib/dashboard/reprice-filter'
import { cn } from '@/lib/utils'

export default function RepriceCoverage({
  summary,
  onFilter,
}: {
  summary: CoverageSummary
  onFilter: (f: RepriceFilter) => void
}) {
  const { total, withGuardrails, autoOn, needsAttention } = summary
  if (total === 0) return null
  return (
    <p className="font-mono text-xs text-muted flex items-center gap-2 flex-wrap">
      <span>
        <span className="text-text">{withGuardrails}/{total}</span> guardrails
      </span>
      <span className="text-muted/40">·</span>
      <button
        type="button"
        onClick={() => onFilter('auto-on')}
        className="hover:text-text transition-colors underline-offset-2 hover:underline"
      >
        {autoOn} auto-on
      </button>
      <span className="text-muted/40">·</span>
      <button
        type="button"
        onClick={() => onFilter('needs-attention')}
        className={cn(
          'transition-colors underline-offset-2 hover:underline',
          needsAttention > 0 ? 'text-rose-400 hover:text-rose-300' : 'text-muted hover:text-text',
        )}
      >
        {needsAttention} need attention
      </button>
    </p>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd specter-web && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd specter-web
git add components/dashboard/reprice-coverage.tsx
git commit -m "feat(repricing): add clickable RepriceCoverage header" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Repricing page wiring

**Files:**
- Modify: `specter-web/app/(dashboard)/repricing/page.tsx` (full replacement)

This wires the coverage header, the search/filter/sort controls, the per-row preview chip + confidence meter, inline bounds validation, and the change-log summary + source badge. Preserves the existing global toggle, the `?sku`/`?source` deep-link landing, and the `Bound` sub-component.

- [ ] **Step 1: Replace the page**

`specter-web/app/(dashboard)/repricing/page.tsx`:
```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal, Sparkles, History, Search } from 'lucide-react'
import {
  useRepricing,
  usePriceChanges,
  useUpdateRepriceSettings,
  useUpdateRepriceSKU,
  type RepriceSKU,
} from '@/lib/api'
import UpgradeGate from '@/components/dashboard/upgrade-gate'
import SignalBadge from '@/components/dashboard/signal-badge'
import ConfidenceMeter from '@/components/dashboard/confidence-meter'
import RepricePreviewChip from '@/components/dashboard/reprice-preview-chip'
import RepriceCoverage from '@/components/dashboard/reprice-coverage'
import EmptyState from '@/components/dashboard/empty-state'
import { timeAgo } from '@/lib/time-ago'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { useQueryParams } from '@/lib/dashboard/use-query-params'
import { parseSource, parseRepriceFilter, parseRepriceSort, parseSearchQuery } from '@/lib/dashboard/url-params'
import { repricePrefill, formatLandingToast } from '@/lib/dashboard/reprice-prefill'
import { repricePreview } from '@/lib/dashboard/reprice-preview'
import { coverageSummary } from '@/lib/dashboard/guardrail-coverage'
import { validateBounds } from '@/lib/dashboard/bounds-validation'
import { changeLogSummary } from '@/lib/dashboard/change-log-summary'
import {
  searchRepriceSKUs,
  filterRepriceSKUs,
  sortRepriceSKUs,
} from '@/lib/dashboard/reprice-filter'

const FILTERS = [
  { label: 'All', value: 'all' as const },
  { label: 'Needs Attention', value: 'needs-attention' as const },
  { label: 'Needs Guardrails', value: 'needs-guardrails' as const },
  { label: 'Auto On', value: 'auto-on' as const },
  { label: 'Would Clamp', value: 'would-clamp' as const },
]

const SORTS = [
  { label: 'Default', value: 'default' as const },
  { label: 'Needs Attention First', value: 'attention' as const },
  { label: 'Impact', value: 'impact' as const },
]

export default function RepricingPage() {
  const { data, isLoading, error } = useRepricing()
  const { data: changes } = usePriceChanges()
  const settingsMut = useUpdateRepriceSettings()
  const skuMut = useUpdateRepriceSKU()

  const { get, set } = useQueryParams()
  const query = parseSearchQuery(get('q'))
  const filter = parseRepriceFilter(get('filter'))
  const sort = parseRepriceSort(get('sort'))

  const [focusedSkuId, setFocusedSkuId] = useState<string | null>(null)
  const handledSkuRef = useRef<string | null>(null)

  // Handle a ?sku deep-link once data has resolved, then strip the params.
  useEffect(() => {
    const skuId = get('sku')
    if (!skuId || !data) return // wait for the repricing list
    if (handledSkuRef.current === skuId) return // one-time per id
    handledSkuRef.current = skuId

    const match = data.skus.find((s) => s.id === skuId)
    const source = parseSource(get('source')) // available for future analytics
    void source
    if (match) {
      setFocusedSkuId(skuId)
      const t = formatLandingToast(match)
      toast(t.title, t.description ? { description: t.description } : undefined)
    } else {
      toast.error("That product isn't in your repricing list.")
    }
    set({ sku: null, source: null })
  }, [get, data, set])

  // 403 → render the upgrade gate (backend is the real gate).
  if (error?.status === 403) {
    return (
      <UpgradeGate
        requiredPlan={error.body?.required_plan ?? 'cipher'}
        feature="Auto-repricing"
        description="Set floor and ceiling guardrails and let SPECTER apply price changes to Shopify automatically the moment a signal fires."
      />
    )
  }

  const allSkus = data?.skus ?? []
  const displayed = sortRepriceSKUs(
    filterRepriceSKUs(searchRepriceSKUs(allSkus, query), filter),
    sort,
  )
  const logSummary = changeLogSummary(changes ?? [])

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Repricing</h1>
          <p className="font-body text-sm text-muted mt-1">
            Set guardrails per product. SPECTER applies changes to Shopify within 5 minutes
            of a signal.
          </p>
          {data && data.skus.length > 0 && (
            <div className="mt-2">
              <RepriceCoverage
                summary={coverageSummary(data.skus)}
                onFilter={(f) => set({ filter: f === 'all' ? null : f })}
              />
            </div>
          )}
        </div>
        {data && (
          <label className="flex items-center gap-2.5 shrink-0 mt-1">
            <span className="font-body text-sm text-muted">Auto-reprice</span>
            <button
              role="switch"
              aria-checked={data.global_auto_reprice_enabled}
              onClick={() =>
                settingsMut.mutate(
                  { auto_reprice_enabled: !data.global_auto_reprice_enabled },
                  {
                    onSuccess: () =>
                      toast.success(
                        `Auto-reprice turned ${!data.global_auto_reprice_enabled ? 'on' : 'off'}`,
                      ),
                  },
                )
              }
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                data.global_auto_reprice_enabled ? 'bg-primary' : 'bg-border',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-bg transition-transform',
                  data.global_auto_reprice_enabled && 'translate-x-5',
                )}
              />
            </button>
          </label>
        )}
      </header>

      {/* Search + filter + sort controls */}
      {data && data.skus.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => set({ q: e.target.value || null })}
              placeholder="Search products…"
              className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-1.5 font-body text-sm text-text placeholder:text-muted focus:outline-none focus:border-primary/40"
            />
          </div>
          <label className="flex items-center gap-2 font-body text-xs text-muted">
            Filter
            <select
              value={filter}
              onChange={(e) => set({ filter: e.target.value === 'all' ? null : e.target.value })}
              className="bg-surface border border-border rounded-lg px-2.5 py-1.5 font-body text-sm text-text focus:outline-none focus:border-primary/40"
            >
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 font-body text-xs text-muted">
            Sort
            <select
              value={sort}
              onChange={(e) => set({ sort: e.target.value === 'default' ? null : e.target.value })}
              className="bg-surface border border-border rounded-lg px-2.5 py-1.5 font-body text-sm text-text focus:outline-none focus:border-primary/40"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* SKU guardrail table */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      ) : !data || data.skus.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="No products to reprice yet"
          description="Connect your Shopify store to import products, then set floor and ceiling guardrails here."
          cta={{ label: 'Go to settings', href: '/settings' }}
        />
      ) : displayed.length === 0 ? (
        <p className="font-body text-sm text-muted">No products match the current search or filter.</p>
      ) : (
        <section className="flex flex-col gap-3">
          {displayed.map((sku) => (
            <SKURow
              key={sku.id}
              sku={sku}
              onSave={skuMut.mutateAsync}
              saving={skuMut.isPending}
              focused={sku.id === focusedSkuId}
            />
          ))}
        </section>
      )}

      {/* Price change log */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History size={16} className="text-muted" />
            <h2 className="font-display text-lg font-semibold text-text">Price change log</h2>
          </div>
          {logSummary.count > 0 && (
            <span className="font-mono text-xs text-muted">
              {logSummary.netRevenueDelta !== null ? (
                <span className={cn(logSummary.netRevenueDelta >= 0 ? 'text-primary' : 'text-rose-400')}>
                  net {logSummary.netRevenueDelta >= 0 ? '+' : '−'}${Math.abs(logSummary.netRevenueDelta).toFixed(2)}
                </span>
              ) : (
                <span>net —</span>
              )}
              {' '}over {logSummary.count} change{logSummary.count === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {!changes || changes.length === 0 ? (
          <p className="font-body text-sm text-muted">
            No automatic price changes yet. They&apos;ll appear here once auto-reprice fires.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {changes.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-4 bg-surface border border-border rounded-xl px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm text-text truncate">{c.sku_title}</p>
                  <p className="font-mono text-xs text-muted mt-0.5">
                    ${c.old_price.toFixed(2)} → ${c.new_price.toFixed(2)}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 font-mono text-[10px] uppercase text-muted shrink-0">
                  {c.source}
                </span>
                {c.revenue_delta !== null && (
                  <span
                    className={cn(
                      'font-mono text-xs tabular-nums shrink-0',
                      c.revenue_delta >= 0 ? 'text-primary' : 'text-rose-400',
                    )}
                  >
                    {c.revenue_delta >= 0 ? '+' : ''}${c.revenue_delta.toFixed(2)}
                  </span>
                )}
                <span className="font-body text-xs text-muted shrink-0 w-16 text-right">
                  {timeAgo(c.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function SKURow({
  sku,
  onSave,
  saving,
  focused,
}: {
  sku: RepriceSKU
  onSave: (input: { id: string; floor_price?: number; ceiling_price?: number; auto_reprice_enabled?: boolean }) => Promise<unknown>
  saving: boolean
  focused: boolean
}) {
  const [floor, setFloor] = useState(sku.floor_price?.toString() ?? '')
  const [ceiling, setCeiling] = useState(sku.ceiling_price?.toString() ?? '')
  const rowRef = useRef<HTMLDivElement>(null)
  const floorRef = useRef<HTMLInputElement>(null)
  const ceilingRef = useRef<HTMLInputElement>(null)
  const handledRef = useRef(false)
  const [highlight, setHighlight] = useState(false)

  const dirty =
    floor !== (sku.floor_price?.toString() ?? '') ||
    ceiling !== (sku.ceiling_price?.toString() ?? '')
  const boundsError = validateBounds(floor, ceiling)
  const preview = repricePreview(sku)

  // When this row becomes the deep-link target: scroll to it, highlight (fades),
  // and prefill the suggested bound IF that bound is empty. Runs once.
  useEffect(() => {
    if (!focused || handledRef.current) return
    handledRef.current = true
    rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlight(true)
    const timer = setTimeout(() => setHighlight(false), 4000)

    const { bound, value } = repricePrefill(sku)
    if (bound === 'ceiling' && value && sku.ceiling_price === null) {
      setCeiling(value)
      ceilingRef.current?.focus()
    } else if (bound === 'floor' && value && sku.floor_price === null) {
      setFloor(value)
      floorRef.current?.focus()
    }
    return () => clearTimeout(timer)
    // Run only when the row becomes focused; sku is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused])

  return (
    <div
      ref={rowRef}
      className={cn(
        'bg-surface border rounded-xl px-4 py-3.5 flex flex-col gap-3 transition-all',
        highlight ? 'border-primary/60 ring-2 ring-primary/40' : 'border-border',
      )}
    >
      <div className="flex items-center gap-3">
        <p className="font-body text-sm font-medium text-text flex-1 truncate">{sku.title}</p>
        {sku.latest_suggestion && (
          <span className="flex items-center gap-2 shrink-0">
            <SignalBadge type={sku.latest_suggestion.type} />
            {sku.latest_suggestion.price_suggestion !== null && (
              <span className="flex items-center gap-1 font-mono text-xs text-primary">
                <Sparkles size={11} />
                ${sku.latest_suggestion.price_suggestion.toFixed(2)}
              </span>
            )}
            <ConfidenceMeter confidence={sku.latest_suggestion.confidence} />
          </span>
        )}
      </div>

      {/* Projected price preview */}
      <RepricePreviewChip preview={preview} currentPrice={sku.current_price} />

      <div className="flex items-end gap-3 flex-wrap">
        <span className="font-mono text-xs text-muted">
          Current: {sku.current_price !== null ? `$${sku.current_price.toFixed(2)}` : '—'}
        </span>
        <Bound label="Floor" value={floor} onChange={setFloor} inputRef={floorRef} />
        <Bound label="Ceiling" value={ceiling} onChange={setCeiling} inputRef={ceilingRef} />

        <button
          onClick={async () => {
            try {
              await onSave({
                id: sku.id,
                floor_price: floor ? Number(floor) : undefined,
                ceiling_price: ceiling ? Number(ceiling) : undefined,
              })
              toast.success('Guardrails saved')
            } catch {
              /* error toast handled by the global mutation net */
            }
          }}
          disabled={!dirty || saving || boundsError !== null}
          className="px-4 py-1.5 rounded-lg bg-primary/10 text-primary font-body text-sm font-medium hover:bg-primary/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Save
        </button>

        <label className="flex items-center gap-2 ml-auto">
          <span className="font-body text-xs text-muted">Auto</span>
          <button
            role="switch"
            aria-checked={sku.auto_reprice_enabled}
            onClick={async () => {
              try {
                await onSave({ id: sku.id, auto_reprice_enabled: !sku.auto_reprice_enabled })
                toast.success(
                  `Auto-reprice ${!sku.auto_reprice_enabled ? 'enabled' : 'disabled'} for this product`,
                )
              } catch {
                /* error toast handled by the global mutation net */
              }
            }}
            className={cn(
              'relative w-9 h-5 rounded-full transition-colors',
              sku.auto_reprice_enabled ? 'bg-primary' : 'bg-border',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-bg transition-transform',
                sku.auto_reprice_enabled && 'translate-x-4',
              )}
            />
          </button>
        </label>
      </div>

      {boundsError && (
        <p className="font-body text-xs text-rose-400">{boundsError}</p>
      )}
    </div>
  )
}

function Bound({
  label,
  value,
  onChange,
  inputRef,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  inputRef?: React.Ref<HTMLInputElement>
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-body text-xs text-muted">{label}</label>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-muted">$</span>
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          className="w-24 bg-bg border border-border rounded-lg pl-5 pr-2 py-1.5 font-mono text-sm text-text focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd specter-web && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Production build**

Run: `cd specter-web && npm run build`
Expected: build succeeds; `/repricing` compiles.

- [ ] **Step 4: Commit**

```bash
cd specter-web
git add "app/(dashboard)/repricing/page.tsx"
git commit -m "feat(repricing): wire coverage, search/filter/sort, preview chip, validation, log summary" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full web unit suite**

Run: `cd specter-web && npm test -- --run`
Expected: PASS — all prior 299 tests plus the new pure suites (reprice-preview 9, guardrail-coverage 10, bounds-validation 9, reprice-filter 11, change-log-summary 3, url-params +8 = +50 → ~349). No failures.

- [ ] **Step 2: Lint**

Run: `cd specter-web && npm run lint`
Expected: no new errors/warnings from the changed files.

- [ ] **Step 3: Production build**

Run: `cd specter-web && npm run build`
Expected: build succeeds; `/repricing` compiles clean.

- [ ] **Step 4: No commit** — verification only. If any step fails, fix in the owning task before finishing the branch.

---

## Self-Review (completed during planning)

**1. Spec coverage**
- §4.1 reprice-preview → Task 1. ✓
- §4.2 guardrail-coverage → Task 2. ✓
- §4.3 bounds-validation → Task 3. ✓
- §4.4 reprice-filter (search/filter/sort, incl. needs-attention filter + attention sort) → Task 4. ✓
- §4.5 change-log-summary → Task 5. ✓
- §5 URL parsers (filter/sort/search) → Task 6. ✓
- §6.1 RepricePreviewChip → Task 7. ✓
- §6.2 RepriceCoverage (clickable Need Attention / Auto On) → Task 8. ✓
- §6.3 reuse ConfidenceMeter + formatPriceDelta; no SignalProvenance → Tasks 7, 9. ✓
- §7 page wiring (coverage, controls, preview, validation, log summary + source badge, deep-link preserved) → Task 9. ✓
- §9 testing (pure-only) → Tasks 1–6, 10. ✓

**2. Placeholder scan:** none — every code step contains complete code.

**3. Type consistency:**
- `RepriceState` defined in Task 1, consumed in Tasks 4 (filter) and 7 (chip). ✓
- `RepriceFilter`/`RepriceSort` defined in Task 4, imported by Task 6 (parsers) and Task 9 (page) and Task 8 (`onFilter` param type). ✓
- `CoverageSummary` from Task 2 consumed by Task 8. ✓
- `RepricePreview` interface from Task 1 consumed by Task 7. ✓
- `priceDeltaPct` / `formatPriceDelta` reused from D's `lib/dashboard/price-delta.ts` (unchanged). ✓
- Page pipeline `sortRepriceSKUs(filterRepriceSKUs(searchRepriceSKUs(...)))` matches the exported names from Task 4. ✓
- URL keys `q` / `filter` / `sort` default-omitted via `set({ key: ''→null })`; `?sku`/`?source` deep-link keys untouched. ✓
```
