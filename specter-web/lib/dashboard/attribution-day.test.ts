import { describe, it, expect } from 'vitest'
import { dayKey, formatDayLabel, changesOnDay } from './attribution-day'
import type { PriceChange } from '@/lib/api'

function pc(p: Partial<PriceChange> = {}): PriceChange {
  return {
    id: 'pc', sku_id: 's', sku_title: 'Widget',
    old_price: 100, new_price: 110, source: 'auto',
    revenue_delta: 10, created_at: '2026-05-28T14:03:00+00:00',
    ...p,
  }
}

describe('dayKey', () => {
  it('returns the UTC date slice', () => {
    expect(dayKey('2026-05-28T14:03:00+00:00')).toBe('2026-05-28')
    expect(dayKey('2026-12-01T00:00:00Z')).toBe('2026-12-01')
  })
})

describe('formatDayLabel', () => {
  it('renders Mon D from YYYY-MM-DD (locale-independent)', () => {
    expect(formatDayLabel('2026-05-28')).toBe('May 28')
    expect(formatDayLabel('2026-01-03')).toBe('Jan 3')
    expect(formatDayLabel('2026-12-31')).toBe('Dec 31')
  })
})

describe('changesOnDay', () => {
  it('keeps only that UTC day, sorted by |delta| desc', () => {
    const list = [
      pc({ id: 'a', created_at: '2026-05-28T01:00:00+00:00', revenue_delta: 50 }),
      pc({ id: 'b', created_at: '2026-05-28T23:00:00+00:00', revenue_delta: -120 }),
      pc({ id: 'c', created_at: '2026-05-29T00:00:00+00:00', revenue_delta: 999 }),
    ]
    expect(changesOnDay(list, '2026-05-28').map((c) => c.id)).toEqual(['b', 'a'])
  })

  it('empty when no change matches', () => {
    expect(changesOnDay([pc({ created_at: '2026-05-29T00:00:00+00:00' })], '2026-05-28')).toEqual([])
  })
})
