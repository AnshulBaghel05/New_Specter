import { describe, it, expect } from 'vitest'
import { groupSignalsByDay } from './group-signals'
import type { Signal } from '@/lib/api'

function sig(id: string, created_at: string): Signal {
  return {
    id,
    sku_id: 's',
    sku_title: 't',
    type: 'HOLD',
    confidence: 0.6,
    reasoning: null,
    price_suggestion: null,
    current_price: null,
    source: 'rule',
    ai_fallback: false,
    created_at,
  }
}

describe('groupSignalsByDay', () => {
  const now = new Date('2026-06-02T12:00:00')

  it('buckets into Today, Yesterday, Earlier and drops empty groups', () => {
    const groups = groupSignalsByDay(
      [
        sig('a', '2026-06-02T09:00:00'),
        sig('b', '2026-06-01T23:00:00'),
        sig('c', '2026-05-20T10:00:00'),
      ],
      now,
    )
    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday', 'Earlier'])
    expect(groups[0].items.map((s) => s.id)).toEqual(['a'])
    expect(groups[1].items.map((s) => s.id)).toEqual(['b'])
    expect(groups[2].items.map((s) => s.id)).toEqual(['c'])
  })

  it('omits groups that have no items', () => {
    const groups = groupSignalsByDay([sig('a', '2026-06-02T01:00:00')], now)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Today')
  })

  it('preserves input order within a group', () => {
    const groups = groupSignalsByDay(
      [sig('a', '2026-06-02T08:00:00'), sig('b', '2026-06-02T11:00:00')],
      now,
    )
    expect(groups[0].items.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('returns an empty array for no signals', () => {
    expect(groupSignalsByDay([], now)).toEqual([])
  })
})
