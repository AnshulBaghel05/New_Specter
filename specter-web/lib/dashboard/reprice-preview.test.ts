import { describe, it, expect } from 'vitest'
import { repricePreview } from './reprice-preview'
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

describe('repricePreview', () => {
  it('no suggestion → no-action', () => {
    expect(repricePreview(sku({ latest_suggestion: null }))).toEqual({ state: 'no-action', effectivePrice: null })
  })

  it('HOLD → no-action', () => {
    expect(repricePreview(sku({ latest_suggestion: sug({ type: 'HOLD' }) }))).toEqual({ state: 'no-action', effectivePrice: null })
  })

  it('null price_suggestion → no-action', () => {
    expect(repricePreview(sku({ latest_suggestion: sug({ price_suggestion: null }) }))).toEqual({ state: 'no-action', effectivePrice: null })
  })

  it('actionable but no bounds → no-guardrails, effective = suggestion', () => {
    expect(repricePreview(sku({ latest_suggestion: sug({ price_suggestion: 120 }) }))).toEqual({ state: 'no-guardrails', effectivePrice: 120 })
  })

  it('suggestion below floor → floor-clamped', () => {
    const s = sku({ floor_price: 90, ceiling_price: 130, latest_suggestion: sug({ type: 'LOWER', price_suggestion: 80 }) })
    expect(repricePreview(s)).toEqual({ state: 'floor-clamped', effectivePrice: 90 })
  })

  it('suggestion above ceiling → ceiling-clamped', () => {
    const s = sku({ floor_price: 90, ceiling_price: 130, latest_suggestion: sug({ price_suggestion: 150 }) })
    expect(repricePreview(s)).toEqual({ state: 'ceiling-clamped', effectivePrice: 130 })
  })

  it('suggestion within both bounds → within', () => {
    const s = sku({ floor_price: 90, ceiling_price: 130, latest_suggestion: sug({ price_suggestion: 120 }) })
    expect(repricePreview(s)).toEqual({ state: 'within', effectivePrice: 120 })
  })

  it('only floor set, suggestion above it → within', () => {
    const s = sku({ floor_price: 90, ceiling_price: null, latest_suggestion: sug({ price_suggestion: 120 }) })
    expect(repricePreview(s)).toEqual({ state: 'within', effectivePrice: 120 })
  })

  it('only ceiling set, suggestion below it → within', () => {
    const s = sku({ floor_price: null, ceiling_price: 130, latest_suggestion: sug({ price_suggestion: 120 }) })
    expect(repricePreview(s)).toEqual({ state: 'within', effectivePrice: 120 })
  })
})
