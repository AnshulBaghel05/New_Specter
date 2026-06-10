import { describe, it, expect } from 'vitest'
import { calcShipping } from '@/lib/tools/shipping'
import { lookupRate, calcDimWeightLb, UPS_GROUND, DIM_DIVISOR } from '@/lib/tools/shipping-rates'
import { calcShippingInternational } from '@/lib/tools/shipping'
import type { IntlShippingInput } from '@/lib/tools/shipping'
import { calcBulkShipment } from '@/lib/tools/shipping'
import { calcPackagingOptimizer } from '@/lib/tools/shipping'
import type { BoxSpec } from '@/lib/tools/shipping'

describe('calcDimWeightLb', () => {
  it('computes dim weight correctly (UPS/FedEx divisor 139)', () => {
    // 12×10×6 = 720 in³; /139 = 5.18 lb
    expect(calcDimWeightLb(12, 10, 6, DIM_DIVISOR.ups_fedex)).toBeCloseTo(5.18, 1)
  })
  it('computes dim weight correctly (USPS divisor 166)', () => {
    expect(calcDimWeightLb(12, 10, 6, DIM_DIVISOR.usps)).toBeCloseTo(4.34, 1)
  })
})

describe('lookupRate', () => {
  it('returns zone 2, 1lb UPS Ground rate', () => {
    expect(lookupRate(UPS_GROUND, 2, 1)).toBe(10.72)
  })
  it('rounds up to next weight breakpoint', () => {
    // 1.5lb should use 2lb rate
    expect(lookupRate(UPS_GROUND, 2, 1.5)).toBe(lookupRate(UPS_GROUND, 2, 2))
  })
})

describe('calcShipping', () => {
  const base = { weight_lb: 2, length_in: 10, width_in: 8, height_in: 5, zone: 4 as const }

  it('returns rates array with at least 5 carriers', () => {
    const r = calcShipping(base)
    expect(r.rates.length).toBeGreaterThanOrEqual(5)
  })

  it('identifies cheapest carrier correctly', () => {
    const r = calcShipping(base)
    const min = Math.min(...r.rates.map(c => c.rate))
    expect(r.cheapest.rate).toBe(min)
  })

  it('billable_weight = max(actual, dim_weight)', () => {
    // Package: 20×18×16 = 5760 in³; dim_lb = 5760/139 = 41.4lb > 2lb actual
    const heavy_dim = calcShipping({ weight_lb: 2, length_in: 20, width_in: 18, height_in: 16, zone: 4 })
    expect(heavy_dim.billable_weight_ups_lb).toBeGreaterThan(2)
  })

  it('actual weight beats dim weight for dense package', () => {
    // Small dense package: 4×4×4 = 64in³; dim_lb = 64/139 = 0.46lb < 2lb actual
    const dense = calcShipping({ weight_lb: 2, length_in: 4, width_in: 4, height_in: 4, zone: 4 })
    expect(dense.billable_weight_ups_lb).toBe(2)
  })

  it('USPS DIM weight only applies when volume > 1728 in³', () => {
    const small = calcShipping({ weight_lb: 3, length_in: 10, width_in: 8, height_in: 2, zone: 4 })
    // 10×8×2 = 160 in³ < 1728 → usps_dim = 0
    expect(small.usps_dim_weight_lb).toBe(0)
    expect(small.billable_weight_usps_lb).toBe(3) // actual wins
  })

  it('all rates are positive numbers', () => {
    const r = calcShipping(base)
    r.rates.forEach(rate => {
      expect(rate.rate).toBeGreaterThan(0)
    })
  })

  it('rates increase with zone distance', () => {
    const z2 = calcShipping({ ...base, zone: 2 })
    const z8 = calcShipping({ ...base, zone: 8 })
    const ups_z2 = z2.rates.find(r => r.service === 'UPS Ground')!.rate
    const ups_z8 = z8.rates.find(r => r.service === 'UPS Ground')!.rate
    expect(ups_z8).toBeGreaterThan(ups_z2)
  })
})

// ── calcShippingInternational ────────────────────────────────────────────

