// Percentage delta between a signal's suggested price and the SKU's current price.

export function priceDeltaPct(
  current: number | null,
  suggestion: number | null,
): number | null {
  if (current === null || suggestion === null || current <= 0) return null
  return ((suggestion - current) / current) * 100
}

// "+4.1%" / "−3.0%" (unicode minus), or null when priceDeltaPct is null.
export function formatPriceDelta(
  current: number | null,
  suggestion: number | null,
): string | null {
  const pct = priceDeltaPct(current, suggestion)
  if (pct === null) return null
  const sign = pct < 0 ? '−' : '+'
  return `${sign}${Math.abs(pct).toFixed(1)}%`
}
