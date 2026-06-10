# Amazon FBA Calculator Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Amazon FBA Calculator with 2025 fee rates, VAT, multi-currency, scenario save/compare, CSV/PDF export, package optimizer, break-even ACOS, fee distribution charts, and an insights strip.

**Architecture:** `lib/tools/fba.ts` gains updated 2025 rate constants and four new pure exports (VAT table, `effectivePriceAfterVat`, SIZE_TIERS, `OptimizerSuggestion`/`findCheaperTierDimensions`, `calcBreakevenAcos`). `app/tools/amazon-fba-calculator/page.tsx` wires sub-project A's hooks (`useCurrency`, `useScenarios`, `useExport`) and components (`ScenarioPanel`, `ExportBar`, `PrintReport`, `ToolBarChart`, `ToolPieChart`) and renders four new cards. One backward-compatible change to `components/tools/tool-chart.tsx` (per-cell bar color). `calcFbaFees` signature is unchanged.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS, Recharts (via `tool-chart.tsx` wrappers), Vitest

---

## File Map

| File | Action |
|---|---|
| `lib/tools/fba.ts` | Modify — 2025 rates, 5 new exports |
| `__tests__/tools/fba.test.ts` | Modify — update expected values + add new tests |
| `components/tools/tool-chart.tsx` | Modify — add `cellColorKey` to `BarDef` |
| `app/tools/amazon-fba-calculator/page.tsx` | Modify — full upgrade |

---

### Task 1: Update 2025 fee rate constants and fix tests

**Files:**
- Modify: `lib/tools/fba.ts`
- Modify: `__tests__/tools/fba.test.ts`

- [ ] **Step 1: Update `lib/tools/fba.ts` — file comment, `RATES_YEAR`, `STORAGE_RATES`, `calcFulfillmentFee`**

Replace the top comment and add `RATES_YEAR`. Replace `STORAGE_RATES`. Replace `calcFulfillmentFee` body with 2025 rates (effective Feb 5, 2025).

In `lib/tools/fba.ts`:

```ts
// Replace line 1:
// Amazon FBA 2025 fee schedule (effective Feb 5, 2025)

export const RATES_YEAR = '2025'
```

Replace the `STORAGE_RATES` constant (lines 61–64):
```ts
export const STORAGE_RATES = {
  jan_sep: 0.78,   // standard-size, Jan–Sep 2025
  oct_dec: 2.40,   // standard-size, Oct–Dec 2025 (peak unchanged)
}
```

Replace `calcFulfillmentFee` body (the switch statement, lines 126–159):
```ts
/** FBA fulfillment fees (2025 rates, non-apparel; effective Feb 5, 2025) */
export function calcFulfillmentFee(tier: FbaSizeTier, billable_oz: number): number {
  const lb = billable_oz / 16

  switch (tier) {
    case 'small_standard': {
      if (billable_oz <= 4)  return 3.06
      if (billable_oz <= 8)  return 3.24
      if (billable_oz <= 12) return 3.42
      return 3.60
    }
    case 'large_standard': {
      if (billable_oz <= 4)  return 3.68
      if (billable_oz <= 8)  return 3.90
      if (billable_oz <= 12) return 4.06
      if (billable_oz <= 16) return 4.56
      if (lb <= 1.5) return 5.19
      if (lb <= 2)   return 5.46
      if (lb <= 2.5) return 5.83
      if (lb <= 3)   return 6.08
      return 6.08 + Math.ceil((lb - 3) / 0.5) * 0.16
    }
    case 'large_bulky': {
      return 9.16 + Math.max(0, lb - 1) * 0.38
    }
    case 'extra_large_0_50': {
      return 26.33 + Math.max(0, lb - 1) * 0.38
    }
    case 'extra_large_50_70': {
      return 40.12 + Math.max(0, lb - 51) * 0.75
    }
    case 'extra_large_70_150': {
      return 54.81 + Math.max(0, lb - 71) * 0.75
    }
    case 'extra_large_150_plus': {
      return 194.95 + Math.max(0, lb - 151) * 0.19
    }
  }
}
```

- [ ] **Step 2: Update test expectations in `__tests__/tools/fba.test.ts`**

Replace each hardcoded 2024 dollar value with the 2025 equivalent. Updated test file:

```ts
import { describe, it, expect } from 'vitest'
import {
  calcDimWeight,
  calcSizeTier,
  calcFulfillmentFee,
  calcFbaFees,
  REFERRAL_RATES,
  REFERRAL_MINIMUM,
} from '@/lib/tools/fba'

describe('calcDimWeight', () => {
  it('returns (L×W×H/139) × 16 in ounces', () => {
    expect(calcDimWeight(10, 8, 4)).toBeCloseTo(36.83, 1)
  })
  it('returns 0-close value for very small package', () => {
    expect(calcDimWeight(3, 3, 1)).toBeLessThan(5)
  })
})

describe('calcSizeTier', () => {
  it('classifies small standard correctly (15oz, 12×10×0.5")', () => {
    expect(calcSizeTier(15, 12, 10, 0.5)).toBe('small_standard')
  })
  it('classifies large standard correctly (12oz, 15×12×4")', () => {
    expect(calcSizeTier(12, 15, 12, 4)).toBe('large_standard')
  })
  it('classifies large bulky correctly (32oz, 24×18×12")', () => {
    const tier = calcSizeTier(32, 24, 18, 12)
    expect(['large_bulky', 'extra_large_0_50']).toContain(tier)
  })
})

describe('calcFulfillmentFee', () => {
  it('returns $3.06 for small standard ≤4oz (2025)', () => {
    expect(calcFulfillmentFee('small_standard', 4)).toBe(3.06)
  })
  it('returns $3.24 for small standard 4-8oz (2025)', () => {
    expect(calcFulfillmentFee('small_standard', 6)).toBe(3.24)
  })
  it('returns $3.68 for large standard ≤4oz (2025)', () => {
    expect(calcFulfillmentFee('large_standard', 4)).toBe(3.68)
  })
  it('returns $5.19 for large standard 1-1.5lb (2025)', () => {
    expect(calcFulfillmentFee('large_standard', 20)).toBe(5.19) // 20oz = 1.25lb
  })
  it('applies per-lb addon above 3lb for large standard (2025)', () => {
    // 3.5lb = $6.08 + 1×$0.16 = $6.24
    expect(calcFulfillmentFee('large_standard', 56)).toBe(6.24) // 56oz = 3.5lb
  })
  it('large bulky base + per-lb increment (2025)', () => {
    // 5lb → $9.16 + (5-1)×$0.38 = $9.16 + $1.52 = $10.68
    expect(calcFulfillmentFee('large_bulky', 80)).toBeCloseTo(10.68, 2)
  })
})

describe('calcFbaFees — net_profit', () => {
  it('computes net profit for a standard product (2025 rates)', () => {
    const result = calcFbaFees({
      selling_price: 29.99,
      product_cost: 8.00,
      weight_oz: 12,
      length_in: 10,
      width_in: 8,
      height_in: 4,
      category: 'most_products',
      avg_monthly_units_stored: 1,
      is_peak_season: false,
    })
    // 10×8×4 = 320 in³; dim_weight ≈ 36.8oz (2.3lb) → large standard 2-2.5lb = $5.83
    expect(result.referral_fee).toBeCloseTo(4.50, 1)
    expect(result.fulfillment_fee).toBe(5.83)
    expect(result.net_profit).toBe(
      Math.round((29.99 - 8.00 - result.total_fees) * 100) / 100,
    )
    expect(result.margin_pct).toBeGreaterThan(0)
  })

  it('enforces minimum referral fee of $0.30', () => {
    const result = calcFbaFees({
      selling_price: 1.00,
      product_cost: 0.50,
      weight_oz: 2,
      length_in: 4,
      width_in: 3,
      height_in: 1,
      category: 'most_products',
      avg_monthly_units_stored: 1,
      is_peak_season: false,
    })
    expect(result.referral_fee).toBe(REFERRAL_MINIMUM)
  })

  it('uses higher storage rate during peak season', () => {
    const base = calcFbaFees({
      selling_price: 25, product_cost: 5,
      weight_oz: 8, length_in: 8, width_in: 6, height_in: 4,
      category: 'most_products', avg_monthly_units_stored: 100,
      is_peak_season: false,
    })
    const peak = calcFbaFees({
      selling_price: 25, product_cost: 5,
      weight_oz: 8, length_in: 8, width_in: 6, height_in: 4,
      category: 'most_products', avg_monthly_units_stored: 100,
      is_peak_season: true,
    })
    expect(peak.monthly_storage_fee).toBeGreaterThan(base.monthly_storage_fee)
  })

  it('uses electronics 8% referral rate', () => {
    const result = calcFbaFees({
      selling_price: 100, product_cost: 50,
      weight_oz: 16, length_in: 12, width_in: 8, height_in: 4,
      category: 'electronics', avg_monthly_units_stored: 1,
      is_peak_season: false,
    })
    expect(result.referral_fee).toBe(8.00)
  })

  it('break_even_price = product_cost + total_fees', () => {
    const input = {
      selling_price: 29.99, product_cost: 8.00,
      weight_oz: 12, length_in: 10, width_in: 8, height_in: 4,
      category: 'most_products' as const, avg_monthly_units_stored: 1,
      is_peak_season: false,
    }
    const r = calcFbaFees(input)
    expect(r.break_even_price).toBe(Math.round((8.00 + r.total_fees) * 100) / 100)
  })
})

describe('REFERRAL_RATES', () => {
  it('jewelry has 20% rate', () => {
    expect(REFERRAL_RATES.jewelry_watches).toBe(0.20)
  })
  it('electronics has 8% rate', () => {
    expect(REFERRAL_RATES.electronics).toBe(0.08)
  })
})
```

