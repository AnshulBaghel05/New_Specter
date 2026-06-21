'use client'

/**
 * specter-api client + TanStack Query hooks.
 *
 * Auth: every request attaches the current Supabase session access token as
 * `Authorization: Bearer {token}`. specter-api validates it (auth/supabase.py).
 *
 * Signals and alerts hooks are added in Prompt 13 when those routers exist.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  PREVIEW,
  previewFn,
  previewMerchant,
  previewSKUs,
  previewSKUCount,
  previewCompetitors,
  previewSignalList,
  previewSignalSummary,
  previewAlertList,
  previewRepriceList,
  previewPriceChanges,
  previewAttribution,
  previewProductsResponse,
} from '@/lib/preview-data'

import { API_URL } from '@/lib/api-url'

// ── Types (mirror specter-api Pydantic schemas) ─────────────────────────────

export interface Merchant {
  id: string
  plan: 'free' | 'recon' | 'cipher' | 'phantom' | 'predator' | 'eclipse'
  shopify_domain: string | null
  shopify_connected: boolean
  shopify_reconnect_required: boolean
  trial_ends_at: string | null
  read_only: boolean
  eclipse_interval_ms: number
  max_competitors_per_sku: number | null
  auto_reprice_enabled: boolean
  email_notifications_enabled: boolean
  subscription_current_end: string | null
  subscription_cancel_at: string | null
}

export interface Addon {
  id: string
  addon_type: string
  razorpay_subscription_id: string | null
}

export interface SubscriptionResponse {
  subscription_id: string
  status: string | null
  short_url: string | null
}

export interface CancelResponse {
  cancel_at: string | null
  status: string
}

export type SelfServePlan = 'recon' | 'cipher' | 'phantom'
export type BillingCadence = 'monthly' | 'annual'

export interface SKU {
  id: string
  merchant_id: string
  title: string
  handle: string | null
  current_price: string | null
  floor_price: string | null
  ceiling_price: string | null
  currency: string
  shopify_variant_id: string | null
  active: boolean
}

export interface SKUCount {
  used: number
  limit: number | null
  max_competitors_per_sku: number | null
}

export interface CompetitorTracking {
  id: string
  own_product_id: string
  competitor_url_id: string
  merchant_id: string
  enabled: boolean
  silenced_oos: boolean
  url: string
  domain: string
  robots_blocked: boolean
}

export type SignalType = 'RAISE' | 'LOWER' | 'HOLD'

export interface Signal {
  id: string
  sku_id: string
  sku_title: string
  type: SignalType
  confidence: number
  reasoning: string | null
  price_suggestion: number | null
  current_price: number | null
  source: 'ai' | 'rule'
  ai_fallback: boolean
  created_at: string
}

export interface SignalTypeCounts {
  raise: number
  lower: number
  hold: number
}

export interface SignalList {
  items: Signal[]
  total: number
  limit: number
  offset: number
  counts: SignalTypeCounts
}

export interface SignalSummary {
  raise_24h: number
  lower_24h: number
  hold_24h: number
  revenue_recovered_mtd: number
  active_oos_count: number
}

export interface OOSAlert {
  id: string
  competitor_tracking_id: string
  sku_id: string
  sku_title: string
  competitor_domain: string
  competitor_url: string
  detected_at: string
  resolved_at: string | null
  notified_at: string | null
  silenced: boolean
  status: 'active' | 'resolved'
}

export interface AlertList {
  items: OOSAlert[]
  active_count: number
}

// ── API error type ──────────────────────────────────────────────────────────

export interface ApiErrorBody {
  error: string
  required_plan?: string
  limit?: number
  used?: number
  message?: string
}

export class ApiError extends Error {
  status: number
  body: ApiErrorBody | null

  constructor(status: number, body: ApiErrorBody | null, message?: string) {
    super(message ?? body?.error ?? `API error ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

// ── Authenticated fetcher ─────────────────────────────────────────────────────

async function getAccessToken(): Promise<string | null> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const resp = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (resp.status === 204) {
    return undefined as T
  }

  let payload: unknown = null
  const text = await resp.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!resp.ok) {
    // FastAPI wraps error bodies in {"detail": ...}
    const detail =
      payload && typeof payload === 'object' && 'detail' in payload
        ? (payload as { detail: unknown }).detail
        : payload
    const body =
      detail && typeof detail === 'object'
        ? (detail as ApiErrorBody)
        : { error: String(detail ?? 'unknown_error') }
    throw new ApiError(resp.status, body)
  }

  return payload as T
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const queryKeys = {
  merchant: ['merchant', 'me'] as const,
  skus: ['skus'] as const,
  skuCount: ['skus', 'count'] as const,
  competitors: ['competitors'] as const,
  signals: (opts?: {
    limit?: number
    offset?: number
    type?: string
    sort?: string
    minConfidence?: number
  }) => ['signals', opts ?? {}] as const,
  signalSummary: ['signals', 'summary'] as const,
  alerts: (status?: string) => ['alerts', status ?? 'all'] as const,
  repricing: ['repricing'] as const,
  priceChanges: ['repricing', 'changes'] as const,
  attribution: (days: number) => ['attribution', days] as const,
  products: ['products'] as const,
  addons: ['billing', 'addons'] as const,
}

// ════════════════════════════════════════════════════════════════════════════
// MERCHANT HOOKS
// ════════════════════════════════════════════════════════════════════════════

export function useMerchant(): UseQueryResult<Merchant, ApiError> {
  return useQuery({
    queryKey: queryKeys.merchant,
    queryFn: previewFn(previewMerchant, () => apiFetch<Merchant>('/merchants/me')),
  })
}

export function useUpdateMerchant(): UseMutationResult<
  Merchant,
  ApiError,
  Partial<Pick<Merchant, 'eclipse_interval_ms' | 'email_notifications_enabled'>>
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) =>
      PREVIEW
        ? Promise.resolve({ ...previewMerchant, ...body })
        : apiFetch<Merchant>('/merchants/me', {
            method: 'PATCH',
            body: JSON.stringify(body),
          }),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.merchant, data)
    },
  })
}

/**
 * Returns the Shopify OAuth begin URL. The caller redirects the browser to it
 * (window.location.href = url) so Shopify can show the consent screen.
 */
