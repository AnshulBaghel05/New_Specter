import { describe, it, expect } from 'vitest'
import {
  priceDisplay, monthlyPriceLabel, isPromoFree, isPromoActive, annualDiscountApplies,
  ANNUAL_DISCOUNT_PCT, PROMO_FREE_PLANS,
} from './pricing'

describe('promo membership', () => {
  it('no plan is on the 100% promo — list pricing is in effect', () => {
    expect(isPromoFree('recon')).toBe(false)
    expect(isPromoFree('CIPHER')).toBe(false)
    expect(isPromoFree('phantom')).toBe(false)
    expect(isPromoFree('predator')).toBe(false)
    expect(isPromoFree('eclipse')).toBe(false)
    expect(PROMO_FREE_PLANS).toEqual([])
    expect(isPromoActive()).toBe(false)
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
  it('RECON/CIPHER/PHANTOM show list price monthly, 15% off annually (no promo)', () => {
    expect(priceDisplay('recon', 79, false)).toEqual({ now: 79, was: null, promoFree: false })
    expect(priceDisplay('recon', 79, true)).toEqual({ now: 67, was: 79, promoFree: false }) // 79 × 0.85 = 67.15 → 67
    expect(priceDisplay('cipher', 249, false)).toEqual({ now: 249, was: null, promoFree: false })
    expect(priceDisplay('phantom', 699, false)).toEqual({ now: 699, was: null, promoFree: false })
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
  it('reads the list price; null is Custom (no promo active)', () => {
    expect(monthlyPriceLabel('recon', 79)).toBe('$79/mo')
    expect(monthlyPriceLabel('predator', 1799)).toBe('$1,799/mo')
    expect(monthlyPriceLabel('eclipse', null)).toBe('Custom')
  })
})
