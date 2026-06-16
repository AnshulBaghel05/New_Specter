import { describe, it, expect } from 'vitest'
import { claimDomainLock, type LockRedis } from '../dispatch-lock'

/**
 * Tiny in-memory fake with real `SET NX` semantics: the value is written only when
 * the key is absent, exactly like Redis. This is what makes the lock atomic, so it
 * is what the test must model.
 */
function fakeRedis(): LockRedis & { store: Map<string, string> } {
  const store = new Map<string, string>()
  return {
    store,
    async set(key, value, _px, _ttlMs, _nx) {
      if (store.has(key)) return null // NX — refuse to overwrite an existing key
      store.set(key, value)
      return 'OK'
    },
    async get(key) {
      return store.get(key) ?? null
    },
  }
}

describe('claimDomainLock', () => {
  it('the first caller wins and owns the lock', async () => {
    const redis = fakeRedis()
    const claim = await claimDomainLock(redis, 'scrape:lock:a.com:/p', 'job-1', 60_000)
    expect(claim).toEqual({ won: true, holder: 'job-1' })
    expect(redis.store.get('scrape:lock:a.com:/p')).toBe('job-1')
  })

  it('a second caller loses and is pointed at the existing holder', async () => {
    const redis = fakeRedis()
    await claimDomainLock(redis, 'scrape:lock:a.com:/p', 'job-1', 60_000)
    const claim = await claimDomainLock(redis, 'scrape:lock:a.com:/p', 'job-2', 60_000)
    expect(claim).toEqual({ won: false, holder: 'job-1' })
    // Lock value is unchanged — the loser never overwrote the winner.
    expect(redis.store.get('scrape:lock:a.com:/p')).toBe('job-1')
  })

  it('under concurrency exactly ONE of N racing callers wins', async () => {
    const redis = fakeRedis()
    const claims = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        claimDomainLock(redis, 'scrape:lock:a.com:/p', `job-${i}`, 60_000),
      ),
    )
    const winners = claims.filter((c) => c.won)
    expect(winners).toHaveLength(1)
    // Every loser is pointed at that single winner.
    const winnerId = winners[0].holder
    for (const c of claims.filter((c) => !c.won)) {
      expect(c.holder).toBe(winnerId)
    }
  })

  it('distinct URLs do not contend', async () => {
    const redis = fakeRedis()
    const a = await claimDomainLock(redis, 'scrape:lock:a.com:/p', 'job-a', 60_000)
    const b = await claimDomainLock(redis, 'scrape:lock:b.com:/q', 'job-b', 60_000)
    expect(a.won).toBe(true)
    expect(b.won).toBe(true)
  })
})
