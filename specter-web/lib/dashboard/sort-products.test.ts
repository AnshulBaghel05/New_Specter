import { describe, it, expect } from 'vitest'
import { sortProducts } from './sort-products'
import type { Product } from '@/lib/api'

const p = (id: string, type: 'RAISE'|'LOWER'|'HOLD'|null, conf = 0.5): Product => ({
  id, title: id, handle: null, current_price: 1, source: 'manual', active: true,
  floor_price: null, ceiling_price: null, competitor_count: 0, competitors: [],
  latest_signal: type ? { type, price_suggestion: null, confidence: conf, created_at: '2026-05-31T00:00:00Z' } : null,
})

describe('sortProducts signals-first', () => {
  it('orders RAISE, LOWER, HOLD, then no-signal; ties by confidence desc', () => {
    const out = sortProducts([p('hold','HOLD'), p('none',null), p('raiseLo','RAISE',0.4), p('lower','LOWER'), p('raiseHi','RAISE',0.9)], 'signals')
    expect(out.map(x => x.id)).toEqual(['raiseHi','raiseLo','lower','hold','none'])
  })

  it('does not mutate the input array', () => {
    const input = [p('b','LOWER'), p('a','RAISE')]
    const before = input.map(x => x.id)
    sortProducts(input, 'signals')
    expect(input.map(x => x.id)).toEqual(before)
  })
})

describe('sortProducts name + updated', () => {
  it('name mode sorts by title ascending', () => {
    const out = sortProducts([p('charlie',null), p('alpha',null), p('bravo',null)], 'name')
    expect(out.map(x => x.id)).toEqual(['alpha','bravo','charlie'])
  })

  it('updated mode sorts by signal created_at descending, no-signal last', () => {
    const old = { ...p('old','HOLD'), latest_signal: { type: 'HOLD' as const, price_suggestion: null, confidence: 0.5, created_at: '2026-01-01T00:00:00Z' } }
    const recent = { ...p('recent','HOLD'), latest_signal: { type: 'HOLD' as const, price_suggestion: null, confidence: 0.5, created_at: '2026-05-31T00:00:00Z' } }
    const none = p('none', null)
    const out = sortProducts([old, none, recent], 'updated')
    expect(out.map(x => x.id)).toEqual(['recent','old','none'])
  })
})
