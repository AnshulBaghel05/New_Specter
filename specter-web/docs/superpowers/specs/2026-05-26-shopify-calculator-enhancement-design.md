# Shopify Calculator Enhancement — Design Spec

**Date:** 2026-05-26
**Sub-project:** C
**Status:** Approved

---

## Goal

Extend the Shopify True Profit Calculator with three new analytical models — LTV + repeat purchase, plan optimizer, and full subscription revenue — plus wire the shared currency/scenario/export infrastructure already used by the FBA calculator.

---

## Architecture

Single-page enhancement. No new routes. The existing `/tools/shopify-profit-calculator` page gains new sections below the current P&L grid. All four sections (P&L, LTV, Plan Optimizer, Subscription) share one `useCurrency` instance and one `ScenarioPanel` namespace (`toolId="shopify"`).

**Modified files:**
- `lib/tools/shopify-profit.ts` — add `calcLtv`, `calcPlanOptimizer`, `calcSubscription` functions + their input/result types. `calcShopifyProfit` is untouched.
- `app/tools/shopify-profit-calculator/page.tsx` — wire `useCurrency`, `ScenarioPanel`, `ExportBar`, `PrintReport`; add LTV, Plan Optimizer, Subscription cards; fix `h-5.5` Tailwind bug (→ `h-6`).

**New files:**
- `__tests__/tools/shopify-profit.test.ts` — Vitest unit tests for all three new calc functions.

**Existing files used without change:**
- `lib/tools/benchmarks.ts` — add `shopify: { ltv_cac_healthy: 3, nrr_healthy: 1.0 }` to `BENCHMARKS`
- `components/tools/tool-chart.tsx` — `ToolPieChart`, `ToolBarChart`, `ToolLineChart`
- `hooks/use-currency.ts`, `hooks/use-scenarios.ts`
- `components/tools/scenario-panel.tsx`, `export-bar.tsx`, `print-report.tsx`

---

## Calculation Logic

### calcLtv

```ts
export type LtvMode = 'frequency' | 'churn'

export interface LtvInput {
  mode: LtvMode
  avg_order_value: number       // USD
  purchases_per_year: number
  // frequency mode only:
  customer_lifespan_years?: number
  // churn mode only:
  monthly_churn_rate_pct?: number  // e.g. 5 = 5%
  cac: number                   // customer acquisition cost, USD
  true_margin_pct: number       // from calcShopifyProfit result
}

export interface LtvResult {
  customer_lifespan_months: number
  ltv: number
  net_ltv: number
  ltv_cac_ratio: number
  payback_months: number
  health: 'healthy' | 'tight' | 'danger'  // ≥3 / 1–3 / <1
}
```

**Frequency mode:**
```
customer_lifespan_months = customer_lifespan_years × 12
ltv = avg_order_value × purchases_per_year × customer_lifespan_years
```

**Churn mode:**
```
customer_lifespan_months = 100 / monthly_churn_rate_pct
customer_lifespan_years = customer_lifespan_months / 12
ltv = avg_order_value × (purchases_per_year / 12) × customer_lifespan_months
```

**Shared (both modes):**
```
net_ltv = ltv × (true_margin_pct / 100) - cac
ltv_cac_ratio = ltv / cac                          // 0 when cac=0
monthly_profit_per_customer = avg_order_value × (purchases_per_year / 12) × (true_margin_pct / 100)
payback_months = cac / monthly_profit_per_customer  // 0 when margin=0
health = ltv_cac_ratio >= BENCHMARKS.shopify.ltv_cac_healthy ? 'healthy'
       : ltv_cac_ratio >= 1 ? 'tight'
       : 'danger'
```

---

### calcPlanOptimizer

