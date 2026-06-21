import type { ParseResult } from '../types'

/** Derive the structured `.json` endpoint from a Shopify product URL.
 * Strips ?query and #hash and any trailing slash, then appends `.json`. */
export function shopifyProductJsonUrl(url: string): string {
  const noHash = url.split('#')[0]
  const noQuery = noHash.split('?')[0]
  const trimmed = noQuery.replace(/\/+$/, '')
  return `${trimmed}.json`
}

/** Derive the `/products/{handle}.js` endpoint from a Shopify product URL.
 * Unlike `.json`, the `.js` Ajax endpoint returns price in CENTS and — crucially —
 * a real per-variant `available` flag (the public `.json` omits it, which made the
 * old parser report every Shopify competitor out of stock). */
export function shopifyProductJsUrl(url: string): string {
  const trimmed = url.split('#')[0].split('?')[0].replace(/\/+$/, '')
  return `${trimmed}.js`
}

interface ShopifyVariant { price?: unknown; available?: unknown }
interface ShopifyProduct { title?: unknown; variants?: ShopifyVariant[] }

interface ShopifyJsVariant { price?: unknown; available?: unknown }
interface ShopifyJs { title?: unknown; price?: unknown; available?: unknown; variants?: ShopifyJsVariant[] }

/** Parse a Shopify `/products/{handle}.js` body. Price = first variant (cents →
 * units); inStock = the product-level or any-variant `available`. Currency is not
 * carried by the endpoint, so the caller supplies one read from the page HTML. */
export function parseShopifyJs(jsonText: string, fallbackCurrency: string): ParseResult | null {
  let product: ShopifyJs
  try {
    product = JSON.parse(jsonText) as ShopifyJs
  } catch {
    return null
  }
  const variants = Array.isArray(product.variants) ? product.variants : []
  if (variants.length === 0) return null
  const cents = Number(variants[0].price)
  if (!Number.isFinite(cents)) return null
  return {
    price: cents / 100,
    inStock: product.available === true || variants.some(v => v.available === true),
    currency: fallbackCurrency || 'USD',
    title: typeof product.title === 'string' && product.title.trim() ? product.title.trim() : null,
  }
}

/** Parse a Shopify `/products/{handle}.json` body. Price = first variant (the
 * default a shopper sees); inStock = any variant buyable. Shopify's product JSON
 * carries no currency, so the caller supplies one read from the page HTML. */
export function parseShopifyJson(jsonText: string, fallbackCurrency: string): ParseResult | null {
  let product: ShopifyProduct
  try {
    product = (JSON.parse(jsonText) as { product?: ShopifyProduct }).product ?? {}
  } catch {
    return null
  }
  const variants = Array.isArray(product.variants) ? product.variants : []
  if (variants.length === 0) return null
  const price = parseFloat(String(variants[0].price ?? ''))
  if (isNaN(price)) return null
  return {
    price,
    inStock: variants.some(v => v.available === true),
    currency: fallbackCurrency || 'USD',
    title: typeof product.title === 'string' && product.title.trim() ? product.title.trim() : null,
  }
}
