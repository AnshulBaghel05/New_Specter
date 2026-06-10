import { describe, it, expect } from 'vitest'
import { calcPricePosition, calcGapPct } from '@/lib/tools/price-position'

describe('calcGapPct', () => {
  it('returns positive when my_price > reference', () => {
    expect(calcGapPct(110, 100)).toBeCloseTo(10, 5)
  })
  it('returns negative when my_price < reference', () => {
    expect(calcGapPct(90, 100)).toBeCloseTo(-10, 5)
  })
  it('returns 0 when prices are equal', () => {
    expect(calcGapPct(100, 100)).toBe(0)
  })
  it('returns 0 for zero reference', () => {
    expect(calcGapPct(100, 0)).toBe(0)
  })
})

describe('calcPricePosition', () => {
  const competitors = [
    { name: 'Comp A', price: 90 },
    { name: 'Comp B', price: 100 },
    { name: 'Comp C', price: 110 },
  ]

  it('computes market_low, market_high, market_avg', () => {
    const r = calcPricePosition({ my_price: 100, competitors })
    expect(r.market_low).toBe(90)
    expect(r.market_high).toBe(110)
    expect(r.market_avg).toBeCloseTo(100, 1)
  })

  it('signals LOWER when price is > 5% above market avg', () => {
    // market_avg = 100; my_price = 107 (7% above)
    const r = calcPricePosition({ my_price: 107, competitors })
    expect(r.signal).toBe('LOWER')
    expect(r.gap_pct_vs_avg).toBeGreaterThan(5)
  })

  it('signals RAISE when price is > 5% below market avg', () => {
    // market_avg = 100; my_price = 93 (7% below)
    const r = calcPricePosition({ my_price: 93, competitors })
    expect(r.signal).toBe('RAISE')
    expect(r.gap_pct_vs_avg).toBeLessThan(-5)
  })

  it('signals HOLD when price is within ±5% of market avg', () => {
    const r = calcPricePosition({ my_price: 100, competitors })
    expect(r.signal).toBe('HOLD')
  })

  it('counts competitors_below and competitors_above correctly', () => {
    const r = calcPricePosition({ my_price: 100, competitors })
    expect(r.competitors_below).toBe(1) // 90
    expect(r.competitors_above).toBe(1) // 110
  })

  it('my_rank is 1 when cheapest', () => {
    const r = calcPricePosition({ my_price: 85, competitors })
    expect(r.my_rank).toBe(1)
  })

  it('handles empty competitors gracefully', () => {
    const r = calcPricePosition({ my_price: 100, competitors: [] })
    expect(r.signal).toBe('HOLD')
    expect(r.total_competitors).toBe(0)
  })

  it('gap_pct_vs_avg uses sign convention: positive = above market', () => {
    const r = calcPricePosition({ my_price: 120, competitors })
    expect(r.gap_pct_vs_avg).toBeGreaterThan(0)
  })
})