```ts
export interface PlanOptimizerInput {
  monthly_revenue: number
  monthly_orders: number
  uses_shopify_payments: boolean
  cogs: number
  app_spend: number
  avg_return_rate_pct: number
  return_restocking_pct: number
  monthly_shipping_cost: number
  monthly_ad_spend: number
  current_plan: ShopifyPlan
}

export interface PlanRow {
  plan: ShopifyPlan
  total_platform_cost: number   // plan_fee + processing_fee
  true_profit: number
  saves_vs_current: number      // positive = saves money vs current plan
  is_cheapest: boolean
}

export interface CrossOver {
  from_plan: ShopifyPlan
  to_plan: ShopifyPlan
  breakeven_revenue: number     // monthly revenue at which upgrading breaks even
}

export interface PlanOptimizerResult {
  rows: PlanRow[]               // all 4 plans sorted by total_platform_cost asc
  crossovers: CrossOver[]       // adjacent plan pairs, 3 entries
  recommended_plan: ShopifyPlan
}
```

**Cross-over formula** (for adjacent plan pair A → B where B has higher fixed fee but lower rate):
```
breakeven_revenue = (plan_b_fee - plan_a_fee) / (rate_a - rate_b)
```
Where `rate_a`, `rate_b` = SP_RATE[plan] + (uses_shopify_payments ? 0 : THIRD_PARTY_FEE[plan]).

`recommended_plan` = plan with lowest `total_platform_cost` at current revenue.

---

### calcSubscription

```ts
export interface SubscriptionInput {
  starting_mrr: number
  new_mrr_per_month: number
  churned_mrr_per_month: number
  expansion_mrr_per_month: number
  contraction_mrr_per_month: number
  subscriber_count: number
  gross_margin_pct: number      // e.g. 60 = 60%
  cac: number
}

export interface SubscriptionResult {
  mrr_net: number
  arr: number
  nrr_pct: number               // net revenue retention %
  arpu: number                  // avg revenue per user
  sub_ltv: number               // arpu / (churned_mrr / starting_mrr)
  payback_months: number        // cac / (arpu × gross_margin_pct/100)
  mrr_projection: number[]      // 12 entries, month 1–12
  health: 'healthy' | 'at_risk' // nrr >= 100% = healthy
}
```

**Formulas:**
```
mrr_net = starting_mrr + new_mrr_per_month - churned_mrr_per_month
        + expansion_mrr_per_month - contraction_mrr_per_month
arr = mrr_net × 12
nrr_pct = ((starting_mrr - churned_mrr + expansion_mrr - contraction_mrr) / starting_mrr) × 100
arpu = subscriber_count > 0 ? starting_mrr / subscriber_count : 0
monthly_churn_rate = starting_mrr > 0 ? churned_mrr_per_month / starting_mrr : 0
sub_ltv = monthly_churn_rate > 0 ? arpu / monthly_churn_rate : 0
payback_months = arpu > 0 && gross_margin_pct > 0
  ? cac / (arpu × gross_margin_pct / 100) : 0

// 12-month MRR projection (compound):
mrr_projection[0] = mrr_net
for i in 1..11:
  mrr_projection[i] = mrr_projection[i-1]
    + new_mrr_per_month
    - (mrr_projection[i-1] × monthly_churn_rate)
    + expansion_mrr_per_month
    - contraction_mrr_per_month

health = nrr_pct >= BENCHMARKS.shopify.nrr_healthy × 100 ? 'healthy' : 'at_risk'
```

---

## UI Layout

### Existing sections (unchanged)
- Two-column P&L grid (inputs left, waterfall + metrics right)

### New sections (below existing grid)

**LTV Card** — `CalcCard title="Customer LTV"`
- Header row: toggle switch "Frequency Model ↔ Churn Model"
- Frequency inputs: AOV, purchases/year, lifespan (years), CAC
- Churn inputs: AOV, purchases/year, monthly churn %, CAC
- Results strip (4 metrics): LTV · Net LTV · LTV:CAC ratio · Payback (months)
- Health badge: Healthy (green) / Tight (amber) / Danger (red) based on LTV:CAC

