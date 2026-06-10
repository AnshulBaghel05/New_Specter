export type PriceSignal = 'RAISE' | 'LOWER' | 'HOLD'

export interface Competitor {
  name: string
  price: number
}

export interface PricePositionInput {
  my_price: number
  competitors: Competitor[]
  target_margin_pct?: number // optional: warn if suggested price breaks margin
}

export interface PricePositionResult {
  market_low: number
  market_high: number
  market_avg: number
  market_median: number
  my_rank: number           // 1 = cheapest
  total_competitors: number
  competitors_below: number
  competitors_above: number
  gap_pct_vs_avg: number
  gap_pct_vs_low: number
  signal: PriceSignal
  signal_reason: string
  suggested_price: number
  potential_revenue_lift_pct: number // if RAISE
  my_position: 'below_market' | 'at_market' | 'above_market'
}

/**
 * gap_pct = (my_price - reference) / reference × 100
 * > +5% above avg → LOWER (you're overpriced, losing conversions)
 * < -5% below avg → RAISE (you're leaving money on the table)
 * otherwise        → HOLD
 */
export function calcGapPct(my_price: number, reference: number): number {
  if (reference <= 0) return 0
  return ((my_price - reference) / reference) * 100
}

export function calcPricePosition(input: PricePositionInput): PricePositionResult {
  const prices = input.competitors.map((c) => c.price).filter((p) => p > 0)
  if (prices.length === 0) {
    return {
      market_low: 0, market_high: 0, market_avg: 0, market_median: 0,
      my_rank: 1, total_competitors: 0,
      competitors_below: 0, competitors_above: 0,
      gap_pct_vs_avg: 0, gap_pct_vs_low: 0,
      signal: 'HOLD', signal_reason: 'No competitors entered.',
      suggested_price: input.my_price, potential_revenue_lift_pct: 0,
      my_position: 'at_market',
    }
  }

  const sorted = [...prices].sort((a, b) => a - b)
  const market_low = sorted[0]
  const market_high = sorted[sorted.length - 1]
  const market_avg = round2(prices.reduce((a, b) => a + b, 0) / prices.length)

  // Median
  const mid = Math.floor(sorted.length / 2)
  const market_median =
    sorted.length % 2 === 0
      ? round2((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid]

  const competitors_below = prices.filter((p) => p < input.my_price).length
  const competitors_above = prices.filter((p) => p > input.my_price).length
  const my_rank = competitors_below + 1  // rank 1 = cheapest

  const gap_pct_vs_avg = round1(calcGapPct(input.my_price, market_avg))
  const gap_pct_vs_low = round1(calcGapPct(input.my_price, market_low))

  let signal: PriceSignal
  let signal_reason: string
  let suggested_price: number
  let potential_revenue_lift_pct = 0

  if (gap_pct_vs_avg > 5) {
    signal = 'LOWER'
    signal_reason = `Your price is ${gap_pct_vs_avg.toFixed(1)}% above market average. Reducing could recover lost conversions.`
    suggested_price = round2(market_avg * 0.99) // just below avg
  } else if (gap_pct_vs_avg < -5) {
    signal = 'RAISE'
    signal_reason = `Your price is ${Math.abs(gap_pct_vs_avg).toFixed(1)}% below market average. You may be leaving margin on the table.`
    suggested_price = round2(market_avg * 0.98) // slightly below avg to stay competitive
    potential_revenue_lift_pct = round1(
      ((suggested_price - input.my_price) / input.my_price) * 100,
    )
  } else {
    signal = 'HOLD'
    signal_reason = `Your price is within ±5% of market average. Position is competitive.`
    suggested_price = input.my_price
  }

  let my_position: 'below_market' | 'at_market' | 'above_market'
  if (gap_pct_vs_avg > 2) my_position = 'above_market'
  else if (gap_pct_vs_avg < -2) my_position = 'below_market'
  else my_position = 'at_market'

  return {
    market_low: round2(market_low),
    market_high: round2(market_high),
    market_avg,
    market_median,
    my_rank,
    total_competitors: prices.length,
    competitors_below,
    competitors_above,
    gap_pct_vs_avg,
    gap_pct_vs_low,
    signal,
    signal_reason,
    suggested_price,
    potential_revenue_lift_pct,
    my_position,
  }
}

function round2(n: number) { return Math.round(n * 100) / 100 }
function round1(n: number) { return Math.round(n * 10) / 10 }
