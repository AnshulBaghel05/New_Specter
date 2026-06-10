import type { Product } from '@/lib/api'

export type DomainHealth = 'healthy' | 'degraded' | 'blocked'

export interface DomainPairing {
  productId: string
  productTitle: string
  trackingId: string
  url: string
  latestPrice: number | null
  inStock: boolean | null
  lastCheckedAt: string | null
  robotsBlocked: boolean
  silencedOos: boolean
}

export interface DomainGroup {
  domain: string
  productCount: number
  inStock: number
  oos: number
  avgPriceGap: number | null   // mean (competitor - your) / your ; null if no priced pairings
  health: DomainHealth
  lastCheckedAt: string | null // newest across pairings
  pairings: DomainPairing[]
}

export function groupByDomain(products: Product[]): DomainGroup[] {
  const map = new Map<string, DomainPairing[]>()
  const gapByDomain = new Map<string, number[]>()

  for (const prod of products) {
    for (const c of prod.competitors) {
      if (!c.domain) continue
      const list = map.get(c.domain) ?? []
      list.push({
        productId: prod.id, productTitle: prod.title, trackingId: c.tracking_id,
        url: c.url, latestPrice: c.latest_price, inStock: c.in_stock,
        lastCheckedAt: c.last_checked_at, robotsBlocked: c.robots_blocked,
        silencedOos: c.silenced_oos,
      })
      map.set(c.domain, list)
      if (c.latest_price != null && prod.current_price != null && prod.current_price > 0) {
        const gaps = gapByDomain.get(c.domain) ?? []
        gaps.push((c.latest_price - prod.current_price) / prod.current_price)
        gapByDomain.set(c.domain, gaps)
      }
    }
  }

  const groups: DomainGroup[] = []
  map.forEach((pairings, domain) => {
    const gaps = gapByDomain.get(domain) ?? []
    const avgPriceGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null
    const inStock = pairings.filter(p => p.inStock === true).length
    const oos = pairings.filter(p => p.inStock === false).length
    const blocked = pairings.some(p => p.robotsBlocked)
    const allMissing = pairings.every(p => p.latestPrice == null)
    const lastCheckedAt = pairings
      .map(p => p.lastCheckedAt).filter(Boolean)
      .sort().at(-1) ?? null
    const health: DomainHealth = blocked ? 'blocked' : allMissing ? 'degraded' : 'healthy'
    groups.push({ domain, productCount: pairings.length, inStock, oos, avgPriceGap, health, lastCheckedAt, pairings })
  })
  return groups
}
