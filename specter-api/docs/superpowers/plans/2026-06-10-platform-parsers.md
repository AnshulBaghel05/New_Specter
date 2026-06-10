# Platform Parsers (Audit #5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route detected Shopify/WooCommerce product URLs onto the cheap datacenter HTTP path and parse them from their structured endpoints (Shopify `.json`, Woo Store API), eliminating Playwright/residential/CAPTCHA spend for platform stores.

**Architecture:** Three new pure modules under `scraper/domains/` (platform fingerprint detection + Shopify + Woo parsers) wired into the probe worker (reroute off browser) and the http worker (structured-first resolver, generic HTML as fallback). No backend/Python changes.

**Tech Stack:** TypeScript (node16 module → `node:` builtins), cheerio (already a dep), vitest (`__tests__/**/*.test.ts`), got (datacenter dispatcher).

**Verify commands** (run from `scraper/`):
- Typecheck: `node node_modules/typescript/bin/tsc --noEmit`
- One test file: `node node_modules/vitest/vitest.mjs run __tests__/<file>.test.ts`
- Full suite: `node node_modules/vitest/vitest.mjs run`

**Reference types:** `ParseResult = { price: number | null; inStock: boolean; currency: string; title: string | null }` (`scraper/types.ts`).

**Staging rule:** stage exact paths (backend source is largely untracked; never `git add .`). Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Platform fingerprint detection

**Files:**
- Create: `scraper/domains/platform.ts`
- Test: `scraper/__tests__/platform-detect.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run it, expect FAIL** — `node node_modules/vitest/vitest.mjs run __tests__/platform-detect.test.ts` → "Cannot find module '../domains/platform'".

- [ ] **Step 3: Implement `scraper/domains/platform.ts`**

```typescript
export type Platform = 'shopify' | 'woocommerce'

const SHOPIFY_HEADERS = ['x-shopify-stage', 'x-shopid', 'x-shardid', 'x-sorting-hat-shopid']
const SHOPIFY_HTML = ['cdn.shopify.com', '/cdn/shop/', 'Shopify.theme', 'var Shopify =', 'window.Shopify']
const WOO_HTML = [
  'woocommerce-page', 'class="woocommerce', 'wp-content/plugins/woocommerce',
  'content="WooCommerce', 'woocommerce-Price-amount',
]

function headerPresent(headers: Record<string, unknown>, names: string[]): boolean {
  const lower: Record<string, unknown> = {}
  for (const k of Object.keys(headers ?? {})) lower[k.toLowerCase()] = headers[k]
  return names.some(n => lower[n] != null)
}

/** Fingerprint the storefront platform from response headers + HTML body.
 * Shopify wins ties: its header signal is unambiguous, and Shopify storefronts
 * can embed third-party widgets whose markup name-drops "woocommerce". */
export function detectPlatform(headers: Record<string, unknown>, html: string): Platform | null {
  const body = html ?? ''
  if (headerPresent(headers, SHOPIFY_HEADERS)) return 'shopify'
  if (SHOPIFY_HTML.some(m => body.includes(m))) return 'shopify'
  if (WOO_HTML.some(m => body.includes(m))) return 'woocommerce'
  return null
}
```

- [ ] **Step 4: Run it, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add scraper/domains/platform.ts scraper/__tests__/platform-detect.test.ts
git commit -m "feat(audit-5): platform fingerprint detection (Shopify/Woo)"
```

---

### Task 2: Shopify structured-endpoint parser

**Files:**
- Create: `scraper/domains/shopify.ts`
- Test: `scraper/__tests__/shopify-parser.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run it, expect FAIL.**

- [ ] **Step 3: Implement `scraper/domains/shopify.ts`**

```typescript
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
```

- [ ] **Step 4: Run it, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add scraper/domains/shopify.ts scraper/__tests__/shopify-parser.test.ts
git commit -m "feat(audit-5): Shopify .json structured parser + URL derivation"
```

---

