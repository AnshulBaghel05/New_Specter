import { describe, it, expect } from 'vitest'
import { changeLogSummary } from './change-log-summary'
import type { PriceChange } from '@/lib/api'

function change(p: Partial<PriceChange> = {}): PriceChange {
  return {
    id: 'c', sku_id: 's', sku_title: 'Widget',
    old_price: 100, new_price: 110, source: 'signal',
    revenue_delta: null, created_at: '2026-06-01T00:00:00Z',
    ...p,
  }
}

describe('changeLogSummary', () => {
  it('empty → count 0, null net', () => {
    expect(changeLogSummary([])).toEqual({ count: 0, netRevenueDelta: null })
  })
  it('all null deltas → count N, null net', () => {
    expect(changeLogSummary([change(), change()])).toEqual({ count: 2, netRevenueDelta: null })
  })
  it('sums non-null deltas', () => {
    const out = changeLogSummary([change({ revenue_delta: 12.5 }), change({ revenue_delta: -2.5 }), change({ revenue_delta: null })])
    expect(out.count).toBe(3)
    expect(out.netRevenueDelta).toBeCloseTo(10)
  })
})
