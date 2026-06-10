import { describe, it, expect } from 'vitest'
import {
  calcEoq,
  calcSafetyStock,
  calcReorderPoint,
  calcInventory,
  Z_SCORES,
  calcSeasonalInventory,
  SEASONALITY_PRESETS,
  calcAbcClassification,
} from '@/lib/tools/inventory'

describe('Z_SCORES', () => {
  it('90% service level z = 1.28', () => expect(Z_SCORES['90']).toBe(1.28))
  it('95% service level z = 1.645', () => expect(Z_SCORES['95']).toBe(1.645))
  it('99% service level z = 2.326', () => expect(Z_SCORES['99']).toBe(2.326))
})

describe('calcEoq', () => {
  it('= sqrt(2DS/H)', () => {
    // D=1000, S=50, H=5 → sqrt(100000/5) = sqrt(20000) ≈ 141.4
    expect(calcEoq(1000, 50, 5)).toBeCloseTo(141.4, 0)
  })
  it('returns 0 when holding_cost = 0', () => {
    expect(calcEoq(1000, 50, 0)).toBe(0)
  })
  it('returns 0 when annual_demand = 0', () => {
    expect(calcEoq(0, 50, 5)).toBe(0)
  })
  it('increases with higher annual demand', () => {
    expect(calcEoq(2000, 50, 5)).toBeGreaterThan(calcEoq(1000, 50, 5))
  })
  it('decreases with higher holding cost', () => {
    expect(calcEoq(1000, 50, 10)).toBeLessThan(calcEoq(1000, 50, 5))
  })
})

describe('calcSafetyStock', () => {
  it('= z × σ × sqrt(L)', () => {
    // z=1.645, σ=10, L=9 → 1.645 × 10 × 3 = 49.35
    expect(calcSafetyStock(1.645, 10, 9)).toBeCloseTo(49.35, 1)
  })
  it('= 0 when std_dev = 0', () => {
    expect(calcSafetyStock(1.645, 0, 9)).toBe(0)
  })
  it('increases with longer lead time', () => {
    expect(calcSafetyStock(1.645, 10, 16)).toBeGreaterThan(calcSafetyStock(1.645, 10, 9))
  })
  it('increases with higher z-score (service level)', () => {
    expect(calcSafetyStock(2.326, 10, 9)).toBeGreaterThan(calcSafetyStock(1.28, 10, 9))
  })
})

describe('calcReorderPoint', () => {
  it('= avg_daily_demand × lead_time + safety_stock', () => {
    expect(calcReorderPoint(10, 7, 20)).toBe(90)
  })
})

describe('calcInventory', () => {
  const base = {
    avg_daily_demand: 10,
    demand_std_dev: 3,
    lead_time_days: 7,
    order_cost: 50,
    unit_cost: 20,
    holding_cost_pct: 25,
    service_level: '95' as const,
  }

  it('annual_demand = avg_daily_demand × 365', () => {
    const r = calcInventory(base)
    expect(r.annual_demand).toBe(3650)
  })

  it('holding_cost_per_unit = unit_cost × holding_pct', () => {
    const r = calcInventory(base)
    expect(r.holding_cost_per_unit).toBe(5)
  })

  it('eoq matches Wilson formula', () => {
    const r = calcInventory(base)
    const expected = Math.sqrt((2 * 3650 * 50) / 5)
    expect(r.eoq).toBe(Math.round(expected))
  })

  it('safety_stock uses z=1.645 for 95% service level', () => {
    const r = calcInventory(base)
    const raw = 1.645 * 3 * Math.sqrt(7)
    expect(r.safety_stock).toBe(Math.ceil(raw))
  })

  it('reorder_point = demand×lead_time + safety_stock', () => {
    const r = calcInventory(base)
    expect(r.reorder_point).toBe(Math.round(10 * 7 + r.safety_stock))
  })

  it('higher service level → higher safety_stock', () => {
    const r90 = calcInventory({ ...base, service_level: '90' })
    const r99 = calcInventory({ ...base, service_level: '99' })
    expect(r99.safety_stock).toBeGreaterThan(r90.safety_stock)
  })

  it('total_annual_cost = ordering_cost + holding_cost', () => {
    const r = calcInventory(base)
    expect(r.total_annual_cost).toBe(
      Math.round((r.annual_ordering_cost + r.annual_holding_cost) * 100) / 100,
    )
  })
})

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
    const expected = Math.round(r.safety_stock * base.selling_price * (r.stockout_risk_pct / 100) * 100) / 100
    expect(r.annual_stockout_cost).toBe(expected)
  })
})

describe('calcSeasonalInventory', () => {
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
    const baseR = r.eoq
    r.monthly_plans.forEach(m => {
      expect(Math.abs(m.eoq - baseR)).toBeLessThanOrEqual(2)
    })
  })
})

describe('calcAbcClassification', () => {
  const skus = [
    { sku_id: 'A1', unit_cost: 50, annual_units: 1000 },
    { sku_id: 'B1', unit_cost: 20, annual_units: 500  },
    { sku_id: 'B2', unit_cost: 15, annual_units: 400  },
    { sku_id: 'C1', unit_cost: 5,  annual_units: 300  },
    { sku_id: 'C2', unit_cost: 2,  annual_units: 200  },
  ]

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
