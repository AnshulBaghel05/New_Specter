# Inventory & Restock Calculator Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the inventory calculator with cash flow metrics on the existing `calcInventory`, seasonality-adjusted monthly planning (`calcSeasonalInventory`), and multi-SKU ABC classification (`calcAbcClassification`); rebuild the page as a 3-tab UI (EOQ Calculator | Seasonal Planning | ABC Analysis) with full `useCurrency` / `ScenarioPanel` / `ExportBar` parity.

**Architecture:** Three additions to `lib/tools/inventory.ts`: (1) four new fields on the existing `InventoryResult` interface + updated `calcInventory`, (2) `calcSeasonalInventory` with seasonality presets, (3) `calcAbcClassification` for multi-SKU ABC. Page `app/tools/inventory-reorder-calculator/page.tsx` is fully rewritten as a 3-tab switcher.

**Tech Stack:** TypeScript strict, Vitest, existing tool-layout primitives (`CalcCard`, `Field`, `Input`, `Select`, `Metric`), `useCurrency` hook, `ScenarioPanel`, `ExportBar`, Recharts (existing — for monthly demand bar chart).

---

## File Map

| File | Change |
|------|--------|
| `lib/tools/inventory.ts` | Extend `InventoryResult` with 4 cash flow fields; update `calcInventory`; add `MONTH_NAMES`, `SEASONALITY_PRESETS`, `SeasonalInventoryInput`, `MonthlyInventoryPlan`, `SeasonalInventoryResult`, `calcSeasonalInventory`; add `SkuInput`, `SkuClassification`, `AbcResult`, `calcAbcClassification` |
| `__tests__/tools/inventory.test.ts` | Append 3 new `describe` blocks — ~20 new tests |
| `app/tools/inventory-reorder-calculator/page.tsx` | Full rewrite — 3 tabs, currency, scenarios, export |

---

### Task 1: Cash flow metrics on `calcInventory` + 4 tests

**Files:**
- Modify: `lib/tools/inventory.ts` — extend `InventoryResult`, update `calcInventory`
- Modify: `__tests__/tools/inventory.test.ts` — append tests

---

- [ ] **Step 1: Write 4 failing tests (append to `__tests__/tools/inventory.test.ts`)**

Append after the existing `describe('calcInventory', ...)` block:

```ts
describe('calcInventory — cash flow fields', () => {
  const base = {
    avg_daily_demand: 10,
    demand_std_dev: 3,
    lead_time_days: 7,
    order_cost: 50,
    unit_cost: 20,
    holding_cost_pct: 25,
    service_level: '95' as const,
    selling_price: 49.99,
  }

  it('inventory_turns = annual_demand / avg_inventory', () => {
    const r = calcInventory(base)
    const expected = Math.round((r.annual_demand / r.avg_inventory) * 100) / 100
    expect(r.inventory_turns).toBe(expected)
  })

  it('days_of_inventory = 365 / inventory_turns', () => {
    const r = calcInventory(base)
    const expected = Math.round((365 / r.inventory_turns) * 10) / 10
    expect(r.days_of_inventory).toBe(expected)
  })

  it('working_capital = avg_inventory × unit_cost', () => {
    const r = calcInventory(base)
    const expected = Math.round(r.avg_inventory * base.unit_cost * 100) / 100
    expect(r.working_capital).toBe(expected)
  })

  it('annual_stockout_cost = safety_stock × selling_price × stockout_risk_pct/100', () => {
    const r = calcInventory(base)
    // service_level = 95 → stockout_risk_pct = 5
    const expected = Math.round(r.safety_stock * base.selling_price * (r.stockout_risk_pct / 100) * 100) / 100
    expect(r.annual_stockout_cost).toBe(expected)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run __tests__/tools/inventory.test.ts
```

Expected: New 4 tests fail — `inventory_turns`, `days_of_inventory`, `working_capital`, `annual_stockout_cost` not on result.

- [ ] **Step 3: Extend `InventoryResult` and update `calcInventory` in `lib/tools/inventory.ts`**

Add four fields to the `InventoryResult` interface (after `stockout_risk_pct`):

```ts
  inventory_turns: number        // annual_demand / avg_inventory
  days_of_inventory: number      // 365 / inventory_turns
  working_capital: number        // avg_inventory × unit_cost
  annual_stockout_cost: number   // safety_stock × selling_price × (stockout_risk_pct / 100)
```

In `calcInventory`, add these computations before the `return` statement:

```ts
  const inventory_turns = avg_inventory > 0 ? round2(annual_demand / avg_inventory) : 0
  const days_of_inventory = inventory_turns > 0 ? round1(365 / inventory_turns) : 0
  const working_capital = round2(avg_inventory * input.unit_cost)
  const annual_stockout_cost = round2(
    safety_stock * (input.selling_price ?? 0) * (stockout_risk_pct / 100)
  )
```

Add all four to the return object:

```ts
  return {
    // ... existing fields ...
    stockout_risk_pct,
    inventory_turns,
    days_of_inventory,
    working_capital,
    annual_stockout_cost,
  }
```

- [ ] **Step 4: Run tests — all pass**

```bash
npx vitest run __tests__/tools/inventory.test.ts
```

