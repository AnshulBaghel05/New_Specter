# ROAS Calculator Enhancement — Design Spec

**Date:** 2026-05-27
**Sub-project:** F — Full attribution model, platform benchmarks, funnel metrics

---

## Goal

Extend the existing ROAS calculator with a full funnel model (impressions → clicks → conversions → revenue), platform benchmarks (industry ROAS/CTR/CVR averages for Meta, Google, TikTok, Amazon, Email), and a break-even CVR calculator. Rebuild the page as a 2-tab UI (Basic ROAS | Funnel Analysis) with a Platform Benchmarks reference card pinned below both tabs. Full infrastructure parity: `useCurrency`, `ScenarioPanel`, `ExportBar`, `PrintReport`.

---

## Architecture

Two new exported calc functions added to `lib/tools/roas.ts` alongside existing `calcRoas`. Page becomes a 2-tab UI (Basic ROAS | Funnel Analysis) with Platform Benchmarks always pinned below. Full infrastructure parity.

**Tech Stack:** TypeScript, Vitest, existing tool-layout components, `useCurrency` hook.

---

## File Map

| File | Change |
|------|--------|
| `lib/tools/roas.ts` | Add `AdPlatform`, `PlatformBenchmark`, `PLATFORM_BENCHMARKS`, `FunnelInput`, `FunnelResult`, `calcFunnel` |
| `__tests__/tools/roas.test.ts` | Append ~12 tests for `calcFunnel` |
| `app/tools/roas-calculator/page.tsx` | Full rewrite — 2 tabs, currency, scenarios, export |

---

## Data Models

### Platform Benchmarks

```ts
export type AdPlatform = 'meta' | 'google_shopping' | 'google_search' | 'tiktok' | 'amazon' | 'email'

export interface PlatformBenchmark {
  platform: AdPlatform
  label: string
  avg_roas_low: number    // lower end of typical ROAS range
  avg_roas_high: number   // upper end
  avg_ctr_pct: number     // typical CTR %
  avg_cvr_pct: number     // typical CVR %
  avg_cpc_usd: number     // typical CPC in USD (ecommerce)
}

export const PLATFORM_BENCHMARKS: PlatformBenchmark[] = [
  { platform: 'meta',            label: 'Meta (Facebook/Instagram)', avg_roas_low: 2.0, avg_roas_high: 5.0,  avg_ctr_pct: 1.1, avg_cvr_pct: 1.5,  avg_cpc_usd: 1.20 },
  { platform: 'google_shopping', label: 'Google Shopping',          avg_roas_low: 3.0, avg_roas_high: 8.0,  avg_ctr_pct: 0.6, avg_cvr_pct: 3.0,  avg_cpc_usd: 0.85 },
  { platform: 'google_search',   label: 'Google Search',            avg_roas_low: 2.0, avg_roas_high: 4.0,  avg_ctr_pct: 1.5, avg_cvr_pct: 3.5,  avg_cpc_usd: 1.75 },
  { platform: 'tiktok',          label: 'TikTok Ads',               avg_roas_low: 1.5, avg_roas_high: 3.0,  avg_ctr_pct: 1.5, avg_cvr_pct: 1.0,  avg_cpc_usd: 0.60 },
  { platform: 'amazon',          label: 'Amazon Ads (PPC)',         avg_roas_low: 3.0, avg_roas_high: 8.0,  avg_ctr_pct: 0.4, avg_cvr_pct: 10.0, avg_cpc_usd: 1.20 },
  { platform: 'email',           label: 'Email Marketing',          avg_roas_low: 15.0,avg_roas_high: 40.0, avg_ctr_pct: 3.0, avg_cvr_pct: 5.0,  avg_cpc_usd: 0.05 },
]
```

### Funnel Model

