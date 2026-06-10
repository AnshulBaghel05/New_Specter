export interface RoasInput {
  ad_spend: number
  revenue: number
  cogs: number
  fulfillment_and_shipping: number  // variable costs beyond COGS
  monthly_orders?: number
}

export interface RoasResult {
  roas: number
  troas: number             // true ROAS = gross_profit / ad_spend
  gross_profit: number
  gross_margin_pct: number
  net_profit: number        // gross_profit - ad_spend
  net_margin_pct: number
  break_even_roas: number   // 1 / gross_margin
  break_even_spend: number  // max ad spend to break even at this revenue
  profit_per_ad_dollar: number
  is_profitable: boolean
  efficiency_score: string  // qualitative assessment
}

/**
 * Break-even ROAS = 1 / gross_margin
 * Example: 40% margin → break-even ROAS = 2.5×
 * ROAS > break-even → profitable campaign
 */
export function calcBreakEvenRoas(gross_margin: number): number {
  if (gross_margin <= 0) return 0
  return 1 / gross_margin
}

export function calcRoas(input: RoasInput): RoasResult {
  const { ad_spend, revenue, cogs, fulfillment_and_shipping } = input

  const variable_costs = cogs + fulfillment_and_shipping
  const gross_profit = round2(revenue - variable_costs)
  const gross_margin = revenue > 0 ? gross_profit / revenue : 0
  const gross_margin_pct = round1(gross_margin * 100)

  const roas = ad_spend > 0 ? round2(revenue / ad_spend) : 0
  const troas = ad_spend > 0 ? round2(gross_profit / ad_spend) : 0

  const net_profit = round2(gross_profit - ad_spend)
  const net_margin_pct = revenue > 0 ? round1((net_profit / revenue) * 100) : 0

  const break_even_roas = round2(calcBreakEvenRoas(gross_margin))
  const break_even_spend = break_even_roas > 0 ? round2(revenue / break_even_roas) : 0

  const profit_per_ad_dollar = ad_spend > 0 ? round2(net_profit / ad_spend) : 0

  let efficiency_score: string
  if (troas <= 0) efficiency_score = 'Unprofitable'
  else if (troas < 1) efficiency_score = 'Below break-even'
  else if (troas < 2) efficiency_score = 'Marginally profitable'
  else if (troas < 4) efficiency_score = 'Healthy'
  else efficiency_score = 'Excellent'

  return {
    roas,
    troas,
    gross_profit,
    gross_margin_pct,
    net_profit,
    net_margin_pct,
    break_even_roas,
    break_even_spend,
    profit_per_ad_dollar,
    is_profitable: net_profit > 0,
    efficiency_score,
  }
}

function round2(n: number) { return Math.round(n * 100) / 100 }
function round1(n: number) { return Math.round(n * 10) / 10 }

// ── Funnel model ─────────────────────────────────────────────────────────────

export type AdPlatform = 'meta' | 'google_shopping' | 'google_search' | 'tiktok' | 'amazon' | 'email'

export interface PlatformBenchmark {
  platform: AdPlatform
  label: string
  avg_roas_low: number
  avg_roas_high: number
  avg_ctr_pct: number
  avg_cvr_pct: number
  avg_cpc_usd: number
}

