// Display-only preview of what auto-reprice would set NOW for a SKU, given its
// current guardrails. Re-clamps the stored suggestion to the current floor/ceiling
// so the preview stays honest if the merchant changed bounds after the signal fired.
// Independent of auto on/off (the toggle and guardrail-coverage own that).

import type { RepriceSKU } from '@/lib/api'

export type RepriceState =
  | 'no-action'
  | 'no-guardrails'
  | 'within'
  | 'floor-clamped'
  | 'ceiling-clamped'

export interface RepricePreview {
  state: RepriceState
  effectivePrice: number | null
}

export function repricePreview(sku: RepriceSKU): RepricePreview {
  const s = sku.latest_suggestion
  const p = s?.price_suggestion ?? null
  if (!s || s.type === 'HOLD' || p === null) {
    return { state: 'no-action', effectivePrice: null }
  }
  const f = sku.floor_price
  const c = sku.ceiling_price
  if (f === null && c === null) {
    return { state: 'no-guardrails', effectivePrice: p }
  }
  if (f !== null && p < f) {
    return { state: 'floor-clamped', effectivePrice: f }
  }
  if (c !== null && p > c) {
    return { state: 'ceiling-clamped', effectivePrice: c }
  }
  return { state: 'within', effectivePrice: p }
}
