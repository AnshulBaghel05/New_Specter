import { load } from 'cheerio'
import type { ParseResult } from '../types'
import { normaliseCurrency } from './generic'

/** Build the WooCommerce Store API query for a `/product/{slug}/` URL, or null
 * when no product slug is present (can't query the Store API without one). */
export function wooStoreApiUrl(url: string): string | null {
  const m = url.match(/\/product\/([^/?#]+)/)
  if (!m) return null
  const u = new URL(url)
  return `${u.origin}/wp-json/wc/store/v1/products?slug=${m[1]}`
}

interface WooApiPrices { price?: unknown; currency_minor_unit?: unknown; currency_code?: unknown }
interface WooApiProduct { name?: unknown; is_in_stock?: unknown; prices?: WooApiPrices }

/** Parse the Store API products array (first product). Prices are minor-unit
 * strings scaled by currency_minor_unit; currency_code is authoritative. */
export function parseWooStoreApi(jsonText: string): ParseResult | null {
  let arr: WooApiProduct[]
  try {
    const parsed = JSON.parse(jsonText)
    arr = Array.isArray(parsed) ? parsed : []
  } catch {
    return null
  }
  if (arr.length === 0) return null
  const p = arr[0]
  const prices = p.prices ?? {}
  const minor = Number(prices.currency_minor_unit ?? 2)
  const raw = parseFloat(String(prices.price ?? ''))
  if (isNaN(raw)) return null
  return {
    price: raw / Math.pow(10, isNaN(minor) ? 2 : minor),
    inStock: p.is_in_stock === true,
    currency: normaliseCurrency(String(prices.currency_code ?? 'USD')),
    title: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : null,
  }
}

/** HTML fallback for Woo stores with the Store API disabled. */
export function parseWooHtml(html: string): ParseResult | null {
  const $ = load(html)
  const amount = $('.price .woocommerce-Price-amount').first()
  const text = amount.find('bdi').first().text() || amount.text()
  if (!text.trim()) return null
  const price = parseFloat(text.replace(/[^\d.]/g, ''))
  if (isNaN(price)) return null
  const stockEl = $('p.stock').first()
  const inStock = stockEl.length ? !stockEl.hasClass('out-of-stock') : true
  const symbol = text.replace(/[\d.,\s]/g, '') || 'USD'
  const title = $('h1.product_title').first().text().trim()
    || $('h1').first().text().trim() || null
  return { price, inStock, currency: normaliseCurrency(symbol), title }
}