Expected: All existing 7 + new 4 = 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/tools/inventory.ts __tests__/tools/inventory.test.ts
git commit -m "feat(inventory): add cash flow metrics — inventory_turns, days_of_inventory, working_capital, annual_stockout_cost"
```

---

### Task 2: `calcSeasonalInventory` — presets, types, function, 8 tests

**Files:**
- Modify: `lib/tools/inventory.ts` — append after `calcInventory`
- Modify: `__tests__/tools/inventory.test.ts` — append tests

---

- [ ] **Step 1: Write 8 failing tests**

Append after the cash-flow describe block:

```ts
describe('calcSeasonalInventory', () => {
  // Need import — add to top of file: import { calcSeasonalInventory, SEASONALITY_PRESETS } from '@/lib/tools/inventory'
  const base = {
    avg_daily_demand: 10,
    demand_std_dev: 3,
    lead_time_days: 7,
    order_cost: 50,
    unit_cost: 20,
    holding_cost_pct: 25,
    service_level: '95' as const,
    selling_price: 49.99,
    monthly_multipliers: SEASONALITY_PRESETS.flat,
  }

  it('monthly_plans.length = 12', () => {
    expect(calcSeasonalInventory(base).monthly_plans.length).toBe(12)
  })

  it('flat preset — all monthly daily_demand equal avg_daily_demand', () => {
    const r = calcSeasonalInventory(base)
    r.monthly_plans.forEach(m => {
      expect(m.daily_demand).toBeCloseTo(base.avg_daily_demand, 1)
    })
  })

  it('peak_month has the highest monthly_demand', () => {
    const r = calcSeasonalInventory({ ...base, monthly_multipliers: SEASONALITY_PRESETS.holiday_heavy })
    expect(r.peak_month.monthly_demand).toBe(Math.max(...r.monthly_plans.map(m => m.monthly_demand)))
  })

  it('lowest_month has the lowest monthly_demand', () => {
    const r = calcSeasonalInventory({ ...base, monthly_multipliers: SEASONALITY_PRESETS.holiday_heavy })
    expect(r.lowest_month.monthly_demand).toBe(Math.min(...r.monthly_plans.map(m => m.monthly_demand)))
  })

  it('holiday_heavy peak_month is December (index 11)', () => {
    const r = calcSeasonalInventory({ ...base, monthly_multipliers: SEASONALITY_PRESETS.holiday_heavy })
    expect(r.peak_month.month).toBe(12)
  })

  it('safety_stock for peak month >= base safety_stock (higher multiplier → more variability)', () => {
    const r = calcSeasonalInventory({ ...base, monthly_multipliers: SEASONALITY_PRESETS.holiday_heavy })
    expect(r.peak_month.safety_stock).toBeGreaterThanOrEqual(r.safety_stock)
  })

  it('summer_peak peak_month is July (index 6)', () => {
    const r = calcSeasonalInventory({ ...base, monthly_multipliers: SEASONALITY_PRESETS.summer_peak })
    expect(r.peak_month.month).toBe(7)
  })

  it('flat preset — base calcInventory eoq matches each monthly eoq (within rounding)', () => {
    const r = calcSeasonalInventory(base)
    const baseR = r.eoq  // inherited from calcInventory
    r.monthly_plans.forEach(m => {
      expect(Math.abs(m.eoq - baseR)).toBeLessThanOrEqual(2)
    })
  })
})
```

Update the import at the top of the test file:

```ts
import {
  calcEoq, calcSafetyStock, calcReorderPoint, calcInventory, Z_SCORES,
  calcSeasonalInventory, SEASONALITY_PRESETS,
} from '@/lib/tools/inventory'
```

- [ ] **Step 2: Run to confirm failures**

```bash
npx vitest run __tests__/tools/inventory.test.ts
```

Expected: 8 new tests fail — `calcSeasonalInventory` and `SEASONALITY_PRESETS` not exported.

- [ ] **Step 3: Append seasonal types, presets, and function to `lib/tools/inventory.ts`**

Append after the existing `calcInventory` function:

```ts
// ── Seasonality ────────────────────────────────────────────────────────────

export const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const

export type SeasonalityPreset = 'flat' | 'holiday_heavy' | 'summer_peak' | 'back_to_school'

