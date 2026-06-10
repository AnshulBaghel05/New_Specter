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
