import { describe, it, expect } from 'vitest'
import { chooseCheckoutMode, buildSuccessPath } from './checkout'

describe('chooseCheckoutMode', () => {
  it('uses embedded when key present and script loaded', () => {
    expect(chooseCheckoutMode({ keyId: 'rzp_test', scriptLoaded: true, shortUrl: 'https://x' }))
      .toBe('embedded')
  })
  it('falls back to hosted when key missing', () => {
    expect(chooseCheckoutMode({ keyId: '', scriptLoaded: true, shortUrl: 'https://x' }))
      .toBe('hosted')
  })
  it('falls back to hosted when script failed to load', () => {
    expect(chooseCheckoutMode({ keyId: 'rzp_test', scriptLoaded: false, shortUrl: 'https://x' }))
      .toBe('hosted')
  })
  it('returns none when neither embedded is possible nor a short_url exists', () => {
    expect(chooseCheckoutMode({ keyId: '', scriptLoaded: false, shortUrl: null }))
      .toBe('none')
  })
})

describe('buildSuccessPath', () => {
  it('returns the bare path when no plan is given', () => {
    expect(buildSuccessPath()).toBe('/billing/success')
    expect(buildSuccessPath(null)).toBe('/billing/success')
  })
  it('tags the plan (lowercased) as a query param', () => {
    expect(buildSuccessPath('cipher')).toBe('/billing/success?plan=cipher')
    expect(buildSuccessPath('CIPHER')).toBe('/billing/success?plan=cipher')
  })
})