- [ ] **Step 3: Run tests — expect all to pass**

```bash
npm test -- --run
```

Expected: All tests pass (the `fulfillment_fee` assertion now uses 5.83 for the 2-2.5lb large standard tier).

- [ ] **Step 4: Commit**

```bash
git add lib/tools/fba.ts __tests__/tools/fba.test.ts
git commit -m "feat(fba): update to 2025 fee rates — fulfillment fees and storage"
```

---

### Task 2: Add VAT + SIZE_TIERS exports to fba.ts

**Files:**
- Modify: `lib/tools/fba.ts`
- Modify: `__tests__/tools/fba.test.ts`

- [ ] **Step 1: Write failing tests for the new exports**

Append to `__tests__/tools/fba.test.ts`:

```ts
import {
  // add to existing import:
  effectivePriceAfterVat,
  VAT_RATES,
  SIZE_TIERS,
} from '@/lib/tools/fba'

describe('effectivePriceAfterVat', () => {
  it('returns price unchanged when rate is 0', () => {
    expect(effectivePriceAfterVat(29.99, 0)).toBe(29.99)
  })
  it('adjusts price for 20% UK VAT (price / 1.20)', () => {
    expect(effectivePriceAfterVat(29.99, 0.20)).toBeCloseTo(24.99, 2)
  })
  it('adjusts price for 19% German VAT (price / 1.19)', () => {
    expect(effectivePriceAfterVat(23.80, 0.19)).toBeCloseTo(20.00, 2)
  })
})

describe('SIZE_TIERS', () => {
  it('exports all 7 tiers in order cheapest→most expensive', () => {
    expect(SIZE_TIERS).toEqual([
      'small_standard', 'large_standard', 'large_bulky',
      'extra_large_0_50', 'extra_large_50_70', 'extra_large_70_150', 'extra_large_150_plus',
    ])
  })
})

describe('VAT_RATES', () => {
  it('contains NONE entry with rate 0', () => {
    const none = VAT_RATES.find((v) => v.code === 'NONE')
    expect(none?.rate).toBe(0)
  })
  it('contains UK entry with rate 0.20', () => {
    const uk = VAT_RATES.find((v) => v.code === 'GB')
    expect(uk?.rate).toBe(0.20)
  })
})
```

- [ ] **Step 2: Run tests — expect new tests to fail**

```bash
npm test -- --run
```

Expected: 7 new test failures (effectivePriceAfterVat, SIZE_TIERS, VAT_RATES not exported yet).

- [ ] **Step 3: Add `VatEntry`, `VAT_RATES`, `effectivePriceAfterVat`, and `SIZE_TIERS` to `lib/tools/fba.ts`**

Add after the `REFERRAL_MINIMUM` line (line 58) and before `FbaInput`:

```ts
export interface VatEntry {
  country: string
  code: string
  rate: number
}

export const VAT_RATES: VatEntry[] = [
  { country: 'None (No VAT)',  code: 'NONE', rate: 0    },
  { country: 'UK',             code: 'GB',   rate: 0.20 },
  { country: 'Germany',        code: 'DE',   rate: 0.19 },
  { country: 'France',         code: 'FR',   rate: 0.20 },
  { country: 'Italy',          code: 'IT',   rate: 0.22 },
  { country: 'Spain',          code: 'ES',   rate: 0.21 },
  { country: 'Netherlands',    code: 'NL',   rate: 0.21 },
  { country: 'Poland',         code: 'PL',   rate: 0.23 },
  { country: 'Sweden',         code: 'SE',   rate: 0.25 },
]

export function effectivePriceAfterVat(price: number, rate: number): number {
  return rate === 0 ? price : price / (1 + rate)
}

export const SIZE_TIERS: FbaSizeTier[] = [
  'small_standard', 'large_standard', 'large_bulky',
  'extra_large_0_50', 'extra_large_50_70', 'extra_large_70_150', 'extra_large_150_plus',
]
```

Note: `VatEntry`, `VAT_RATES`, `effectivePriceAfterVat`, and `SIZE_TIERS` must be placed after the `FbaSizeTier` type declaration (since `SIZE_TIERS` uses it) but `VatEntry`/`VAT_RATES`/`effectivePriceAfterVat` can go anywhere. Place them after `REFERRAL_MINIMUM` and before `FbaInput`.

Also update the import list at the top of `__tests__/tools/fba.test.ts` to include the new exports in the single import statement.

- [ ] **Step 4: Run tests — expect all to pass**

