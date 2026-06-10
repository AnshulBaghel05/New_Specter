import { describe, it, expect, vi } from 'vitest'
import { resolvePlatformParse } from '../domains/index'

const SHOPIFY_HTML = '<html>cdn.shopify.com<meta property="og:price:currency" content="USD"></html>'

describe('resolvePlatformParse', () => {
  it('prefers the Shopify .json endpoint over generic HTML', async () => {
    const fetchText = vi.fn().mockResolvedValue(
      JSON.stringify({ product: { title: 'A', variants: [{ price: '12.00', available: true }] } }))
    const r = await resolvePlatformParse('https://s.com/products/a', SHOPIFY_HTML, {}, fetchText)
    expect(fetchText).toHaveBeenCalledWith('https://s.com/products/a.json')
    expect(r).toEqual({ price: 12.0, inStock: true, currency: 'USD', title: 'A' })
  })

  it('falls back to generic HTML when the Shopify endpoint fails', async () => {
    const html = SHOPIFY_HTML + '<script type="application/ld+json">' +
      JSON.stringify({ '@type': 'Product', name: 'B', offers: { price: '7.50', priceCurrency: 'USD', availability: 'InStock' } }) +
      '</script>'
    const fetchText = vi.fn().mockResolvedValue(null)   // endpoint down
    const r = await resolvePlatformParse('https://s.com/products/b', html, {}, fetchText)
    expect(r?.price).toBe(7.5)
  })

  it('uses generic HTML directly for a non-platform page (no fetch)', async () => {
    const html = '<script type="application/ld+json">' +
      JSON.stringify({ '@type': 'Product', name: 'C', offers: { price: '3.00', priceCurrency: 'USD', availability: 'InStock' } }) +
      '</script>'
    const fetchText = vi.fn()
    const r = await resolvePlatformParse('https://x.com/p/c', html, {}, fetchText)
    expect(fetchText).not.toHaveBeenCalled()
    expect(r?.price).toBe(3.0)
  })

  it('prefers the Woo Store API for a /product/ URL', async () => {
    const wooHtml = '<body class="woocommerce">'
    const fetchText = vi.fn().mockResolvedValue(
      JSON.stringify([{ name: 'D', is_in_stock: true, prices: { price: '500', currency_minor_unit: 2, currency_code: 'USD' } }]))
    const r = await resolvePlatformParse('https://w.com/product/d/', wooHtml, {}, fetchText)
    expect(fetchText).toHaveBeenCalledWith('https://w.com/wp-json/wc/store/v1/products?slug=d')
    expect(r).toEqual({ price: 5.0, inStock: true, currency: 'USD', title: 'D' })
  })
})
