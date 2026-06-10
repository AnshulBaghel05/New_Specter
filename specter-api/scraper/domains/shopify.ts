import type { ParseResult } from '../types'

/** Derive the structured `.json` endpoint from a Shopify product URL.
 * Strips ?query and #hash and any trailing slash, then appends `.json`. */
export function shopifyProductJsonUrl(url: string): string {
  const noHash = url.split('#')[0]
  const noQuery = noHash.split('?')[0]
  const trimmed = noQuery.replace(/\/+$/, '')
  return `${trimmed}.json`
}

interface ShopifyVariant { price?: unknown; available?: unknown }
interface ShopifyProduct { title?: unknown; variants?: ShopifyVariant[] }

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
