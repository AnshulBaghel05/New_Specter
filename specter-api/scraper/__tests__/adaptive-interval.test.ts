import { describe, it, expect } from 'vitest'
import {
  adaptiveIntervalMultiplier,
  computeAdaptiveInterval,
  PLAN_INTERVALS,
  PLAN_MAX_INTERVALS,
} from '../plans'

// Balanced backoff curve: streak <3 → 1×, 3–5 → 2×, 6–8 → 4×, ≥9 → plan cap.

describe('adaptiveIntervalMultiplier (balanced curve)', () => {
  it('is 1× for a fresh / short streak (0–2)', () => {
    expect(adaptiveIntervalMultiplier(0)).toBe(1)
    expect(adaptiveIntervalMultiplier(2)).toBe(1)
  })
  it('is 2× for streak 3–5', () => {
    expect(adaptiveIntervalMultiplier(3)).toBe(2)
    expect(adaptiveIntervalMultiplier(5)).toBe(2)
  })
  it('is 4× for streak 6–8', () => {
    expect(adaptiveIntervalMultiplier(6)).toBe(4)
    expect(adaptiveIntervalMultiplier(8)).toBe(4)
  })
  it('saturates (→ cap) for streak ≥9', () => {
    expect(adaptiveIntervalMultiplier(9)).toBe(Number.POSITIVE_INFINITY)
    expect(adaptiveIntervalMultiplier(100)).toBe(Number.POSITIVE_INFINITY)
  })
  it('treats a negative streak as fresh (1×)', () => {
    expect(adaptiveIntervalMultiplier(-1)).toBe(1)
  })
})

describe('computeAdaptiveInterval — RECON (6h floor, 24h cap)', () => {
  const floor = PLAN_INTERVALS.RECON   // 21_600_000
  const cap = PLAN_MAX_INTERVALS.RECON // 86_400_000
  it('returns the plan floor at low streak — never faster than the plan', () => {
    expect(computeAdaptiveInterval('recon', 0)).toBe(floor)
    expect(computeAdaptiveInterval('RECON', 2)).toBe(floor)
  })
  it('doubles at streak 3–5', () => {
    expect(computeAdaptiveInterval('recon', 3)).toBe(floor * 2) // 12h
  })
  it('reaches the cap by streak 6 (4× == 24h) and never exceeds it', () => {
    expect(computeAdaptiveInterval('recon', 6)).toBe(cap)
    expect(computeAdaptiveInterval('recon', 9)).toBe(cap)
    expect(computeAdaptiveInterval('recon', 999)).toBe(cap)
  })
})

describe('computeAdaptiveInterval — per-plan bounds', () => {
  it('PREDATOR floors at 1h and caps at 4h', () => {
    expect(computeAdaptiveInterval('predator', 0)).toBe(3_600_000)
    expect(computeAdaptiveInterval('predator', 3)).toBe(7_200_000)   // 2×
    expect(computeAdaptiveInterval('predator', 6)).toBe(14_400_000)  // 4× == cap
    expect(computeAdaptiveInterval('predator', 9)).toBe(14_400_000)  // cap
  })
  it('CIPHER floors at 3h and caps at 12h', () => {
    expect(computeAdaptiveInterval('cipher', 0)).toBe(10_800_000)
    expect(computeAdaptiveInterval('cipher', 9)).toBe(43_200_000)
  })
  it('falls back to RECON bounds for an unknown plan', () => {
    expect(computeAdaptiveInterval('mystery', 0)).toBe(PLAN_INTERVALS.RECON)
    expect(computeAdaptiveInterval('mystery', 9)).toBe(PLAN_MAX_INTERVALS.RECON)
  })
})

describe('computeAdaptiveInterval — ECLIPSE (configurable floor)', () => {
  it('uses the merchant-configured floor and the 1h cap', () => {
    expect(computeAdaptiveInterval('eclipse', 0, 300_000)).toBe(300_000)   // 5m default
    expect(computeAdaptiveInterval('eclipse', 3, 300_000)).toBe(600_000)   // 2×
    expect(computeAdaptiveInterval('eclipse', 9, 300_000)).toBe(3_600_000) // cap 1h
  })
  it('never backs off below the floor when the configured floor exceeds the cap', () => {
    // A merchant who sets ECLIPSE to 2h gets no backoff (floor wins over the 1h cap).
    expect(computeAdaptiveInterval('eclipse', 9, 7_200_000)).toBe(7_200_000)
  })
})