export const SEASONALITY_PRESETS: Record<SeasonalityPreset, number[]> = {
  flat:           [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  holiday_heavy:  [0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.8, 0.9, 1.0, 1.2, 1.8, 2.0],
  summer_peak:    [0.8, 0.8, 0.9, 1.0, 1.3, 1.8, 2.0, 1.8, 1.2, 0.8, 0.7, 0.7],
  back_to_school: [0.8, 0.8, 0.8, 0.8, 0.9, 1.0, 1.5, 2.0, 1.8, 1.0, 0.8, 0.8],
}

export interface SeasonalInventoryInput extends InventoryInput {
  monthly_multipliers: number[]
}

export interface MonthlyInventoryPlan {
  month: number
  month_name: string
  daily_demand: number
  monthly_demand: number
  eoq: number
  safety_stock: number
  reorder_point: number
  orders_this_month: number
  monthly_holding_cost: number
  monthly_ordering_cost: number
}

export interface SeasonalInventoryResult extends InventoryResult {
  monthly_plans: MonthlyInventoryPlan[]
  peak_month: MonthlyInventoryPlan
  lowest_month: MonthlyInventoryPlan
}

export function calcSeasonalInventory(input: SeasonalInventoryInput): SeasonalInventoryResult {
  const base = calcInventory(input)
  const z = Z_SCORES[input.service_level]
  const holding_cost_per_unit = input.unit_cost * (input.holding_cost_pct / 100)

  // Normalize multipliers so their average = 1.0
  const total = input.monthly_multipliers.reduce((a, b) => a + b, 0)
  const norm = input.monthly_multipliers.map(m => total > 0 ? m / (total / 12) : 1)

  const monthly_plans: MonthlyInventoryPlan[] = norm.map((n, i) => {
    const daily_demand = round2(input.avg_daily_demand * n)
    const monthly_demand = Math.round(daily_demand * 30.4167)
    const annualized = daily_demand * 365
    const eoq = Math.max(1, Math.round(calcEoq(annualized, input.order_cost, holding_cost_per_unit)))
    const safety_stock = Math.ceil(z * input.demand_std_dev * Math.sqrt(n) * Math.sqrt(input.lead_time_days))
    const reorder_point = Math.round(daily_demand * input.lead_time_days + safety_stock)
    const orders_this_month = eoq > 0 ? Math.max(0, Math.round(monthly_demand / eoq)) : 0
    const monthly_holding_cost = round2((eoq / 2 + safety_stock) * holding_cost_per_unit / 12)
    const monthly_ordering_cost = round2(orders_this_month * input.order_cost)

    return {
      month: i + 1,
      month_name: MONTH_NAMES[i],
      daily_demand,
      monthly_demand,
      eoq,
      safety_stock,
      reorder_point,
      orders_this_month,
      monthly_holding_cost,
      monthly_ordering_cost,
    }
  })

  const peak_month = monthly_plans.reduce((a, b) => b.monthly_demand > a.monthly_demand ? b : a)
  const lowest_month = monthly_plans.reduce((a, b) => b.monthly_demand < a.monthly_demand ? b : a)

  return { ...base, monthly_plans, peak_month, lowest_month }
}
```

- [ ] **Step 4: Run tests — all pass**

```bash
npx vitest run __tests__/tools/inventory.test.ts
```

Expected: All 11 existing + 8 new = 19 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/tools/inventory.ts __tests__/tools/inventory.test.ts
git commit -m "feat(inventory): add calcSeasonalInventory with presets (flat, holiday_heavy, summer_peak, back_to_school)"
```

---

### Task 3: `calcAbcClassification` — types, function, 8 tests

**Files:**
- Modify: `lib/tools/inventory.ts` — append after `calcSeasonalInventory`
- Modify: `__tests__/tools/inventory.test.ts` — append tests

---

- [ ] **Step 1: Write 8 failing tests**

Append after the seasonal describe block:

```ts
describe('calcAbcClassification', () => {
  // Add to import: calcAbcClassification
  const skus = [
    { sku_id: 'A1', unit_cost: 50, annual_units: 1000 },   // value: 50000
    { sku_id: 'B1', unit_cost: 20, annual_units: 500  },   // value: 10000
    { sku_id: 'B2', unit_cost: 15, annual_units: 400  },   // value: 6000
    { sku_id: 'C1', unit_cost: 5,  annual_units: 300  },   // value: 1500
    { sku_id: 'C2', unit_cost: 2,  annual_units: 200  },   // value: 400
  ]
  // n=5, a_cutoff=ceil(5×0.2)=1, b_cutoff=ceil(5×0.5)=3
  // A=[A1], B=[B1, B2], C=[C1, C2]

  it('empty array returns all-empty result', () => {
    const r = calcAbcClassification([])
    expect(r.classifications).toHaveLength(0)
    expect(r.total_annual_value).toBe(0)
  })

  it('single SKU is classified A', () => {
    const r = calcAbcClassification([{ sku_id: 'X', unit_cost: 10, annual_units: 100 }])
    expect(r.classifications[0].class).toBe('A')
  })

  it('sorted descending by annual_value', () => {
    const r = calcAbcClassification(skus)
    const values = r.classifications.map(s => s.annual_value)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1])
    }
  })

  it('top 20% of items (ceil) → class A', () => {
    const r = calcAbcClassification(skus)
    expect(r.a_skus).toHaveLength(1)
    expect(r.a_skus[0].sku_id).toBe('A1')
  })

  it('next 30% → class B', () => {
    const r = calcAbcClassification(skus)
    expect(r.b_skus).toHaveLength(2)
    expect(r.b_skus.map(s => s.sku_id)).toContain('B1')
    expect(r.b_skus.map(s => s.sku_id)).toContain('B2')
  })

  it('remaining → class C', () => {
    const r = calcAbcClassification(skus)
    expect(r.c_skus).toHaveLength(2)
  })

  it('cumulative_pct increases monotonically', () => {
    const r = calcAbcClassification(skus)
    const pcts = r.classifications.map(s => s.cumulative_pct)
    for (let i = 1; i < pcts.length; i++) {
      expect(pcts[i]).toBeGreaterThanOrEqual(pcts[i - 1])
    }
  })

  it('total_annual_value = sum of all annual_values', () => {
    const r = calcAbcClassification(skus)
    const sum = skus.reduce((acc, s) => acc + s.unit_cost * s.annual_units, 0)
    expect(r.total_annual_value).toBeCloseTo(sum, 1)
  })
})
```

Update the import at the top of the test file to include `calcAbcClassification`:

```ts
import {
  calcEoq, calcSafetyStock, calcReorderPoint, calcInventory, Z_SCORES,
  calcSeasonalInventory, SEASONALITY_PRESETS,
  calcAbcClassification,
} from '@/lib/tools/inventory'
```

- [ ] **Step 2: Run to confirm failures**

```bash
npx vitest run __tests__/tools/inventory.test.ts
```

Expected: 8 new tests fail.

- [ ] **Step 3: Append ABC types and function to `lib/tools/inventory.ts`**

Append after `calcSeasonalInventory`:

```ts
// ── ABC Classification ────────────────────────────────────────────────────

export interface SkuInput {
  sku_id: string
  unit_cost: number
  annual_units: number
}

export interface SkuClassification {
  sku_id: string
  annual_value: number
  value_pct: number
  cumulative_pct: number
  class: 'A' | 'B' | 'C'
}

export interface AbcResult {
  classifications: SkuClassification[]
  a_skus: SkuClassification[]
  b_skus: SkuClassification[]
  c_skus: SkuClassification[]
  total_annual_value: number
}

export function calcAbcClassification(skus: SkuInput[]): AbcResult {
  if (skus.length === 0) {
    return { classifications: [], a_skus: [], b_skus: [], c_skus: [], total_annual_value: 0 }
  }

  const valued = skus.map(s => ({ ...s, annual_value: round2(s.unit_cost * s.annual_units) }))
  const sorted = [...valued].sort((a, b) => b.annual_value - a.annual_value)
  const total_annual_value = round2(sorted.reduce((acc, s) => acc + s.annual_value, 0))

  const n = sorted.length
  const a_cutoff = Math.ceil(n * 0.20)
  const b_cutoff = Math.ceil(n * 0.50)

  let cumulative = 0
  const classifications: SkuClassification[] = sorted.map((s, i) => {
    const value_pct = total_annual_value > 0 ? round2(s.annual_value / total_annual_value * 100) : 0
    cumulative = round2(cumulative + value_pct)
    const cls: 'A' | 'B' | 'C' = i < a_cutoff ? 'A' : i < b_cutoff ? 'B' : 'C'
    return { sku_id: s.sku_id, annual_value: s.annual_value, value_pct, cumulative_pct: cumulative, class: cls }
  })

  return {
    classifications,
    a_skus: classifications.filter(s => s.class === 'A'),
    b_skus: classifications.filter(s => s.class === 'B'),
    c_skus: classifications.filter(s => s.class === 'C'),
    total_annual_value,
  }
}
```

- [ ] **Step 4: Run tests — all pass**

```bash
npx vitest run __tests__/tools/inventory.test.ts
```

Expected: All 19 existing + 8 new = 27 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/tools/inventory.ts __tests__/tools/inventory.test.ts
git commit -m "feat(inventory): add calcAbcClassification for multi-SKU A/B/C inventory ranking"
```

---

### Task 4: Page rewrite — 3-tab UI with currency, scenarios, export

**Files:**
- Modify: `app/tools/inventory-reorder-calculator/page.tsx` — full rewrite

---

- [ ] **Step 1: Rewrite `app/tools/inventory-reorder-calculator/page.tsx`**

Replace the entire file with:

```tsx
'use client'

import { useState, useMemo } from 'react'
import ToolLayout, { CalcCard, Field, Input, Select, Metric } from '@/components/tools/tool-layout'
import ScenarioPanel from '@/components/tools/scenario-panel'
import ExportBar from '@/components/tools/export-bar'
import { useCurrency } from '@/hooks/use-currency'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  calcInventory, calcSeasonalInventory, calcAbcClassification,
  SEASONALITY_PRESETS, MONTH_NAMES,
  Z_SCORES,
  type ServiceLevel,
  type SeasonalityPreset,
  type SkuInput,
} from '@/lib/tools/inventory'
import type { Scenario } from '@/lib/tools/scenarios'
import { cn } from '@/lib/utils'

