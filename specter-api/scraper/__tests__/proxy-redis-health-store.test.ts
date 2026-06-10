import { describe, it, expect, vi } from 'vitest'
import { RedisProxyHealthStore, proxyHealthKey } from '../proxy/redis-health-store'

function fakeRedis() {
  const sets: Array<[string, string]> = []
  return {
    sets,
    set: vi.fn(async (k: string, v: string) => { sets.push([k, v]); return 'OK' }),
    mget: vi.fn(async (..._keys: string[]) => [] as Array<string | null>),
  }
}

const URL_A = 'http://user:secret@gw.example.com:8080'

describe('RedisProxyHealthStore', () => {
  it('hashes the proxy URL into the key — no credentials leak', () => {
    const key = proxyHealthKey(URL_A)
    expect(key.startsWith('proxy:health:')).toBe(true)
    expect(key).not.toContain('secret')
    expect(key).not.toContain('gw.example.com')
  })

  it('get returns the default health for an unseen url', () => {
    const store = new RedisProxyHealthStore(fakeRedis() as never, [URL_A])
    expect(store.get(URL_A)).toEqual({ score: 100, cooldownUntil: 0 })
  })

  it('set updates the in-memory map synchronously and mirrors to redis', () => {
    const redis = fakeRedis()
    const store = new RedisProxyHealthStore(redis as never, [URL_A])
    store.set(URL_A, { score: 50, cooldownUntil: 1_000 })
    expect(store.get(URL_A)).toEqual({ score: 50, cooldownUntil: 1_000 })   // sync read-back
    expect(redis.set).toHaveBeenCalledTimes(1)
    expect(redis.set.mock.calls[0][0]).toBe(proxyHealthKey(URL_A))           // hashed key
  })

  it('swallows redis errors on set (worker keeps running)', () => {
    const redis = { set: vi.fn(async () => { throw new Error('redis down') }), mget: vi.fn() }
    const store = new RedisProxyHealthStore(redis as never, [URL_A])
    expect(() => store.set(URL_A, { score: 0, cooldownUntil: 9 })).not.toThrow()
    expect(store.get(URL_A).score).toBe(0)
  })

  it('refresh merges the stricter (later) cooldown from other pods', async () => {
    const redis = fakeRedis()
    redis.mget = vi.fn(async () => [JSON.stringify({ score: 0, cooldownUntil: 5_000 })])
    const store = new RedisProxyHealthStore(redis as never, [URL_A])
    store.set(URL_A, { score: 100, cooldownUntil: 1_000 })   // our local view: cools sooner
    await store.refreshOnce()
    expect(store.get(URL_A).cooldownUntil).toBe(5_000)        // adopt the later cooldown
  })
})
