// Per-SKU aggregation of attributed (auto) price changes — the leaderboard's source.
// The chart endpoint stays authoritative for totals; this is a "where did it come
// from" lens derived from the recent change log.

import type { PriceChange } from '@/lib/api'

export type BreakdownSort = 'net' | 'recovered' | 'lost' | 'count'

export interface SkuBreakdown {
  sku_id: string
  sku_title: string
  recovered: number // sum of positive deltas (>= 0)
  lost: number // sum of negative deltas (<= 0)
  net: number // recovered + lost
  count: number // number of accounted changes
}

// Filter the change log to what the attribution chart counts: auto source,
// non-null revenue_delta, created within the trailing `days` window.
export function attributionAccountedChanges(
  changes: PriceChange[],
  days: number,
  now: number = Date.now(),
): PriceChange[] {
  const cutoff = now - days * 86_400_000
  return changes.filter(
    (c) =>
      c.source === 'auto' &&
      c.revenue_delta !== null &&
      new Date(c.created_at).getTime() >= cutoff,
  )
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function skuBreakdown(accounted: PriceChange[]): SkuBreakdown[] {
  const map = new Map<string, SkuBreakdown>()
  for (const c of accounted) {
    const delta = c.revenue_delta ?? 0
    let r = map.get(c.sku_id)
    if (!r) {
      r = { sku_id: c.sku_id, sku_title: c.sku_title, recovered: 0, lost: 0, net: 0, count: 0 }
      map.set(c.sku_id, r)
    }
    if (delta >= 0) r.recovered += delta
    else r.lost += delta
    r.net += delta
    r.count += 1
  }
  return Array.from(map.values()).map((r) => ({
    ...r,
    recovered: round2(r.recovered),
    lost: round2(r.lost),
    net: round2(r.net),
  }))
}

function byTitle(a: SkuBreakdown, b: SkuBreakdown): number {
  return a.sku_title.localeCompare(b.sku_title)
}

// Fully deterministic (total order) — equal-value rows resolve down to sku_title asc.
export function sortSkuBreakdown(rows: SkuBreakdown[], sort: BreakdownSort): SkuBreakdown[] {
  const copy = [...rows]
  switch (sort) {
    case 'recovered':
      return copy.sort((a, b) => b.recovered - a.recovered || b.net - a.net || byTitle(a, b))
    case 'lost':
      return copy.sort((a, b) => a.lost - b.lost || a.net - b.net || byTitle(a, b))
    case 'count':
      return copy.sort((a, b) => b.count - a.count || b.net - a.net || byTitle(a, b))
    case 'net':
    default:
      return copy.sort((a, b) => b.net - a.net || b.recovered - a.recovered || byTitle(a, b))
  }
}

export function totalChangeCount(rows: SkuBreakdown[]): number {
  return rows.reduce((sum, r) => sum + r.count, 0)
}

// True when the raw change response is exactly at the 100-row cap — older
// qualifying changes MAY exist beyond what was loaded.
export function isBreakdownPartial(rawCount: number): boolean {
  return rawCount === 100
}

// "+$420.00" / "−$210.50" — unicode minus (U+2212), matching price-delta.ts.
export function formatSignedUsd(n: number): string {
  const sign = n < 0 ? '−' : '+'
  return `${sign}$${Math.abs(n).toFixed(2)}`
}