describe('calcShippingInternational', () => {
  const ukElec: IntlShippingInput = {
    weight_lb: 2, length_in: 10, width_in: 10, height_in: 10,
    declared_value_usd: 100, destination: 'uk', product_category: 'electronics',
  }

  it('returns exactly 4 carrier rates', () => {
    expect(calcShippingInternational(ukElec).rates).toHaveLength(4)
  })

  it('UK electronics: duty=0%, VAT=20%', () => {
    const r = calcShippingInternational(ukElec)
    expect(r.duty_rate_pct).toBe(0)
    expect(r.destination_vat_pct).toBe(20)
  })

  it('UK electronics: DHL base_rate and total_landed_cost', () => {
    const r = calcShippingInternational(ukElec)
    const dhl = r.rates.find((x) => x.service === 'DHL Express')!
    expect(dhl.base_rate).toBeCloseTo(41.26, 1)
    expect(dhl.estimated_duty).toBe(0)
    expect(dhl.estimated_vat).toBeCloseTo(29.90, 1)
    expect(dhl.total_landed_cost).toBeCloseTo(79.41, 0)
  })

  it('CA apparel: duty_rate_pct=18, vat_pct=5', () => {
    const r = calcShippingInternational({
      weight_lb: 1, length_in: 8, width_in: 8, height_in: 8,
      declared_value_usd: 50, destination: 'ca', product_category: 'apparel',
    })
    expect(r.duty_rate_pct).toBe(18)
    expect(r.destination_vat_pct).toBe(5)
  })

  it('AU general: duty_rate_pct=5, vat_pct=10', () => {
    const r = calcShippingInternational({
      weight_lb: 1, length_in: 5, width_in: 5, height_in: 5,
      declared_value_usd: 30, destination: 'au', product_category: 'general',
    })
    expect(r.duty_rate_pct).toBe(5)
    expect(r.destination_vat_pct).toBe(10)
  })

  it('dim weight triggers when volume/139 > actual weight', () => {
    expect(calcShippingInternational(ukElec).billable_weight_lb).toBeCloseTo(7.19, 1)
  })

  it('actual weight used when heavier than dim weight', () => {
    const r = calcShippingInternational({
      weight_lb: 5, length_in: 4, width_in: 4, height_in: 4,
      declared_value_usd: 50, destination: 'uk', product_category: 'general',
    })
    expect(r.billable_weight_lb).toBe(5)
  })

  it('fastest carrier is FedEx International Priority (transit_days=3)', () => {
    const r = calcShippingInternational(ukElec)
    expect(r.fastest.service).toBe('FedEx International Priority')
    expect(r.fastest.transit_days).toBe(3)
  })

  it('cheapest and fastest differ', () => {
    const r = calcShippingInternational(ukElec)
    expect(r.cheapest.service).not.toBe(r.fastest.service)
  })
})

describe('calcBulkShipment', () => {
  // 10 units × 5lb, 12×10×6: dim=720/139=5.18, billable/unit=max(5,5.18)=5.18
  // total_billable=51.8 < 150 → ltl_rate=null
  const small = { weight_lb_per_unit: 5, length_in: 12, width_in: 10, height_in: 6, unit_count: 10, zone: 4 as const }

  // 200 units × 1lb, 6×6×6: dim=216/139=1.55, billable/unit=1.55
  // total_billable=310 ≥ 150 → ltl=50+310*0.08=74.8
  const large = { weight_lb_per_unit: 1, length_in: 6, width_in: 6, height_in: 6, unit_count: 200, zone: 4 as const }

  it('returns 4 parcel_rates', () => {
    expect(calcBulkShipment(small).parcel_rates).toHaveLength(4)
  })

  it('ltl_rate is null when total_billable < 150', () => {
    const r = calcBulkShipment(small)
    expect(r.ltl_rate).toBeNull()
    expect(r.recommended_mode).toBe('parcel')
  })

  it('dim weight applied per unit then multiplied for total', () => {
    const r = calcBulkShipment(small)
    expect(r.billable_weight_lb).toBeCloseTo(51.8, 0)
  })

  it('cost_per_unit = total_cost / unit_count for each carrier', () => {
    const r = calcBulkShipment(large)
    r.parcel_rates.forEach(({ total_cost, cost_per_unit }) => {
      expect(cost_per_unit).toBeCloseTo(total_cost / 200, 1)
    })
  })

  it('ltl_rate computed when total_billable >= 150', () => {
    const r = calcBulkShipment(large)
    expect(r.ltl_rate).toBeCloseTo(74.8, 1)
    expect(r.ltl_cost_per_unit).toBeCloseTo(74.8 / 200, 1)
  })

  it('recommended_mode = ltl when LTL is cheaper than cheapest parcel', () => {
    expect(calcBulkShipment(large).recommended_mode).toBe('ltl')
  })

  it('ltl_crossover_units is a finite positive integer', () => {
    const n = calcBulkShipment(large).ltl_crossover_units
    expect(Number.isFinite(n)).toBe(true)
    expect(n).toBeGreaterThan(0)
  })

  it('unit_count=0 returns empty parcel_rates without divide-by-zero', () => {
    const r = calcBulkShipment({ weight_lb_per_unit: 2, length_in: 10, width_in: 8, height_in: 6, unit_count: 0, zone: 4 })
    expect(r.parcel_rates).toHaveLength(0)
    expect(r.ltl_rate).toBeNull()
  })
})

