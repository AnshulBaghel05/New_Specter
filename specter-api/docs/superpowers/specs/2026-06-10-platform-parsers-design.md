# Platform Parsers (Audit #5) — Design

**Date:** 2026-06-10
**Status:** Approved (design)
**Branch:** `freemium-backend-foundation`

## Problem

SPECTER targets Shopify/WooCommerce merchants, but the scraper parses every site
generically. The probe worker classifies a URL `http_ok` (→ cheap datacenter HTTP
worker) or `js_required` (→ Playwright: residential proxy ~$8.40/GB **+ 2–4 s
Chromium CPU** + possible CAPTCHA spend). Many Shopify stores render price via JS
and so get classified `js_required`, burning the expensive path — even though
**every Shopify product is available as structured JSON** at `{product-url}.json`
over a plain datacenter GET, and **WooCommerce exposes a Store API** with
cents-precise prices and real stock booleans.

`domains/index.ts` has a `DOMAIN_MAP` registry hook for platform parsers, but it
is empty and unusable as designed: it keys on bare domain, while Shopify/Woo
stores run on arbitrary custom domains. Platform routing must be
**fingerprint-based**, not domain-based.

## Cost model that shapes the design

The expensive thing to avoid is **Playwright (residential + Chromium + CAPTCHA)**,
not a datacenter HTML GET (already cheap). Therefore:
- The structured-endpoint fetch lives on the **cheap http worker**.
- The **probe's** job is only to keep platform URLs *off* the browser.

## Decisions (locked)

1. **Scope:** Shopify **and** WooCommerce in this pass.
2. **Routing:** probe reroutes a detected-platform URL to `http_ok` even when it
   would otherwise be `js_required` (max cost saving; browser is the last resort).
3. **Parser precedence: structured-first.** When a platform is detected, try its
   structured endpoint *before* the generic HTML parse and return on success.
   Rationale: structured endpoints are contractual (stable schema) and survive
   theme changes that break incidental HTML selectors; the extra cost is one
   datacenter JSON GET, negligible vs the browser path. Generic HTML parse is the
   fallback when the structured source is unavailable/empty.

## Architecture

### New pure modules (no I/O — fully unit-testable)

**`scraper/domains/platform.ts`**
- `type Platform = 'shopify' | 'woocommerce'`
- `detectPlatform(headers: Record<string,string|string[]|undefined>, html: string): Platform | null`
  - Shopify markers: `x-shopify-stage` / `x-shopid` / `x-shardid` headers, or
    HTML `cdn.shopify.com`, `/cdn/shop/`, `Shopify.theme`, `var Shopify =`.
  - Woo markers: HTML `class="woocommerce`, `wp-content/plugins/woocommerce`,
    `<meta name="generator" content="WooCommerce`, `woocommerce-Price-amount`.
  - Shopify checked first (header signal is unambiguous). Returns null if neither.

**`scraper/domains/shopify.ts`**
- `shopifyProductJsonUrl(url: string): string` — strip `?query`/`#hash`, strip a
  trailing slash, append `.json`. (`/products/foo` → `/products/foo.json`;
  `/collections/x/products/foo/?v=2` → `/collections/x/products/foo.json`.)
- `parseShopifyJson(jsonText: string, fallbackCurrency: string): ParseResult | null`
  - Parse `{ product: { title, variants: [...] } }`.
  - Price/stock from the **first variant** (the default/selected variant — what a
    shopper sees first): `variants[0].price` (major-units string), `available`.
  - `inStock = product.variants.some(v => v.available)` (in stock if any variant
    is buyable); price from the first variant.
  - Currency: Shopify `product.json` carries none → use `fallbackCurrency`
    (read from the page HTML by the caller). `title` from `product.title`.
  - Return null on malformed JSON, missing product, or no parseable price.