export function shopifyOAuthUrl(shop: string): string {
  return `${API_URL}/merchants/shopify/oauth?shop=${encodeURIComponent(shop)}`
}

export function useDisconnectShopify(): UseMutationResult<void, ApiError, void> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      PREVIEW
        ? Promise.resolve(undefined as void)
        : apiFetch<void>('/merchants/shopify/disconnect', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.merchant })
    },
  })
}

// ════════════════════════════════════════════════════════════════════════════
// BILLING HOOKS
// ════════════════════════════════════════════════════════════════════════════

export function useStartTrial(): UseMutationResult<Merchant, ApiError, void> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      PREVIEW
        ? Promise.resolve<Merchant>({ ...previewMerchant, plan: 'recon' })
        : apiFetch<Merchant>('/merchants/start-trial', { method: 'POST' }),
    onSuccess: (data) => qc.setQueryData(queryKeys.merchant, data),
  })
}

export function useSubscribe(): UseMutationResult<
  SubscriptionResponse,
  ApiError,
  { plan: SelfServePlan; cadence: BillingCadence }
> {
  return useMutation({
    mutationFn: (body) =>
      PREVIEW
        ? Promise.resolve<SubscriptionResponse>({ subscription_id: 'sub_preview', status: 'created', short_url: null })
        : apiFetch<SubscriptionResponse>('/billing/subscribe', { method: 'POST', body: JSON.stringify(body) }),
  })
}

export function useUpgrade(): UseMutationResult<
  SubscriptionResponse,
  ApiError,
  { plan: SelfServePlan; cadence: BillingCadence }
> {
  return useMutation({
    mutationFn: (body) =>
      PREVIEW
        ? Promise.resolve<SubscriptionResponse>({ subscription_id: 'sub_preview', status: 'created', short_url: null })
        : apiFetch<SubscriptionResponse>('/billing/upgrade', { method: 'POST', body: JSON.stringify(body) }),
  })
}

export function useDowngrade(): UseMutationResult<unknown, ApiError, { plan: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) =>
      PREVIEW
        ? Promise.resolve({ plan: body.plan })
        : apiFetch<unknown>('/billing/downgrade', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.merchant }),
  })
}

export function useCancelSubscription(): UseMutationResult<CancelResponse, ApiError, void> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      PREVIEW
        ? Promise.resolve<CancelResponse>({ cancel_at: null, status: 'cancel_scheduled' })
        : apiFetch<CancelResponse>('/billing/cancel', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.merchant }),
  })
}

export function useAddons(): UseQueryResult<Addon[], ApiError> {
  return useQuery({
    queryKey: queryKeys.addons,
    queryFn: () => (PREVIEW ? Promise.resolve<Addon[]>([]) : apiFetch<Addon[]>('/billing/addons')),
    retry: false,
  })
}