describe('calcPackagingOptimizer', () => {
  const prod = {
    product_length_in: 10, product_width_in: 8, product_height_in: 5,
    product_weight_lb: 2, zone: 4 as const,
  }

  it('ideal_box = product dims + 4 per axis', () => {
    const r = calcPackagingOptimizer({ ...prod, custom_boxes: [] })
    expect(r.ideal_box.length_in).toBe(14)
    expect(r.ideal_box.width_in).toBe(12)
    expect(r.ideal_box.height_in).toBe(9)
  })

  it('ideal_dim_weight_lb = ideal box volume / 139', () => {
    // 14*12*9 = 1512; /139 = 10.878 → 10.88
    const r = calcPackagingOptimizer({ ...prod, custom_boxes: [] })
    expect(r.ideal_dim_weight_lb).toBeCloseTo(10.88, 1)
  })

  it('empty custom_boxes → catalog_matches is empty', () => {
    expect(calcPackagingOptimizer({ ...prod, custom_boxes: [] }).catalog_matches).toHaveLength(0)
  })

  it('fits=true when box dims each >= product dim + 1"', () => {
    const box: BoxSpec = { name: 'A', length_in: 11, width_in: 9, height_in: 6 }
    const r = calcPackagingOptimizer({ ...prod, custom_boxes: [box] })
    expect(r.catalog_matches[0].fits).toBe(true)
  })

  it('fits=false when any box dim < product dim + 1"', () => {
    // length 10 < product_length(10) + 1 = 11
    const box: BoxSpec = { name: 'B', length_in: 10, width_in: 9, height_in: 6 }
    const r = calcPackagingOptimizer({ ...prod, custom_boxes: [box] })
    expect(r.catalog_matches[0].fits).toBe(false)
  })

  it('non-fitting box still has a valid cheapest_rate_usd', () => {
    const box: BoxSpec = { name: 'C', length_in: 5, width_in: 5, height_in: 5 }
    const r = calcPackagingOptimizer({ ...prod, custom_boxes: [box] })
    expect(r.catalog_matches[0].cheapest_rate_usd).toBeGreaterThan(0)
  })

  it('void_fill_in3 = box volume − product volume', () => {
    const box: BoxSpec = { name: 'D', length_in: 14, width_in: 12, height_in: 9 }
    // box=1512, product=400, void=1112
    const r = calcPackagingOptimizer({ ...prod, custom_boxes: [box] })
    expect(r.catalog_matches[0].void_fill_in3).toBe(1512 - 400)
  })

  it('dim weight wins for large light box', () => {
    // 20×20×20 with 1lb product: dim=8000/139=57.55 > 1lb
    const box: BoxSpec = { name: 'E', length_in: 20, width_in: 20, height_in: 20 }
    const r = calcPackagingOptimizer({ ...prod, product_weight_lb: 1, custom_boxes: [box] })
    expect(r.catalog_matches[0].billable_weight_lb).toBeCloseTo(57.55, 0)
  })

  it('catalog_matches sorted by cheapest_rate_usd ascending', () => {
    const small: BoxSpec = { name: 'S', length_in: 11, width_in: 9, height_in: 6 }
    const large: BoxSpec = { name: 'L', length_in: 20, width_in: 20, height_in: 20 }
    // Pass large first — sort should put small first (cheaper rate)
    const r = calcPackagingOptimizer({ ...prod, product_weight_lb: 1, custom_boxes: [large, small] })
    expect(r.catalog_matches[0].cheapest_rate_usd).toBeLessThanOrEqual(r.catalog_matches[1].cheapest_rate_usd)
  })
})
