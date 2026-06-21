import { describe, it, expect } from 'vitest'
import { searchRepriceSKUs, filterRepriceSKUs, sortRepriceSKUs } from './reprice-filter'
import type { RepriceSKU, LatestSuggestion } from '@/lib/api'

function sug(p: Partial<LatestSuggestion> = {}): LatestSuggestion {
  return { type: 'RAISE', price_suggestion: 120, confidence: 0.9, created_at: '2026-06-01T00:00:00Z', ...p }
}
function sku(p: Partial<RepriceSKU> = {}): RepriceSKU {
  return {
    id: 's', title: 'Widget', current_price: 100,
    floor_price: null, ceiling_price: null, currency: 'USD',
    auto_reprice_enabled: false, latest_suggestion: null,
    ...p,
  }
}

describe('searchRepriceSKUs', () => {
  const list = [sku({ id: 'a', title: 'Blue Widget' }), sku({ id: 'b', title: 'Red Gadget' })]
  it('blank query returns all', () => {
    expect(searchRepriceSKUs(list, '   ')).toHaveLength(2)
  })
  it('case-insensitive title match', () => {
    expect(searchRepriceSKUs(list, 'widget').map((s) => s.id)).toEqual(['a'])
  })
  it('no match → empty', () => {
    expect(searchRepriceSKUs(list, 'zzz')).toEqual([])
  })
})

describe('filterRepriceSKUs', () => {
  const complete = sku({ id: 'complete', floor_price: 90, ceiling_price: 130, auto_reprice_enabled: true, latest_suggestion: sug() })
  const partial = sku({ id: 'partial', floor_price: 90, auto_reprice_enabled: true, latest_suggestion: sug() })
  const clamp = sku({ id: 'clamp', floor_price: 90, ceiling_price: 110, latest_suggestion: sug({ price_suggestion: 150 }) })
  const list = [complete, partial, clamp]

  it('all → unchanged', () => {
    expect(filterRepriceSKUs(list, 'all')).toHaveLength(3)
  })
  it('needs-guardrails → incomplete only', () => {
    expect(filterRepriceSKUs(list, 'needs-guardrails').map((s) => s.id)).toEqual(['partial', 'clamp'])
  })
  it('auto-on → enabled only', () => {
    expect(filterRepriceSKUs(list, 'auto-on').map((s) => s.id)).toEqual(['complete', 'partial'])
  })
  it('would-clamp → clamped only', () => {
    expect(filterRepriceSKUs(list, 'would-clamp').map((s) => s.id)).toEqual(['clamp'])
  })
  it('needs-attention → actionable & (incomplete or auto-off)', () => {
    expect(filterRepriceSKUs(list, 'needs-attention').map((s) => s.id)).toEqual(['partial', 'clamp'])
  })
})

describe('sortRepriceSKUs', () => {
  it('default returns a new array in original order', () => {
    const list = [sku({ id: 'a' }), sku({ id: 'b' })]
    const out = sortRepriceSKUs(list, 'default')
    expect(out).not.toBe(list)
    expect(out.map((s) => s.id)).toEqual(['a', 'b'])
  })
  it('attention puts needs-attention first, stable within groups', () => {
    const calm = sku({ id: 'calm', floor_price: 90, ceiling_price: 130, auto_reprice_enabled: true, latest_suggestion: sug() })
    const hot = sku({ id: 'hot', floor_price: 90, latest_suggestion: sug() })
    const out = sortRepriceSKUs([calm, hot], 'attention')
    expect(out.map((s) => s.id)).toEqual(['hot', 'calm'])
  })
  it('impact orders by |delta%| desc with no-action last', () => {
    const big = sku({ id: 'big', current_price: 100, floor_price: 90, ceiling_price: 200, latest_suggestion: sug({ price_suggestion: 150 }) })
    const small = sku({ id: 'small', current_price: 100, floor_price: 90, ceiling_price: 200, latest_suggestion: sug({ price_suggestion: 110 }) })
    const none = sku({ id: 'none', latest_suggestion: null })
    const out = sortRepriceSKUs([small, none, big], 'impact')
    expect(out.map((s) => s.id)).toEqual(['big', 'small', 'none'])
  })
})
