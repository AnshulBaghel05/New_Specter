import { describe, it, expect } from 'vitest'
import { detectPlatform } from '../domains/platform'

describe('detectPlatform', () => {
  it('detects Shopify from the x-shopify-stage header', () => {
    expect(detectPlatform({ 'x-shopify-stage': 'production' }, '')).toBe('shopify')
  })
  it('detects Shopify from cdn.shopify.com in HTML', () => {
    expect(detectPlatform({}, '<link href="https://cdn.shopify.com/s/files/x.css">')).toBe('shopify')
  })
  it('detects Shopify from a Shopify.theme global', () => {
    expect(detectPlatform({}, '<script>var Shopify = {}; Shopify.theme = {"name":"Dawn"}</script>')).toBe('shopify')
  })
  it('detects WooCommerce from the body class', () => {
    expect(detectPlatform({}, '<body class="archive woocommerce-page woocommerce">')).toBe('woocommerce')
  })
  it('detects WooCommerce from the plugin path', () => {
    expect(detectPlatform({}, '<link href="/wp-content/plugins/woocommerce/assets/x.css">')).toBe('woocommerce')
  })
  it('prefers Shopify when both header and Woo markup somehow co-occur', () => {
    expect(detectPlatform({ 'x-shopify-stage': 'production' }, 'woocommerce')).toBe('shopify')
  })
  it('returns null for a generic page', () => {
    expect(detectPlatform({}, '<html><body><div class="price">$9</div></body></html>')).toBeNull()
  })
})

describe('probe reroute predicate', () => {
  it('a JS-rendered Shopify page (no JSON-LD price) still fingerprints Shopify', () => {
    const html = '<html><head><script src="https://cdn.shopify.com/s/x.js"></script></head>' +
      '<body><div id="app"></div></body></html>'   // price rendered by JS, no static price
    expect(detectPlatform({}, html)).toBe('shopify')
  })
  it('a non-platform Nuxt page is not rerouted', () => {
    expect(detectPlatform({}, '<div id="__nuxt__"></div>')).toBeNull()
  })
})
