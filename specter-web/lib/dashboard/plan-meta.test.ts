import { describe, it, expect } from 'vitest'
import { planMeta, PLAN_META } from './plan-meta'

describe('planMeta', () => {
  it('returns display meta for each known plan', () => {
    // No promo active → RECON shows its list price.
    expect(planMeta('recon')).toEqual({ label: 'RECON', listMonthly: 79, priceLabel: '$79/mo', refreshLabel: 'every 6 hr', priorityLabel: 'Standard queue' })
    expect(planMeta('eclipse').refreshLabel).toBe('5–15 min')
    expect(planMeta('eclipse').priorityLabel).toBe('Dedicated workers')
    expect(planMeta('free')).toEqual({ label: 'Free', listMonthly: 0, priceLabel: '$0', refreshLabel: '—', priorityLabel: null })
  })

  it('shows list pricing for every paid plan (no promo active)', () => {
    expect(planMeta('cipher').priceLabel).toBe('$249/mo')
    expect(planMeta('phantom').priceLabel).toBe('$699/mo')
    expect(planMeta('predator').priceLabel).toBe('$1,799/mo')
    expect(planMeta('eclipse').priceLabel).toBe('Custom')
  })

  it('covers all six plan keys', () => {
    expect(Object.keys(PLAN_META).sort()).toEqual(
      ['cipher', 'eclipse', 'free', 'phantom', 'predator', 'recon'].sort()
    )
  })

  it('falls back to an uppercased label for an unknown plan', () => {
    expect(planMeta('mystery')).toEqual({ label: 'MYSTERY', listMonthly: null, priceLabel: '', refreshLabel: '—', priorityLabel: null })
  })
})
