import { describe, it, expect } from 'vitest'
import {
  isHistory90dPlan,
  maxLookbackDays,
  presetAllowed,
  dateFromForDays,
  parseRangeDays,
  DEFAULT_RANGE_DAYS,
} from '@/lib/dashboard/date-range'

describe('isHistory90dPlan', () => {
  it('is true for predator and eclipse', () => {
    expect(isHistory90dPlan('predator')).toBe(true)
    expect(isHistory90dPlan('eclipse')).toBe(true)
  })
  it('is false for lower plans and undefined', () => {
    expect(isHistory90dPlan('free')).toBe(false)
    expect(isHistory90dPlan('recon')).toBe(false)
    expect(isHistory90dPlan('cipher')).toBe(false)
    expect(isHistory90dPlan('phantom')).toBe(false)
    expect(isHistory90dPlan(undefined)).toBe(false)
  })
})

describe('maxLookbackDays', () => {
  it('is 90 for 90d plans, 30 otherwise', () => {
    expect(maxLookbackDays('predator')).toBe(90)
    expect(maxLookbackDays('cipher')).toBe(30)
    expect(maxLookbackDays(undefined)).toBe(30)
  })
})

describe('presetAllowed', () => {
  it('allows <=30 day presets on any plan', () => {
    expect(presetAllowed(7, 'free')).toBe(true)
    expect(presetAllowed(30, 'cipher')).toBe(true)
  })
  it('only allows 90-day preset on 90d plans', () => {
    expect(presetAllowed(90, 'cipher')).toBe(false)
    expect(presetAllowed(90, 'predator')).toBe(true)
  })
})

describe('dateFromForDays', () => {
  it('subtracts the given days in UTC and returns ISO date', () => {
    const today = new Date('2026-06-05T12:00:00Z')
    expect(dateFromForDays(30, today)).toBe('2026-05-06')
    expect(dateFromForDays(7, today)).toBe('2026-05-29')
  })
})

describe('parseRangeDays', () => {
  it('accepts known presets', () => {
    expect(parseRangeDays('7')).toBe(7)
    expect(parseRangeDays('90')).toBe(90)
  })
  it('defaults unknown values to 30', () => {
    expect(parseRangeDays('45')).toBe(DEFAULT_RANGE_DAYS)
    expect(parseRangeDays(null)).toBe(DEFAULT_RANGE_DAYS)
  })
})