```bash
npm test -- --run
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/tools/fba.ts __tests__/tools/fba.test.ts
git commit -m "feat(fba): add VAT_RATES, effectivePriceAfterVat, SIZE_TIERS exports"
```

---

### Task 3: Add package optimizer function to fba.ts

**Files:**
- Modify: `lib/tools/fba.ts`
- Modify: `__tests__/tools/fba.test.ts`

- [ ] **Step 1: Write failing tests for `findCheaperTierDimensions`**

Append to `__tests__/tools/fba.test.ts` (add `findCheaperTierDimensions` to the import):

```ts
import {
  // ... existing imports ...,
  findCheaperTierDimensions,
} from '@/lib/tools/fba'

describe('findCheaperTierDimensions', () => {
  it('returns null for small_standard (already cheapest)', () => {
    // 8oz, 12×10×0.5 in → small_standard
    const result = findCheaperTierDimensions(8, 12, 10, 0.5, 3.06, 'most_products', 29.99)
    expect(result).toBeNull()
  })

  it('suggests reducing length when large_standard → small_standard is possible', () => {
    // 8oz (< 16oz), 16×10×0.5 in → large_standard (L=16 > 15)
    // reduce L to 15: calcSizeTier(8, 15, 10, 0.5) = small_standard
    const currentFee = calcFulfillmentFee('large_standard', 8) // $3.90
    const result = findCheaperTierDimensions(8, 16, 10, 0.5, currentFee, 'most_products', 29.99)
    expect(result).not.toBeNull()
    expect(result!.target_tier).toBe('small_standard')
    expect(result!.suggested_length_in).toBe(15)
    expect(result!.fee_saving).toBeGreaterThan(0)
    expect(result!.threshold_in).toBe(15)
  })

  it('returns null when weight prevents small_standard (weight > 16oz)', () => {
    // 20oz > 16oz max for small_standard; L=16, W=12, H=0.5 → large_standard
    const currentFee = calcFulfillmentFee('large_standard', 20) // $5.19
    const result = findCheaperTierDimensions(20, 16, 12, 0.5, currentFee, 'most_products', 29.99)
    expect(result).toBeNull()
  })

  it('returns null when dimension is already at or below threshold', () => {
    // 8oz, 14×12×0.5 in → large_standard (M=14, fits, but L=14 < 15 already)
    // Actually L=14 ≤ 15 so no reduction needed
    const currentFee = calcFulfillmentFee('large_standard', 8)
    const result = findCheaperTierDimensions(8, 14, 12, 0.5, currentFee, 'most_products', 29.99)
    // If already qualifies for small_standard after sorting, should return null
    // calcSizeTier(8, 14, 12, 0.5) → L=14 ≤ 15, M=12 ≤ 12, S=0.5 ≤ 0.75, weight=8≤16 → small_standard
    // But wait — if current tier is already small_standard, returns null
    // So this product IS actually small_standard, not large_standard
    // Let's use L=14, W=13 (M > 12 → not small_standard)
    const fee2 = calcFulfillmentFee('large_standard', 8)
    const result2 = findCheaperTierDimensions(8, 14, 13, 0.5, fee2, 'most_products', 29.99)
    // L=14 ≤ 15 so no length reduction needed; M=13 > 12 prevents small_standard via weight/width
    // findCheaperTierDimensions should return null (longest dim ≤ threshold)
    expect(result2).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — expect new tests to fail**

```bash
npm test -- --run
```

Expected: The `findCheaperTierDimensions` tests fail.

- [ ] **Step 3: Add `OptimizerSuggestion` interface and `findCheaperTierDimensions` to `lib/tools/fba.ts`**

Add after `SIZE_TIERS` (before `FbaInput`):

```ts
export interface OptimizerSuggestion {
  target_tier: FbaSizeTier
  suggested_length_in: number
  suggested_width_in: number
  suggested_height_in: number
  fee_saving: number       // USD delta (positive = saving)
  description: string      // e.g. "Reduce length 16.0in → 15.0in"
  threshold_in: number     // max L dimension of the target tier (for callout distance calc)
}

export function findCheaperTierDimensions(
  weight_oz: number,
  length_in: number,
  width_in: number,
  height_in: number,
  current_fulfillment_fee: number,
  category: FbaCategory,
  selling_price: number,
): OptimizerSuggestion | null {
  const currentTier = calcSizeTier(weight_oz, length_in, width_in, height_in)
  if (currentTier === 'small_standard') return null

  const NEXT_CHEAPER: Partial<Record<FbaSizeTier, { tier: FbaSizeTier; maxL: number }>> = {
    large_standard:   { tier: 'small_standard', maxL: 15 },
    large_bulky:      { tier: 'large_standard', maxL: 18 },
    extra_large_0_50: { tier: 'large_bulky',    maxL: 59 },
  }

  const next = NEXT_CHEAPER[currentTier]
  if (!next) return null  // weight-dominated extra-large tier — dimension reduction won't help

  // Find the longest dimension
  const dims = [
    { key: 'length_in' as const, val: length_in },
    { key: 'width_in'  as const, val: width_in  },
    { key: 'height_in' as const, val: height_in },
  ].sort((a, b) => b.val - a.val)
  const longest = dims[0]

  if (longest.val <= next.maxL) return null  // already within threshold for that dimension

  const suggested = {
    length_in: longest.key === 'length_in' ? next.maxL : length_in,
    width_in:  longest.key === 'width_in'  ? next.maxL : width_in,
    height_in: longest.key === 'height_in' ? next.maxL : height_in,
  }

  const newTier = calcSizeTier(weight_oz, suggested.length_in, suggested.width_in, suggested.height_in)
  if (newTier !== next.tier) return null  // other constraints (weight, other dims) prevent the tier

  const newDimWeight = calcDimWeight(suggested.length_in, suggested.width_in, suggested.height_in)
  const newBillable = Math.max(weight_oz, newDimWeight)
  const newFee = calcFulfillmentFee(next.tier, newBillable)
  const saving = round2(current_fulfillment_fee - newFee)
  if (saving <= 0) return null

  const dimName = longest.key.replace('_in', '')
  return {
    target_tier: next.tier,
    suggested_length_in: suggested.length_in,
    suggested_width_in: suggested.width_in,
    suggested_height_in: suggested.height_in,
    fee_saving: saving,
    description: `Reduce ${dimName} ${longest.val}in → ${next.maxL}in`,
    threshold_in: next.maxL,
  }
}
```

Note: `findCheaperTierDimensions` uses `calcSizeTier`, `calcDimWeight`, `calcFulfillmentFee`, and `round2` — all defined in the same file. Place this function after `SIZE_TIERS` and before `FbaInput` (or after `calcFulfillmentFee` — as long as it is after `calcSizeTier`, `calcDimWeight`, and `calcFulfillmentFee` are defined). The private `round2` is defined at the bottom of the file; TypeScript hoisting ensures it's available.

Actually place `OptimizerSuggestion` and `findCheaperTierDimensions` **after** `calcFulfillmentFee` and **before** `calcFbaFees`. This avoids forward-reference issues with the private helpers.

- [ ] **Step 4: Run tests — expect all to pass**

```bash
npm test -- --run
```

Expected: All tests pass including the new `findCheaperTierDimensions` suite.

- [ ] **Step 5: Commit**

```bash
git add lib/tools/fba.ts __tests__/tools/fba.test.ts
git commit -m "feat(fba): add OptimizerSuggestion and findCheaperTierDimensions"
```

---

### Task 4: Add calcBreakevenAcos to fba.ts

**Files:**
- Modify: `lib/tools/fba.ts`
- Modify: `__tests__/tools/fba.test.ts`

- [ ] **Step 1: Write failing tests for `calcBreakevenAcos`**

Append to `__tests__/tools/fba.test.ts` (add `calcBreakevenAcos` to the import):

```ts
import {
  // ... existing imports ...,
  calcBreakevenAcos,
} from '@/lib/tools/fba'

