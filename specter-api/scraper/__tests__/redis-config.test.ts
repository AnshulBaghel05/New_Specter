import { describe, it, expect } from 'vitest'
import {
  resolveBrokerUrl,
  resolveStateUrl,
  redisOptionsFromUrl,
} from '../redis-config'

describe('redis-config URL resolution', () => {
  it('uses BROKER_REDIS_URL for the broker when set', () => {
    const env = { BROKER_REDIS_URL: 'rediss://b/', UPSTASH_REDIS_URL: 'rediss://u/' }
    expect(resolveBrokerUrl(env)).toBe('rediss://b/')
  })

  it('falls back to UPSTASH_REDIS_URL for the broker when BROKER_REDIS_URL is unset', () => {
    const env = { UPSTASH_REDIS_URL: 'rediss://u/' }
    expect(resolveBrokerUrl(env)).toBe('rediss://u/')
  })

  it('uses STATE_REDIS_URL for state when set', () => {
    const env = { STATE_REDIS_URL: 'rediss://s/', UPSTASH_REDIS_URL: 'rediss://u/' }
    expect(resolveStateUrl(env)).toBe('rediss://s/')
  })

  it('falls back to UPSTASH_REDIS_URL for state when STATE_REDIS_URL is unset', () => {
    const env = { UPSTASH_REDIS_URL: 'rediss://u/' }
    expect(resolveStateUrl(env)).toBe('rediss://u/')
  })

  it('throws a clear error when no URL is available at all', () => {
    expect(() => resolveBrokerUrl({})).toThrow(/UPSTASH_REDIS_URL/)
    expect(() => resolveStateUrl({})).toThrow(/UPSTASH_REDIS_URL/)
  })
})

describe('redisOptionsFromUrl', () => {
  it('parses host/port/credentials and enables TLS for rediss://', () => {
    const o = redisOptionsFromUrl('rediss://default:p%40ss@host.example:6380')
    expect(o.host).toBe('host.example')
    expect(o.port).toBe(6380)
    expect(o.username).toBe('default')
    expect(o.password).toBe('p@ss')          // URL-decoded
    expect(o.tls).toEqual({})                  // TLS on for rediss://
    expect(o.maxRetriesPerRequest).toBeNull()  // required by BullMQ
    expect(o.enableReadyCheck).toBe(false)     // required for Upstash
  })

  it('leaves TLS off for plain redis:// and defaults the port to 6379', () => {
    const o = redisOptionsFromUrl('redis://default:tok@localhost')
    expect(o.port).toBe(6379)
    expect(o.tls).toBeUndefined()
  })
})
