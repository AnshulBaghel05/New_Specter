import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { computeSignature, ingestHeaders, deterministicUuid, buildSnapshotBody } from '../lib/ingest-client'

// ── computeSignature mirrors the FastAPI verifier byte-for-byte ───────────────

describe('computeSignature', () => {
  it('is HMAC-SHA256 hex of `${ts}.${body}` with the secret', () => {
    const body = '{"a":1}', ts = '1000', secret = 'test-ingest-secret'
    const expected = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')
    expect(computeSignature(body, ts, secret)).toBe(expected)
  })

  it('is 64 hex chars and deterministic', () => {
    const s = computeSignature('{}', '5', 'k')
    expect(s).toMatch(/^[0-9a-f]{64}$/)
    expect(computeSignature('{}', '5', 'k')).toBe(s)
  })

  it('changes when body, timestamp, or secret changes', () => {
    const base = computeSignature('{}', '5', 'k')
    expect(computeSignature('{"x":1}', '5', 'k')).not.toBe(base)
    expect(computeSignature('{}', '6', 'k')).not.toBe(base)
    expect(computeSignature('{}', '5', 'k2')).not.toBe(base)
  })
})

describe('ingestHeaders', () => {
  it('emits seconds-precision timestamp + matching signature', () => {
    const h = ingestHeaders('{"p":9}', 'secret', 1_700_000_500_000)
    expect(h['X-Specter-Timestamp']).toBe('1700000500')  // ms → s
    expect(h['X-Specter-Signature']).toBe(
      computeSignature('{"p":9}', '1700000500', 'secret'),
    )
    expect(h['Content-Type']).toBe('application/json')
  })
})

// ── deterministicUuid — stable idempotency key across retries ─────────────────

describe('deterministicUuid', () => {
  it('is a valid v5 uuid and stable for the same name', () => {
    const a = deterministicUuid('job-1')
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(deterministicUuid('job-1')).toBe(a)        // retries share the key
  })

  it('distinct names give distinct uuids', () => {
    expect(deterministicUuid('job-1')).not.toBe(deterministicUuid('job-2'))
  })
})

// ── buildSnapshotBody — the single ingest payload shape both workers POST ──────
// Lives here so the http and playwright workers cannot drift apart again: the
// playwright worker once shipped without job_uuid/merchant_cycle_ids (and unsigned),
// silently losing every JS-required snapshot to a 401. One builder = one contract.

describe('buildSnapshotBody', () => {
  const base = {
    url: 'https://shop.example.com/products/x',
    domain: 'shop.example.com',
    urlPath: '/products/x',
    competitorTrackingIds: ['ct-1', 'ct-2'],
    price: 49.99,
    currency: 'USD',
    inStock: true,
    title: 'Widget',
    needsReview: false,
    jobId: 'job-42',
  }

  it('maps camelCase inputs to the snake_case API contract', () => {
    const b = buildSnapshotBody(base)
    expect(b.url).toBe(base.url)
    expect(b.domain).toBe(base.domain)
    expect(b.url_path).toBe('/products/x')
    expect(b.competitor_tracking_ids).toEqual(['ct-1', 'ct-2'])
    expect(b.price).toBe(49.99)
    expect(b.currency).toBe('USD')
    expect(b.in_stock).toBe(true)
    expect(b.title).toBe('Widget')
    expect(b.needs_review).toBe(false)
  })

  it('always carries a deterministic job_uuid derived from the job id (idempotency)', () => {
    const b = buildSnapshotBody(base)
    expect(b.job_uuid).toBe(deterministicUuid('job-42'))
    // a retry of the same job re-POSTs the SAME uuid → server absorbs via ON CONFLICT
    expect(buildSnapshotBody(base).job_uuid).toBe(b.job_uuid)
  })

  it('always carries merchant_cycle_ids — empty array when none supplied', () => {
    expect(buildSnapshotBody(base).merchant_cycle_ids).toEqual([])
    const withCycles = buildSnapshotBody({ ...base, merchantCycleIds: [{ merchant_id: 'm1', cycle_id: 3 }] })
    expect(withCycles.merchant_cycle_ids).toEqual([{ merchant_id: 'm1', cycle_id: 3 }])
  })

  it('defaults the cost-context fields to a zero-cost direct fetch', () => {
    const b = buildSnapshotBody(base)
    expect(b.proxy_tier).toBeNull()      // null tier → zero proxy cost upstream
    expect(b.resp_bytes).toBe(0)
    expect(b.captcha_solved).toBe(false)
  })

  it('passes through proxy tier, response bytes, and captcha flag for cost attribution', () => {
    const b = buildSnapshotBody({
      ...base, proxyTier: 'residential', respBytes: 1_234_567, captchaSolved: true,
    })
    expect(b.proxy_tier).toBe('residential')
    expect(b.resp_bytes).toBe(1_234_567)
    expect(b.captcha_solved).toBe(true)
  })
})
