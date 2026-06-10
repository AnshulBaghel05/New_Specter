import { describe, it, expect } from 'vitest'
import { repricingHref } from './deep-links'

describe('repricingHref', () => {
  it('builds a sku-only href when no source given', () => {
    expect(repricingHref('sku_123')).toBe('/repricing?sku=sku_123')
  })

  it('appends the source when provided', () => {
    expect(repricingHref('sku_123', 'signals')).toBe('/repricing?sku=sku_123&source=signals')
  })

  it('url-encodes the sku id', () => {
    expect(repricingHref('a b/c')).toBe('/repricing?sku=a%20b%2Fc')
  })
})
