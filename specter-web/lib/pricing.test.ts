import { describe, it, expect } from 'vitest'
import {
  priceDisplay, monthlyPriceLabel, isPromoFree, annualDiscountApplies,
  ANNUAL_DISCOUNT_PCT, PROMO_FREE_PLANS,
} from './pricing'

describe('promo membership', () => {
  it('RECON/CIPHER/PHANTOM are 100% off, others are not', () => {
    expect(isPromoFree('recon')).toBe(true)
    expect(isPromoFree('CIPHER')).toBe(true)
    expect(isPromoFree('phantom')).toBe(true)
    expect(isPromoFree('predator')).toBe(false)
    expect(isPromoFree('eclipse')).toBe(false)
    expect(PROMO_FREE_PLANS).toEqual(['recon', 'cipher', 'phantom'])
  })
})

describe('annual discount eligibility', () => {
  it('applies to everything except PREDATOR and ECLIPSE', () => {
    expect(annualDiscountApplies('recon')).toBe(true)
    expect(annualDiscountApplies('phantom')).toBe(true)
    expect(annualDiscountApplies('predator')).toBe(false)
    expect(annualDiscountApplies('eclipse')).toBe(false)
    expect(ANNUAL_DISCOUNT_PCT).toBe(15)
  })
})

describe('priceDisplay', () => {
  it('promo plan shows $0 with the list price struck (monthly + annual)', () => {
    expect(priceDisplay('recon', 79, false)).toEqual({ now: 0, was: 79, promoFree: true })
    expect(priceDisplay('recon', 79, true)).toEqual({ now: 0, was: 79, promoFree: true })
  })
  it('PREDATOR has NO annual discount — same price either cadence, no strike', () => {
    expect(priceDisplay('predator', 1799, false)).toEqual({ now: 1799, was: null, promoFree: false })
    expect(priceDisplay('predator', 1799, true)).toEqual({ now: 1799, was: null, promoFree: false })
  })
  it('ECLIPSE (custom) has no numeric price', () => {
    expect(priceDisplay('eclipse', null, true)).toEqual({ now: null, was: null, promoFree: false })
  })
  it('a non-promo eligible plan gets 15% off annually with the monthly struck', () => {
    // Use a non-promo eligible plan to isolate the annual path from the promo.
    expect(priceDisplay('vanguard', 200, true)).toEqual({ now: 170, was: 200, promoFree: false })
    expect(priceDisplay('vanguard', 200, false)).toEqual({ now: 200, was: null, promoFree: false })
  })
})

describe('monthlyPriceLabel', () => {
  it('promo plans read $0/mo; others their list price; null is Custom', () => {
    expect(monthlyPriceLabel('recon', 79)).toBe('$0/mo')
    expect(monthlyPriceLabel('predator', 1799)).toBe('$1,799/mo')
    expect(monthlyPriceLabel('eclipse', null)).toBe('Custom')
  })
})