type Tab = 'eoq' | 'seasonal' | 'abc'

const SERVICE_LEVELS: { value: ServiceLevel; label: string }[] = [
  { value: '90', label: '90% — z=1.28' },
  { value: '95', label: '95% — z=1.645' },
  { value: '99', label: '99% — z=2.326' },
]

const PRESET_OPTIONS: { value: SeasonalityPreset; label: string }[] = [
  { value: 'flat',           label: 'Flat / Even year-round' },
  { value: 'holiday_heavy',  label: 'Holiday Heavy (Q4 peak)' },
  { value: 'summer_peak',    label: 'Summer Peak (June–Aug)' },
  { value: 'back_to_school', label: 'Back to School (Aug–Sep)' },
]

const ABC_COLORS = { A: 'text-primary', B: 'text-amber-400', C: 'text-muted' }
const ABC_BG = { A: 'bg-primary/10 border-primary/20', B: 'bg-amber-400/10 border-amber-400/20', C: 'bg-surface border-border' }

function emptySkus(): SkuInput[] {
  return [
    { sku_id: 'SKU-001', unit_cost: 50, annual_units: 1000 },
    { sku_id: 'SKU-002', unit_cost: 20, annual_units: 500 },
    { sku_id: 'SKU-003', unit_cost: 15, annual_units: 400 },
  ]
}

