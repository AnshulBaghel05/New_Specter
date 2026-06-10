// Pure builders for dashboard deep-links.
// ActionSource is the canonical "where did this action originate" tag,
// shared with url-params.ts (parseSource).

export type ActionSource = 'overview' | 'signals' | 'alerts'

export function repricingHref(skuId: string, source?: ActionSource): string {
  const base = `/repricing?sku=${encodeURIComponent(skuId)}`
  return source ? `${base}&source=${encodeURIComponent(source)}` : base
}
