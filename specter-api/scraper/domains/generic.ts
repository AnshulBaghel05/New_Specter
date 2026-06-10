import { load } from 'cheerio'
import type { Page } from 'playwright'
import type { ParseResult } from '../types'

// ── Currency normalisation ─────────────────────────────────────────────────────
// Maps raw symbol/prefix strings to ISO 4217 codes.
// Checked in order — put longer/more-specific patterns first to avoid partial
// matches (e.g. "Rs." before "R").
const CURRENCY_MAP: [RegExp, string][] = [
  [/Rs\.|₹/i,   'INR'],
  [/£/,          'GBP'],
  [/€/,          'EUR'],
  [/\$/,         'USD'],
  // Already ISO 4217 three-letter codes — pass through normalisation unchanged.
  [/^(USD|GBP|EUR|INR|AUD|CAD|SGD|JPY|CNY|MXN|BRL|ZAR|AED|CHF|SEK|NOK|DKK)$/i, '$1'],
]

export function normaliseCurrency(raw: string): string {
  const trimmed = raw.trim()
  for (const [pattern, code] of CURRENCY_MAP) {
    const m = trimmed.match(pattern)
    // Always uppercase: ISO pass-through captures original case (e.g. 'usd' → 'USD')
    if (m) return (m[1] ?? code).toUpperCase()
  }
  return trimmed.toUpperCase() || 'USD'  // unknown → uppercase or default USD
}

// ── Price string parsing ───────────────────────────────────────────────────────
// Strips currency symbols, thousands separators, and converts to float.
function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null
  // Remove currency symbols, whitespace, commas used as thousands separators.
  const cleaned = raw.replace(/[^\d.]/g, '')
  const value = parseFloat(cleaned)
  return isNaN(value) ? null : value
}

// ── JSON-LD schema.org/Product parser ─────────────────────────────────────────
export function parseJsonLd(html: string): ParseResult | null {
  const blocks = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )
  if (!blocks) return null

  for (const block of blocks) {
    const raw = block
      .replace(/<script[^>]*>/i, '')
      .replace(/<\/script>/i, '')
      .trim()

    try {
      const data    = JSON.parse(raw) as unknown
      const entries = Array.isArray(data) ? data : [data]

      for (const entry of entries) {
        if (
          entry === null ||
          typeof entry !== 'object' ||
          (entry as Record<string, unknown>)['@type'] !== 'Product'
        ) continue

        const rec    = entry as Record<string, unknown>
        const offers = rec.offers as Record<string, unknown> | undefined
        if (!offers) continue

        // Handle both single offer and offersCatalog/array.
        const offer = Array.isArray(offers)
          ? (offers as Record<string, unknown>[])[0]
          : offers

        const rawPrice    = offer?.price ?? offer?.lowPrice
        const rawCurrency = String(offer?.priceCurrency ?? '$')
        const rawInStock  = String(offer?.availability ?? '')

        const price = typeof rawPrice === 'number'
          ? rawPrice
          : parsePrice(String(rawPrice ?? ''))

        if (price === null) continue

        const inStock = !rawInStock || rawInStock.toLowerCase().includes('instock')

        return {
          price,
          inStock,
          currency: normaliseCurrency(rawCurrency),
          title:    String(rec.name ?? '').trim() || null,
        }
      }
    } catch {
      // Malformed JSON-LD block — try next.
    }
  }

  return null
}

// ── Open Graph price meta parser ──────────────────────────────────────────────
export function parseOpenGraph(html: string): ParseResult | null {
  const $     = load(html)
  const price = $('meta[property="og:price:amount"]').attr('content')
    ?? $('meta[property="product:price:amount"]').attr('content')

  if (!price) return null

  const parsed = parsePrice(price)
  if (parsed === null) return null

  const rawCurrency = $('meta[property="og:price:currency"]').attr('content')
    ?? $('meta[property="product:price:currency"]').attr('content')
    ?? '$'

  const title = $('meta[property="og:title"]').attr('content')?.trim() ?? null

  return {
    price:    parsed,
    inStock:  true,        // OG meta rarely exposes stock — optimistic default
    currency: normaliseCurrency(rawCurrency),
    title,
  }
}

// ── CSS selector price parser ──────────────────────────────────────────────────
// Last resort: DOM scrape of common price element selectors.
const PRICE_SELECTORS = [
  '[data-price]',
  '.price',
  '#price',
  'span.a-price .a-offscreen',  // Amazon price (screen-reader span)
  'span.a-price',
  '[itemprop="price"]',
  '.product-price',
  '.current-price',
]

export function parseCss(html: string): ParseResult | null {
  const $ = load(html)

  for (const selector of PRICE_SELECTORS) {
    const el = $(selector).first()
    if (!el.length) continue

    // Prefer data-price attribute, then aria-label, then text content.
    const raw = el.attr('data-price')
      ?? el.attr('aria-label')
      ?? el.attr('content')
      ?? el.text()

    const price = parsePrice(raw)
    if (price === null) continue

    const title = $('h1').first().text().trim() || null

    return { price, inStock: true, currency: 'USD', title }
  }

  return null
}

// ── Public API — HTTP worker (sync, raw HTML string) ─────────────────────────

/**
 * Parse a raw HTML string and return a `ParseResult`.
 *
 * Pipeline order (stops at first success):
 * 1. JSON-LD schema.org/Product + offers.price
 * 2. Open Graph price meta tags (og:price:amount, product:price:amount)
 * 3. CSS selectors ([data-price], .price, #price, span.a-price, ...)
 */
export function parseHtml(html: string): ParseResult {
  return (
    parseJsonLd(html)    ??
    parseOpenGraph(html) ??
    parseCss(html)       ??
    { price: null, inStock: false, currency: 'USD', title: null }
  )
}

// ── Public API — Playwright worker (async, live browser Page) ─────────────────

/**
 * Extract price from a fully rendered Playwright page.
 *
 * Strategy:
 * 1. Wait for networkidle (5s cap) so JS has injected JSON-LD and OG meta.
 * 2. Run the same HTML pipeline on `page.content()`.
 * 3. If still no price, fall back to a live DOM evaluation via page.evaluate()
 *    which catches prices dynamically inserted after the initial HTML parse.
 */
export async function parse(page: Page): Promise<ParseResult> {
  // Wait for JS rendering. networkidle can hang on pages with live data streams,
  // so cap it at 5s and continue regardless.
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})

  // Run the sync pipeline on the fully rendered HTML.
  const html = await page.content()
  const fromHtml = parseJsonLd(html) ?? parseOpenGraph(html) ?? parseCss(html)
  if (fromHtml !== null) return fromHtml

  // Live DOM fallback: evaluate PRICE_SELECTORS directly in the page context.
  // Uses a string-based evaluate to avoid TypeScript DOM global type conflicts
  // when lib does not include "DOM".
  const selectorsJson = JSON.stringify(PRICE_SELECTORS)
  const domResult = (await page.evaluate(`
    (() => {
      const selectors = ${selectorsJson};
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const raw = el.getAttribute('data-price')
          || el.getAttribute('aria-label')
          || el.getAttribute('content')
          || el.textContent;
        if (!raw) continue;
        const cleaned = raw.replace(/[^\\d.]/g, '');
        const price = parseFloat(cleaned);
        if (!isNaN(price) && price > 0) {
          return {
            price,
            inStock: true,
            currency: 'USD',
            title: (document.querySelector('h1') || {}).textContent?.trim() || null,
          };
        }
      }
      return null;
    })()
  `)) as ParseResult | null

  return domResult ?? { price: null, inStock: false, currency: 'USD', title: null }
}
