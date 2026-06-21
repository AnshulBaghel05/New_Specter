import { describe, it, expect, vi } from 'vitest'
import { resolvePlatformParse } from '../domains/index'

const SHOPIFY_HTML = '<html>cdn.shopify.com<meta property="og:price:currency" content="USD"></html>'

describe('resolvePlatformParse', () => {
  it('prefers the Shopify .js endpoint (reliable availability) over generic HTML', async () => {
    // .js carries price in cents + a real `available`; resolver tries it first.
    const fetchText = vi.fn().mockImplementation((u: string) =>
      Promise.resolve(u.endsWith('.js')
        ? JSON.stringify({ title: 'A', price: 1200, available: true, variants: [{ price: 1200, available: true }] })
        : null))
    const r = await resolvePlatformParse('https://s.com/products/a', SHOPIFY_HTML, {}, fetchText)
    expect(fetchText).toHaveBeenCalledWith('https://s.com/products/a.js')
    expect(r).toEqual({ price: 12.0, inStock: true, currency: 'USD', title: 'A' })
  })

  it('falls back to .json (price/title) + HTML availability when .js is blocked', async () => {
    // Gymshark-style: .js 404s, but .json works for price/title; stock comes from
    // the page HTML so we do not falsely report the product out of stock.
    const html = SHOPIFY_HTML.replace('</html>',
      '<meta property="og:availability" content="instock"></html>')
    const fetchText = vi.fn().mockImplementation((u: string) =>
      Promise.resolve(u.endsWith('.js')
        ? null
        : JSON.stringify({ product: { title: 'A', variants: [{ price: '12.00' }] } })))  // no `available`
    const r = await resolvePlatformParse('https://s.com/products/a', html, {}, fetchText)
    expect(r).toEqual({ price: 12.0, inStock: true, currency: 'USD', title: 'A' })
  })

  it('falls back to generic HTML when both Shopify endpoints fail', async () => {
    const html = SHOPIFY_HTML + '<script type="application/ld+json">' +
      JSON.stringify({ '@type': 'Product', name: 'B', offers: { price: '7.50', priceCurrency: 'USD', availability: 'InStock' } }) +
      '</script>'
    const fetchText = vi.fn().mockResolvedValue(null)   // both endpoints down
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
