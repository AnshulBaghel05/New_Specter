import { describe, it, expect } from 'vitest'
import {
  OOS_URGENT_HOURS,
  oosDurationMs,
  formatOosDuration,
  isUrgentOOS,
  sortAlerts,
  alertCounts,
} from './alert-helpers'
import type { OOSAlert } from '@/lib/api'

function alert(p: Partial<OOSAlert>): OOSAlert {
  return {
    id: 'a',
    competitor_tracking_id: 'ct',
    sku_id: 's',
    sku_title: 't',
    competitor_domain: 'b.com',
    competitor_url: 'https://b.com/p',
    detected_at: '2026-06-01T00:00:00Z',
    resolved_at: null,
    notified_at: null,
    silenced: false,
    status: 'active',
    ...p,
  }
}

const now = new Date('2026-06-01T05:00:00Z')

describe('oosDurationMs', () => {
  it('active: now minus detected', () => {
    expect(oosDurationMs(alert({}), now)).toBe(5 * 3_600_000)
  })
  it('resolved: resolved minus detected', () => {
    const a = alert({ status: 'resolved', resolved_at: '2026-06-01T02:00:00Z' })
    expect(oosDurationMs(a, now)).toBe(2 * 3_600_000)
  })
})

describe('formatOosDuration', () => {
  it('formats days, hours, minutes with the largest unit', () => {
    expect(formatOosDuration(3 * 86_400_000)).toBe('3d')
    expect(formatOosDuration(5 * 3_600_000)).toBe('5h')
    expect(formatOosDuration(12 * 60_000)).toBe('12m')
  })
  it('clamps sub-minute durations to 1m', () => {
    expect(formatOosDuration(10_000)).toBe('1m')
  })
})

describe('isUrgentOOS', () => {
  it('is true for active alerts older than 24h', () => {
    const a = alert({ detected_at: '2026-05-30T00:00:00Z' })
    expect(isUrgentOOS(a, now)).toBe(true)
  })
  it('is false for active alerts within 24h', () => {
    expect(isUrgentOOS(alert({}), now)).toBe(false)
  })
  it('is false for resolved alerts regardless of duration', () => {
    const a = alert({ status: 'resolved', detected_at: '2026-05-20T00:00:00Z', resolved_at: '2026-05-31T00:00:00Z' })
    expect(isUrgentOOS(a, now)).toBe(false)
  })
  it('exposes the 24h threshold constant', () => {
    expect(OOS_URGENT_HOURS).toBe(24)
  })
})

describe('sortAlerts', () => {
  const a1 = alert({ id: 'a1', detected_at: '2026-06-01T03:00:00Z', competitor_domain: 'zeta.com' })
  const a2 = alert({ id: 'a2', detected_at: '2026-06-01T01:00:00Z', competitor_domain: 'alpha.com' })

  it('recent: newest detected first', () => {
    expect(sortAlerts([a2, a1], 'recent').map((a) => a.id)).toEqual(['a1', 'a2'])
  })
  it('oldest: oldest detected first', () => {
    expect(sortAlerts([a1, a2], 'oldest').map((a) => a.id)).toEqual(['a2', 'a1'])
  })
  it('domain: alphabetical by competitor_domain', () => {
    expect(sortAlerts([a1, a2], 'domain').map((a) => a.id)).toEqual(['a2', 'a1'])
  })
  it('does not mutate the input array', () => {
    const input = [a2, a1]
    sortAlerts(input, 'recent')
    expect(input.map((a) => a.id)).toEqual(['a2', 'a1'])
  })
})

describe('alertCounts', () => {
  it('counts active and resolved', () => {
    const counts = alertCounts([
      alert({ status: 'active' }),
      alert({ status: 'active' }),
      alert({ status: 'resolved', resolved_at: '2026-06-01T02:00:00Z' }),
    ])
    expect(counts).toEqual({ active: 2, resolved: 1 })
  })
})
