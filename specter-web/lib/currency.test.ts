import { describe, it, expect } from 'vitest'
import { formatMoney, currencySymbol, DEFAULT_CURRENCY } from './currency'

describe('currencySymbol', () => {
  it('maps known codes to their symbol, case-insensitively', () => {
    expect(currencySymbol('USD')).toBe('$')
    expect(currencySymbol('eur')).toBe('€')
    expect(currencySymbol('GBP')).toBe('£')
  })

  it('falls back to the upper-cased code for unknown currencies', () => {
    expect(currencySymbol('ZZZ')).toBe('ZZZ')
  })

  it('defaults to $ when no code is given', () => {
    expect(currencySymbol(null)).toBe('$')
    expect(currencySymbol(undefined)).toBe('$')
  })
})

describe('formatMoney', () => {
  it('returns an em dash for null/empty/non-finite amounts', () => {
    expect(formatMoney(null, 'USD')).toBe('—')
    expect(formatMoney('', 'USD')).toBe('—')
    expect(formatMoney(Number.NaN, 'USD')).toBe('—')
  })

  it('formats USD with two decimals and a dollar sign', () => {
    expect(formatMoney(89.99, 'USD')).toBe('$89.99')
  })

  it('accepts numeric strings (API sends Decimal as string)', () => {
    expect(formatMoney('120.5', 'USD')).toBe('$120.50')
  })

  it('uses per-currency decimal rules (JPY has none)', () => {
    // Intl renders JPY without fraction digits; assert no decimal point.
    expect(formatMoney(1500, 'JPY')).not.toContain('.')
  })

  it('still renders a well-formed but unlisted ISO code via Intl', () => {
    const out = formatMoney(10, 'ZZZ')
    expect(out).toContain('ZZZ')
    expect(out).toContain('10.00')
  })

  it('falls back to symbol + fixed-2 when Intl rejects a malformed code', () => {
    // "US" is not a valid 3-letter currency code — Intl throws, so we fall back.
    expect(formatMoney(10, 'US')).toBe('US10.00')
  })

  it('defaults to the default currency when code is missing', () => {
    expect(formatMoney(5, null)).toBe(formatMoney(5, DEFAULT_CURRENCY))
  })
})
