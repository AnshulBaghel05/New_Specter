import { describe, it, expect } from 'vitest'
import {
  ProxyManager,
  InMemoryProxyHealthStore,
  CAPTCHA_STATUS,
  type ProxyManagerConfig,
} from '../proxy/manager'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeManager(
  overrides: Partial<ProxyManagerConfig> & {
    datacenterUrls?: string[]
    residentialUrls?: string[]
    clockMs?: number
  } = {},
): { manager: ProxyManager; clock: { now: number } } {
  const clock = { now: overrides.clockMs ?? 0 }
  const manager = new ProxyManager(
    {
      datacenterUrls:  overrides.datacenterUrls  ?? ['dc1', 'dc2', 'dc3'],
      residentialUrls: overrides.residentialUrls ?? ['res1', 'res2'],
      cooldownMs:      overrides.cooldownMs      ?? 60_000,
      stickyWindowMs:  overrides.stickyWindowMs  ?? 30_000,
      banStatuses:     overrides.banStatuses,
      healthyScore:    overrides.healthyScore,
      penaltyPerBan:   overrides.penaltyPerBan,
      recoveryPerOk:   overrides.recoveryPerOk,
    },
    new InMemoryProxyHealthStore(),
    () => clock.now,
  )
  return { manager, clock }
}

// ── round-robin across a multi-IP pool ───────────────────────────────────────

describe('ProxyManager — round-robin', () => {
  it('cycles through all datacenter IPs and then wraps', () => {
    const { manager } = makeManager({ datacenterUrls: ['dc1', 'dc2', 'dc3'] })
    const results = [
      manager.next('datacenter'),
      manager.next('datacenter'),
      manager.next('datacenter'),
      manager.next('datacenter'), // wraps back
    ]
    expect(results[0]).toBe('dc1')
    expect(results[1]).toBe('dc2')
    expect(results[2]).toBe('dc3')
    expect(results[3]).toBe('dc1')
  })

  it('each call returns a value from the pool', () => {
    const { manager } = makeManager({ datacenterUrls: ['a', 'b', 'c'] })
    const pool = new Set(['a', 'b', 'c'])
    for (let i = 0; i < 9; i++) {
      expect(pool.has(manager.next('datacenter'))).toBe(true)
    }
  })
})

// ── reportFailure — cooldown ejects IP from rotation ─────────────────────────

describe('ProxyManager — reportFailure / cooldown', () => {
  it('reportFailure(ip, 403) removes that IP from rotation during cooldown', () => {
    const { manager } = makeManager({ datacenterUrls: ['dc1', 'dc2'] })
    manager.reportFailure('dc1', 403)
    // dc1 is cooling; both calls should return dc2
    expect(manager.next('datacenter')).toBe('dc2')
    expect(manager.next('datacenter')).toBe('dc2')
  })

  it('IP is handed out again after cooldown elapses', () => {
    const { manager, clock } = makeManager({
      datacenterUrls: ['dc1', 'dc2'],
      cooldownMs: 60_000,
    })
    manager.reportFailure('dc1', 403)
    // still cooling
    expect(manager.next('datacenter')).toBe('dc2')

    // advance clock past cooldown
    clock.now = 60_001
    const results = [manager.next('datacenter'), manager.next('datacenter')]
    expect(results).toContain('dc1')
  })

  it('429 also triggers cooldown', () => {
    const { manager } = makeManager({ datacenterUrls: ['dc1', 'dc2'] })
    manager.reportFailure('dc1', 429)
    expect(manager.next('datacenter')).toBe('dc2')
  })

  it('CAPTCHA sentinel (status 0) also triggers cooldown', () => {
    const { manager } = makeManager({ datacenterUrls: ['dc1', 'dc2'] })
    manager.reportFailure('dc1', CAPTCHA_STATUS)
    expect(manager.next('datacenter')).toBe('dc2')
  })
})

// ── reportSuccess — restores a cooled-down IP ─────────────────────────────────

describe('ProxyManager — reportSuccess', () => {
  it('reportSuccess clears cooldown so the IP re-enters rotation immediately', () => {
    const { manager } = makeManager({ datacenterUrls: ['dc1', 'dc2'] })
    manager.reportFailure('dc1', 403)
    // still cooling before success
    expect(manager.next('datacenter')).toBe('dc2')

    manager.reportSuccess('dc1')
    // now dc1 should be back — cycle should include it
    const seen = new Set<string>()
    for (let i = 0; i < 4; i++) seen.add(manager.next('datacenter'))
    expect(seen.has('dc1')).toBe(true)
  })

  it('reportSuccess on a non-cooled IP raises score without throwing', () => {
    const { manager } = makeManager({ datacenterUrls: ['dc1'] })
    expect(() => manager.reportSuccess('dc1')).not.toThrow()
  })
})

