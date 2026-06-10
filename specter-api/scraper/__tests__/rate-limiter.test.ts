import { describe, it, expect } from 'vitest'
import {
  evaluateTokenBucket, decideAcquire, decideCrawlDelay,
  RATE_LIMIT_LUA, ACQUIRE_SLOT_LUA, RELEASE_SLOT_LUA, CRAWL_DELAY_LUA,
  type BucketState,
} from '../workers/rate-limiter'

// ── evaluateTokenBucket — atomic drain proves no overshoot ────────────────────

describe('evaluateTokenBucket — exactly `limit` allowed per window', () => {
  it('allows exactly `limit` sequential requests at one instant, then denies', () => {
    const limit = 6, win = 60_000, now = 1_000
    let state: BucketState | null = null
    const allowed: boolean[] = []
    for (let i = 0; i < 50; i++) {
      const d = evaluateTokenBucket(state, limit, win, now)
      allowed.push(d.allowed)
      state = { tokens: d.tokens, ts: d.ts }  // persist like the Lua HMSET
    }
    expect(allowed.filter(Boolean).length).toBe(limit)            // no overshoot
    expect(allowed.slice(limit).every(a => a === false)).toBe(true)
  })

  it('denied result carries a positive retryAfterMs', () => {
    const d = evaluateTokenBucket({ tokens: 0, ts: 1_000 }, 6, 60_000, 1_000)
    expect(d.allowed).toBe(false)
    expect(d.retryAfterMs).toBeGreaterThan(0)
  })

  it('refills exactly one token after window/limit elapses', () => {
    const limit = 6, win = 60_000
    const denied = evaluateTokenBucket({ tokens: 0, ts: 1_000 }, limit, win, 1_000)
    expect(denied.allowed).toBe(false)
    // window/limit = 10s → exactly one token back
    const refilled = evaluateTokenBucket({ tokens: 0, ts: 1_000 }, limit, win, 1_000 + 10_000)
    expect(refilled.allowed).toBe(true)
  })

  it('first call on an empty bucket is allowed (full bucket)', () => {
    const d = evaluateTokenBucket(null, 6, 60_000, 5_000)
    expect(d.allowed).toBe(true)
    expect(d.tokens).toBe(5)  // 6 - 1
  })

  it('never accumulates beyond `limit` tokens after a long idle', () => {
    const d = evaluateTokenBucket({ tokens: 0, ts: 0 }, 6, 60_000, 10_000_000)
    expect(d.allowed).toBe(true)
    expect(d.tokens).toBeLessThanOrEqual(6)
  })

  it('a backward clock does not drain the bucket (refill clamped to 0)', () => {
    // nowMs (9_000) is before lastTs (10_000): refill must clamp to 0, not subtract.
    const d = evaluateTokenBucket({ tokens: 3, ts: 10_000 }, 6, 60_000, 9_000)
    expect(d.allowed).toBe(true)
    expect(d.tokens).toBe(2)  // 3 - 1, no negative refill
  })
})

// ── decideAcquire — concurrency lease ceiling ─────────────────────────────────

describe('decideAcquire — hard ceiling on simultaneous in-flight', () => {
  it('acquires up to (but not at) max', () => {
    const max = 3
    expect(decideAcquire(0, max)).toBe(true)
    expect(decideAcquire(1, max)).toBe(true)
    expect(decideAcquire(2, max)).toBe(true)
    expect(decideAcquire(3, max)).toBe(false)  // already at ceiling
    expect(decideAcquire(4, max)).toBe(false)
  })
})

// ── decideCrawlDelay — robots.txt minimum spacing ────────────────────────────

describe('decideCrawlDelay — honors robots Crawl-delay as min spacing', () => {
  it('allows the first-ever request to a domain (no prior timestamp)', () => {
    expect(decideCrawlDelay(null, 10_000, 5_000)).toEqual({ allowed: true, retryAfterMs: 0 })
  })

  it('denies a request that arrives sooner than the crawl-delay', () => {
    // Crawl-delay 10s; last at t=1000, now at t=6000 → only 5s elapsed.
    const d = decideCrawlDelay(1_000, 10_000, 6_000)
    expect(d.allowed).toBe(false)
    expect(d.retryAfterMs).toBe(5_000)   // 10s - 5s
  })

  it('allows once at least the full crawl-delay has elapsed (>=10s ⇒ ≥10s spacing)', () => {
    expect(decideCrawlDelay(1_000, 10_000, 11_000)).toEqual({ allowed: true, retryAfterMs: 0 })
    expect(decideCrawlDelay(1_000, 10_000, 99_000)).toEqual({ allowed: true, retryAfterMs: 0 })
  })

  it('is a no-op when the domain declares no crawl-delay', () => {
    expect(decideCrawlDelay(1_000, 0, 1_001)).toEqual({ allowed: true, retryAfterMs: 0 })
  })
})

// ── Lua scripts are present (the atomic counterparts of the pure logic) ───────

describe('Lua scripts', () => {
  it('RATE_LIMIT_LUA implements the token bucket', () => {
    expect(RATE_LIMIT_LUA).toContain('tokens')
    expect(RATE_LIMIT_LUA).toContain('PEXPIRE')
  })
  it('ACQUIRE_SLOT_LUA guards the concurrency ceiling', () => {
    expect(ACQUIRE_SLOT_LUA).toContain('INCR')
  })
  it('RELEASE_SLOT_LUA decrements the concurrency counter', () => {
    expect(RELEASE_SLOT_LUA).toContain('DECR')
  })
  it('CRAWL_DELAY_LUA gates on elapsed time and refreshes the timestamp', () => {
    expect(CRAWL_DELAY_LUA).toContain('elapsed')
    expect(CRAWL_DELAY_LUA).toContain('PEXPIRE')
  })
})
