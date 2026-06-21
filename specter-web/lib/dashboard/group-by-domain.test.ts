import { describe, it, expect } from 'vitest'
import { groupByDomain } from './group-by-domain'
import type { Product } from '@/lib/api'

const product = (over: Partial<Product>): Product => ({
  id: 'p', title: 't', handle: null, current_price: 100, currency: 'USD', source: 'manual',
  active: true, floor_price: null, ceiling_price: null, competitor_count: 0,
  latest_signal: null, competitors: [], ...over,
})

describe('groupByDomain', () => {
  it('groups pairings by domain with avg price gap and stock counts', () => {
    const products: Product[] = [
      product({ id: 'a', current_price: 100, competitors: [
        { tracking_id: 't1', competitor_url_id: 'u1', url: 'https://amazon.com/x', domain: 'amazon.com',
          enabled: true, silenced_oos: false, robots_blocked: false, latest_price: 90, currency: 'USD', in_stock: true, last_checked_at: '2026-05-31T00:00:00Z', status: 'live', status_label: 'Tracking normally' },
      ] }),
      product({ id: 'b', current_price: 100, competitors: [
        { tracking_id: 't2', competitor_url_id: 'u2', url: 'https://amazon.com/y', domain: 'amazon.com',
          enabled: true, silenced_oos: false, robots_blocked: false, latest_price: 110, currency: 'USD', in_stock: false, last_checked_at: '2026-05-31T00:00:00Z', status: 'live', status_label: 'Tracking normally' },
      ] }),
    ]
    const groups = groupByDomain(products)
    expect(groups).toHaveLength(1)
    const g = groups[0]
    expect(g.domain).toBe('amazon.com')
    expect(g.productCount).toBe(2)
    expect(g.inStock).toBe(1)
    expect(g.oos).toBe(1)
    // gaps: (90-100)/100 = -0.10 ; (110-100)/100 = +0.10 ; avg = 0
    expect(g.avgPriceGap).toBeCloseTo(0)
    expect(g.health).toBe('healthy')
  })

  it('marks domain blocked when any pairing is robots_blocked', () => {
    const products: Product[] = [product({ competitors: [
      { tracking_id: 't', competitor_url_id: 'u', url: 'https://x.com/p', domain: 'x.com',
        enabled: true, silenced_oos: false, robots_blocked: true, latest_price: null, currency: 'USD', in_stock: null, last_checked_at: null, status: 'blocked', status_label: 'Blocked' },
    ] })]
    expect(groupByDomain(products)[0].health).toBe('blocked')
  })
})
