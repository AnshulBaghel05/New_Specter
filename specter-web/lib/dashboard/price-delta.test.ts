import { describe, it, expect } from 'vitest'
import { priceDeltaPct, formatPriceDelta } from './price-delta'

describe('priceDeltaPct', () => {
  it('computes a positive delta', () => {
    expect(priceDeltaPct(100, 104.1)).toBeCloseTo(4.1, 5)
  })

  it('computes a negative delta', () => {
    expect(priceDeltaPct(100, 97)).toBeCloseTo(-3, 5)
  })

  it('returns null when current or suggestion is null', () => {
    expect(priceDeltaPct(null, 100)).toBeNull()
    expect(priceDeltaPct(100, null)).toBeNull()
  })

  it('returns null when current is zero or negative', () => {
    expect(priceDeltaPct(0, 100)).toBeNull()
    expect(priceDeltaPct(-5, 100)).toBeNull()
  })
})

describe('formatPriceDelta', () => {
  it('formats a positive delta with a plus and one decimal', () => {
    expect(formatPriceDelta(100, 104.1)).toBe('+4.1%')
  })

  it('formats a negative delta with a unicode minus', () => {
    expect(formatPriceDelta(100, 97)).toBe('−3.0%')
  })

  it('returns null when not computable', () => {
    expect(formatPriceDelta(0, 100)).toBeNull()
    expect(formatPriceDelta(100, null)).toBeNull()
  })
})
