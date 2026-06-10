/**
 * Signed ingest client — the scraper's authenticated channel to specter-api's
 * /internal router. Signs `${timestamp}.${rawBody}` with SCRAPER_INGEST_SECRET
 * (HMAC-SHA256, hex) exactly as auth/internal_auth.py verifies it, and sends the
 * signature + timestamp headers. Idempotency: every snapshot carries a job_uuid
 * derived deterministically from the stable BullMQ job id, so a retried job
 * re-POSTs the SAME uuid and the server absorbs it via ON CONFLICT DO NOTHING.
 */
import 'dotenv/config'
import { createHmac, createHash } from 'node:crypto'

const SPECTER_API_URL = process.env.SPECTER_API_URL ?? 'http://localhost:8000'

// Fixed namespace for v5 ids derived from BullMQ job ids (any constant uuid works).
const NAMESPACE_BYTES = Buffer.from('6f1c2d3e4a5b6c7d8e9f0a1b2c3d4e5f', 'hex')

/** HMAC-SHA256 hex of `${timestamp}.${rawBody}` — mirrors the FastAPI verifier. */
export function computeSignature(rawBody: string, timestamp: string, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
}

/** Build the signed request headers for a raw JSON body. */
export function ingestHeaders(
  rawBody: string,
  secret: string,
  nowMs: number = Date.now(),
): Record<string, string> {
  const ts = String(Math.floor(nowMs / 1000))
  return {
    'Content-Type':       'application/json',
    'X-Specter-Timestamp': ts,
    'X-Specter-Signature': computeSignature(rawBody, ts, secret),
  }
}

/**
 * Deterministic RFC-4122 v5 UUID from an arbitrary name (the stable BullMQ job
 * id). Same name → same uuid, so retries of one scrape share an idempotency key
 * while distinct scrapes (distinct job ids) never collide.
 */
export function deterministicUuid(name: string): string {
  const h = createHash('sha1').update(NAMESPACE_BYTES).update(name).digest()
  h[6] = (h[6] & 0x0f) | 0x50  // version 5
  h[8] = (h[8] & 0x3f) | 0x80  // RFC variant
  const hex = h.subarray(0, 16).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/**
 * Build the price-snapshot POST body — the SINGLE source of the ingest payload
 * shape, shared by the http and playwright workers so they cannot drift apart.
 * (The playwright worker once shipped without `job_uuid`/`merchant_cycle_ids` and
 * unsigned, silently losing every JS-required snapshot to a 401.) Always emits a
 * deterministic `job_uuid` for idempotency and a `merchant_cycle_ids` array so the
 * cycle barrier advances even when none are supplied.
 */
export function buildSnapshotBody(params: {
  url: string
  domain: string
  urlPath: string
  competitorTrackingIds: string[]
  price: number
  currency: string
  inStock: boolean
  title: string | null
  needsReview: boolean
  jobId: string
  merchantCycleIds?: unknown[]
  // Cost attribution (Audit #4): which proxy tier paid for the bandwidth, how
  // many bytes were transferred, and whether a CAPTCHA was solved for this fetch.
  // `proxyTier` is null on a direct (no-proxy) fetch → zero proxy cost upstream.
  proxyTier?: string | null
  respBytes?: number
  captchaSolved?: boolean
}): Record<string, unknown> {
  return {
    url:                     params.url,
    domain:                  params.domain,
    url_path:                params.urlPath,
    competitor_tracking_ids: params.competitorTrackingIds,
    price:                   params.price,
    currency:                params.currency,
    in_stock:                params.inStock,
    title:                   params.title,
    needs_review:            params.needsReview,
    // Idempotency key — stable across BullMQ retries of this same job.
    job_uuid:                deterministicUuid(params.jobId),
    // The dispatcher populates these when it opens a cycle; absent for now.
    merchant_cycle_ids:      params.merchantCycleIds ?? [],
    // Cost context — drives the per-merchant cost ledger split (Audit #4).
    proxy_tier:              params.proxyTier ?? null,
    resp_bytes:              params.respBytes ?? 0,
    captcha_solved:          params.captchaSolved ?? false,
  }
}

async function signedPost(path: string, payload: unknown): Promise<Response> {
  const secret  = process.env.SCRAPER_INGEST_SECRET ?? ''
  const rawBody = JSON.stringify(payload)
  return fetch(`${SPECTER_API_URL}${path}`, {
    method:  'POST',
    headers: ingestHeaders(rawBody, secret),
    body:    rawBody,
  })
}

export function postPriceSnapshot(payload: Record<string, unknown>): Promise<Response> {
  return signedPost('/internal/price-snapshot', payload)
}

export function postScrapeFailed(payload: Record<string, unknown>): Promise<Response> {
  return signedPost('/internal/scrape-failed', payload)
}

export function postDomainBlocked(payload: Record<string, unknown>): Promise<Response> {
  return signedPost('/internal/domain-blocked', payload)
}