// ── failover when all datacenter IPs are cooling ─────────────────────────────

describe('ProxyManager — provider failover', () => {
  it('fails over to residential when all datacenter IPs are cooling', () => {
    const { manager } = makeManager({
      datacenterUrls: ['dc1', 'dc2'],
      residentialUrls: ['res1'],
    })
    manager.reportFailure('dc1', 403)
    manager.reportFailure('dc2', 403)
    const proxy = manager.next('datacenter')
    expect(proxy).toBe('res1')
  })

  it('fails over to datacenter when all residential IPs are cooling', () => {
    const { manager } = makeManager({
      datacenterUrls: ['dc1'],
      residentialUrls: ['res1', 'res2'],
    })
    manager.reportFailure('res1', 403)
    manager.reportFailure('res2', 403)
    const proxy = manager.next('residential')
    expect(proxy).toBe('dc1')
  })

  it('throws when no healthy proxy exists in either tier', () => {
    const { manager } = makeManager({
      datacenterUrls: ['dc1'],
      residentialUrls: ['res1'],
    })
    manager.reportFailure('dc1', 403)
    manager.reportFailure('res1', 403)
    expect(() => manager.next('datacenter')).toThrow(/no healthy proxy/i)
  })
})

// ── sticky sessions ───────────────────────────────────────────────────────────

describe('ProxyManager — sticky sessions', () => {
  it('two next() calls for the same domain within the window return the same IP', () => {
    const { manager } = makeManager({
      datacenterUrls: ['dc1', 'dc2', 'dc3'],
      stickyWindowMs: 30_000,
    })
    const first  = manager.next('datacenter', 'shop.example.com')
    const second = manager.next('datacenter', 'shop.example.com')
    expect(second).toBe(first)
  })

  it('different domains are sticky to different IPs (independent)', () => {
    const { manager } = makeManager({
      datacenterUrls: ['dc1', 'dc2'],
      stickyWindowMs: 30_000,
    })
    // pin both domains
    const a1 = manager.next('datacenter', 'shop-a.com')
    const b1 = manager.next('datacenter', 'shop-b.com')
    // they may or may not be the same IP depending on round-robin position,
    // but each domain is consistently sticky
    expect(manager.next('datacenter', 'shop-a.com')).toBe(a1)
    expect(manager.next('datacenter', 'shop-b.com')).toBe(b1)
  })

  it('sticky assignment expires after the window elapses', () => {
    const { manager, clock } = makeManager({
      datacenterUrls: ['dc1', 'dc2', 'dc3'],
      stickyWindowMs: 30_000,
      cooldownMs: 60_000,
    })
    const first = manager.next('datacenter', 'shop.example.com')
    // within window — same
    clock.now = 29_999
    expect(manager.next('datacenter', 'shop.example.com')).toBe(first)

    // advance clock past sticky window
    clock.now = 30_001
    // Next call re-assigns; we just verify it doesn't throw and returns a valid IP
    const after = manager.next('datacenter', 'shop.example.com')
    expect(['dc1', 'dc2', 'dc3']).toContain(after)
  })

  it('sticky breaks if the pinned IP starts cooling — returns a different healthy IP', () => {
    const { manager } = makeManager({
      datacenterUrls: ['dc1', 'dc2', 'dc3'],
      stickyWindowMs: 30_000,
    })
    // Pin shop.example.com to whatever IP comes first (dc1 in fresh round-robin)
    const first = manager.next('datacenter', 'shop.example.com')
    // Now ban that IP
    manager.reportFailure(first, 403)
    // Next sticky call for the same domain must return a DIFFERENT healthy IP
    const fallback = manager.next('datacenter', 'shop.example.com')
    expect(fallback).not.toBe(first)
    expect(['dc1', 'dc2', 'dc3']).toContain(fallback)
  })
})

// ── reportResult unified entry-point ─────────────────────────────────────────

describe('ProxyManager — reportResult', () => {
  it('success status delegates to reportSuccess', () => {
    const { manager } = makeManager({ datacenterUrls: ['dc1', 'dc2'] })
    manager.reportFailure('dc1', 403)
    // still cooling
    expect(manager.next('datacenter')).toBe('dc2')
    // unified: 200 → success → clears cooldown
    manager.reportResult('dc1', 200)
    const seen = new Set<string>()
    for (let i = 0; i < 4; i++) seen.add(manager.next('datacenter'))
    expect(seen.has('dc1')).toBe(true)
  })

  it('ban status delegates to reportFailure', () => {
    const { manager } = makeManager({ datacenterUrls: ['dc1', 'dc2'] })
    manager.reportResult('dc1', 403)
    // dc1 should be cooling now
    expect(manager.next('datacenter')).toBe('dc2')
  })
})
