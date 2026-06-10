import { describe, it, expect } from 'vitest'
import { guardrailStatus, needsAttention, coverageSummary } from './guardrail-coverage'
import type { RepriceSKU, LatestSuggestion } from '@/lib/api'

function sug(p: Partial<LatestSuggestion> = {}): LatestSuggestion {
  return { type: 'RAISE', price_suggestion: 120, confidence: 0.9, created_at: '2026-06-01T00:00:00Z', ...p }
}
function sku(p: Partial<RepriceSKU> = {}): RepriceSKU {
  return {
    id: 's', title: 'Widget', current_price: 100,
    floor_price: null, ceiling_price: null,
    auto_reprice_enabled: false, latest_suggestion: null,
    ...p,
  }
}

describe('guardrailStatus', () => {
  it('both bounds → complete', () => {
    expect(guardrailStatus(sku({ floor_price: 90, ceiling_price: 130 }))).toBe('complete')
  })
  it('one bound → partial', () => {
    expect(guardrailStatus(sku({ floor_price: 90 }))).toBe('partial')
    expect(guardrailStatus(sku({ ceiling_price: 130 }))).toBe('partial')
  })
  it('no bounds → none', () => {
    expect(guardrailStatus(sku())).toBe('none')
  })
})

describe('needsAttention', () => {
  it('actionable + incomplete guardrails → true', () => {
    expect(needsAttention(sku({ floor_price: 90, latest_suggestion: sug() }))).toBe(true)
  })
  it('actionable + complete + auto on → false', () => {
    expect(needsAttention(sku({ floor_price: 90, ceiling_price: 130, auto_reprice_enabled: true, latest_suggestion: sug() }))).toBe(false)
  })
  it('actionable + complete + auto OFF → true', () => {
    expect(needsAttention(sku({ floor_price: 90, ceiling_price: 130, auto_reprice_enabled: false, latest_suggestion: sug() }))).toBe(true)
  })
  it('HOLD suggestion → false', () => {
    expect(needsAttention(sku({ latest_suggestion: sug({ type: 'HOLD' }) }))).toBe(false)
  })
  it('no suggestion → false', () => {
    expect(needsAttention(sku({ floor_price: 90 }))).toBe(false)
  })
})

describe('coverageSummary', () => {
  it('aggregates the list', () => {
    const skus = [
      sku({ floor_price: 90, ceiling_price: 130, auto_reprice_enabled: true, latest_suggestion: sug() }),
      sku({ floor_price: 90, auto_reprice_enabled: true, latest_suggestion: sug() }),
      sku({ auto_reprice_enabled: false }),
    ]
    expect(coverageSummary(skus)).toEqual({ total: 3, withGuardrails: 1, autoOn: 2, needsAttention: 1 })
  })
  it('empty list', () => {
    expect(coverageSummary([])).toEqual({ total: 0, withGuardrails: 0, autoOn: 0, needsAttention: 0 })
  })
})