**Plan Optimizer Card** — `CalcCard title="Plan Optimizer"`
- Comparison table: Plan | Monthly Fee | Processing Cost | Total Cost | True Profit | vs Current
- Current plan row highlighted with `border-l-2 border-l-primary`
- Recommended plan row tagged with "Best for your volume" chip
- `ToolLineChart`: X = monthly revenue $0–$200K, Y = total platform cost, 4 lines (one per plan), vertical reference line at current revenue, cross-over annotations in legend

**Subscription Card** — `CalcCard title="Subscription Revenue"` — only rendered when `show_subscription` toggle is on (toggle in card header)
- Inputs: Starting MRR, New MRR/mo, Churned MRR/mo, Expansion MRR/mo, Contraction MRR/mo, Subscribers, Gross Margin %, CAC
- Results strip: NRR % · ARR · Sub LTV · Payback months · Month-12 MRR
- Health badge: Healthy (NRR ≥ 100%) / At Risk
- `ToolLineChart`: 12-month MRR projection

**Header additions (same pattern as FBA):**
- `ScenarioPanel toolId="shopify"` + `ExportBar` in `headerRight`
- `PrintReport` at page bottom

---

## Infrastructure Wiring

All inputs/outputs converted through `useCurrency` (`toUSD` on entry, `fromUSD`+`fmt` on display). Calc functions always receive and return USD. `currentInputs` and `currentResults` passed to `ScenarioPanel` snapshot all four sections. `exportInputs` and `exportResults` arrays fed to `ExportBar` and `PrintReport`.

Fix existing bug: `h-5.5` on the Shopify Payments toggle → `h-6`.

---

## Testing

File: `__tests__/tools/shopify-profit.test.ts`

**LTV frequency model:**
- AOV=$100, 4×/yr, 3yr, CAC=$50, margin=40% → LTV=$1200, net_ltv=$430, ratio=24, payback≈1.25mo

**LTV churn model:**
- AOV=$100, 4×/yr, 5% monthly churn, CAC=$50, margin=40% → lifespan=20mo, LTV≈$666.67, verify net_ltv and payback

**LTV health boundaries:**
- ratio ≥ 3 → 'healthy'; ratio 1.5 → 'tight'; ratio 0.8 → 'danger'

**LTV edge cases:**
- CAC=0 → ltv_cac_ratio=0, payback=0 (no divide-by-zero)
- margin=0 → payback=0

**Plan optimizer cross-overs:**
- basic→shopify (Shopify Payments): breakeven = (105-39)/(0.029-0.026) = $22,000/mo
- shopify→advanced: breakeven = (399-105)/(0.026-0.024) = $147,000/mo

**Plan optimizer at $100K revenue:**
- All 4 plans computed; `advanced` has lower total cost than `shopify` at this volume
- `saves_vs_current` positive for plans cheaper than current

**Subscription NRR:**
- start=$10K, churned=$1K, expansion=$2K, contraction=$0 → NRR=110%, health='healthy'
- start=$10K, churned=$2K, expansion=$0 → NRR=80%, health='at_risk'

**Subscription 12-month projection:**
- MRR=$10K, new=$500/mo, churn=2%, expansion=0 → month-12 within expected range

**Subscription payback:**
- CAC=$200, ARPU=$50, margin=60% → payback=200/(50×0.6)≈6.67mo

**Subscription edge cases:**
- subscriber_count=0 → arpu=0, sub_ltv=0
- churned_mrr=0 → sub_ltv=0 (no divide-by-zero)

---

## Constraints

- NEVER call specter-api from this page (client-side only — CLAUDE.md)
- All calc functions receive/return USD; currency conversion at hook boundary only
- `ScenarioPanel` manages its own `useScenarios` state — page must NOT call `useScenarios` directly
- `h-5.5` Tailwind class does not exist — use `h-6`
- No tests for UI components — test calc math only (CLAUDE.md)
