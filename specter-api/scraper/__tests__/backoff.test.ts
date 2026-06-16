import { describe, it, expect } from 'vitest'
import { retryBackoffDelay, RETRY_BACKOFF_LADDER_MS } from '../backoff'

describe('retryBackoffDelay — 1m → 5m → 30m ladder', () => {
  it('the ladder is exactly 1m, 5m, 30m', () => {
    expect(RETRY_BACKOFF_LADDER_MS).toEqual([60_000, 300_000, 1_800_000])
  })

  it('1st retry waits 1 minute', () => {
    expect(retryBackoffDelay(1)).toBe(60_000)
  })

  it('2nd retry waits 5 minutes', () => {
    expect(retryBackoffDelay(2)).toBe(300_000)
  })

  it('3rd retry waits 30 minutes', () => {
    expect(retryBackoffDelay(3)).toBe(1_800_000)
  })

  it('clamps beyond the ladder to the last rung (30 min)', () => {
    expect(retryBackoffDelay(4)).toBe(1_800_000)
    expect(retryBackoffDelay(99)).toBe(1_800_000)
  })

  it('guards attemptsMade < 1 to the first rung', () => {
    expect(retryBackoffDelay(0)).toBe(60_000)
    expect(retryBackoffDelay(-5)).toBe(60_000)
  })
})
