// Pure parsers: URL string -> typed dashboard view-state.
// Unknown values coerce to each param's default so a hand-edited URL never crashes.

import type { SignalType } from '@/lib/api'
import type { ProductSort } from '@/lib/dashboard/sort-products'
import type { ActionSource } from '@/lib/dashboard/deep-links'
import type { AlertSort } from '@/lib/dashboard/alert-helpers'
import type { RepriceFilter, RepriceSort } from '@/lib/dashboard/reprice-filter'
import type { BreakdownSort } from '@/lib/dashboard/attribution-breakdown'

export type DomainSort = 'products' | 'oos' | 'name'

export function parseSignalType(v: string | null): SignalType | undefined {
  return v === 'RAISE' || v === 'LOWER' || v === 'HOLD' ? v : undefined
}

export function parsePage(v: string | null): number {
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 ? n : 0
}

export function parseAlertStatus(v: string | null): 'active' | 'resolved' | undefined {
  return v === 'active' || v === 'resolved' ? v : undefined
}

export function parseProductSort(v: string | null): ProductSort {
  return v === 'signals' || v === 'updated' || v === 'name' ? v : 'signals'
}

export function parseDomainSort(v: string | null): DomainSort {
  return v === 'products' || v === 'oos' || v === 'name' ? v : 'products'
}

export function parseDays(v: string | null): 7 | 30 | 90 {
  const n = Number(v)
  return n === 7 || n === 90 ? n : 30
}

export function parseSource(v: string | null): ActionSource | null {
  return v === 'overview' || v === 'signals' || v === 'alerts' ? v : null
}

export function parseSignalSort(v: string | null): 'recent' | 'confidence' {
  return v === 'confidence' ? 'confidence' : 'recent'
}

export function parseMinConfidence(v: string | null): number {
  return v === '0.5' || v === '0.7' || v === '0.9' ? Number(v) : 0
}

export function parseAlertSort(v: string | null): AlertSort {
  return v === 'oldest' || v === 'domain' ? v : 'recent'
}

export function parseRepriceFilter(v: string | null): RepriceFilter {
  return v === 'needs-attention' || v === 'needs-guardrails' || v === 'auto-on' || v === 'would-clamp'
    ? v
    : 'all'
}

export function parseRepriceSort(v: string | null): RepriceSort {
  return v === 'attention' || v === 'impact' ? v : 'default'
}

export function parseSearchQuery(v: string | null): string {
  return (v ?? '').trim()
}

export function parseBreakdownSort(v: string | null): BreakdownSort {
  return v === 'recovered' || v === 'lost' || v === 'count' ? v : 'net'
}

export function parseDay(v: string | null): string | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}
