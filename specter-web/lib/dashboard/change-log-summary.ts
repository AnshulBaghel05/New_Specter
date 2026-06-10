// Summary line for the price-change log: how many changes and the net revenue impact.

import type { PriceChange } from '@/lib/api'

export interface ChangeLogSummary {
  count: number
  netRevenueDelta: number | null
}

export function changeLogSummary(changes: PriceChange[]): ChangeLogSummary {
  let sum = 0
  let any = false
  for (const c of changes) {
    if (c.revenue_delta !== null) {
      sum += c.revenue_delta
      any = true
    }
  }
  return { count: changes.length, netRevenueDelta: any ? sum : null }
}