### Task 3: WooCommerce parser (Store API + HTML fallback)

**Files:**
- Create: `scraper/domains/woocommerce.ts`
- Test: `scraper/__tests__/woocommerce-parser.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run it, expect FAIL.**

- [ ] **Step 3: Implement `scraper/domains/woocommerce.ts`**

```typescript
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
```

- [ ] **Step 4: Run it, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add scraper/domains/woocommerce.ts scraper/__tests__/woocommerce-parser.test.ts
git commit -m "feat(audit-5): WooCommerce Store API + HTML parser"
```

---

### Task 4: Structured-first resolver + index export

**Files:**
- Modify: `scraper/domains/index.ts`
- Test: `scraper/__tests__/http-platform-resolve.test.ts`

The resolver is pure over an injected async `fetchText(url): Promise<string|null>` so
it unit-tests without network. It prefers the structured endpoint, then generic HTML.

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run it, expect FAIL.**

- [ ] **Step 3: Rewrite `scraper/domains/index.ts`**

Replace the dead `DOMAIN_MAP` block with the platform resolver (keep the `getParser`/`DomainParser` export only if still imported elsewhere — grep first; the playwright worker uses `getParser`, so KEEP it).

```typescript
import type { Page } from 'playwright'
import type { ParseResult } from '../types'
import * as generic from './generic'
import { detectPlatform } from './platform'
import { shopifyProductJsonUrl, parseShopifyJson } from './shopify'
import { wooStoreApiUrl, parseWooStoreApi, parseWooHtml } from './woocommerce'

// ── Domain parser interface (used by the Playwright worker for live pages) ─────
export interface DomainParser {
  parse(page: Page): Promise<ParseResult>
  parseHtml(html: string): ParseResult
}

/** Playwright worker still routes through the generic parser for rendered pages. */
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
 * `fetchText`) and prefer it — it survives theme changes that break HTML
 * selectors. Generic HTML parse is the fallback. `fetchText` returns the body
 * string or null on any failure.
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

  const generic_ = generic.parseHtml(html)
  return generic_.price !== null ? generic_ : null
}
```

- [ ] **Step 4: Run it, expect PASS.** Then `node node_modules/typescript/bin/tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add scraper/domains/index.ts scraper/__tests__/http-platform-resolve.test.ts
git commit -m "feat(audit-5): structured-first platform resolver (Shopify/Woo > generic)"
```

---

### Task 5: Wire the resolver into the http worker

**Files:**
- Modify: `scraper/workers/http.ts`

- [ ] **Step 1: Add imports** (top of file, with the other domain import):

```typescript
import { normaliseCurrency } from '../domains/generic'
import { resolvePlatformParse } from '../domains'
```

(Remove the now-unused `parseHtml` from the `../domains/generic` import if present — `normaliseCurrency` is still used.)

- [ ] **Step 2: Replace the generic parse call.** At `scraper/workers/http.ts:120` the current line is:

```typescript
    const parsed: ParseResult = parseHtml(html)
```

Replace with a structured-first resolve that reuses the existing datacenter `dispatcher` for the structured GET:

```typescript
    // Structured-first: prefer the platform endpoint (Shopify .json / Woo Store
    // API) over HTML selectors — it survives theme changes. Reuses this worker's
    // datacenter proxy dispatcher; null on any failure → generic HTML fallback.
    const fetchText = async (u: string): Promise<string | null> => {
      try {
        const opts: Record<string, unknown> = { ...getOptions, method: 'GET' }
        const r = await got(u, opts)
        return r.statusCode >= 200 && r.statusCode < 300 ? String(r.body) : null
      } catch {
        return null
      }
    }
    const resolved = await resolvePlatformParse(url, html, response.headers, fetchText)
    const parsed: ParseResult = resolved ?? { price: null, inStock: false, currency: 'USD', title: null }
```

Note: `response` and `getOptions` and `got` are already in scope at that point
(GET happens at `http.ts:85`; `getOptions` defined at `:65`). Confirm by reading
the surrounding lines before editing.

