import { describe, it, expect } from 'vitest'
import { shopifyProductJsonUrl, parseShopifyJson } from '../domains/shopify'

describe('shopifyProductJsonUrl', () => {
  it('appends .json to a product URL', () => {
    expect(shopifyProductJsonUrl('https://shop.com/products/foo'))
      .toBe('https://shop.com/products/foo.json')
  })
  it('strips a trailing slash, query, and hash before appending', () => {
    expect(shopifyProductJsonUrl('https://shop.com/collections/x/products/foo/?v=2#tab'))
      .toBe('https://shop.com/collections/x/products/foo.json')
  })
})

describe('parseShopifyJson', () => {
  const product = JSON.stringify({
    product: {
      title: 'Wool Runner',
      variants: [
        { price: '95.00', available: false },
        { price: '95.00', available: true },
      ],
    },
  })

  it('parses first-variant price, any-variant stock, title, fallback currency', () => {
    const r = parseShopifyJson(product, 'USD')
    expect(r).toEqual({ price: 95.0, inStock: true, currency: 'USD', title: 'Wool Runner' })
  })
  it('reports out of stock when no variant is available', () => {
    const oos = JSON.stringify({ product: { title: 'X', variants: [{ price: '10.00', available: false }] } })
    expect(parseShopifyJson(oos, 'GBP')).toEqual({ price: 10.0, inStock: false, currency: 'GBP', title: 'X' })
  })
  it('returns null on malformed JSON', () => {
    expect(parseShopifyJson('not json', 'USD')).toBeNull()
  })
  it('returns null when there is no parseable variant price', () => {
    expect(parseShopifyJson(JSON.stringify({ product: { title: 'X', variants: [] } }), 'USD')).toBeNull()
  })
})
