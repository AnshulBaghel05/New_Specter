# Inventory & Restock Calculator Enhancement — Design Spec

**Date:** 2026-05-27
**Sub-project:** G — Seasonality profiles, ABC classification, stockout cost, cash flow metrics

---

## Goal

Extend the existing Wilson EOQ calculator with seasonality-adjusted monthly inventory planning (12-month demand multiplier profiles with presets), ABC classification for multi-SKU portfolios, expanded cash flow metrics (inventory turns, days of inventory, working capital), and stockout cost estimation. Rebuild the page as a 3-tab UI (EOQ Calculator | Seasonal Planning | ABC Analysis). Full infrastructure parity: `useCurrency`, `ScenarioPanel`, `ExportBar`, `PrintReport`.

---

## Architecture

Two new exported calc functions plus extended cash flow fields on `InventoryResult` — all in `lib/tools/inventory.ts`. Page becomes a 3-tab UI with full infrastructure parity.

**Tech Stack:** TypeScript, Vitest, existing tool-layout components, `useCurrency` hook, Recharts (existing) for monthly demand bar chart.

---

## File Map

| File | Change |
|------|--------|
| `lib/tools/inventory.ts` | Extend `InventoryResult` with cash flow fields; add `SEASONALITY_PRESETS`, `SeasonalInventoryInput`, `MonthlyInventoryPlan`, `SeasonalInventoryResult`, `calcSeasonalInventory`; add `SkuInput`, `SkuClassification`, `AbcResult`, `calcAbcClassification` |
| `__tests__/tools/inventory.test.ts` | New — ~20 tests across `calcInventory` (cash flow fields), `calcSeasonalInventory`, `calcAbcClassification` |
| `app/tools/inventory-reorder-calculator/page.tsx` | Full rewrite — 3 tabs, currency, scenarios, export, print |

---

## Data Models

### Extended `InventoryResult`

Add four cash flow fields to the existing interface (backward-compatible additions):

```ts
export interface InventoryResult {
  // ... existing fields unchanged ...
  annual_demand: number
  holding_cost_per_unit: number
  eoq: number
  safety_stock: number
  reorder_point: number
  avg_inventory: number
  orders_per_year: number
  annual_ordering_cost: number
  annual_holding_cost: number
  total_annual_cost: number
  days_supply_per_order: number
  stockout_risk_pct: number

  // NEW cash flow fields
  inventory_turns: number        // annual_demand / avg_inventory
  days_of_inventory: number      // 365 / inventory_turns
  working_capital: number        // avg_inventory × unit_cost
  annual_stockout_cost: number   // safety_stock × selling_price × (stockout_risk_pct / 100)
}
```

`selling_price` is already an optional field on `InventoryInput`. When absent, `annual_stockout_cost = 0`.

### Seasonality

```ts
export type SeasonalityPreset = 'flat' | 'holiday_heavy' | 'summer_peak' | 'back_to_school'

export const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Raw multipliers — normalized internally so avg = 1.0
export const SEASONALITY_PRESETS: Record<SeasonalityPreset, number[]> = {
  flat:           [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  holiday_heavy:  [0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.8, 0.9, 1.0, 1.2, 1.8, 2.0],
  summer_peak:    [0.8, 0.8, 0.9, 1.0, 1.3, 1.8, 2.0, 1.8, 1.2, 0.8, 0.7, 0.7],
  back_to_school: [0.8, 0.8, 0.8, 0.8, 0.9, 1.0, 1.5, 2.0, 1.8, 1.0, 0.8, 0.8],
}

export interface SeasonalInventoryInput extends InventoryInput {
  monthly_multipliers: number[]   // exactly 12 values, all >= 0, at least one > 0
}

export interface MonthlyInventoryPlan {
  month: number                   // 1–12
  month_name: string              // 'Jan'–'Dec'
  daily_demand: number            // avg_daily_demand × norm_multiplier[i]
  monthly_demand: number          // daily_demand × 30.4167
  eoq: number                     // EOQ for this month's annualized demand rate
  safety_stock: number            // z × demand_std_dev × sqrt(norm_multiplier[i]) × sqrt(lead_time_days)
  reorder_point: number           // daily_demand × lead_time_days + safety_stock
  orders_this_month: number       // round(monthly_demand / eoq) — minimum 0
  monthly_holding_cost: number    // (eoq/2 + safety_stock) × holding_cost_per_unit / 12
  monthly_ordering_cost: number   // orders_this_month × order_cost
}

export interface SeasonalInventoryResult extends InventoryResult {
  monthly_plans: MonthlyInventoryPlan[]
  peak_month: MonthlyInventoryPlan     // highest monthly_demand
  lowest_month: MonthlyInventoryPlan   // lowest monthly_demand
}
```

### ABC Classification

```ts
export interface SkuInput {
  sku_id: string
  unit_cost: number
  annual_units: number
}

export interface SkuClassification {
  sku_id: string
  annual_value: number       // unit_cost × annual_units
  value_pct: number          // annual_value / total_annual_value × 100
  cumulative_pct: number     // cumulative % from highest to lowest
  class: 'A' | 'B' | 'C'    // A: top 20% of items, B: next 30%, C: bottom 50%
}

export interface AbcResult {
  classifications: SkuClassification[]  // sorted by annual_value descending
  a_skus: SkuClassification[]
  b_skus: SkuClassification[]
  c_skus: SkuClassification[]
  total_annual_value: number
}
```

---

## Business Logic

### Extended `calcInventory` — cash flow additions