- [ ] **Step 3: Typecheck + full suite**

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run
```
Expected: tsc clean; all tests pass (137 prior + new).

- [ ] **Step 4: Commit**

```bash
git add scraper/workers/http.ts
git commit -m "feat(audit-5): http worker uses structured-first platform resolver"
```

---

### Task 6: Reroute detected platforms off Playwright in the probe

**Files:**
- Modify: `scraper/workers/probe.ts`

- [ ] **Step 1: Add the import** (with the other domain imports near the top):

```typescript
import { detectPlatform } from '../domains/platform'
```

- [ ] **Step 2: Insert the platform heuristic.** In `classifyUrl`, after Heuristic 2 (Cloudflare JS challenge in GET body, ends ~`scraper/probe.ts:134`) and before Heuristic 3 (`__NEXT_DATA__`), add:

```typescript
  // ── Heuristic 2b — known storefront platform → http path ──────────────────
  // Shopify (.json) and WooCommerce (Store API) expose cheap structured
  // endpoints the http worker can parse, so a JS-rendered price must NOT send
  // these to Playwright. This reroute is the core cost win of Audit #5.
  if (detectPlatform(getResp.headers, html)) {
    return { classification: 'http_ok', via: 'heuristic' }
  }
```

Note: the GET response variable is named `getResp` (`scraper/probe.ts:111`) but
`html` is assigned from it; confirm the header source. If `getResp` is out of
scope after the try block, capture `getResp.headers` into a `let getHeaders`
alongside the existing `html`/`cfMitigatedGet` assignments at `:112-114` and use
`detectPlatform(getHeaders, html)`.

- [ ] **Step 3: Add a regression test for the reroute.** Append to
`scraper/__tests__/platform-detect.test.ts` a focused unit test that the heuristic
predicate (detectPlatform on representative Shopify/Woo bodies) is truthy and on a
JS-framework body (e.g. `id="__nuxt__"`) without platform markers is null — this
pins the ordering intent without standing up a BullMQ worker:

```typescript
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
```

- [ ] **Step 4: Typecheck + full suite**

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run
```
Expected: tsc clean; all pass.

- [ ] **Step 5: Commit**

```bash
git add scraper/workers/probe.ts scraper/__tests__/platform-detect.test.ts
git commit -m "feat(audit-5): probe reroutes detected platforms off Playwright"
```

---

### Task 7: Final verification sweep

- [ ] **Step 1: Full scraper suite + typecheck**

```bash
cd scraper
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run
```
Expected: tsc exit 0; all test files pass (137 prior + 4 new files).

- [ ] **Step 2: Backend untouched — sanity only** (no Python changed, so optional):

```bash
.venv/Scripts/python.exe -m pytest -q
```
Expected: 337 pass (unchanged).

- [ ] **Step 3: Update memory** — mark Audit #5 complete; note Shopify `/meta.json` single-GET currency cache + `.js` cents endpoint as deferred optimizations; all top-5 audit items now done.

---

## Self-Review notes

- **Spec coverage:** detection (T1), Shopify parser (T2), Woo parser (T3),
  structured-first resolver (T4), http wiring (T5), probe reroute (T6), verify (T7)
  — every spec section maps to a task.
- **Type consistency:** all parsers return `ParseResult | null`; resolver returns
  `ParseResult | null`; http worker coalesces null → the existing parse-null
  sentinel. `detectPlatform` headers param typed `Record<string, unknown>` to
  accept got's `IncomingHttpHeaders`.
- **Cost (Audit #4) unchanged:** http worker still emits `proxyTier:'datacenter'`
  + `respBytes: html.length`; the structured GET rides the same dispatcher and
  reports proxy health identically.
- **No regression risk to generic path:** non-platform pages skip `fetchText`
  entirely (resolver returns generic parse), so existing behaviour is byte-identical
  for them.
