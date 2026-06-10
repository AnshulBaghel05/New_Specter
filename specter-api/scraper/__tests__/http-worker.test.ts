import { describe, it, expect } from 'vitest'
import { parseHtml, normaliseCurrency } from '../domains/generic'
import { validateParseResult } from '../workers/validate'

// ── normaliseCurrency ────────────────────────────────────────────────────────

describe('normaliseCurrency', () => {
  it('maps ₹ to INR', () => expect(normaliseCurrency('₹')).toBe('INR'))
  it('maps Rs. to INR', () => expect(normaliseCurrency('Rs.')).toBe('INR'))
  it('maps £ to GBP', () => expect(normaliseCurrency('£')).toBe('GBP'))
  it('maps € to EUR', () => expect(normaliseCurrency('€')).toBe('EUR'))
  it('maps $ to USD', () => expect(normaliseCurrency('$')).toBe('USD'))
  it('passes through uppercase ISO codes unchanged', () => {
    expect(normaliseCurrency('EUR')).toBe('EUR')
    expect(normaliseCurrency('CAD')).toBe('CAD')
    expect(normaliseCurrency('JPY')).toBe('JPY')
  })
  it('upper-cases unknown codes', () => expect(normaliseCurrency('usd')).toBe('USD'))
  it('defaults to USD for empty string', () => expect(normaliseCurrency('')).toBe('USD'))
})

// ── validateParseResult ──────────────────────────────────────────────────────

describe('validateParseResult — Rule 1 (price > 0 && isFinite)', () => {
  it('rejects null price', () => {
    const r = validateParseResult({ price: null, inStock: true, currency: 'USD', title: null }, null)
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.includes('price invalid'))).toBe(true)
  })
  it('rejects zero price', () => {
    const r = validateParseResult({ price: 0, inStock: true, currency: 'USD', title: null }, null)
    expect(r.valid).toBe(false)
  })
  it('rejects negative price', () => {
    const r = validateParseResult({ price: -5, inStock: true, currency: 'USD', title: null }, null)
    expect(r.valid).toBe(false)
  })
  it('accepts positive price', () => {
    const r = validateParseResult({ price: 29.99, inStock: true, currency: 'USD', title: null }, null)
    expect(r.valid).toBe(true)
  })
})

describe('validateParseResult — Rule 2 (price < 1_000_000)', () => {
  it('rejects price at 1_000_000', () => {
    const r = validateParseResult({ price: 1_000_000, inStock: true, currency: 'USD', title: null }, null)
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.includes('ceiling'))).toBe(true)
  })
  it('accepts price just below ceiling', () => {
    const r = validateParseResult({ price: 999_999.99, inStock: true, currency: 'USD', title: null }, null)
    expect(r.valid).toBe(true)
  })
})

describe('validateParseResult — Rule 4 (inStock strict boolean)', () => {
  it('rejects string "true"', () => {
    // Force a bad type via cast to simulate a runtime type mismatch.
    const bad = { price: 10, inStock: 'true' as unknown as boolean, currency: 'USD', title: null }
    const r = validateParseResult(bad, null)
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.includes('inStock'))).toBe(true)
  })
  it('accepts false', () => {
    const r = validateParseResult({ price: 10, inStock: false, currency: 'USD', title: null }, null)
    expect(r.valid).toBe(true)
  })
})

describe('validateParseResult — Rule 5 (price spike > 90%)', () => {
  it('sets needsReview when price doubles (100% change)', () => {
    const r = validateParseResult(
      { price: 100, inStock: true, currency: 'USD', title: null },
      50,
    )
    expect(r.valid).toBe(true)       // still written
    expect(r.needsReview).toBe(true)
  })
  it('does NOT set needsReview for 89% change', () => {
    const r = validateParseResult(
      { price: 94.5, inStock: true, currency: 'USD', title: null },
      50,
    )
    expect(r.valid).toBe(true)
    expect(r.needsReview).toBe(false)
  })
  it('does NOT set needsReview when previousPrice is null', () => {
    const r = validateParseResult(
      { price: 999, inStock: true, currency: 'USD', title: null },
      null,
    )
    expect(r.needsReview).toBe(false)
  })
  it('sets needsReview for a 91% price drop', () => {
    const r = validateParseResult(
      { price: 9, inStock: true, currency: 'USD', title: null },
      100,
    )
    expect(r.valid).toBe(true)
    expect(r.needsReview).toBe(true)
  })
})

// ── parseHtml — pipeline order ────────────────────────────────────────────────

describe('parseHtml — JSON-LD (heuristic 1)', () => {
  const jsonLdHtml = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Wireless Earbuds X1",
    "offers": {
      "@type": "Offer",
      "price": "89.99",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    }
  }
  </script>
</head>
<body><span class="price">$120.00</span></body>
</html>`

  it('extracts price from JSON-LD, not CSS selector', () => {
    const r = parseHtml(jsonLdHtml)
    expect(r.price).toBe(89.99)
    expect(r.currency).toBe('USD')
    expect(r.inStock).toBe(true)
    expect(r.title).toBe('Wireless Earbuds X1')
  })
})

describe('parseHtml — Open Graph fallback (heuristic 2)', () => {
  const ogHtml = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:price:amount" content="49.95" />
  <meta property="og:price:currency" content="GBP" />
  <meta property="og:title" content="Blue Sneakers" />
</head>
<body></body>
</html>`

  it('extracts price from Open Graph meta when no JSON-LD', () => {
    const r = parseHtml(ogHtml)
    expect(r.price).toBe(49.95)
    expect(r.currency).toBe('GBP')
    expect(r.title).toBe('Blue Sneakers')
  })
})

describe('parseHtml — CSS selector fallback (heuristic 3)', () => {
  it('extracts price from .price element', () => {
    const r = parseHtml('<html><body><span class="price">$29.99</span></body></html>')
    expect(r.price).toBe(29.99)
  })
  it('extracts price from #price element', () => {
    const r = parseHtml('<html><body><span id="price">€14.50</span></body></html>')
    expect(r.price).toBe(14.50)
  })
  it('extracts price from [data-price] attribute', () => {
    const r = parseHtml('<html><body><div data-price="199.00">Product</div></body></html>')
    expect(r.price).toBe(199.00)
  })
})

describe('parseHtml — no price found', () => {
  it('returns price: null for empty HTML', () => {
    const r = parseHtml('<html><body><p>No price here</p></body></html>')
    expect(r.price).toBeNull()
    expect(r.inStock).toBe(false)
  })
})

describe('parseHtml — pipeline priority (JSON-LD wins over CSS)', () => {
  it('JSON-LD price takes priority over CSS selector price when both present', () => {
    const html = `
      <script type="application/ld+json">
        {"@type":"Product","name":"Widget","offers":{"price":"55.00","priceCurrency":"USD","availability":"InStock"}}
      </script>
      <span class="price">$999.00</span>
    `
    const r = parseHtml(html)
    expect(r.price).toBe(55.00)
  })
})

describe('parseHtml — currency normalisation in JSON-LD', () => {
  it('normalises ₹ symbol from JSON-LD priceCurrency', () => {
    const html = `
      <script type="application/ld+json">
        {"@type":"Product","name":"Kurta","offers":{"price":"499","priceCurrency":"₹","availability":"InStock"}}
      </script>
    `
    const r = parseHtml(html)
    expect(r.price).toBe(499)
    expect(r.currency).toBe('INR')
  })
})