export function useRemoveAddon(): UseMutationResult<void, ApiError, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (addonId) =>
      PREVIEW
        ? Promise.resolve(undefined as void)
        : apiFetch<void>(`/billing/addon/${addonId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.addons }),
  })
}

// ════════════════════════════════════════════════════════════════════════════
// SKU HOOKS
// ════════════════════════════════════════════════════════════════════════════

export function useSKUs(): UseQueryResult<SKU[], ApiError> {
  return useQuery({
    queryKey: queryKeys.skus,
    queryFn: previewFn(previewSKUs, () => apiFetch<SKU[]>('/skus')),
  })
}

export function useSKUCount(): UseQueryResult<SKUCount, ApiError> {
  return useQuery({
    queryKey: queryKeys.skuCount,
    queryFn: previewFn(previewSKUCount, () => apiFetch<SKUCount>('/skus/count')),
  })
}

export interface CreateSKUInput {
  title: string
  handle?: string
  current_price?: string
  currency?: string
  shopify_variant_id?: string
}

export function useCreateSKU(): UseMutationResult<SKU, ApiError, CreateSKUInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) =>
      PREVIEW
        ? Promise.resolve<SKU>({
            id: `sku_preview_${Date.now()}`,
            merchant_id: previewMerchant.id,
            title: body.title,
            handle: body.handle ?? null,
            current_price: body.current_price ?? null,
            floor_price: null,
            ceiling_price: null,
            currency: body.currency ?? 'USD',
            shopify_variant_id: body.shopify_variant_id ?? null,
            active: true,
          })
        : apiFetch<SKU>('/skus', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.skus })
      qc.invalidateQueries({ queryKey: queryKeys.skuCount })
      qc.invalidateQueries({ queryKey: queryKeys.products })
    },
  })
}

export interface UpdateSKUInput {
  id: string
  floor_price?: string
  ceiling_price?: string
  current_price?: string
  currency?: string
  active?: boolean
}

export function useUpdateSKU(): UseMutationResult<SKU, ApiError, UpdateSKUInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }) =>
      PREVIEW
        ? Promise.resolve<SKU>({
            ...(previewSKUs.find((s) => s.id === id) ?? previewSKUs[0]),
            id,
            ...patch,
          })
        : apiFetch<SKU>(`/skus/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.skus })
      qc.invalidateQueries({ queryKey: queryKeys.products })
    },
  })
}

/**
 * Permanently delete a product. The API cascades (trackings, signals, alerts,
 * price history) and reschedules the competitor URLs that lose their last
 * tracking. Irreversible — callers MUST gate this behind a typed confirmation.
 */
export function useDeleteSKU(): UseMutationResult<void, ApiError, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) =>
      PREVIEW
        ? Promise.resolve(undefined as void)
        : apiFetch<void>(`/skus/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.skus })
      qc.invalidateQueries({ queryKey: queryKeys.skuCount })
      qc.invalidateQueries({ queryKey: queryKeys.products })
    },
  })
}

// ════════════════════════════════════════════════════════════════════════════
// COMPETITOR HOOKS
// ════════════════════════════════════════════════════════════════════════════

export function useCompetitors(): UseQueryResult<CompetitorTracking[], ApiError> {
  return useQuery({
    queryKey: queryKeys.competitors,
    queryFn: previewFn(previewCompetitors, () => apiFetch<CompetitorTracking[]>('/competitors')),
  })
}

export interface AddCompetitorInput {
  url: string
  own_product_id: string
}

export function useAddCompetitor(): UseMutationResult<
  CompetitorTracking,
  ApiError,
  AddCompetitorInput
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) =>
      PREVIEW
        ? Promise.resolve<CompetitorTracking>({
            id: `trk_preview_${Date.now()}`,
            own_product_id: body.own_product_id,
            competitor_url_id: `cu_preview_${Date.now()}`,
            merchant_id: previewMerchant.id,
            enabled: true,
            silenced_oos: false,
            url: body.url,
            domain: (() => {
              try {
                return new URL(body.url).hostname.replace(/^www\./, '')
              } catch {
                return body.url
              }
            })(),
            robots_blocked: false,
          })
        : apiFetch<CompetitorTracking>('/competitors', {
            method: 'POST',
            body: JSON.stringify(body),
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.competitors })
      qc.invalidateQueries({ queryKey: queryKeys.skuCount })
      qc.invalidateQueries({ queryKey: queryKeys.products })
    },
  })
}

export function useDeleteCompetitor(): UseMutationResult<void, ApiError, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (trackingId) =>
      PREVIEW
        ? Promise.resolve(undefined as void)
        : apiFetch<void>(`/competitors/${trackingId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.competitors })
      qc.invalidateQueries({ queryKey: queryKeys.skuCount })
      qc.invalidateQueries({ queryKey: queryKeys.products })
    },
  })
}