export default function InventoryReorderPage() {
  const [tab, setTab] = useState<Tab>('eoq')
  const { currency, setCurrency, fmt, fromUSD, toUSD, currencies } = useCurrency()

  // ── EOQ state ──────────────────────────────────────────────────────────────
  const [dailyDemand,  setDailyDemand]  = useState('10')
  const [stdDev,       setStdDev]       = useState('3')
  const [leadTime,     setLeadTime]     = useState('7')
  const [orderCost,    setOrderCost]    = useState('50')
  const [unitCost,     setUnitCost]     = useState('20')
  const [holdingPct,   setHoldingPct]   = useState('25')
  const [serviceLevel, setServiceLevel] = useState<ServiceLevel>('95')
  const [sellingPrice, setSellingPrice] = useState('49.99')

  const eoqResult = useMemo(() => calcInventory({
    avg_daily_demand:  parseFloat(dailyDemand)  || 0,
    demand_std_dev:    parseFloat(stdDev)        || 0,
    lead_time_days:    parseFloat(leadTime)      || 1,
    order_cost:        toUSD(parseFloat(orderCost)    || 0),
    unit_cost:         toUSD(parseFloat(unitCost)     || 0),
    holding_cost_pct:  parseFloat(holdingPct)    || 0,
    service_level:     serviceLevel,
    selling_price:     toUSD(parseFloat(sellingPrice) || 0),
  }), [dailyDemand, stdDev, leadTime, orderCost, unitCost, holdingPct, serviceLevel, sellingPrice, toUSD])

  // ── Seasonal state ──────────────────────────────────────────────────────────
  const [preset, setPreset]       = useState<SeasonalityPreset>('flat')
  const [multipliers, setMults]   = useState<number[]>([...SEASONALITY_PRESETS.flat])

  function applyPreset(p: SeasonalityPreset) {
    setPreset(p)
    setMults([...SEASONALITY_PRESETS[p]])
  }

  const seasonalResult = useMemo(() => calcSeasonalInventory({
    avg_daily_demand:  parseFloat(dailyDemand)  || 0,
    demand_std_dev:    parseFloat(stdDev)        || 0,
    lead_time_days:    parseFloat(leadTime)      || 1,
    order_cost:        toUSD(parseFloat(orderCost)    || 0),
    unit_cost:         toUSD(parseFloat(unitCost)     || 0),
    holding_cost_pct:  parseFloat(holdingPct)    || 0,
    service_level:     serviceLevel,
    selling_price:     toUSD(parseFloat(sellingPrice) || 0),
    monthly_multipliers: multipliers,
  }), [dailyDemand, stdDev, leadTime, orderCost, unitCost, holdingPct, serviceLevel, sellingPrice, multipliers, toUSD])

  // ── ABC state ──────────────────────────────────────────────────────────────
  const [skus, setSkus] = useState<SkuInput[]>(emptySkus())

  function updateSku(idx: number, field: keyof SkuInput, value: string) {
    setSkus(prev => prev.map((s, i) => {
      if (i !== idx) return s
      if (field === 'sku_id') return { ...s, sku_id: value }
      return { ...s, [field]: parseFloat(value) || 0 }
    }))
  }

  function addSku() {
    if (skus.length >= 20) return
    setSkus(prev => [...prev, { sku_id: `SKU-${String(prev.length + 1).padStart(3, '0')}`, unit_cost: 10, annual_units: 100 }])
  }

  function removeSku(idx: number) {
    setSkus(prev => prev.filter((_, i) => i !== idx))
  }

  const abcResult = useMemo(() => calcAbcClassification(
    skus.map(s => ({ ...s, unit_cost: toUSD(s.unit_cost) }))
  ), [skus, toUSD])

  // ── Scenario wiring ────────────────────────────────────────────────────────
  const eoqInputs  = { dailyDemand, stdDev, leadTime, orderCost, unitCost, holdingPct, serviceLevel, sellingPrice }
  const eoqResults = { eoq: eoqResult.eoq, reorder_point: eoqResult.reorder_point, safety_stock: eoqResult.safety_stock, total_annual_cost: eoqResult.total_annual_cost, inventory_turns: eoqResult.inventory_turns }
  const eoqLabels  = { eoq: 'EOQ', reorder_point: 'Reorder Point', safety_stock: 'Safety Stock', total_annual_cost: 'Total Annual Cost', inventory_turns: 'Inventory Turns' }

  function loadScenario(s: Scenario) {
    const v = s.inputs as Record<string, string>
    if (v.dailyDemand  != null) setDailyDemand(v.dailyDemand)
    if (v.stdDev       != null) setStdDev(v.stdDev)
    if (v.leadTime     != null) setLeadTime(v.leadTime)
    if (v.orderCost    != null) setOrderCost(v.orderCost)
    if (v.unitCost     != null) setUnitCost(v.unitCost)
    if (v.holdingPct   != null) setHoldingPct(v.holdingPct)
    if (v.serviceLevel != null) setServiceLevel(v.serviceLevel as ServiceLevel)
    if (v.sellingPrice != null) setSellingPrice(v.sellingPrice)
  }

  const exportInputs  = [{ label: 'Daily Demand', value: dailyDemand }, { label: 'Std Dev', value: stdDev }, { label: 'Lead Time', value: leadTime }, { label: 'Order Cost', value: orderCost }, { label: 'Unit Cost', value: unitCost }, { label: 'Holding %', value: holdingPct }, { label: 'Service Level', value: serviceLevel }]
  const exportResults = [{ label: 'EOQ', value: String(eoqResult.eoq) }, { label: 'Reorder Point', value: String(eoqResult.reorder_point) }, { label: 'Safety Stock', value: String(eoqResult.safety_stock) }, { label: 'Inventory Turns', value: String(eoqResult.inventory_turns) }, { label: 'Days of Inventory', value: String(eoqResult.days_of_inventory) }, { label: 'Working Capital', value: String(eoqResult.working_capital) }]

  const currSymbol = currencies.find(c => c.code === currency)?.symbol ?? '$'

  return (
    <ToolLayout
      toolId={`inventory-${tab}`}
      badge="Free Inventory Tool"
      title="Inventory EOQ & Restock Calculator"
      description="Optimize order quantities, plan for seasonal demand, and classify your SKU portfolio by annual value — all from your real cost and demand data."
      headerRight={
        <div className="flex items-center gap-3">
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className="font-mono text-xs bg-surface border border-border rounded-lg px-2 py-1 text-muted"
          >
            {currencies.map(c => <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>)}
          </select>
          <ScenarioPanel
            toolId={`inventory-${tab}`}
            currentInputs={eoqInputs}
            currentResults={eoqResults}
            currency={currency}
            resultLabels={eoqLabels}
            onLoad={loadScenario}
          />
          <ExportBar toolId={`inventory-${tab}`} inputs={exportInputs} results={exportResults} currency={currency} />
        </div>
      }
    >
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-surface rounded-xl border border-border w-fit mb-6">
        {(['eoq', 'seasonal', 'abc'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-lg font-body text-sm transition-all',
              tab === t ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted hover:text-text',
            )}
          >
            {t === 'eoq' ? 'EOQ Calculator' : t === 'seasonal' ? 'Seasonal Planning' : 'ABC Analysis'}
          </button>
        ))}
      </div>

      {/* ── EOQ tab ──────────────────────────────────────────────────────────── */}
      {tab === 'eoq' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-5">
            <CalcCard title="Demand & Lead Time">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Avg Daily Demand" hint="Units sold per day">
                  <Input value={dailyDemand} onChange={setDailyDemand} suffix="units" min={0.1} step={0.1} />
                </Field>
                <Field label="Demand Std Dev" hint="Day-to-day variability (σ)">
                  <Input value={stdDev} onChange={setStdDev} suffix="units" min={0} step={0.1} />
                </Field>
                <Field label="Lead Time" hint="Days from order to receipt">
                  <Input value={leadTime} onChange={setLeadTime} suffix="days" min={1} />
                </Field>
                <Field label="Selling Price" hint="For stockout cost calculation">
                  <Input value={sellingPrice} onChange={setSellingPrice} prefix={currSymbol} min={0} step={0.01} />
                </Field>
              </div>
            </CalcCard>
            <CalcCard title="Order & Holding Costs">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Order Cost" hint="Cost to place one PO">
                  <Input value={orderCost} onChange={setOrderCost} prefix={currSymbol} min={0} />
                </Field>
                <Field label="Unit Cost (COGS)">
                  <Input value={unitCost} onChange={setUnitCost} prefix={currSymbol} min={0} step={0.01} />
                </Field>
                <Field label="Annual Holding Cost" hint="% of unit value">
                  <Input value={holdingPct} onChange={setHoldingPct} suffix="%" min={0} max={100} />
                </Field>
              </div>
            </CalcCard>
            <CalcCard title="Service Level">
              <Field label="Target Service Level">
                <Select value={serviceLevel} onChange={v => setServiceLevel(v as ServiceLevel)}>
                  {SERVICE_LEVELS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </Field>
              <div className="mt-3 p-3 rounded-lg bg-bg border border-border">
                <p className="font-body text-xs text-muted">
                  Z-score: <span className="font-mono text-primary">{Z_SCORES[serviceLevel]}</span>
                  {' '}· Stockout risk: <span className="font-mono text-rose-400">{eoqResult.stockout_risk_pct}%</span>
                </p>
              </div>
            </CalcCard>
          </div>

          <div className="flex flex-col gap-5">
            <CalcCard>
              <div className="text-center py-2">
                <p className="font-body text-xs text-muted uppercase tracking-widest mb-2">Optimal Order Quantity (EOQ)</p>
                <p className="font-display text-5xl font-bold text-primary mb-1">{eoqResult.eoq.toLocaleString()}</p>
                <p className="font-mono text-sm text-muted">units per order</p>
                <div className="flex items-center justify-center gap-4 mt-3">
                  <span className="font-mono text-xs text-muted">{eoqResult.orders_per_year} orders/year</span>
                  <span className="text-border">·</span>
                  <span className="font-mono text-xs text-muted">{eoqResult.days_supply_per_order} days/order</span>
                </div>
              </div>
            </CalcCard>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                <p className="font-body text-xs text-muted uppercase tracking-wide mb-1">Reorder Point</p>
                <p className="font-mono text-3xl font-bold text-primary">{eoqResult.reorder_point.toLocaleString()}</p>
                <p className="font-body text-xs text-muted mt-1">units — place order now</p>
              </div>
              <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-4 text-center">
                <p className="font-body text-xs text-muted uppercase tracking-wide mb-1">Safety Stock</p>
                <p className="font-mono text-3xl font-bold text-amber-400">{eoqResult.safety_stock.toLocaleString()}</p>
                <p className="font-body text-xs text-muted mt-1">buffer units</p>
              </div>
            </div>

            <CalcCard title="Inventory Economics">
              <div className="grid grid-cols-2 gap-4">
                <Metric label="Total Annual Cost" value={fmt(fromUSD(eoqResult.total_annual_cost))} variant="negative" sub="ordering + holding" />
                <Metric label="Working Capital" value={fmt(fromUSD(eoqResult.working_capital))} variant="warning" sub="avg inventory × unit cost" />
                <Metric label="Inventory Turns" value={`${eoqResult.inventory_turns}×`} sub="annual demand / avg inv." />
                <Metric label="Days of Inventory" value={`${eoqResult.days_of_inventory}`} sub="365 / turns" />
              </div>
            </CalcCard>

            <CalcCard title="Annual Cost Breakdown">
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <div>
                    <p className="font-body text-sm text-text">Ordering Cost</p>
                    <p className="font-body text-xs text-muted">{eoqResult.orders_per_year} orders × {fmt(fromUSD(parseFloat(orderCost) || 0))}/order</p>
                  </div>
                  <span className="font-mono text-sm text-text">{fmt(fromUSD(eoqResult.annual_ordering_cost))}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <div>
                    <p className="font-body text-sm text-text">Holding Cost</p>
                    <p className="font-body text-xs text-muted">{eoqResult.avg_inventory} units × {fmt(fromUSD(eoqResult.holding_cost_per_unit))}/unit/yr</p>
                  </div>
                  <span className="font-mono text-sm text-text">{fmt(fromUSD(eoqResult.annual_holding_cost))}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <div>
                    <p className="font-body text-sm text-text">Annual Stockout Cost</p>
                    <p className="font-body text-xs text-muted">{eoqResult.safety_stock} units × {fmt(fromUSD(parseFloat(sellingPrice) || 0))} × {eoqResult.stockout_risk_pct}%</p>
                  </div>
                  <span className="font-mono text-sm text-rose-400">{fmt(fromUSD(eoqResult.annual_stockout_cost))}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <p className="font-body text-sm font-semibold text-text">Total Annual Cost</p>
                  <span className="font-mono text-sm font-bold text-rose-400">{fmt(fromUSD(eoqResult.total_annual_cost))}</span>
                </div>
              </div>
            </CalcCard>
          </div>
        </div>
      )}

      {/* ── Seasonal Planning tab ─────────────────────────────────────────────── */}
      {tab === 'seasonal' && (
        <div className="flex flex-col gap-6">
          <div className="grid md:grid-cols-2 gap-6">
            <CalcCard title="Seasonality Profile">
              <Field label="Preset" hint="Pre-fill 12-month multipliers">
                <Select value={preset} onChange={v => applyPreset(v as SeasonalityPreset)}>
                  {PRESET_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </Select>
              </Field>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {MONTH_NAMES.map((name, i) => (
                  <Field key={name} label={name}>
                    <Input
                      value={String(multipliers[i])}
                      onChange={v => {
                        const next = [...multipliers]
                        next[i] = parseFloat(v) || 0
                        setMults(next)
                      }}
                      min={0}
                      step={0.1}
                    />
                  </Field>
                ))}
              </div>
            </CalcCard>

            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                  <p className="font-body text-xs text-muted uppercase tracking-wide mb-1">Peak Month</p>
                  <p className="font-mono text-2xl font-bold text-primary">{seasonalResult.peak_month.month_name}</p>
                  <p className="font-body text-xs text-muted mt-1">{seasonalResult.peak_month.monthly_demand.toLocaleString()} units</p>
                </div>
                <div className="bg-rose-400/5 border border-rose-400/20 rounded-xl p-4 text-center">
                  <p className="font-body text-xs text-muted uppercase tracking-wide mb-1">Lowest Month</p>
                  <p className="font-mono text-2xl font-bold text-rose-400">{seasonalResult.lowest_month.month_name}</p>
                  <p className="font-body text-xs text-muted mt-1">{seasonalResult.lowest_month.monthly_demand.toLocaleString()} units</p>
                </div>
              </div>
              <CalcCard title="Monthly Demand">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={seasonalResult.monthly_plans} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <XAxis dataKey="month_name" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ background: '#0D0F1A', border: '1px solid #1A1D2E', borderRadius: 8, fontSize: 11 }}
                      formatter={(v: number) => [v.toLocaleString(), 'Units']}
                    />
                    <Bar dataKey="monthly_demand" radius={[3, 3, 0, 0]}>
                      {seasonalResult.monthly_plans.map((m, i) => (
                        <Cell key={i} fill={m.month === seasonalResult.peak_month.month ? '#00E87A' : '#1A1D2E'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CalcCard>
            </div>
          </div>

          {/* Monthly planning table */}
          <CalcCard title="Monthly Inventory Plan">
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-border text-muted text-right">
                    <th className="pb-2 font-body font-medium text-left">Month</th>
                    <th className="pb-2 font-body font-medium">Daily Demand</th>
                    <th className="pb-2 font-body font-medium">Monthly Units</th>
                    <th className="pb-2 font-body font-medium">EOQ</th>
                    <th className="pb-2 font-body font-medium">Safety Stock</th>
                    <th className="pb-2 font-body font-medium">Reorder Point</th>
                    <th className="pb-2 font-body font-medium">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {seasonalResult.monthly_plans.map(m => (
                    <tr key={m.month} className={cn('border-b border-border/50 last:border-0 text-right', m.month === seasonalResult.peak_month.month ? 'bg-primary/5' : '')}>
                      <td className="py-1.5 font-body text-text text-left">{m.month_name}</td>
                      <td className="py-1.5 text-muted">{m.daily_demand.toFixed(1)}</td>
                      <td className="py-1.5 text-text">{m.monthly_demand.toLocaleString()}</td>
                      <td className="py-1.5 text-primary">{m.eoq.toLocaleString()}</td>
                      <td className="py-1.5 text-amber-400">{m.safety_stock.toLocaleString()}</td>
                      <td className="py-1.5 text-text">{m.reorder_point.toLocaleString()}</td>
                      <td className="py-1.5 text-muted">{m.orders_this_month}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CalcCard>
        </div>
      )}

      {/* ── ABC Analysis tab ─────────────────────────────────────────────────── */}
      {tab === 'abc' && (
        <div className="flex flex-col gap-6">
          <div className="grid md:grid-cols-3 gap-4">
            {(['A', 'B', 'C'] as const).map(cls => {
              const items = cls === 'A' ? abcResult.a_skus : cls === 'B' ? abcResult.b_skus : abcResult.c_skus
              const totalPct = items.reduce((acc, s) => acc + s.value_pct, 0)
              return (
                <div key={cls} className={cn('rounded-xl border p-4 text-center', ABC_BG[cls])}>
                  <p className={cn('font-display text-3xl font-bold mb-1', ABC_COLORS[cls])}>Class {cls}</p>
                  <p className="font-mono text-xl text-text">{items.length} SKUs</p>
                  <p className="font-body text-xs text-muted mt-1">{totalPct.toFixed(1)}% of total value</p>
                  <p className="font-body text-xs text-muted mt-0.5">
                    {cls === 'A' ? 'Top 20% of items' : cls === 'B' ? 'Next 30% of items' : 'Bottom 50% of items'}
                  </p>
                </div>
              )
            })}
          </div>

          {/* SKU table editor */}
          <CalcCard title="SKU Portfolio">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted text-left">
                    <th className="pb-2 font-body font-medium">SKU ID</th>
                    <th className="pb-2 font-body font-medium">Unit Cost</th>
                    <th className="pb-2 font-body font-medium">Annual Units</th>
                    <th className="pb-2 font-body font-medium text-right">Annual Value</th>
                    <th className="pb-2 font-body font-medium text-right">% of Total</th>
                    <th className="pb-2 font-body font-medium text-right">Class</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {skus.map((sku, i) => {
                    const classified = abcResult.classifications.find(c => c.sku_id === sku.sku_id)
                    return (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="py-1.5 pr-2">
                          <input
                            value={sku.sku_id}
                            onChange={e => updateSku(i, 'sku_id', e.target.value)}
                            className="w-24 bg-bg border border-border rounded px-2 py-0.5 font-mono text-xs text-text"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            value={sku.unit_cost}
                            onChange={e => updateSku(i, 'unit_cost', e.target.value)}
                            className="w-20 bg-bg border border-border rounded px-2 py-0.5 font-mono text-xs text-text"
                            min={0}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            value={sku.annual_units}
                            onChange={e => updateSku(i, 'annual_units', e.target.value)}
                            className="w-24 bg-bg border border-border rounded px-2 py-0.5 font-mono text-xs text-text"
                            min={0}
                          />
                        </td>
                        <td className="py-1.5 font-mono text-xs text-right text-text">
                          {classified ? fmt(fromUSD(classified.annual_value)) : '—'}
                        </td>
                        <td className="py-1.5 font-mono text-xs text-right text-muted">
                          {classified ? `${classified.value_pct.toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-1.5 text-right">
                          {classified && (
                            <span className={cn('font-mono text-xs font-bold', ABC_COLORS[classified.class])}>
                              {classified.class}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 pl-2">
                          <button
                            onClick={() => removeSku(i)}
                            className="text-muted hover:text-rose-400 transition-colors text-xs font-mono"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <button
                onClick={addSku}
                disabled={skus.length >= 20}
                className="font-mono text-xs text-primary hover:text-primary/80 disabled:text-muted transition-colors"
              >
                + Add SKU {skus.length >= 20 ? '(max 20)' : ''}
              </button>
              <p className="font-mono text-xs text-muted">
                Total: {fmt(fromUSD(abcResult.total_annual_value))}
              </p>
            </div>
          </CalcCard>
        </div>
      )}
    </ToolLayout>
  )
}
```

- [ ] **Step 2: Check TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors. Common issues to watch:
- `ToolLayout` `headerRight` prop — already used in shipping calculator, exists.
- `Cell` import from recharts — needed for colored bar chart cells.
- `SeasonalityPreset` type export — check it's exported from `lib/tools/inventory.ts`.

- [ ] **Step 3: Run all inventory tests**

```bash
npx vitest run __tests__/tools/inventory.test.ts
```

Expected: All 27 tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/tools/inventory-reorder-calculator/page.tsx
git commit -m "feat(inventory): rewrite page as 3-tab UI — EOQ, Seasonal Planning, ABC Analysis"
```
