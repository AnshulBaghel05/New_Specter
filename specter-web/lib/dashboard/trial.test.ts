import { describe, it, expect } from 'vitest'
import { daysLeft } from './trial'

describe('daysLeft', () => {
  it('returns a positive integer for a future date (ceil of remaining days)', () => {
    const inThreeDays = new Date(Date.now() + 3 * 86_400_000).toISOString()
    expect(daysLeft(inThreeDays)).toBe(3)
  })

  it('returns 1 for a date later today/tomorrow', () => {
    const soon = new Date(Date.now() + 60_000).toISOString()
    expect(daysLeft(soon)).toBe(1)
  })

  it('returns null for a past date', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()
    expect(daysLeft(yesterday)).toBeNull()
  })

  it('returns null for null or invalid input', () => {
    expect(daysLeft(null)).toBeNull()
    expect(daysLeft('not-a-date')).toBeNull()
  })
})