export function useSilenceOOS(): UseMutationResult<
  CompetitorTracking,
  ApiError,
  { trackingId: string; silenced: boolean }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ trackingId, silenced }) =>
      PREVIEW
        ? Promise.resolve<CompetitorTracking>({
            ...(previewCompetitors.find((c) => c.id === trackingId) ?? previewCompetitors[0]),
            id: trackingId,
            silenced_oos: silenced,
          })
        : apiFetch<CompetitorTracking>(`/competitors/${trackingId}/silence-oos`, {
            method: 'PATCH',
            body: JSON.stringify({ silenced_oos: silenced }),
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.competitors })
      qc.invalidateQueries({ queryKey: queryKeys.products })
    },
  })
}

// ════════════════════════════════════════════════════════════════════════════
// SIGNAL HOOKS
// ════════════════════════════════════════════════════════════════════════════

export function useSignals(opts?: {
  limit?: number
  offset?: number
  type?: SignalType
  sort?: 'recent' | 'confidence'
  minConfidence?: number
  dateFrom?: string // ISO date (YYYY-MM-DD); PREDATOR+ up to 90 days back, else 30
  dateTo?: string   // ISO date (YYYY-MM-DD); defaults to now
}): UseQueryResult<SignalList, ApiError> {
  const params = new URLSearchParams()
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit))
  if (opts?.offset !== undefined) params.set('offset', String(opts.offset))
  if (opts?.type) params.set('type', opts.type)
  if (opts?.sort === 'confidence') params.set('sort', 'confidence')
  if (opts?.minConfidence && opts.minConfidence > 0)
    params.set('min_confidence', String(opts.minConfidence))
  if (opts?.dateFrom) params.set('date_from', opts.dateFrom)
  if (opts?.dateTo) params.set('date_to', opts.dateTo)
  const qs = params.toString()

  return useQuery({
    queryKey: queryKeys.signals(opts),
    queryFn: previewFn(previewSignalList, () => apiFetch<SignalList>(`/signals${qs ? `?${qs}` : ''}`)),
  })
}

export function useSignalSummary(): UseQueryResult<SignalSummary, ApiError> {
  return useQuery({
    queryKey: queryKeys.signalSummary,
    queryFn: previewFn(previewSignalSummary, () => apiFetch<SignalSummary>('/signals/summary')),
  })
}

// ════════════════════════════════════════════════════════════════════════════
// ALERT HOOKS
// ════════════════════════════════════════════════════════════════════════════

export function useAlerts(
  status?: 'active' | 'resolved',
): UseQueryResult<AlertList, ApiError> {
  const qs = status ? `?status=${status}` : ''
  return useQuery({
    queryKey: queryKeys.alerts(status),
    queryFn: previewFn(previewAlertList, () => apiFetch<AlertList>(`/alerts${qs}`)),
  })
}

export function useSilenceAlert(): UseMutationResult<
  OOSAlert,
  ApiError,
  { alertId: string; silenced: boolean }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ alertId, silenced }) =>
      PREVIEW
        ? Promise.resolve<OOSAlert>({
            ...(previewAlertList.items.find((a) => a.id === alertId) ?? previewAlertList.items[0]),
            id: alertId,
            silenced,
          })
        : apiFetch<OOSAlert>(`/alerts/${alertId}/silence`, {
            method: 'PATCH',
            body: JSON.stringify({ silenced }),
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
}

// ════════════════════════════════════════════════════════════════════════════
// REPRICING HOOKS (CIPHER+)
// ════════════════════════════════════════════════════════════════════════════

export interface LatestSuggestion {
  type: SignalType
  price_suggestion: number | null
  confidence: number
  created_at: string
}

export interface RepriceSKU {
  id: string
  title: string
  current_price: number | null
  floor_price: number | null
  ceiling_price: number | null
  currency: string
  auto_reprice_enabled: boolean
  latest_suggestion: LatestSuggestion | null
}

export interface RepriceList {
  global_auto_reprice_enabled: boolean
  skus: RepriceSKU[]
}

export interface PriceChange {
  id: string
  sku_id: string
  sku_title: string
  old_price: number
  new_price: number
  source: string
  revenue_delta: number | null
  created_at: string
}

export function useRepricing(): UseQueryResult<RepriceList, ApiError> {
  return useQuery({
    queryKey: queryKeys.repricing,
    queryFn: previewFn(previewRepriceList, () => apiFetch<RepriceList>('/repricing')),
    retry: false, // a 403 (RECON plan) should surface immediately as the upgrade gate
  })
}

export function usePriceChanges(): UseQueryResult<PriceChange[], ApiError> {
  return useQuery({
    queryKey: queryKeys.priceChanges,
    queryFn: previewFn(previewPriceChanges, () => apiFetch<PriceChange[]>('/repricing/changes')),
    retry: false,
  })
}

export function useUpdateRepriceSettings(): UseMutationResult<
  RepriceList,
  ApiError,
  { auto_reprice_enabled: boolean }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) =>
      PREVIEW
        ? Promise.resolve<RepriceList>({
            ...previewRepriceList,
            global_auto_reprice_enabled: body.auto_reprice_enabled,
          })
        : apiFetch<RepriceList>('/repricing/settings', {
            method: 'PATCH',
            body: JSON.stringify(body),
          }),
    onSuccess: (data) => qc.setQueryData(queryKeys.repricing, data),
  })
}

