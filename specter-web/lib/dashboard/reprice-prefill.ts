// Pure rules for the Repricing deep-link landing: which guardrail bound to
// prefill from the latest suggestion, and the connecting toast copy.

import type { RepriceSKU } from '@/lib/api'

export interface PrefillResult {
  bound: 'floor' | 'ceiling' | null
  value: string | null
}

// RAISE -> ceiling, LOWER -> floor, HOLD / no suggestion -> no prefill.
export function repricePrefill(sku: RepriceSKU): PrefillResult {
  const s = sku.latest_suggestion
  if (!s || s.price_suggestion === null) return { bound: null, value: null }
  if (s.type === 'RAISE') return { bound: 'ceiling', value: s.price_suggestion.toFixed(2) }
  if (s.type === 'LOWER') return { bound: 'floor', value: s.price_suggestion.toFixed(2) }
  return { bound: null, value: null }
}

export interface LandingToast {
  title: string
  description?: string
}

export function formatLandingToast(sku: RepriceSKU): LandingToast {
  const { bound, value } = repricePrefill(sku)
  const title = `Reviewing ${sku.title}`
  if (bound && value) {
    return { title, description: `Suggested ${bound}: $${value}` }
  }
  return { title }
}
