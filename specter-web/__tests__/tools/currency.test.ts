import { describe, it, expect } from 'vitest'
import { toUSD, fromUSD, fmt, EXCHANGE_RATES, CURRENCIES } from '@/lib/tools/currency'

describe('CURRENCIES', () => {
  it('contains 10 currencies', () => {
    expect(CURRENCIES).toHaveLength(10)
  })
  it('every currency has code, symbol, name', () => {
    CURRENCIES.forEach((c) => {
      expect(c.code).toBeTruthy()
      expect(c.symbol).toBeTruthy()
      expect(c.name).toBeTruthy()
    })
  })
})

describe('toUSD', () => {
  it('returns same amount for USD', () => {
    expect(toUSD(100, 'USD')).toBe(100)
  })
  it('converts EUR to USD: 92 EUR / 0.92 = 100 USD', () => {
    expect(toUSD(92, 'EUR')).toBeCloseTo(100, 1)
  })
  it('converts GBP to USD: 79 GBP / 0.79 = 100 USD', () => {
    expect(toUSD(79, 'GBP')).toBeCloseTo(100, 1)
  })
  it('defaults to rate 1 for unknown currency code', () => {
    expect(toUSD(100, 'ZZZ')).toBe(100)
  })
  it('handles zero', () => {
    expect(toUSD(0, 'EUR')).toBe(0)
  })
})

describe('fromUSD', () => {
  it('returns same amount for USD', () => {
    expect(fromUSD(100, 'USD')).toBe(100)
  })
  it('converts USD to EUR: 100 USD × 0.92 = 92 EUR', () => {
    expect(fromUSD(100, 'EUR')).toBeCloseTo(92, 1)
  })
  it('round-trips toUSD → fromUSD with no loss', () => {
    expect(fromUSD(toUSD(50, 'GBP'), 'GBP')).toBeCloseTo(50, 5)
  })
  it('round-trips toUSD → fromUSD for INR', () => {
    expect(fromUSD(toUSD(1000, 'INR'), 'INR')).toBeCloseTo(1000, 3)
  })
})

describe('fmt', () => {
  it('formats USD with $ and 2 decimal places', () => {
    expect(fmt(12.5, 'USD')).toBe('$12.50')
  })
  it('formats negative USD correctly', () => {
    expect(fmt(-5, 'USD')).toContain('5.00')
  })
  it('formats JPY with no decimal places', () => {
    const result = fmt(1234, 'JPY')
    expect(result).toContain('1,234')
    expect(result).not.toContain('.')
  })
  it('formats EUR with € symbol', () => {
    expect(fmt(10, 'EUR')).toContain('€')
  })
})

describe('EXCHANGE_RATES', () => {
  it('USD rate is exactly 1', () => {
    expect(EXCHANGE_RATES['USD']).toBe(1)
  })
  it('all CURRENCIES have a rate', () => {
    CURRENCIES.forEach((c) => {
      expect(EXCHANGE_RATES[c.code]).toBeDefined()
    })
  })
})
