import { describe, it, expect } from 'vitest'
import { planChangeOptions } from './plan-change'

describe('planChangeOptions', () => {
  it('marks the current plan and classifies the rest as up/downgrade or contact', () => {
    const opts = planChangeOptions('cipher')
    const byPlan = Object.fromEntries(opts.map((o) => [o.plan, o.action]))
    expect(byPlan.cipher).toBe('current')
    expect(byPlan.recon).toBe('downgrade')      // below cipher
    expect(byPlan.phantom).toBe('upgrade')      // above cipher
    expect(byPlan.predator).toBe('contact')     // sales-led tiers are not self-serve
    expect(byPlan.eclipse).toBe('contact')
  })

  it('treats every self-serve tier as an upgrade for a free user', () => {
    const byPlan = Object.fromEntries(planChangeOptions('free').map((o) => [o.plan, o.action]))
    expect(byPlan.recon).toBe('upgrade')
    expect(byPlan.cipher).toBe('upgrade')
    expect(byPlan.phantom).toBe('upgrade')
  })

  it('always offers the five paid tiers in ascending order', () => {
    expect(planChangeOptions('recon').map((o) => o.plan))
      .toEqual(['recon', 'cipher', 'phantom', 'predator', 'eclipse'])
  })

  it('marks predator as current (and still sales-led) for a predator merchant', () => {
    const byPlan = Object.fromEntries(planChangeOptions('predator').map((o) => [o.plan, o.action]))
    expect(byPlan.predator).toBe('current')
    expect(byPlan.phantom).toBe('downgrade')   // self-serve downgrade target
  })
})