export interface UpdateRepriceSKUInput {
  id: string
  floor_price?: number
  ceiling_price?: number
  auto_reprice_enabled?: boolean
}

export function useUpdateRepriceSKU(): UseMutationResult<
  RepriceSKU,
  ApiError,
  UpdateRepriceSKUInput
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }) =>
      PREVIEW
        ? Promise.resolve<RepriceSKU>({
            ...(previewRepriceList.skus.find((s) => s.id === id) ?? previewRepriceList.skus[0]),
            id,
            ...patch,
          })
        : apiFetch<RepriceSKU>(`/repricing/sku/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
          }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.repricing }),
  })
}

// ════════════════════════════════════════════════════════════════════════════
// ATTRIBUTION HOOKS (PHANTOM+)
// ════════════════════════════════════════════════════════════════════════════

export interface DailyPoint {
  date: string
  revenue_delta: number
}

export interface AttributionChart {
  series: DailyPoint[]
  total_recovered: number
  total_lost: number
  net: number
}

export function useAttribution(days = 30): UseQueryResult<AttributionChart, ApiError> {
  return useQuery({
    queryKey: queryKeys.attribution(days),
    queryFn: previewFn(previewAttribution, () => apiFetch<AttributionChart>(`/attribution/chart?days=${days}`)),
    retry: false,
  })
}

/**
 * Download the attribution CSV with the auth token attached, then trigger a
 * browser save. Returns false if the request was rejected (e.g. 403 plan gate).
 */
export async function downloadAttributionCsv(): Promise<boolean> {
  const token = await getAccessToken()
  const resp = await fetch(`${API_URL}/attribution/export.csv`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!resp.ok) return false

  const blob = await resp.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'attribution.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return true
}

// ════════════════════════════════════════════════════════════════════════════
// PRODUCTS WORKSPACE
// ════════════════════════════════════════════════════════════════════════════

export type CompetitorStatus = 'live' | 'stale' | 'failing' | 'pending' | 'blocked'

export interface ProductCompetitor {
  tracking_id: string
  competitor_url_id: string
  url: string
  domain: string
  enabled: boolean
  silenced_oos: boolean
  robots_blocked: boolean
  latest_price: number | null
  currency: string              // competitor's own scraped currency (not the product's)
  in_stock: boolean | null
  last_checked_at: string | null
  status: CompetitorStatus      // derived scrape health (see products.py)
  status_label: string          // human-readable reason (tooltip)
}

export interface ProductSignal {
  type: SignalType
  price_suggestion: number | null
  confidence: number
  created_at: string
}

export interface Product {
  id: string
  title: string
  handle: string | null
  current_price: number | null
  currency: string
  source: 'shopify' | 'manual'
  active: boolean
  floor_price: number | null
  ceiling_price: number | null
  competitor_count: number
  latest_signal: ProductSignal | null
  competitors: ProductCompetitor[]
}

export interface ProductsResponse {
  items: Product[]
  total: number          // total products; > items.length when the catalog is paginated
  sku_used: number
  sku_limit: number | null
  max_competitors_per_sku: number | null
}

export function useProducts(): UseQueryResult<ProductsResponse, ApiError> {
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: previewFn(previewProductsResponse, () => apiFetch<ProductsResponse>('/products')),
  })
}
