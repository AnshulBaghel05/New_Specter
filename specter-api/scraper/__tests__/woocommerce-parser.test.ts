import { describe, it, expect } from 'vitest'
import { wooStoreApiUrl, parseWooStoreApi, parseWooHtml } from '../domains/woocommerce'

describe('wooStoreApiUrl', () => {
  it('builds the Store API slug query from a /product/{slug}/ URL', () => {
    expect(wooStoreApiUrl('https://shop.com/product/blue-shirt/'))
      .toBe('https://shop.com/wp-json/wc/store/v1/products?slug=blue-shirt')
  })
  it('returns null when the URL has no /product/{slug} segment', () => {
    expect(wooStoreApiUrl('https://shop.com/shop/category/x')).toBeNull()
  })
})

describe('parseWooStoreApi', () => {
  const body = JSON.stringify([{
    name: 'Blue Shirt', is_in_stock: true,
    prices: { price: '1999', currency_minor_unit: 2, currency_code: 'GBP' },
  }])
  it('parses minor-unit price, stock, currency_code, name', () => {
    expect(parseWooStoreApi(body)).toEqual({ price: 19.99, inStock: true, currency: 'GBP', title: 'Blue Shirt' })
  })
  it('returns null on an empty array', () => {
    expect(parseWooStoreApi('[]')).toBeNull()
  })
  it('returns null on malformed JSON', () => {
    expect(parseWooStoreApi('nope')).toBeNull()
  })
})

describe('parseWooHtml', () => {
  it('parses Woo price markup + in-stock', () => {
    const html = `
      <div class="summary"><p class="price">
        <span class="woocommerce-Price-amount amount"><bdi>&pound;24.50</bdi></span>
      </p><p class="stock in-stock">12 in stock</p></div>
      <h1 class="product_title">Red Hat</h1>`
    const r = parseWooHtml(html)
    expect(r?.price).toBe(24.5)
    expect(r?.inStock).toBe(true)
    expect(r?.currency).toBe('GBP')
    expect(r?.title).toBe('Red Hat')
  })
  it('marks out-of-stock from the stock paragraph', () => {
    const html = `<p class="price"><span class="woocommerce-Price-amount"><bdi>$9.00</bdi></span></p>
      <p class="stock out-of-stock">Out of stock</p>`
    expect(parseWooHtml(html)?.inStock).toBe(false)
  })
  it('returns null when no Woo price is present', () => {
    expect(parseWooHtml('<div>no price here</div>')).toBeNull()
  })
})
