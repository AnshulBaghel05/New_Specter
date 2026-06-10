// Wilson EOQ model + safety stock with z-scores

export const Z_SCORES = {
  '90': 1.28,
  '95': 1.645,
  '99': 2.326,
} as const

export type ServiceLevel = keyof typeof Z_SCORES

export interface InventoryInput {
  avg_daily_demand: number       // units/day
  demand_std_dev: number         // std deviation of daily demand (units)
  lead_time_days: number         // supplier lead time in days
  order_cost: number             // cost to place one purchase order ($)
  unit_cost: number              // per-unit product cost ($)
  holding_cost_pct: number       // annual holding cost as % of unit cost (e.g. 25 = 25%)
  service_level: ServiceLevel    // '90', '95', or '99'
  selling_price?: number         // optional, for margin calculations
}

export interface InventoryResult {
  annual_demand: number
  holding_cost_per_unit: number  // $ per unit per year
  eoq: number
  safety_stock: number
  reorder_point: number
  avg_inventory: number          // EOQ/2 + safety_stock
  orders_per_year: number
  annual_ordering_cost: number
  annual_holding_cost: number
  total_annual_cost: number
  days_supply_per_order: number
  stockout_risk_pct: number      // 100 - service_level
  inventory_turns: number        // annual_demand / avg_inventory
  days_of_inventory: number      // 365 / inventory_turns
  working_capital: number        // avg_inventory × unit_cost
  annual_stockout_cost: number   // safety_stock × selling_price × (stockout_risk_pct / 100)
}

/**
 * Wilson Economic Order Quantity formula
 * EOQ = sqrt( (2 × D × S) / H )
 * D = annual demand, S = ordering cost per order, H = holding cost per unit per year
 */
export function calcEoq(
  annual_demand: number,
  order_cost: number,
  holding_cost_per_unit: number,
): number {
  if (holding_cost_per_unit <= 0 || annual_demand <= 0 || order_cost <= 0) return 0
  return Math.sqrt((2 * annual_demand * order_cost) / holding_cost_per_unit)
}

/**
 * Safety stock = z × σ_d × sqrt(L)
 * z = z-score for desired service level
 * σ_d = std deviation of daily demand
 * L = lead time in days
 */
export function calcSafetyStock(
  z_score: number,
  demand_std_dev: number,
  lead_time_days: number,
): number {
  return z_score * demand_std_dev * Math.sqrt(lead_time_days)
}

/** Reorder Point = (avg_daily_demand × lead_time) + safety_stock */
export function calcReorderPoint(
  avg_daily_demand: number,
  lead_time_days: number,
  safety_stock: number,
): number {
  return avg_daily_demand * lead_time_days + safety_stock
}

export function calcInventory(input: InventoryInput): InventoryResult {
  const annual_demand = input.avg_daily_demand * 365
  const holding_cost_per_unit = input.unit_cost * (input.holding_cost_pct / 100)

  const eoq_raw = calcEoq(annual_demand, input.order_cost, holding_cost_per_unit)
  const eoq = Math.max(1, Math.round(eoq_raw))

  const z = Z_SCORES[input.service_level]
  const safety_stock_raw = calcSafetyStock(z, input.demand_std_dev, input.lead_time_days)
  const safety_stock = Math.ceil(safety_stock_raw)

  const reorder_point = Math.round(calcReorderPoint(input.avg_daily_demand, input.lead_time_days, safety_stock))
  const avg_inventory = Math.round(eoq / 2 + safety_stock)
  const orders_per_year = annual_demand > 0 && eoq > 0 ? annual_demand / eoq : 0

  const annual_ordering_cost = round2(orders_per_year * input.order_cost)
  const annual_holding_cost = round2(avg_inventory * holding_cost_per_unit)
  const total_annual_cost = round2(annual_ordering_cost + annual_holding_cost)

  const days_supply_per_order =
    input.avg_daily_demand > 0 ? Math.round(eoq / input.avg_daily_demand) : 0

  const stockout_risk_pct = 100 - parseFloat(input.service_level)

  const inventory_turns = avg_inventory > 0 ? round2(annual_demand / avg_inventory) : 0
  const days_of_inventory = inventory_turns > 0 ? round1(365 / inventory_turns) : 0
  const working_capital = round2(avg_inventory * input.unit_cost)
  const annual_stockout_cost = round2(
    safety_stock * (input.selling_price ?? 0) * (stockout_risk_pct / 100)
  )

  return {
    annual_demand: Math.round(annual_demand),
    holding_cost_per_unit: round2(holding_cost_per_unit),
    eoq,
    safety_stock,
    reorder_point,
    avg_inventory,
    orders_per_year: round1(orders_per_year),
    annual_ordering_cost,
    annual_holding_cost,
    total_annual_cost,
    days_supply_per_order,
    stockout_risk_pct,
    inventory_turns,
    days_of_inventory,
    working_capital,
    annual_stockout_cost,
  }
}

// ── Seasonality ─────────────────────────────────────────────────────────────

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

// ── ABC Classification ───────────────────────────────────────────────────────

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

function round2(n: number) { return Math.round(n * 100) / 100 }
function round1(n: number) { return Math.round(n * 10) / 10 }
