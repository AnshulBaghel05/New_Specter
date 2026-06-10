'use client'

/**
 * Dev-only preview fixtures — NEW-USER state.
 *
 * When `NEXT_PUBLIC_PREVIEW=1`, the dashboard data hooks in `lib/api.ts` return
 * the seed data below instead of calling specter-api. This lets the dashboard be
 * previewed end-to-end with NO backend, database, or Supabase auth — useful for
 * design review. It is gated behind the env flag, so production (flag unset) is
 * completely unaffected: every hook falls through to the real `apiFetch`.
 *
 * These fixtures intentionally model a brand-new account: store not yet
 * connected, no products, competitors, signals, alerts, repricing, or
 * attribution history — only an active trial. Every page therefore renders the
 * exact onboarding / empty state a new merchant meets on first login. To preview
 * a populated dashboard instead, replace these values with sample data.
 */
import type {
  Merchant,
  SKU,
  SKUCount,
  CompetitorTracking,
  Signal,
  SignalList,
  SignalSummary,
  OOSAlert,
  AlertList,
  RepriceList,
  PriceChange,
  AttributionChart,
  Product,
  ProductsResponse,
} from '@/lib/api'

export const PREVIEW = process.env.NEXT_PUBLIC_PREVIEW === '1'

const MERCHANT_ID = 'mch_preview_0001'

/** Helper so `previewFn(value, real)` is eager-safe in production (just a ref). */
export function previewFn<T>(value: T, real: () => Promise<T>): () => Promise<T> {
  return PREVIEW ? () => Promise.resolve(value) : real
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString()
}

const SKU_LIMIT = 500
const MAX_COMPETITORS_PER_SKU = 5

// ── Merchant: fresh account, store not yet connected, mid-trial ──────────────

export const previewMerchant: Merchant = {
  id: MERCHANT_ID,
  plan: 'cipher',
  shopify_domain: null,
  shopify_connected: false,
  shopify_reconnect_required: false,
  trial_ends_at: daysFromNow(14),
  read_only: false,
  eclipse_interval_ms: 600_000,
  max_competitors_per_sku: MAX_COMPETITORS_PER_SKU,
  auto_reprice_enabled: false,
  email_notifications_enabled: true,
}

// ── Products / SKUs / competitors: none yet ──────────────────────────────────

export const previewProducts: Product[] = []

export const previewProductsResponse: ProductsResponse = {
  items: previewProducts,
  sku_used: 0,
  sku_limit: SKU_LIMIT,
  max_competitors_per_sku: MAX_COMPETITORS_PER_SKU,
}

export const previewCompetitors: CompetitorTracking[] = []

export const previewSKUs: SKU[] = []

export const previewSKUCount: SKUCount = {
  used: 0,
  limit: SKU_LIMIT,
  max_competitors_per_sku: MAX_COMPETITORS_PER_SKU,
}

// ── Signals: none yet ────────────────────────────────────────────────────────

export const previewSignals: Signal[] = []

export const previewSignalList: SignalList = {
  items: previewSignals,
  total: 0,
  limit: 50,
  offset: 0,
  counts: { raise: 0, lower: 0, hold: 0 },
}

export const previewSignalSummary: SignalSummary = {
  raise_24h: 0,
  lower_24h: 0,
  hold_24h: 0,
  revenue_recovered_mtd: 0,
  active_oos_count: 0,
}

// ── Alerts: none yet ─────────────────────────────────────────────────────────

export const previewAlerts: OOSAlert[] = []

export const previewAlertList: AlertList = {
  items: previewAlerts,
  active_count: 0,
}

// ── Repricing: nothing to reprice yet ────────────────────────────────────────

export const previewRepriceList: RepriceList = {
  global_auto_reprice_enabled: false,
  skus: [],
}

export const previewPriceChanges: PriceChange[] = []

// ── Attribution: no history yet ──────────────────────────────────────────────

export const previewAttribution: AttributionChart = {
  series: [],
  total_recovered: 0,
  total_lost: 0,
  net: 0,
}
