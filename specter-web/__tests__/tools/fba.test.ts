import { describe, it, expect } from 'vitest'
import {
  calcDimWeight,
  calcSizeTier,
  calcFulfillmentFee,
  calcFbaFees,
  findCheaperTierDimensions,
  calcBreakevenAcos,
  REFERRAL_RATES,
  REFERRAL_MINIMUM,
  effectivePriceAfterVat,
  VAT_RATES,
  SIZE_TIERS,
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
    // 8oz, 14×13×0.5 in → large_standard (M=13 > 12 prevents small_standard)
    // L=14 ≤ 15, so no length reduction needed; function should return null
    const fee = calcFulfillmentFee('large_standard', 8)
    const result = findCheaperTierDimensions(8, 14, 13, 0.5, fee, 'most_products', 29.99)
    expect(result).toBeNull()
  })

  it('returns null when a non-longest dimension prevents the target tier', () => {
    // 8oz, 16×13×0.5 — L=16 exceeds threshold (>15), so we attempt the reduction.
    // After reducing L→15, M=13 still > 12, so small_standard is not achievable.
    const fee = calcFulfillmentFee('large_standard', 8)
    const result = findCheaperTierDimensions(8, 16, 13, 0.5, fee, 'most_products', 29.99)
    expect(result).toBeNull()
  })
})

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
    // (-2 / 29.99) * 100 = -6.672... → rounds to -6.7
    expect(calcBreakevenAcos(-2.00, 29.99)).toBe(-6.7)
  })
})