describe('calcBreakevenAcos', () => {
  it('returns correct ACOS percentage rounded to 1 decimal', () => {
    // (5 / 29.99) * 100 = 16.672... → rounds to 16.7
    expect(calcBreakevenAcos(5.00, 29.99)).toBe(16.7)
  })
  it('returns 0 when selling_price is 0', () => {
    expect(calcBreakevenAcos(5.00, 0)).toBe(0)
  })
  it('returns 0 when net_profit is 0', () => {
    expect(calcBreakevenAcos(0, 29.99)).toBe(0)
  })
  it('handles negative profit (loss scenario)', () => {
    // (-2 / 29.99) * 100 = -6.67... → rounds to -6.7
    expect(calcBreakevenAcos(-2.00, 29.99)).toBe(-6.7)
  })
})
```

- [ ] **Step 2: Run tests — expect new tests to fail**

```bash
npm test -- --run
```

Expected: 4 new test failures for `calcBreakevenAcos`.

- [ ] **Step 3: Add `calcBreakevenAcos` to `lib/tools/fba.ts`**

Add after `findCheaperTierDimensions` and before `calcFbaFees`:

```ts
export function calcBreakevenAcos(net_profit: number, selling_price: number): number {
  if (selling_price <= 0) return 0
  return Math.round((net_profit / selling_price) * 1000) / 10
}
```

- [ ] **Step 4: Run all tests — expect all to pass**

```bash
npm test -- --run
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/tools/fba.ts __tests__/tools/fba.test.ts
git commit -m "feat(fba): add calcBreakevenAcos pure function"
```

---

### Task 5: Wire currency + scenarios + export to FBA page

**Files:**
- Modify: `app/tools/amazon-fba-calculator/page.tsx`

This task replaces the local `fmt` function, wires `useCurrency`, `useScenarios`, adds `ScenarioPanel`/`ExportBar`/`PrintReport`, and renames `input` → `input_usd`. No VAT, ACOS, or new cards yet.

- [ ] **Step 1: Replace imports at the top of `page.tsx`**

Replace the entire import block (lines 1–8) with:

```tsx
'use client'