**`scraper/domains/woocommerce.ts`**
- `wooStoreApiUrl(url: string): string | null` — derive
  `{origin}/wp-json/wc/store/v1/products?slug={slug}` from a
  `/product/{slug}/` URL. Returns null when no `/product/{slug}` segment is
  present (can't query the Store API without a slug).
- `parseWooStoreApi(jsonText: string): ParseResult | null` — the Store API returns
  an **array**; take the first product. `prices.price` is a minor-unit string with
  `prices.currency_minor_unit` (divide accordingly) and `prices.currency_code`;
  `is_in_stock` boolean; `name` for title. Self-sufficient on currency.
- `parseWooHtml(html: string): ParseResult | null` — robust Woo HTML fallback for
  stores with the Store API disabled: JSON-LD Product first (reuse generic), then
  Woo price markup `.summary .price .woocommerce-Price-amount bdi` /
  `p.price .amount`, stock via `p.stock.out-of-stock` / `.in-stock`.

### Worker wiring

**`scraper/workers/probe.ts`** — add a platform heuristic to `classifyUrl`,
placed **after** robots (heuristic 1) and the CF-challenge check (heuristic 2) but
**before** the JS-framework fingerprints (heuristic 5) and safe default
(heuristic 7):

```
const platform = detectPlatform(getResp.headers, html)
if (platform) return { classification: 'http_ok', via: 'heuristic' }
```

This is the reroute: a Shopify store whose price is JS-rendered (no static
JSON-LD price, no `.price` value) now stays on the http path instead of falling to
heuristic 5/7 → Playwright. (JSON-LD/CSS heuristics 4/6 still short-circuit to
`http_ok` earlier when they already find a price — the platform heuristic only
adds coverage, never removes it.)

**`scraper/workers/http.ts`** — replace the single generic `parseHtml(html)` call
with a structured-first resolver after the GET:

```
const platform = detectPlatform(response.headers, html)
let parsed = await resolveParse(platform, html, url, response.headers, fetchJson)
//   resolveParse:
//     shopify → GET shopifyProductJsonUrl(url) via the SAME datacenter dispatcher,
//               parseShopifyJson(text, currencyFromHtml(html)); on success return.
//     woo     → wooStoreApiUrl(url) ? GET it → parseWooStoreApi(text); on success return.
//               else parseWooHtml(html).
//     (any miss / no platform) → generic parseHtml(html).
```

- The extra structured GET reuses the existing datacenter `dispatcher` (proxy
  health reporting unchanged — a structured-endpoint ban cools the same IP).
- `currencyFromHtml(html)` reads `og:price:currency` / `product:price:currency` /
  `Shopify.currency.active`; defaults to USD when absent.
- Cost attribution (Audit #4) is unaffected: still `proxyTier: datacenter`,
  `respBytes: html.length` (the structured body is a tiny add we don't separately
  meter — proxy bandwidth is dominated by the HTML GET).

## Data flow (Shopify, JS-rendered price — the win)

```
dispatcher → probe: GET page (datacenter) → detectPlatform = shopify
          → classify http_ok (was js_required → Playwright)        ← reroute
http worker: GET page (datacenter) → detectPlatform = shopify
          → GET {url}.json (datacenter) → parseShopifyJson ✓ → snapshot
          (Playwright/residential/CAPTCHA never touched)
```

## Error handling

- Structured GET failure (network / 404 / non-JSON) → fall through to generic
  `parseHtml`, then to the existing parse-null path (validation-errors queue +
  http-fail counter). A platform store never does *worse* than today.
- Malformed structured JSON → parser returns null → same fallthrough.
- Woo with no `/product/{slug}` URL shape or Store API disabled → `parseWooHtml`.

## Scope guards (YAGNI)

- No JSON-first browser verification, no periodic cross-check (rejected option).
- No generic-pipeline rewrite; generic stays the fallback.
- No catalog/collection crawling — per-URL price/stock/title only.
- Shopify single-GET `/meta.json` currency-cache optimization is **deferred**
  (noted, not built); the HTML GET supplies currency for now.
- `.js` (cents) endpoint not used — `.json` (major-units string) is sufficient and
  one fewer unit conversion.

## Files

- New: `scraper/domains/platform.ts`, `scraper/domains/shopify.ts`,
  `scraper/domains/woocommerce.ts`.
- New tests: `scraper/__tests__/platform-detect.test.ts`,
  `scraper/__tests__/shopify-parser.test.ts`,
  `scraper/__tests__/woocommerce-parser.test.ts`,
  `scraper/__tests__/http-platform-resolve.test.ts` (resolver precedence).
- Modify: `scraper/workers/probe.ts` (platform heuristic),
  `scraper/workers/http.ts` (structured-first resolver),
  `scraper/domains/index.ts` (export the platform resolver; retire the dead
  domain-keyed `DOMAIN_MAP` comment block).

## Verification

- Unit: detection fingerprints (positive + negative), Shopify JSON URL derivation +
  parse (in/out of stock, multi-variant, malformed), Woo Store API + HTML parse,
  resolver precedence (structured preferred, generic fallback on miss).
- `tsc --noEmit` clean; full scraper vitest green (no regression to the 137).
- Cost path unchanged (Audit #4 fields still emitted from http worker).