```ts
export interface FunnelInput {
  platform: AdPlatform
  impressions: number
  ctr_pct: number       // click-through rate %
  cpc_usd: number       // cost per click
  cvr_pct: number       // conversion rate % (of clicks)
  aov_usd: number       // average order value
  cogs_pct: number      // COGS as % of revenue
  fulfillment_pct: number  // fulfillment/shipping as % of revenue
}

export interface FunnelResult {
  clicks: number                   // impressions × ctr/100
  ad_spend: number                 // clicks × cpc
  conversions: number              // clicks × cvr/100
  revenue: number                  // conversions × aov
  roas: number                     // revenue / ad_spend
  troas: number                    // gross_profit / ad_spend
  cpa: number                      // ad_spend / conversions
  gross_profit: number             // revenue × (1 - cogs_pct/100 - fulfillment_pct/100)
  net_profit: number               // gross_profit - ad_spend
  break_even_roas: number          // 1 / gross_margin
  break_even_cvr_pct: number       // cpc / (aov × gross_margin) × 100
  gross_margin_pct: number
  benchmark: PlatformBenchmark
  roas_vs_benchmark: 'below' | 'in_range' | 'above'
  ctr_vs_benchmark: 'below' | 'in_range' | 'above'
  cvr_vs_benchmark: 'below' | 'in_range' | 'above'
}
```

---

## Business Logic

### `calcFunnel(input: FunnelInput): FunnelResult`

```
clicks = round(impressions × ctr_pct / 100)
ad_spend = round2(clicks × cpc_usd)
conversions = round(clicks × cvr_pct / 100)
revenue = round2(conversions × aov_usd)
gross_margin = 1 - cogs_pct/100 - fulfillment_pct/100
gross_profit = round2(revenue × gross_margin)
net_profit = round2(gross_profit - ad_spend)
roas = ad_spend > 0 ? round2(revenue / ad_spend) : 0
troas = ad_spend > 0 ? round2(gross_profit / ad_spend) : 0
cpa = conversions > 0 ? round2(ad_spend / conversions) : 0
break_even_roas = gross_margin > 0 ? round2(1 / gross_margin) : 0
break_even_cvr_pct = (aov_usd > 0 && gross_margin > 0)
  ? round2(cpc_usd / (aov_usd × gross_margin) × 100)
  : 0

benchmark = PLATFORM_BENCHMARKS.find(p => p.platform === platform)
roas_vs_benchmark:
  roas < benchmark.avg_roas_low → 'below'
  roas > benchmark.avg_roas_high → 'above'
  else → 'in_range'
(same pattern for ctr and cvr)
```

---

## Page Layout

```
┌─ Currency picker ──────── ScenarioPanel ── ExportBar ┐
│  [Basic ROAS] [Funnel Analysis]                       │
│  ┌── Inputs ──────────┐  ┌── Results ──────────────┐ │
│  │  (tab-specific)    │  │  (tab-specific)         │ │
│  └────────────────────┘  └─────────────────────────┘ │
│  ┌── Platform Benchmarks (always visible) ──────────┐ │
│  │  6-row table: platform, ROAS range, CTR, CVR, CPC│ │
│  └───────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## Testing Plan (~12 tests in `__tests__/tools/roas.test.ts`)

### `calcFunnel` (~12 tests)
- `clicks = round(impressions × ctr/100)` — 100k impressions × 1% = 1000 clicks
- `ad_spend = clicks × cpc` — 1000 × $1.20 = $1200
- `conversions = round(clicks × cvr/100)` — 1000 × 2% = 20 conversions
- `revenue = conversions × aov` — 20 × $80 = $1600
- `roas = revenue / ad_spend` — 1600/1200 = 1.33
- `gross_profit = revenue × margin` — 1600 × 0.45 = $720 (cogs=40%, fulfillment=15%)
- `cpa = ad_spend / conversions` — 1200/20 = $60
- `break_even_cvr_pct = cpc / (aov × gross_margin)` — 1.20/(80×0.45)×100 = 3.33%
- `roas_vs_benchmark = 'below'` for Meta when roas < 2.0
- `ctr_vs_benchmark = 'in_range'` for Meta when ctr = 1.1%
- `roas_vs_benchmark = 'above'` for Email when roas = 50
- ad_spend=0 edge case: roas=0, troas=0, cpa=0
