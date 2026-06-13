import { describe, it, expect } from 'vitest'
import {
  isActivated,
  deriveOverviewState,
  accountBanners,
  trialDaysLeft,
} from './overview-state'
import type { Merchant, Product, ProductsResponse } from '@/lib/api'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    title: 'Wireless Earbuds',
    handle: null,
    current_price: null,
    source: 'manual',
    active: true,
    floor_price: null,
    ceiling_price: null,
    competitor_count: 0,
    latest_signal: null,
    competitors: [],
    ...overrides,
  }
}

function makeProducts(items: Product[]): ProductsResponse {
  return { items, sku_used: items.length, sku_limit: null, max_competitors_per_sku: null }
}

function makeMerchant(overrides: Partial<Merchant> = {}): Merchant {
  return {
    id: 'm1',
    plan: 'recon',
    shopify_domain: null,
    shopify_connected: false,
    shopify_reconnect_required: false,
    trial_ends_at: null,
    read_only: false,
    eclipse_interval_ms: 0,
    max_competitors_per_sku: null,
    auto_reprice_enabled: false,
    email_notifications_enabled: false,
    subscription_current_end: null,
    subscription_cancel_at: null,
    ...overrides,
  }
}

const SIGNAL = { type: 'RAISE' as const, price_suggestion: 42, confidence: 0.9, created_at: '' }

describe('isActivated', () => {
  it('is false when products is undefined', () => {
    expect(isActivated(undefined)).toBe(false)
  })
  it('is false when no product has a signal', () => {
    expect(isActivated(makeProducts([makeProduct({ competitor_count: 1 })]))).toBe(false)
  })
  it('is true when a product has a latest_signal', () => {
    expect(isActivated(makeProducts([makeProduct({ latest_signal: SIGNAL })]))).toBe(true)
  })
})

describe('trialDaysLeft', () => {
  const now = new Date('2026-06-02T12:00:00Z')
  it('returns null when there is no trial date', () => {
    expect(trialDaysLeft(null, now)).toBeNull()
  })
  it('returns whole days remaining for a future date', () => {
    expect(trialDaysLeft('2026-06-05T12:00:00Z', now)).toBe(3)
  })
  it('returns null for a past/expired date', () => {
    expect(trialDaysLeft('2026-06-01T12:00:00Z', now)).toBeNull()
  })
  it('returns null for an unparseable date', () => {
    expect(trialDaysLeft('not-a-date', now)).toBeNull()
  })
})

describe('accountBanners', () => {
  const now = new Date('2026-06-02T12:00:00Z')
  it('returns [] when merchant is undefined', () => {
    expect(accountBanners(undefined, now)).toEqual([])
  })
  it('returns [] when nothing is wrong', () => {
    expect(accountBanners(makeMerchant(), now)).toEqual([])
  })
  it('surfaces a reconnect banner', () => {
    const b = accountBanners(makeMerchant({ shopify_reconnect_required: true }), now)
    expect(b.map((x) => x.kind)).toEqual(['reconnect'])
    expect(b[0].severity).toBe('urgent')
  })
  it('surfaces a read-only banner', () => {
    const b = accountBanners(makeMerchant({ read_only: true }), now)
    expect(b.map((x) => x.kind)).toEqual(['read_only'])
  })
  it('surfaces a trial banner with day count', () => {
    const b = accountBanners(makeMerchant({ trial_ends_at: '2026-06-05T12:00:00Z' }), now)
    expect(b.map((x) => x.kind)).toEqual(['trial'])
    expect(b[0].severity).toBe('info')
    expect(b[0].title).toContain('3 days')
  })
  it('orders multiple banners reconnect, read_only, trial', () => {
    const b = accountBanners(
      makeMerchant({
        shopify_reconnect_required: true,
        read_only: true,
        trial_ends_at: '2026-06-05T12:00:00Z',
      }),
      now,
    )
    expect(b.map((x) => x.kind)).toEqual(['reconnect', 'read_only', 'trial'])
  })
})

describe('deriveOverviewState', () => {
  it('returns null while products is loading', () => {
    expect(deriveOverviewState(undefined, makeMerchant())).toBeNull()
  })
  it('empty catalog: all steps pending, not activated', () => {
    const s = deriveOverviewState(makeProducts([]), makeMerchant())!
    expect(s.activated).toBe(false)
    expect(s.steps.map((x) => x.done)).toEqual([false, false, false])
  })
  it('products only: step 1 done, rest pending', () => {
    const s = deriveOverviewState(makeProducts([makeProduct()]), makeMerchant())!
    expect(s.steps.map((x) => x.done)).toEqual([true, false, false])
    expect(s.activated).toBe(false)
  })
  it('linked competitor but no signal yet: steps 1 and 2 done, 3 pending', () => {
    const s = deriveOverviewState(makeProducts([makeProduct({ competitor_count: 1 })]), makeMerchant())!
    expect(s.steps.map((x) => x.done)).toEqual([true, true, false])
    expect(s.activated).toBe(false)
  })
  it('first signal received: all steps done, activated', () => {
    const s = deriveOverviewState(
      makeProducts([makeProduct({ competitor_count: 1, latest_signal: SIGNAL })]),
      makeMerchant(),
    )!
    expect(s.steps.map((x) => x.done)).toEqual([true, true, true])
    expect(s.activated).toBe(true)
  })
  it('the automatic signal step has no cta', () => {
    const s = deriveOverviewState(makeProducts([]), makeMerchant())!
    expect(s.steps[2].id).toBe('signal')
    expect(s.steps[2].cta).toBeUndefined()
  })
})
