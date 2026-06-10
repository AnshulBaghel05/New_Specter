// Per-SKU guardrail status and the page-level coverage summary.

import type { RepriceSKU } from '@/lib/api'

export type GuardrailStatus = 'complete' | 'partial' | 'none'

export function guardrailStatus(sku: RepriceSKU): GuardrailStatus {
  const hasFloor = sku.floor_price !== null
  const hasCeiling = sku.ceiling_price !== null
  if (hasFloor && hasCeiling) return 'complete'
  if (hasFloor || hasCeiling) return 'partial'
  return 'none'
}

function isActionable(sku: RepriceSKU): boolean {
  const s = sku.latest_suggestion
  return !!s && (s.type === 'RAISE' || s.type === 'LOWER') && s.price_suggestion !== null
}

// An actionable suggestion that can't yet act safely: guardrails incomplete OR
// per-SKU auto disabled. (Global auto is shown by the page's global toggle.)
export function needsAttention(sku: RepriceSKU): boolean {
  if (!isActionable(sku)) return false
  return guardrailStatus(sku) !== 'complete' || !sku.auto_reprice_enabled
}

export interface CoverageSummary {
  total: number
  withGuardrails: number
  autoOn: number
  needsAttention: number
}

export function coverageSummary(skus: RepriceSKU[]): CoverageSummary {
  let withGuardrails = 0
  let autoOn = 0
  let attention = 0
  for (const sku of skus) {
    if (guardrailStatus(sku) === 'complete') withGuardrails++
    if (sku.auto_reprice_enabled) autoOn++
    if (needsAttention(sku)) attention++
  }
  return { total: skus.length, withGuardrails, autoOn, needsAttention: attention }
}
