import { describe, it, expect } from 'vitest'
import { repricePrefill, formatLandingToast } from './reprice-prefill'
import type { RepriceSKU } from '@/lib/api'

function makeSku(overrides: Partial<RepriceSKU>): RepriceSKU {
  return {
    id: 'sku_1',
    title: 'Wireless Earbuds',
    current_price: 39.99,
    floor_price: null,
    ceiling_price: null,
    auto_reprice_enabled: false,
    latest_suggestion: null,
    ...overrides,
  }
}

describe('repricePrefill', () => {
  it('RAISE -> ceiling with the suggested price', () => {
    expect(
      repricePrefill(makeSku({ latest_suggestion: { type: 'RAISE', price_suggestion: 42, confidence: 0.9, created_at: '' } })),
    ).toEqual({ bound: 'ceiling', value: '42.00' })
  })
  it('LOWER -> floor with the suggested price', () => {
    expect(
      repricePrefill(makeSku({ latest_suggestion: { type: 'LOWER', price_suggestion: 33.5, confidence: 0.9, created_at: '' } })),
    ).toEqual({ bound: 'floor', value: '33.50' })
  })
  it('HOLD -> no prefill', () => {
    expect(
      repricePrefill(makeSku({ latest_suggestion: { type: 'HOLD', price_suggestion: 40, confidence: 0.9, created_at: '' } })),
    ).toEqual({ bound: null, value: null })
  })
  it('no suggestion -> no prefill', () => {
    expect(repricePrefill(makeSku({ latest_suggestion: null }))).toEqual({ bound: null, value: null })
  })
  it('null price_suggestion -> no prefill', () => {
    expect(
      repricePrefill(makeSku({ latest_suggestion: { type: 'RAISE', price_suggestion: null, confidence: 0.9, created_at: '' } })),
    ).toEqual({ bound: null, value: null })
  })
})

describe('formatLandingToast', () => {
  it('includes the suggested ceiling for a RAISE', () => {
    expect(
      formatLandingToast(makeSku({ latest_suggestion: { type: 'RAISE', price_suggestion: 42, confidence: 0.9, created_at: '' } })),
    ).toEqual({ title: 'Reviewing Wireless Earbuds', description: 'Suggested ceiling: $42.00' })
  })
  it('includes the suggested floor for a LOWER', () => {
    expect(
      formatLandingToast(makeSku({ latest_suggestion: { type: 'LOWER', price_suggestion: 33.5, confidence: 0.9, created_at: '' } })),
    ).toEqual({ title: 'Reviewing Wireless Earbuds', description: 'Suggested floor: $33.50' })
  })
  it('omits description when there is no actionable suggestion', () => {
    expect(formatLandingToast(makeSku({ latest_suggestion: null }))).toEqual({ title: 'Reviewing Wireless Earbuds' })
  })
})
