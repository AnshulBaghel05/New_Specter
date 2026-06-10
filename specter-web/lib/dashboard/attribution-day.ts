// Day-bucketing for the chart drill-down. The chart groups server-side by the
// UTC date of created_at, so the client must match (iso.slice(0,10)).

import type { PriceChange } from '@/lib/api'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

// "2026-05-28" -> "May 28". Pure string math (no Date) so it is timezone-safe.
export function formatDayLabel(day: string): string {
  const [, m, d] = day.split('-').map(Number)
  const month = MONTHS[(m ?? 1) - 1] ?? ''
  return `${month} ${d ?? ''}`.trim()
}

// Accounted changes on a given YYYY-MM-DD, biggest movers first.
export function changesOnDay(accounted: PriceChange[], day: string): PriceChange[] {
  return accounted
    .filter((c) => dayKey(c.created_at) === day)
    .sort((a, b) => Math.abs(b.revenue_delta ?? 0) - Math.abs(a.revenue_delta ?? 0))
}
