import { describe, it, expect } from 'vitest'
import { calcRoas, calcBreakEvenRoas, calcFunnel, PLATFORM_BENCHMARKS } from '@/lib/tools/roas'

describe('calcBreakEvenRoas', () => {
  it('= 1/gross_margin (40% margin → 2.5×)', () => {
    expect(calcBreakEvenRoas(0.40)).toBeCloseTo(2.5, 5)
  })
  it('= 1/gross_margin (50% margin → 2.0×)', () => {
    expect(calcBreakEvenRoas(0.50)).toBeCloseTo(2.0, 5)
  })
  it('returns 0 for zero margin', () => {
    expect(calcBreakEvenRoas(0)).toBe(0)
  })
  it('returns 0 for negative margin', () => {
    expect(calcBreakEvenRoas(-0.1)).toBe(0)
  })
})

describe('calcRoas', () => {
  const base = {
    ad_spend: 1000,
    revenue: 5000,
    cogs: 2500,
    fulfillment_and_shipping: 250,
  }

  it('roas = revenue / ad_spend', () => {
    const r = calcRoas(base)
    expect(r.roas).toBe(5.0)
  })

  it('troas = gross_profit / ad_spend', () => {
    const r = calcRoas(base)
    // gross_profit = 5000 - 2500 - 250 = 2250; troas = 2250/1000 = 2.25
    expect(r.troas).toBe(2.25)
  })

  it('gross_profit = revenue - cogs - fulfillment', () => {
    const r = calcRoas(base)
    expect(r.gross_profit).toBe(2250)
  })

  it('net_profit = gross_profit - ad_spend', () => {
    const r = calcRoas(base)
    expect(r.net_profit).toBe(1250)
  })

  it('is_profitable when net_profit > 0', () => {
    expect(calcRoas(base).is_profitable).toBe(true)
  })

  it('is not profitable when ad_spend exceeds gross_profit', () => {
    const r = calcRoas({ ...base, ad_spend: 3000 })
    expect(r.is_profitable).toBe(false)
  })

  it('break_even_roas = 1 / gross_margin', () => {
    const r = calcRoas(base)
    // gross_margin = 2250/5000 = 0.45; break_even = 1/0.45 ≈ 2.22
    expect(r.break_even_roas).toBeCloseTo(2.22, 1)
  })

  it('campaign is above break-even when roas > break_even_roas', () => {
    const r = calcRoas(base)
    expect(r.roas).toBeGreaterThan(r.break_even_roas)
  })

  it('returns 0 roas when ad_spend = 0', () => {
    const r = calcRoas({ ...base, ad_spend: 0 })
    expect(r.roas).toBe(0)
    expect(r.troas).toBe(0)
  })

  it('gross_margin_pct computed as percentage', () => {
    const r = calcRoas(base)
    expect(r.gross_margin_pct).toBeCloseTo(45, 0)
  })
})

describe('calcFunnel', () => {
  const base = {
    platform: 'meta' as const,
    impressions: 100_000,
    ctr_pct: 1.0,
    cpc_usd: 1.20,
    cvr_pct: 2.0,
    aov_usd: 80,
    cogs_pct: 40,
    fulfillment_pct: 15,
  }
  // clicks = round(100000 × 1.0 / 100) = 1000
  // ad_spend = 1000 × 1.20 = 1200
  // conversions = round(1000 × 2.0 / 100) = 20
  // revenue = 20 × 80 = 1600
  // gross_margin = 1 - 0.40 - 0.15 = 0.45
  // gross_profit = 1600 × 0.45 = 720
  // roas = 1600 / 1200 ≈ 1.33
  // cpa = 1200 / 20 = 60
  // break_even_cvr_pct = 1.20 / (80 × 0.45) × 100 ≈ 3.33

  it('clicks = round(impressions × ctr/100)', () => {
    expect(calcFunnel(base).clicks).toBe(1000)
  })

  it('ad_spend = clicks × cpc', () => {
    expect(calcFunnel(base).ad_spend).toBe(1200)
  })

  it('conversions = round(clicks × cvr/100)', () => {
    expect(calcFunnel(base).conversions).toBe(20)
  })

  it('revenue = conversions × aov', () => {
    expect(calcFunnel(base).revenue).toBe(1600)
  })

  it('roas = revenue / ad_spend', () => {
    expect(calcFunnel(base).roas).toBeCloseTo(1.33, 1)
  })

  it('gross_profit = revenue × gross_margin (cogs=40%, fulfillment=15%)', () => {
    expect(calcFunnel(base).gross_profit).toBe(720)
  })

  it('cpa = ad_spend / conversions', () => {
    expect(calcFunnel(base).cpa).toBe(60)
  })

  it('break_even_cvr_pct = cpc / (aov × gross_margin) × 100', () => {
    expect(calcFunnel(base).break_even_cvr_pct).toBeCloseTo(3.33, 1)
  })

  it('roas_vs_benchmark = "below" for Meta when roas < 2.0', () => {
    expect(calcFunnel(base).roas_vs_benchmark).toBe('below')
  })

  it('ctr_vs_benchmark = "in_range" for Meta when ctr = 1.1%', () => {
    const r = calcFunnel({ ...base, ctr_pct: 1.1 })
    expect(r.ctr_vs_benchmark).toBe('in_range')
  })

  it('roas_vs_benchmark = "above" for Email when roas = 50', () => {
    const r = calcFunnel({
      ...base,
      platform: 'email',
      impressions: 10_000,
      ctr_pct: 3.0,
      cpc_usd: 0.05,
      cvr_pct: 5.0,
      aov_usd: 500,
    })
    expect(r.roas_vs_benchmark).toBe('above')
  })

  it('ad_spend=0 edge case: roas=0, troas=0, cpa=0', () => {
    const r = calcFunnel({ ...base, cpc_usd: 0 })
    expect(r.roas).toBe(0)
    expect(r.troas).toBe(0)
    expect(r.cpa).toBe(0)
  })
})
