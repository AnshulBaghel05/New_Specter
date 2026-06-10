import type { Page } from 'playwright'
import type { ParseResult } from '../types'
import * as generic from './generic'
import { detectPlatform } from './platform'
import { shopifyProductJsonUrl, parseShopifyJson } from './shopify'
import { wooStoreApiUrl, parseWooStoreApi, parseWooHtml } from './woocommerce'

// ── Domain parser interface (used by the Playwright worker for live pages) ─────

export interface DomainParser {
  /** Playwright worker: receive a live browser page, return parsed price data. */
  parse(page: Page): Promise<ParseResult>
  /** HTTP worker: receive raw HTML string, return parsed price data (sync). */
  parseHtml(html: string): ParseResult
}

/**
 * Parser for the Playwright worker's rendered pages. Platform routing for the
 * cheap http path is fingerprint-based (see resolvePlatformParse) — Shopify/Woo
 * stores run on arbitrary custom domains, so a domain-keyed registry can't work.
 * The rendered-page path stays on the generic parser.
 */
export function getParser(_domain: string): DomainParser {
  return generic
}

// ── Currency read from page HTML (Shopify product.json carries none) ──────────

function currencyFromHtml(html: string): string {
  const og = html.match(/<meta[^>]+(?:og:price:currency|product:price:currency)[^>]+content=["']([^"']+)["']/i)
  if (og) return og[1]
  const shopify = html.match(/Shopify\.currency\s*=\s*\{[^}]*["']active["']\s*:\s*["']([A-Z]{3})["']/i)
  if (shopify) return shopify[1]
  return 'USD'
}

/**
 * Structured-first parse for the http worker. When the page fingerprints as a
 * known platform, fetch its structured endpoint (via the injected datacenter
 * `fetchText`) and prefer it — a contractual JSON schema survives theme changes
 * that break incidental HTML selectors. Generic HTML parse is the fallback.
 * `fetchText` returns the body string, or null on any failure.
 */
export async function resolvePlatformParse(
  url: string,
  html: string,
  headers: Record<string, unknown>,
  fetchText: (u: string) => Promise<string | null>,
): Promise<ParseResult | null> {
  const platform = detectPlatform(headers, html)

  if (platform === 'shopify') {
    const text = await fetchText(shopifyProductJsonUrl(url))
    const parsed = text ? parseShopifyJson(text, currencyFromHtml(html)) : null
    if (parsed) return parsed
  } else if (platform === 'woocommerce') {
    const api = wooStoreApiUrl(url)
    if (api) {
      const text = await fetchText(api)
      const parsed = text ? parseWooStoreApi(text) : null
      if (parsed) return parsed
    }
    const fromHtml = parseWooHtml(html)
    if (fromHtml) return fromHtml
  }

  const fromGeneric = generic.parseHtml(html)
  return fromGeneric.price !== null ? fromGeneric : null
}
