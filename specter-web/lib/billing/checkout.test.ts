import { describe, it, expect } from 'vitest'
import { chooseCheckoutMode } from './checkout'

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