```
inventory_turns = avg_inventory > 0 ? round2(annual_demand / avg_inventory) : 0
days_of_inventory = inventory_turns > 0 ? round1(365 / inventory_turns) : 0
working_capital = round2(avg_inventory × unit_cost)
annual_stockout_cost = round2(safety_stock × (selling_price ?? 0) × (stockout_risk_pct / 100))
```

No changes to existing calculations — these are appended to the returned object.

### `calcSeasonalInventory(input: SeasonalInventoryInput): SeasonalInventoryResult`

```
// Normalize multipliers so their average = 1.0
total = sum(monthly_multipliers)
norm[i] = monthly_multipliers[i] / (total / 12)

// Base result uses the unmodified avg_daily_demand (annual average)
base = calcInventory(input)

// Per-month calculations
for i in 0..11:
  daily_demand[i] = input.avg_daily_demand × norm[i]
  annualized_demand = daily_demand[i] × 365
  month_hcpu = input.unit_cost × (input.holding_cost_pct / 100)
  eoq[i] = max(1, round(calcEoq(annualized_demand, input.order_cost, month_hcpu)))
  safety_stock[i] = ceil(z × input.demand_std_dev × sqrt(norm[i]) × sqrt(input.lead_time_days))
  reorder_point[i] = round(daily_demand[i] × input.lead_time_days + safety_stock[i])
  monthly_demand[i] = round(daily_demand[i] × 30.4167)
  orders_this_month[i] = eoq[i] > 0 ? max(0, round(monthly_demand[i] / eoq[i])) : 0
  monthly_holding_cost[i] = round2((eoq[i]/2 + safety_stock[i]) × month_hcpu / 12)
  monthly_ordering_cost[i] = round2(orders_this_month[i] × input.order_cost)

peak_month = month with highest monthly_demand
lowest_month = month with lowest monthly_demand

Return { ...base, monthly_plans, peak_month, lowest_month }
```

### `calcAbcClassification(skus: SkuInput[]): AbcResult`

```
if skus.length === 0: return { classifications: [], a_skus: [], b_skus: [], c_skus: [], total_annual_value: 0 }

// Compute annual value per SKU
valued = skus.map(s => ({ ...s, annual_value: round2(s.unit_cost × s.annual_units) }))

// Sort descending by annual_value
sorted = valued.sort((a, b) => b.annual_value - a.annual_value)
total_annual_value = sum(sorted.annual_value)

// Assign classes by item position (not value threshold)
n = sorted.length
a_cutoff = ceil(n × 0.20)      // top 20% of items
b_cutoff = ceil(n × 0.50)      // top 50% of items (A+B combined)

cumulative = 0
for each sku in sorted:
  value_pct = total_annual_value > 0 ? round2(annual_value / total_annual_value × 100) : 0
  cumulative += value_pct
  class = index < a_cutoff ? 'A' : index < b_cutoff ? 'B' : 'C'
  cumulative_pct = round2(cumulative)
```

---

## Page Layout

```
┌─ Currency picker ──────── ScenarioPanel ── ExportBar ─┐
│  [EOQ Calculator] [Seasonal Planning] [ABC Analysis]   │
│  ┌── Inputs ──────────┐  ┌── Results ───────────────┐  │
│  │  (tab-specific)    │  │  (tab-specific)          │  │
│  └────────────────────┘  └──────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

**EOQ Calculator tab:** Existing inputs + existing outputs + 4 new cash flow metric cards (Inventory Turns, Days of Inventory, Working Capital, Annual Stockout Cost).

**Seasonal Planning tab:** Inputs: preset dropdown + 12 monthly multiplier fields (auto-filled from preset, user-editable). Results: monthly planning table (12 rows) + Recharts bar chart of monthly demand + peak/lowest month callouts.

**ABC Analysis tab:** Inputs: multi-SKU table (add/remove rows, each with SKU ID, unit cost, annual units — up to 20 SKUs). Results: classified table sorted by annual value with A/B/C badge + Pareto summary (count and value % per class).

`ScenarioPanel` scoped as `toolId={`inventory-${tab}`}`.

---

## Testing Plan (~20 tests in `__tests__/tools/inventory.test.ts`)

### `calcInventory` cash flow fields (~4 tests)
- `inventory_turns = annual_demand / avg_inventory` — 3650 demand / 250 avg = 14.6
- `days_of_inventory = 365 / inventory_turns` — 365 / 14.6 ≈ 25
- `working_capital = avg_inventory × unit_cost` — 250 × $20 = $5000
- `annual_stockout_cost` — safety_stock × selling_price × stockout_risk_pct/100; zero when no selling_price

### `calcSeasonalInventory` (~8 tests)
- flat preset → monthly EOQs equal base `calcInventory` EOQ (within rounding)
- `monthly_plans.length = 12`
- peak_month has the highest `monthly_demand`
- lowest_month has the lowest `monthly_demand`
- normalized multipliers: for flat preset `norm[i] = 1.0` for all i
- holiday_heavy: peak_month is December (index 11, multiplier 2.0)
- `safety_stock` for peak month > base safety_stock (higher demand variability)
- zero multipliers except one → only that month has demand

### `calcAbcClassification` (~8 tests)
- empty array → all empty arrays, `total_annual_value = 0`
- single SKU → classified A
- sorted descending by `annual_value`
- top 20% of items (ceil) → A class; next 30% → B; remainder → C
- `cumulative_pct` increases monotonically
- `total_annual_value = sum(unit_cost × annual_units)` for all SKUs
- SKU with highest `annual_value` always gets class A
- 5 SKUs → A=[1], B=[2], C=[2] (ceil(5×0.2)=1, ceil(5×0.5)=3, so A=[1], B=[2 from idx 1-2], C=[2 from idx 3-4])
