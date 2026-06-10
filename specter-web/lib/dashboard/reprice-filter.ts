// Pure search / filter / sort over the repricing SKU list. All URL-driven on the page.

import type { RepriceSKU } from '@/lib/api'
import { repricePreview } from '@/lib/dashboard/reprice-preview'
import { guardrailStatus, needsAttention } from '@/lib/dashboard/guardrail-coverage'
import { priceDeltaPct } from '@/lib/dashboard/price-delta'

export type RepriceFilter = 'all' | 'needs-attention' | 'needs-guardrails' | 'auto-on' | 'would-clamp'
export type RepriceSort = 'default' | 'attention' | 'impact'

export function searchRepriceSKUs(skus: RepriceSKU[], query: string): RepriceSKU[] {
  const q = query.trim().toLowerCase()
  if (q === '') return skus
  return skus.filter((s) => s.title.toLowerCase().includes(q))
}

export function filterRepriceSKUs(skus: RepriceSKU[], filter: RepriceFilter): RepriceSKU[] {
  switch (filter) {
    case 'needs-attention':
      return skus.filter(needsAttention)
    case 'needs-guardrails':
      return skus.filter((s) => {
        const st = repricePreview(s).state
        const incomplete = guardrailStatus(s) !== 'complete'
        const clamped = st === 'floor-clamped' || st === 'ceiling-clamped'
        return incomplete || clamped
      })
    case 'auto-on':
      return skus.filter((s) => s.auto_reprice_enabled)
    case 'would-clamp':
      return skus.filter((s) => {
        const st = repricePreview(s).state
        return st === 'floor-clamped' || st === 'ceiling-clamped'
      })
    case 'all':
    default:
      return skus
  }
}

function impactMagnitude(sku: RepriceSKU): number | null {
  const pct = priceDeltaPct(sku.current_price, repricePreview(sku).effectivePrice)
  return pct === null ? null : Math.abs(pct)
}

export function sortRepriceSKUs(skus: RepriceSKU[], sort: RepriceSort): RepriceSKU[] {
  const out = [...skus]
  if (sort === 'attention') {
    // needs-attention first; Array.sort is stable so within-group order is preserved.
    out.sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)))
  } else if (sort === 'impact') {
    out.sort((a, b) => {
      const ma = impactMagnitude(a)
      const mb = impactMagnitude(b)
      if (ma === null && mb === null) return 0
      if (ma === null) return 1 // nulls last
      if (mb === null) return -1
      return mb - ma
    })
  }
  return out
}
