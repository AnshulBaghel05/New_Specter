import { describe, it, expect } from 'vitest'
import {
  attributionAccountedChanges,
  skuBreakdown,
  sortSkuBreakdown,
  totalChangeCount,
  isBreakdownPartial,
  formatSignedUsd,
  type SkuBreakdown,
} from './attribution-breakdown'
import type { PriceChange } from '@/lib/api'

const NOW = Date.UTC(2026, 5, 3, 12, 0, 0) // 2026-06-03T12:00:00Z

function pc(p: Partial<PriceChange> = {}): PriceChange {
  return {
    id: 'pc',
    sku_id: 's1',
    sku_title: 'Widget',
    old_price: 100,
    new_price: 110,
    source: 'auto',
    revenue_delta: 10,
    created_at: '2026-06-03T00:00:00+00:00',
    ...p,
  }
}

function row(p: Partial<SkuBreakdown> = {}): SkuBreakdown {
  return { sku_id: 's', sku_title: 'A', recovered: 0, lost: 0, net: 0, count: 0, ...p }
}

describe('attributionAccountedChanges', () => {
  it('keeps only auto, non-null delta, within range', () => {
    const list = [
      pc({ id: 'a', source: 'auto', revenue_delta: 5 }),
      pc({ id: 'b', source: 'manual', revenue_delta: 5 }),
      pc({ id: 'c', source: 'auto', revenue_delta: null }),
      pc({ id: 'd', source: 'auto', revenue_delta: 5, created_at: '2026-04-01T00:00:00+00:00' }),
    ]
    const out = attributionAccountedChanges(list, 30, NOW)
    expect(out.map((c) => c.id)).toEqual(['a'])
  })

  it('includes a change exactly at the cutoff boundary', () => {
    const cutoffIso = new Date(NOW - 7 * 86_400_000).toISOString()
    const out = attributionAccountedChanges([pc({ id: 'edge', created_at: cutoffIso })], 7, NOW)
    expect(out.map((c) => c.id)).toEqual(['edge'])
  })
})

describe('skuBreakdown', () => {
  it('groups by sku, splitting recovered vs lost and summing net + count', () => {
    const out = skuBreakdown([
      pc({ sku_id: 's1', sku_title: 'Widget', revenue_delta: 20 }),
      pc({ sku_id: 's1', sku_title: 'Widget', revenue_delta: -5 }),
      pc({ sku_id: 's2', sku_title: 'Gadget', revenue_delta: 8 }),
    ])
    const widget = out.find((r) => r.sku_id === 's1')!
    expect(widget).toMatchObject({ recovered: 20, lost: -5, net: 15, count: 2 })
    const gadget = out.find((r) => r.sku_id === 's2')!
    expect(gadget).toMatchObject({ recovered: 8, lost: 0, net: 8, count: 1 })
  })

  it('rounds to cents (no float drift)', () => {
    const out = skuBreakdown([
      pc({ revenue_delta: 0.1 }),
      pc({ revenue_delta: 0.2 }),
    ])
    expect(out[0].net).toBe(0.3)
  })
})

describe('sortSkuBreakdown', () => {
  it('net: net desc, then recovered desc, then title asc', () => {
    const rows = [
      row({ sku_id: 'a', sku_title: 'Beta', net: 10, recovered: 10 }),
      row({ sku_id: 'b', sku_title: 'Alpha', net: 10, recovered: 10 }),
      row({ sku_id: 'c', sku_title: 'Gamma', net: 10, recovered: 20 }),
      row({ sku_id: 'd', sku_title: 'Delta', net: 5, recovered: 5 }),
    ]
    expect(sortSkuBreakdown(rows, 'net').map((r) => r.sku_id)).toEqual(['c', 'b', 'a', 'd'])
  })

  it('lost: most-negative first, then net asc, then title asc', () => {
    const rows = [
      row({ sku_id: 'a', sku_title: 'Beta', lost: -5, net: -5 }),
      row({ sku_id: 'b', sku_title: 'Alpha', lost: -20, net: -20 }),
      row({ sku_id: 'c', sku_title: 'Gamma', lost: -20, net: -10 }),
    ]
    expect(sortSkuBreakdown(rows, 'lost').map((r) => r.sku_id)).toEqual(['b', 'c', 'a'])
  })

  it('count: count desc, then net desc, then title asc', () => {
    const rows = [
      row({ sku_id: 'a', sku_title: 'Beta', count: 3, net: 1 }),
      row({ sku_id: 'b', sku_title: 'Alpha', count: 3, net: 9 }),
      row({ sku_id: 'c', sku_title: 'Gamma', count: 1, net: 50 }),
    ]
    expect(sortSkuBreakdown(rows, 'count').map((r) => r.sku_id)).toEqual(['b', 'a', 'c'])
  })

  it('recovered: recovered desc, then net desc, then title asc', () => {
    const rows = [
      row({ sku_id: 'a', sku_title: 'Beta', recovered: 10, net: 2 }),
      row({ sku_id: 'b', sku_title: 'Alpha', recovered: 10, net: 8 }),
    ]
    expect(sortSkuBreakdown(rows, 'recovered').map((r) => r.sku_id)).toEqual(['b', 'a'])
  })

  it('does not mutate the input array', () => {
    const rows = [row({ sku_id: 'a', net: 1 }), row({ sku_id: 'b', net: 2 })]
    sortSkuBreakdown(rows, 'net')
    expect(rows.map((r) => r.sku_id)).toEqual(['a', 'b'])
  })
})

describe('totalChangeCount', () => {
  it('sums counts across rows', () => {
    expect(totalChangeCount([row({ count: 3 }), row({ count: 4 })])).toBe(7)
  })
})

describe('isBreakdownPartial', () => {
  it('true only at exactly 100', () => {
    expect(isBreakdownPartial(99)).toBe(false)
    expect(isBreakdownPartial(100)).toBe(true)
  })
})

describe('formatSignedUsd', () => {
  it('positive gets +$, negative gets unicode minus', () => {
    expect(formatSignedUsd(420)).toBe('+$420.00')
    expect(formatSignedUsd(-210.5)).toBe('−$210.50')
    expect(formatSignedUsd(0)).toBe('+$0.00')
  })
})