import { useState, useMemo } from 'react'
import ToolLayout, {
  CalcCard, Field, Input, Select, Metric,
} from '@/components/tools/tool-layout'
import {
  calcFbaFees, FbaCategory, FbaInput, REFERRAL_RATES,
} from '@/lib/tools/fba'
import { CURRENCIES } from '@/lib/tools/currency'
import { useCurrency } from '@/hooks/use-currency'
import { useScenarios } from '@/hooks/use-scenarios'
import type { ExportRow } from '@/lib/tools/export'
import ScenarioPanel from '@/components/tools/scenario-panel'
import ExportBar from '@/components/tools/export-bar'
import PrintReport from '@/components/tools/print-report'
import type { Scenario } from '@/lib/tools/scenarios'
import { cn } from '@/lib/utils'
```

- [ ] **Step 2: Remove the local `fmt` helper and add `TIER_LABELS`**

Remove the current `fmt` constant:
```ts
// DELETE this line:
const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
```

The `CATEGORIES` and `TIER_LABELS` constants at the top of the file stay unchanged.

- [ ] **Step 3: Replace the component body — hooks, derived values, renamed `input` → `input_usd`**

Replace the `useState` block and `input`/`r` memos inside `FbaCalculatorPage` with:

```tsx
export default function FbaCalculatorPage() {
  const [selling_price, setSellingPrice] = useState('29.99')
  const [product_cost, setProductCost] = useState('8.00')
  const [weight_oz, setWeightOz] = useState('12')
  const [length_in, setLength] = useState('10')
  const [width_in, setWidth] = useState('8')
  const [height_in, setHeight] = useState('4')
  const [category, setCategory] = useState<FbaCategory>('most_products')
  const [units_stored, setUnitsStored] = useState('100')
  const [is_peak, setIsPeak] = useState(false)

  const { currency, toUSD, fromUSD, fmt, currencies } = useCurrency()
  const { scenarios, saveScenario, deleteScenario, compareIds, setCompareIds } =
    useScenarios('fba')

  const currencySymbol = currencies.find((c) => c.code === currency)?.symbol ?? '$'

  const input_usd: FbaInput = useMemo(
    () => ({
      selling_price: toUSD(parseFloat(selling_price) || 0),
      product_cost:  toUSD(parseFloat(product_cost)  || 0),
      weight_oz:     parseFloat(weight_oz)  || 0,
      length_in:     parseFloat(length_in)  || 0,
      width_in:      parseFloat(width_in)   || 0,
      height_in:     parseFloat(height_in)  || 0,
      category,
      avg_monthly_units_stored: parseFloat(units_stored) || 0,
      is_peak_season: is_peak,
    }),
    [selling_price, product_cost, weight_oz, length_in, width_in, height_in,
     category, units_stored, is_peak, toUSD],
  )

  const r = useMemo(() => calcFbaFees(input_usd), [input_usd])

  const exportInputs: ExportRow[] = [
    { label: 'Selling Price', value: fmt(fromUSD(parseFloat(selling_price) || 0)) },
    { label: 'Product Cost',  value: fmt(fromUSD(parseFloat(product_cost)  || 0)) },
    { label: 'Weight',        value: `${weight_oz} oz` },
    { label: 'Dimensions',    value: `${length_in} × ${width_in} × ${height_in} in` },
    { label: 'Category',      value: category },
    { label: 'Units Stored',  value: units_stored },
    { label: 'Peak Season',   value: is_peak ? 'Yes' : 'No' },
    { label: 'VAT',           value: 'None' },
  ]

  const exportResults: ExportRow[] = [
    { label: 'Net Profit',       value: fmt(fromUSD(r.net_profit)) },
    { label: 'Margin',           value: `${r.margin_pct}%` },
    { label: 'ROI',              value: `${r.roi_pct}%` },
    { label: 'Total Fees',       value: fmt(fromUSD(r.total_fees)) },
    { label: 'Fulfillment Fee',  value: fmt(fromUSD(r.fulfillment_fee)) },
    { label: 'Referral Fee',     value: fmt(fromUSD(r.referral_fee)) },
    { label: 'Storage Fee',      value: fmt(fromUSD(r.monthly_storage_fee)) },
    { label: 'Break-even Price', value: fmt(fromUSD(r.break_even_price)) },
    { label: 'Size Tier',        value: TIER_LABELS[r.size_tier] },
  ]

  const currentInputs: Record<string, string | boolean> = {
    selling_price, product_cost, weight_oz, length_in, width_in,
    height_in, category, units_stored, is_peak: String(is_peak), vat_code: 'NONE',
  }

  const currentResults: Record<string, number> = {
    net_profit: r.net_profit,
    margin_pct: r.margin_pct,
    roi_pct: r.roi_pct,
    total_fees: r.total_fees,
    fulfillment_fee: r.fulfillment_fee,
    referral_fee: r.referral_fee,
    monthly_storage_fee: r.monthly_storage_fee,
    break_even_price: r.break_even_price,
  }

  const resultLabels: Record<string, string> = {
    net_profit: 'Net Profit',
    margin_pct: 'Margin %',
    roi_pct: 'ROI %',
    total_fees: 'Total Fees',
    fulfillment_fee: 'Fulfillment Fee',
    referral_fee: 'Referral Fee',
    monthly_storage_fee: 'Storage Fee',
    break_even_price: 'Break-even Price',
  }

  function handleLoadScenario(scenario: Scenario) {
    setSellingPrice(scenario.inputs.selling_price as string)
    setProductCost(scenario.inputs.product_cost  as string)
    setWeightOz(scenario.inputs.weight_oz         as string)
    setLength(scenario.inputs.length_in           as string)
    setWidth(scenario.inputs.width_in             as string)
    setHeight(scenario.inputs.height_in           as string)
    setCategory(scenario.inputs.category          as FbaCategory)
    setUnitsStored(scenario.inputs.units_stored   as string)
    setIsPeak(scenario.inputs.is_peak === 'true')
  }

  const hasInteracted = parseFloat(selling_price) > 0
```

- [ ] **Step 4: Update all dollar outputs and hardcoded USD strings in the JSX**

In the `return (...)` block, make these replacements:

1. `<Input ... prefix="$" ...>` for Selling Price and Product Cost:
   - Change `prefix="$"` → `prefix={currencySymbol}`

2. In Fee Breakdown card, the three fee rows:
   - `fmt(value)` → `fmt(fromUSD(value))` for each `value` in the map

3. Referral fee note string: `` `${(REFERRAL_RATES[category] * 100).toFixed(0)}% of sale price` `` stays the same (it's a percentage label, not a dollar amount)

4. Storage note: `'${r.cubic_feet} cu ft × ${is_peak ? "$2.40" : "$0.87"}'`  
   → `` `${r.cubic_feet} cu ft × ${is_peak ? fmt(fromUSD(2.40)) : fmt(fromUSD(0.78))}` ``

5. Total Amazon Fees: `fmt(r.total_fees)` → `fmt(fromUSD(r.total_fees))`

6. Headline `fmt(r.net_profit)` → `fmt(fromUSD(r.net_profit))`

7. Break-even price display: `fmt(r.break_even_price)` → `fmt(fromUSD(r.break_even_price))`

- [ ] **Step 5: Add `headerRight` prop to `<ToolLayout>` and `<PrintReport>` after the main div**

Replace `<ToolLayout ... >` opening tag with:

```tsx
<ToolLayout
  toolId="fba"
  badge="Free FBA Tool"
  title="Amazon FBA Fee & Profit Calculator"
  description="Calculate your exact Amazon FBA fulfillment fees, referral fees, and storage costs — then see true net profit per unit with 2025 official rates."
  headerRight={
    <>
      <ScenarioPanel
        toolId="fba"
        currentInputs={currentInputs}
        currentResults={currentResults}
        currency={currency}
        resultLabels={resultLabels}
        onLoad={handleLoadScenario}
      />
      {hasInteracted && (
        <ExportBar
          toolId="fba"
          inputs={exportInputs}
          results={exportResults}
          currency={currency}
        />
      )}
    </>
  }
>
```

After the closing `</div>` of the main grid (before the Disclaimer `<p>`), add:

```tsx
<PrintReport
  toolName="Amazon FBA Calculator"
  toolId="fba"
  currency={currency}
  inputs={exportInputs}
  results={exportResults}
/>
```

- [ ] **Step 6: Run dev server and verify the page loads, currency selector changes symbols, scenarios panel opens**

```bash
npm run dev
```

Open `http://localhost:3000/tools/amazon-fba-calculator`. Verify:
- Currency selector in header changes $ prefix on inputs and all output values
- "Scenarios" chip is visible, expands to save/load panel
- "CSV" and "PDF" buttons appear once selling price > 0

- [ ] **Step 7: Commit**

```bash
git add app/tools/amazon-fba-calculator/page.tsx
git commit -m "feat(fba): wire currency, scenarios, and export to FBA calculator page"
```

---

### Task 6: Add VAT UI to page

**Files:**
- Modify: `app/tools/amazon-fba-calculator/page.tsx`

- [ ] **Step 1: Add VAT imports and state**

Add to the import from `@/lib/tools/fba`:
```ts
import {
  calcFbaFees, FbaCategory, FbaInput, REFERRAL_RATES,
  VAT_RATES, effectivePriceAfterVat,   // ADD these two
} from '@/lib/tools/fba'
```

Inside `FbaCalculatorPage`, after the `is_peak` state, add:
```ts
const [vatCode, setVatCode] = useState('NONE')
```

After `currencySymbol`, add:
```ts
const vatRate = VAT_RATES.find((v) => v.code === vatCode)?.rate ?? 0
```

- [ ] **Step 2: Update `input_usd` memo to apply VAT adjustment**

Replace the `selling_price` line inside the `input_usd` useMemo:
```ts
// Replace:
selling_price: toUSD(parseFloat(selling_price) || 0),
// With:
selling_price: effectivePriceAfterVat(toUSD(parseFloat(selling_price) || 0), vatRate),
```

Add `vatRate` to the dependency array:
```ts
[selling_price, product_cost, weight_oz, length_in, width_in, height_in,
 category, units_stored, is_peak, vatRate, toUSD],
```

- [ ] **Step 3: Update `currentInputs` and `exportInputs` to reflect VAT**

In `currentInputs`, update `vat_code: 'NONE'` → `vat_code: vatCode`.

In `exportInputs`, update the VAT row:
```ts
{ label: 'VAT', value: vatCode === 'NONE' ? 'None' : `${vatCode} ${(vatRate * 100).toFixed(0)}%` },
```

Also add `handleLoadScenario` VAT restoration:
```ts
// Add inside handleLoadScenario:
if (scenario.inputs.vat_code) setVatCode(scenario.inputs.vat_code as string)
```

- [ ] **Step 4: Add Marketplace VAT field to "Product & Pricing" card**

Inside the `<CalcCard title="Product & Pricing">`, after the 2-column price grid, add:
```tsx
<div className="mt-4">
  <Field label="Marketplace VAT">
    <Select value={vatCode} onChange={setVatCode}>
      {VAT_RATES.map((v) => (
        <option key={v.code} value={v.code}>
          {v.country}{v.rate > 0 ? ` (${(v.rate * 100).toFixed(0)}%)` : ''}
        </option>
      ))}
    </Select>
  </Field>
</div>
```

- [ ] **Step 5: Add VAT note below headline profit metric**

Inside the headline `<CalcCard>`, after the `<p>` showing `fmt(fromUSD(r.net_profit))` and before the Margin/ROI row, add:

```tsx
{vatCode !== 'NONE' && (
  <p className="font-body text-xs text-muted mt-1">
    VAT-adjusted: effective revenue{' '}
    {fmt(fromUSD(input_usd.selling_price))} of{' '}
    {fmt(fromUSD(toUSD(parseFloat(selling_price) || 0)))}
  </p>
)}
```

- [ ] **Step 6: Run dev server — verify VAT dropdown appears and adjusts results**

Open `http://localhost:3000/tools/amazon-fba-calculator`. Select UK (20%) VAT. Verify:
- Net profit decreases (effective revenue is price / 1.20)
- VAT note appears below the profit figure

- [ ] **Step 7: Commit**

```bash
git add app/tools/amazon-fba-calculator/page.tsx
git commit -m "feat(fba): add VAT country dropdown with auto-fill rates"
```

---

### Task 7: Add break-even ACOS to headline card

**Files:**
- Modify: `app/tools/amazon-fba-calculator/page.tsx`

- [ ] **Step 1: Add `calcBreakevenAcos` to the import**

```ts
import {
  calcFbaFees, FbaCategory, FbaInput, REFERRAL_RATES,
  VAT_RATES, effectivePriceAfterVat, calcBreakevenAcos,   // ADD calcBreakevenAcos
} from '@/lib/tools/fba'
```

- [ ] **Step 2: Compute `breakeven_acos` after `r`**

After the `r` memo, add:

```ts
const breakeven_acos = calcBreakevenAcos(r.net_profit, input_usd.selling_price)
```

- [ ] **Step 3: Update `exportResults` to include Break-even ACOS**

Add after the ROI row in `exportResults`:
```ts
{ label: 'Break-even ACOS', value: r.net_profit <= 0 ? 'N/A' : `${breakeven_acos}%` },
```

- [ ] **Step 4: Add ACOS metric to the headline card**

In the headline card, find the `<div className="flex items-center justify-center gap-4 mt-3">` row. Add the ACOS span after ROI:

```tsx
<span className="text-border">·</span>
<span className="font-mono text-sm text-muted">
  ACOS:{' '}
  <span className={cn(
    r.net_profit <= 0
      ? 'text-rose-400'
      : breakeven_acos >= 15
        ? 'text-primary'
        : breakeven_acos >= 8
          ? 'text-amber-400'
          : 'text-rose-400',
  )}>
    {r.net_profit <= 0 ? 'N/A' : `${breakeven_acos}%`}
  </span>
</span>
```

Also add `flex-wrap` to the containing div so it wraps on small screens:
```tsx
<div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
```

- [ ] **Step 5: Run dev server — verify ACOS appears and colors correctly**

Open the calculator with defaults ($29.99 selling, $8 cost). Verify:
- ACOS percentage shows next to ROI
- Color is primary (≥15% healthy), amber (8-14.9%), or rose (<8% / negative)

- [ ] **Step 6: Commit**

```bash
git add app/tools/amazon-fba-calculator/page.tsx
git commit -m "feat(fba): add break-even ACOS metric to headline card"
```

---

### Task 8: Add package optimizer card

**Files:**
- Modify: `app/tools/amazon-fba-calculator/page.tsx`

- [ ] **Step 1: Add `findCheaperTierDimensions` import and inline helpers**

Add to the import from `@/lib/tools/fba`:
```ts
import {
  calcFbaFees, FbaCategory, FbaInput, REFERRAL_RATES,
  VAT_RATES, effectivePriceAfterVat, calcBreakevenAcos,
  findCheaperTierDimensions, SIZE_TIERS,   // ADD these
  calcFulfillmentFee,                       // ADD this for tier table
} from '@/lib/tools/fba'
```

Add after the `TIER_LABELS` constant (top of file, outside component):
```ts
const r2 = (n: number) => Math.round(n * 100) / 100

const TIER_LIMITS: Record<string, { maxL: string; maxW: string; maxH: string; maxWt: string }> = {
  small_standard:      { maxL: '15 in', maxW: '12 in', maxH: '0.75 in', maxWt: '1 lb'   },
  large_standard:      { maxL: '18 in', maxW: '14 in', maxH: '8 in',    maxWt: '20 lb'  },
  large_bulky:         { maxL: '59 in', maxW: '33 in', maxH: '33 in',   maxWt: '50 lb'  },
  extra_large_0_50:    { maxL: '—',     maxW: '—',     maxH: '—',       maxWt: '50 lb'  },
  extra_large_50_70:   { maxL: '—',     maxW: '—',     maxH: '—',       maxWt: '70 lb'  },
  extra_large_70_150:  { maxL: '—',     maxW: '—',     maxH: '—',       maxWt: '150 lb' },
  extra_large_150_plus:{ maxL: '—',     maxW: '—',     maxH: '—',       maxWt: '—'      },
}
```

- [ ] **Step 2: Compute `suggestion` after `breakeven_acos`**

```ts
const suggestion = useMemo(
  () => findCheaperTierDimensions(
    input_usd.weight_oz,
    input_usd.length_in,
    input_usd.width_in,
    input_usd.height_in,
    r.fulfillment_fee,
    category,
    input_usd.selling_price,
  ),
  [input_usd, r.fulfillment_fee, category],
)
```

- [ ] **Step 3: Add tier-crossing callout below Package Analysis card**

After the closing `</CalcCard>` of the "Package Analysis" card in the results column, add:

```tsx
{suggestion && (() => {
  const longestDim = Math.max(input_usd.length_in, input_usd.width_in, input_usd.height_in)
  const distance = Math.round((longestDim - suggestion.threshold_in) * 10) / 10
  if (distance / suggestion.threshold_in >= 0.15) return null
  return (
    <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-3">
      <p className="font-body text-sm font-semibold text-amber-400">
        Within {distance} in of a cheaper tier
      </p>
      <p className="font-body text-xs text-muted mt-0.5">
        Saves {fmt(fromUSD(suggestion.fee_saving))}/unit — see optimizer below
      </p>
    </div>
  )
})()}
```

- [ ] **Step 4: Add Package Optimizer card below the 2-column grid**

After the closing `</div>` of the main `grid md:grid-cols-2` div, add:

```tsx
{/* Package Optimizer */}
<div className="mt-6">
  <CalcCard title="Package Optimizer">
    {suggestion && (
      <div className="mb-5 bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="font-body text-sm font-semibold text-text">{suggestion.description}</p>
          <p className="font-body text-xs text-muted mt-0.5">
            Drops to {TIER_LABELS[suggestion.target_tier]} — saves{' '}
            {fmt(fromUSD(suggestion.fee_saving))}/unit in fulfillment fees
          </p>
        </div>
        <button
          onClick={() => {
            setLength(String(suggestion.suggested_length_in))
            setWidth(String(suggestion.suggested_width_in))
            setHeight(String(suggestion.suggested_height_in))
          }}
          className="shrink-0 px-4 py-2 rounded-lg bg-primary text-bg font-mono text-xs font-bold hover:bg-primary/90 transition-colors"
        >
          Apply suggestion
        </button>
      </div>
    )}
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border">
            <th className="font-body text-xs text-muted uppercase tracking-wide pb-2 pr-3">Tier</th>
            <th className="font-body text-xs text-muted uppercase tracking-wide pb-2 pr-3">Max L</th>
            <th className="font-body text-xs text-muted uppercase tracking-wide pb-2 pr-3">Max W</th>
            <th className="font-body text-xs text-muted uppercase tracking-wide pb-2 pr-3">Max H</th>
            <th className="font-body text-xs text-muted uppercase tracking-wide pb-2 pr-3">Max Wt</th>
            <th className="font-body text-xs text-muted uppercase tracking-wide pb-2 text-right">
              Fee at current weight
            </th>
          </tr>
        </thead>
        <tbody>
          {SIZE_TIERS.map((tier) => {
            const lim = TIER_LIMITS[tier]
            const tierFee = r2(calcFulfillmentFee(tier, r.billable_weight_oz))
            const isCurrent = tier === r.size_tier
            return (
              <tr
                key={tier}
                className={cn(
                  'border-b border-border/50 last:border-0',
                  isCurrent && 'bg-primary/5 border-l-2 border-l-primary',
                )}
              >
                <td className={cn('py-2 pr-3 font-body text-xs', isCurrent ? 'text-primary font-semibold' : 'text-text')}>
                  {TIER_LABELS[tier]}
                </td>
                <td className="py-2 pr-3 font-mono text-xs text-muted">{lim.maxL}</td>
                <td className="py-2 pr-3 font-mono text-xs text-muted">{lim.maxW}</td>
                <td className="py-2 pr-3 font-mono text-xs text-muted">{lim.maxH}</td>
                <td className="py-2 pr-3 font-mono text-xs text-muted">{lim.maxWt}</td>
                <td className={cn('py-2 font-mono text-xs text-right', isCurrent ? 'text-primary font-semibold' : 'text-muted')}>
                  {fmt(fromUSD(tierFee))}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    <p className="font-body text-xs text-muted mt-3">
      Fee at current weight compares what each tier would charge for your product's billable weight.
    </p>
  </CalcCard>
</div>
```

- [ ] **Step 5: Run dev server — verify optimizer card renders**

Open the calculator with large dimensions (e.g., length = 20, weight = 8 oz). Verify:
- Tier reference table shows all 7 tiers with current tier highlighted
- "Apply suggestion" button appears and changes the length input when clicked
- Amber callout appears below Package Analysis when within 15% of threshold

- [ ] **Step 6: Commit**

```bash
git add app/tools/amazon-fba-calculator/page.tsx
git commit -m "feat(fba): add package optimizer card with tier table and apply suggestion"
```

---

### Task 9: Add analysis card with charts + insights, extend ToolBarChart, update disclaimer

**Files:**
- Modify: `components/tools/tool-chart.tsx`
- Modify: `app/tools/amazon-fba-calculator/page.tsx`

- [ ] **Step 1: Extend `ToolBarChart` with per-cell coloring in `components/tools/tool-chart.tsx`**

In `tool-chart.tsx`, add `cellColorKey?: string` to `BarDef`:

```ts
// Replace the BarDef interface:
interface BarDef {
  key: string
  label: string
  color?: string
  cellColorKey?: string  // data record key holding per-bar fill color
}
```

In the `{bars.map(...)}` render inside `ToolBarChart`, replace `<Bar ... />` with:

```tsx
{bars.map((b, i) => (
  <Bar
    key={b.key}
    dataKey={b.key}
    name={b.label}
    fill={b.color ?? CHART_COLORS[i % CHART_COLORS.length]}
    radius={[4, 4, 0, 0]}
  >
    {b.cellColorKey &&
      data.map((entry, j) => (
        <Cell key={j} fill={String(entry[b.cellColorKey!])} />
      ))}
  </Bar>
))}
```

`Cell` is already imported at the top of `tool-chart.tsx` — no new import needed.

- [ ] **Step 2: Add remaining imports and constants to `page.tsx`**

Add to the import from `@/lib/tools/fba`:
```ts
import {
  calcFbaFees, FbaCategory, FbaInput, REFERRAL_RATES,
  VAT_RATES, effectivePriceAfterVat, calcBreakevenAcos,
  findCheaperTierDimensions, SIZE_TIERS, calcFulfillmentFee,
  RATES_YEAR,   // ADD RATES_YEAR
} from '@/lib/tools/fba'
import { BENCHMARKS } from '@/lib/tools/benchmarks'
import { ToolPieChart, ToolBarChart } from '@/components/tools/tool-chart'
```

Add after `TIER_LIMITS` (top of file):
```ts
const r1 = (n: number) => Math.round(n * 10) / 10

const TIER_LABELS_SHORT: Record<string, string> = {
  small_standard:      'Small Std',
  large_standard:      'Large Std',
  large_bulky:         'Bulky',
  extra_large_0_50:    'XL 0–50',
  extra_large_50_70:   'XL 50–70',
  extra_large_70_150:  'XL 70–150',
  extra_large_150_plus:'XL 150+',
}
```

- [ ] **Step 3: Compute chart data and insights inside the component**

Add after the `suggestion` memo:

```ts
// Chart 1 — cost distribution pie
const pieData = [
  { name: 'Product Cost',    value: fromUSD(input_usd.product_cost) },
  { name: 'Fulfillment Fee', value: fromUSD(r.fulfillment_fee)      },
  { name: 'Referral Fee',    value: fromUSD(r.referral_fee)         },
  { name: 'Storage Fee',     value: fromUSD(r.monthly_storage_fee)  },
  { name: 'Net Profit',      value: Math.max(0, fromUSD(r.net_profit)) },
]

// Chart 2 — tier fee comparison bar chart
const tierData = SIZE_TIERS.map((tier) => ({
  tier:    TIER_LABELS_SHORT[tier],
  fee:     r2(calcFulfillmentFee(tier, r.billable_weight_oz)),
  color:   tier === r.size_tier ? '#00E87A' : '#60A5FA',
}))

// Insights
const marginHealth =
  r.margin_pct >= BENCHMARKS.fba_margins.healthy * 100 ? 'Healthy'
  : r.margin_pct >= BENCHMARKS.fba_margins.tight * 100  ? 'Tight'
  : 'Danger'

const feeBurdenPct = input_usd.selling_price > 0
  ? r1((r.total_fees / input_usd.selling_price) * 100)
  : 0

const storageVsProfit = r.net_profit > 0
  ? r1((r.monthly_storage_fee / r.net_profit) * 100)
  : null
```

- [ ] **Step 4: Add Analysis card after the Package Optimizer card**

After the Package Optimizer `</div>` block, add:

```tsx
{/* Analysis */}
{input_usd.selling_price > 0 && (
  <div className="mt-6">
    <CalcCard title="Analysis">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Pie: cost distribution */}
        <div>
          <p className="font-body text-xs text-muted uppercase tracking-wide mb-3">
            Cost Distribution
          </p>
          <ToolPieChart
            data={pieData}
            height={220}
            formatter={(v) => fmt(v)}
          />
        </div>

        {/* Bar: fee by tier */}
        <div>
          <p className="font-body text-xs text-muted uppercase tracking-wide mb-3">
            Fee by Tier at Current Weight
          </p>
          <ToolBarChart
            data={tierData}
            xKey="tier"
            bars={[{ key: 'fee', label: 'Fulfillment Fee', cellColorKey: 'color' }]}
            height={220}
            yFormatter={(v) => fmt(fromUSD(v))}
          />
        </div>
      </div>

      {/* Insights strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
        {/* Margin Health */}
        <div className={cn(
          'rounded-xl p-3 border',
          marginHealth === 'Healthy' ? 'bg-primary/5 border-primary/20'
          : marginHealth === 'Tight' ? 'bg-amber-400/5 border-amber-400/20'
          : 'bg-rose-400/5 border-rose-400/20',
        )}>
          <p className="font-body text-xs text-muted uppercase tracking-wide mb-1">Margin Health</p>
          <p className={cn(
            'font-mono text-lg font-bold',
            marginHealth === 'Healthy' ? 'text-primary'
            : marginHealth === 'Tight' ? 'text-amber-400'
            : 'text-rose-400',
          )}>
            {marginHealth}
          </p>
          <p className="font-body text-xs text-muted mt-0.5">{r.margin_pct}% margin</p>
        </div>

        {/* Fee Burden */}
        <div className={cn(
          'rounded-xl p-3 border',
          feeBurdenPct > 40
            ? 'bg-rose-400/5 border-rose-400/20'
            : 'bg-surface border-border',
        )}>
          <p className="font-body text-xs text-muted uppercase tracking-wide mb-1">Fee Burden</p>
          <p className={cn(
            'font-mono text-lg font-bold',
            feeBurdenPct > 40 ? 'text-rose-400' : 'text-primary',
          )}>
            {feeBurdenPct}%
          </p>
          <p className="font-body text-xs text-muted mt-0.5">
            {feeBurdenPct > 40
              ? `Fees consume ${feeBurdenPct}% of sale price`
              : 'of sale price in fees'}
          </p>
        </div>

        {/* Storage Efficiency */}
        <div className={cn(
          'rounded-xl p-3 border',
          storageVsProfit !== null && storageVsProfit > 15
            ? 'bg-amber-400/5 border-amber-400/20'
            : 'bg-surface border-border',
        )}>
          <p className="font-body text-xs text-muted uppercase tracking-wide mb-1">Storage Efficiency</p>
          {storageVsProfit !== null ? (
            <>
              <p className={cn(
                'font-mono text-lg font-bold',
                storageVsProfit > 15 ? 'text-amber-400' : 'text-primary',
              )}>
                {storageVsProfit}%
              </p>
              <p className="font-body text-xs text-muted mt-0.5">
                {storageVsProfit > 15
                  ? 'Storage eating into profit — reduce inventory'
                  : 'of net profit is storage'}
              </p>
            </>
          ) : (
            <p className="font-mono text-lg font-bold text-muted">—</p>
          )}
        </div>
      </div>
    </CalcCard>
  </div>
)}
```

- [ ] **Step 5: Update the disclaimer text from 2024 to 2025**

Find the disclaimer `<p>` near the bottom of the return statement and replace:

```tsx
{/* Replace: */}
Rates based on Amazon FBA 2024 fee schedule (non-apparel, standard-size). Actual fees may vary by category, account type, and promotions. Always verify at{' '}
<span className="text-text/60">sellercentral.amazon.com</span>.

{/* With: */}
Rates based on Amazon FBA {RATES_YEAR} fee schedule (effective Feb 5, 2025; non-apparel, standard-size). Actual fees may vary by category, account type, and promotions. Always verify at{' '}
<span className="text-text/60">sellercentral.amazon.com</span>.
```

- [ ] **Step 6: Run dev server — verify charts and insights render correctly**

Open `http://localhost:3000/tools/amazon-fba-calculator`. Verify:
- Pie chart shows 5 slices for cost distribution
- Bar chart shows 7 bars with current tier highlighted in green
- 3 insight boxes show health status with correct colors
- Disclaimer references 2025 fee schedule

Test edge cases:
- Zero selling price → Analysis card hidden
- All fees > selling price (e.g., price = $0.50, cost = $0.50) → Fee Burden turns rose, Margin Health = Danger

- [ ] **Step 7: Run tests to confirm no regressions**

```bash
npm test -- --run
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add components/tools/tool-chart.tsx app/tools/amazon-fba-calculator/page.tsx
git commit -m "feat(fba): add analysis card with fee distribution charts and insights strip"
```

---

## Self-Review

**Spec coverage check:**

| Spec Section | Covered by Task |
|---|---|
| 2025 fee model — RATES_YEAR, STORAGE_RATES, calcFulfillmentFee | Task 1 |
| 2025 fee model — tests updated | Task 1 |
| VAT — VatEntry, VAT_RATES, effectivePriceAfterVat | Task 2 |
| SIZE_TIERS export | Task 2 |
| Package optimizer — OptimizerSuggestion, findCheaperTierDimensions | Task 3 |
| calcBreakevenAcos | Task 4 |
| Currency wiring — toUSD/fromUSD/fmt, currencySymbol prefix | Task 5 |
| Scenarios — useScenarios, ScenarioPanel, onLoad with all 10 fields | Task 5 (base), Task 6 (adds vat_code) |
| Export — exportInputs/exportResults, ExportBar, PrintReport | Task 5 |
| VAT UI — Select field, VAT note, input_usd adjustment | Task 6 |
| Break-even ACOS — metric in headline, color thresholds | Task 7 |
| Tier-crossing callout — within 15% amber callout | Task 8 |
| Package optimizer card — apply button + tier reference table | Task 8 |
| Chart 1 — ToolPieChart cost distribution | Task 9 |
| Chart 2 — ToolBarChart tier comparison, current tier highlight | Task 9 |
| Insights — Margin Health, Fee Burden, Storage Efficiency | Task 9 |
| Disclaimer update to 2025 | Task 9 |

**Type consistency check:**
- `OptimizerSuggestion.threshold_in` is added in Task 3 and used in Task 8 — consistent
- `input_usd: FbaInput` uses `effectivePriceAfterVat` from Task 2 — added in Task 6 before ACOS (Task 7) uses `input_usd.selling_price` — correct order
- `r2` defined outside component in Task 8 is used in Task 9 `tierData` — consistent
- `r1` defined in Task 9, used only in Task 9 insights — consistent
- `RATES_YEAR` imported in Task 9 — matches the export from Task 1

**Placeholder scan:** None found. All dollar values are explicit, all function signatures are complete.

**Spec note — `threshold_in` field:** The design spec's `OptimizerSuggestion` interface does not include `threshold_in`. This field is added in this plan because the tier-crossing callout needs the threshold value to compute the distance. It is a backward-compatible addition (extra field on an interface that nothing else reads).