const _BENCHMARK_MAP: Record<AdPlatform, PlatformBenchmark> = {
  meta:            { platform: 'meta',            label: 'Meta (Facebook/Instagram)', avg_roas_low: 2.0,  avg_roas_high: 5.0,  avg_ctr_pct: 1.1, avg_cvr_pct: 1.5,  avg_cpc_usd: 1.20 },
  google_shopping: { platform: 'google_shopping', label: 'Google Shopping',           avg_roas_low: 3.0,  avg_roas_high: 8.0,  avg_ctr_pct: 0.6, avg_cvr_pct: 3.0,  avg_cpc_usd: 0.85 },
  google_search:   { platform: 'google_search',   label: 'Google Search',             avg_roas_low: 2.0,  avg_roas_high: 4.0,  avg_ctr_pct: 1.5, avg_cvr_pct: 3.5,  avg_cpc_usd: 1.75 },
  tiktok:          { platform: 'tiktok',          label: 'TikTok Ads',                avg_roas_low: 1.5,  avg_roas_high: 3.0,  avg_ctr_pct: 1.5, avg_cvr_pct: 1.0,  avg_cpc_usd: 0.60 },
  amazon:          { platform: 'amazon',          label: 'Amazon Ads (PPC)',          avg_roas_low: 3.0,  avg_roas_high: 8.0,  avg_ctr_pct: 0.4, avg_cvr_pct: 10.0, avg_cpc_usd: 1.20 },
  email:           { platform: 'email',           label: 'Email Marketing',           avg_roas_low: 15.0, avg_roas_high: 40.0, avg_ctr_pct: 3.0, avg_cvr_pct: 5.0,  avg_cpc_usd: 0.05 },
}

export const PLATFORM_BENCHMARKS: PlatformBenchmark[] = Object.values(_BENCHMARK_MAP)

export interface FunnelInput {
  platform: AdPlatform
  impressions: number
  ctr_pct: number
  cpc_usd: number
  cvr_pct: number
  aov_usd: number
  cogs_pct: number
  fulfillment_pct: number
}

export interface FunnelResult {
  clicks: number
  ad_spend: number
  conversions: number
  revenue: number
  roas: number
  troas: number
  cpa: number
  gross_profit: number
  net_profit: number
  break_even_roas: number
  break_even_cvr_pct: number
  gross_margin_pct: number
  benchmark: PlatformBenchmark
  roas_vs_benchmark: 'below' | 'in_range' | 'above'
  ctr_vs_benchmark: 'below' | 'in_range' | 'above'
  cvr_vs_benchmark: 'below' | 'in_range' | 'above'
}

function vsRange(val: number, low: number, high: number): 'below' | 'in_range' | 'above' {
  if (val < low) return 'below'
  if (val > high) return 'above'
  return 'in_range'
}

export function calcFunnel(input: FunnelInput): FunnelResult {
  const { platform, impressions, ctr_pct, cpc_usd, cvr_pct, aov_usd, cogs_pct, fulfillment_pct } = input

  const clicks = Math.round(impressions * ctr_pct / 100)
  const ad_spend = round2(clicks * cpc_usd)
  const conversions = Math.round(clicks * cvr_pct / 100)
  const revenue = round2(conversions * aov_usd)
  const gross_margin = 1 - cogs_pct / 100 - fulfillment_pct / 100
  const gross_profit = round2(revenue * gross_margin)
  const net_profit = round2(gross_profit - ad_spend)
  const roas = ad_spend > 0 ? round2(revenue / ad_spend) : 0
  const troas = ad_spend > 0 ? round2(gross_profit / ad_spend) : 0
  const cpa = conversions > 0 ? round2(ad_spend / conversions) : 0
  const break_even_roas = gross_margin > 0 ? round2(1 / gross_margin) : 0
  const break_even_cvr_pct =
    aov_usd > 0 && gross_margin > 0
      ? round2(cpc_usd / (aov_usd * gross_margin) * 100)
      : 0
  const gross_margin_pct = round1(gross_margin * 100)

  const benchmark = _BENCHMARK_MAP[platform]

  return {
    clicks,
    ad_spend,
    conversions,
    revenue,
    roas,
    troas,
    cpa,
    gross_profit,
    net_profit,
    break_even_roas,
    break_even_cvr_pct,
    gross_margin_pct,
    benchmark,
    roas_vs_benchmark: vsRange(roas, benchmark.avg_roas_low, benchmark.avg_roas_high),
    ctr_vs_benchmark:  vsRange(ctr_pct, benchmark.avg_ctr_pct * 0.8, benchmark.avg_ctr_pct * 1.2),
    cvr_vs_benchmark:  vsRange(cvr_pct, benchmark.avg_cvr_pct * 0.8, benchmark.avg_cvr_pct * 1.2),
  }
}
