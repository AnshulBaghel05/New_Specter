import { describe, it, expect } from 'vitest'
import {
  lastPriceTtlSeconds,
  cacheLastPrice,
  cacheDomainClass,
  DOMAIN_CLASS_TTL_SECONDS,
  recordPriceObservation,
  getUnchangedStreak,
  streakTtlSeconds,
  type TtlRedis,
  type StreakRedis,
} from '../state-ttl'

// Tiny fake recording every set() call, so we can assert a TTL was applied.
function fakeRedis() {
  const calls: Array<[string, string, string, number]> = []
  const redis: TtlRedis = {
    async set(key, value, mode, seconds) {
      calls.push([key, value, mode, seconds])
      return 'OK'
    },
  }
  return { redis, calls }
}

// Stateful fake so incr/get actually behave (streak logic depends on it).
function fakeStreakRedis() {
  const store = new Map<string, string>()
  const redis: StreakRedis = {
    async get(k) { return store.get(k) ?? null },
    async set(k, v) { store.set(k, v); return 'OK' },
    async incr(k) { const n = parseInt(store.get(k) ?? '0', 10) + 1; store.set(k, String(n)); return n },
    async expire() { return 1 },
  }
  return { redis, store }
}

describe('lastPriceTtlSeconds', () => {
  it('is 2× the plan interval (RECON 6h → 12h)', () => {
    expect(lastPriceTtlSeconds('recon')).toBe(43_200) // 6h*2
  })

  it('tracks the most-frequent plan (PREDATOR 1h → 2h)', () => {
    expect(lastPriceTtlSeconds('PREDATOR')).toBe(7_200)
  })

  it('falls back to RECON for an unknown plan', () => {
    expect(lastPriceTtlSeconds('mystery')).toBe(lastPriceTtlSeconds('recon'))
  })
})

describe('cacheLastPrice', () => {
  it('writes the price WITH an EX TTL (never a TTL-less SET)', async () => {
    const { redis, calls } = fakeRedis()
    await cacheLastPrice(redis, 'rival.com', '/p/x', 19.99, 'cipher')
    expect(calls).toHaveLength(1)
    const [key, value, mode, ttl] = calls[0]
    expect(key).toBe('last-price:rival.com:/p/x')
    expect(value).toBe('19.99')
    expect(mode).toBe('EX')
    expect(ttl).toBeGreaterThan(0)
  })
})

describe('cacheDomainClass', () => {
  it('writes the classification with a 7-day TTL (self-healing)', async () => {
    const { redis, calls } = fakeRedis()
    await cacheDomainClass(redis, 'rival.com', 'js_required')
    const [key, value, mode, ttl] = calls[0]
    expect(key).toBe('domain:class:rival.com')
    expect(value).toBe('js_required')
    expect(mode).toBe('EX')
    expect(ttl).toBe(DOMAIN_CLASS_TTL_SECONDS)
  })
})

describe('streakTtlSeconds', () => {
  it('is 2× the plan cap so a streak survives the longest backoff (RECON 24h → 48h)', () => {
    expect(streakTtlSeconds('recon')).toBe(172_800) // 24h*2
  })
  it('falls back to RECON for an unknown plan', () => {
    expect(streakTtlSeconds('mystery')).toBe(streakTtlSeconds('recon'))
  })
})

describe('recordPriceObservation — unchanged-streak counter', () => {
  it('returns 0 on first sighting, then increments while price + stock are identical', async () => {
    const { redis } = fakeStreakRedis()
    expect(await recordPriceObservation(redis, 'rival.com', '/p/x', 10, true, 'recon')).toBe(0)
    expect(await recordPriceObservation(redis, 'rival.com', '/p/x', 10, true, 'recon')).toBe(1)
    expect(await recordPriceObservation(redis, 'rival.com', '/p/x', 10, true, 'recon')).toBe(2)
  })

  it('resets to 0 when the price changes', async () => {
    const { redis } = fakeStreakRedis()
    await recordPriceObservation(redis, 'rival.com', '/p/x', 10, true, 'recon')
    await recordPriceObservation(redis, 'rival.com', '/p/x', 10, true, 'recon') // streak 1
    expect(await recordPriceObservation(redis, 'rival.com', '/p/x', 11, true, 'recon')).toBe(0)
  })

  it('resets to 0 when only stock flips (in-stock → OOS)', async () => {
    const { redis } = fakeStreakRedis()
    await recordPriceObservation(redis, 'rival.com', '/p/x', 10, true, 'recon')
    await recordPriceObservation(redis, 'rival.com', '/p/x', 10, true, 'recon') // streak 1
    expect(await recordPriceObservation(redis, 'rival.com', '/p/x', 10, false, 'recon')).toBe(0)
  })

  it('writes the streak key with a TTL (never TTL-less)', async () => {
    const { redis, store } = fakeStreakRedis()
    await recordPriceObservation(redis, 'rival.com', '/p/x', 10, true, 'recon')
    expect(store.get('scrape:streak:rival.com:/p/x')).toBe('0')
  })
})

describe('getUnchangedStreak', () => {
  it('reads the current streak, defaulting to 0 when absent', async () => {
    const { redis } = fakeStreakRedis()
    expect(await getUnchangedStreak(redis, 'rival.com', '/p/x')).toBe(0)
    await recordPriceObservation(redis, 'rival.com', '/p/x', 10, true, 'recon')
    await recordPriceObservation(redis, 'rival.com', '/p/x', 10, true, 'recon')
    expect(await getUnchangedStreak(redis, 'rival.com', '/p/x')).toBe(1)
  })
})
