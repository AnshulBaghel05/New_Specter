// Shopify 2024 fee schedule (source: shopify.com/pricing)
import { BENCHMARKS } from './benchmarks'

export type ShopifyPlan =
  | 'basic'      // $39/mo  — 2.9% + $0.30 Shopify Payments; +2.0% 3rd-party
  | 'shopify'    // $105/mo — 2.6% + $0.30 Shopify Payments; +1.0% 3rd-party
  | 'advanced'   // $399/mo — 2.4% + $0.30 Shopify Payments; +0.5% 3rd-party
  | 'plus'       // $2000+/mo — 0.15% + $0.30 Shopify Payments; +0.15% 3rd-party

export const PLAN_MONTHLY_COST: Record<ShopifyPlan, number> = {
  basic: 39,
  shopify: 105,
  advanced: 399,
  plus: 2000,
}

// Shopify Payments processing rates (built-in)
export const SP_RATE: Record<ShopifyPlan, number> = {
  basic: 0.029,
  shopify: 0.026,
  advanced: 0.024,
  plus: 0.0015,
}

// Additional transaction fee when using 3rd-party processor
export const THIRD_PARTY_FEE: Record<ShopifyPlan, number> = {
  basic: 0.02,
  shopify: 0.01,
  advanced: 0.005,
  plus: 0.0015,
}

export const FIXED_FEE_PER_ORDER = 0.30

export interface ShopifyProfitInput {
  plan: ShopifyPlan
  monthly_revenue: number
  cogs: number                // total cost of goods sold for that revenue
  monthly_orders: number
  app_spend: number           // monthly app subscription spend
  avg_return_rate_pct: number // % of orders returned (e.g. 5 = 5%)
  return_restocking_pct: number // % of returned item value lost to restocking/damage (e.g. 20 = 20%)
  monthly_shipping_cost: number // total outbound shipping paid by merchant
  monthly_ad_spend: number
  uses_shopify_payments: boolean
}

export interface ShopifyProfitResult {
  gross_revenue: number
  gross_profit: number
  plan_fee: number
  processing_fee: number
  app_spend: number
  returns_cost: number
  shipping_cost: number
  ad_spend: number
  total_expenses: number
  true_profit: number
  true_margin_pct: number
  revenue_per_ad_dollar: number
  effective_rate_pct: number  // total fees as % of revenue
}

export function calcShopifyProfit(input: ShopifyProfitInput): ShopifyProfitResult {
  const gross_revenue = input.monthly_revenue
  const gross_profit = round2(gross_revenue - input.cogs)

  const plan_fee = PLAN_MONTHLY_COST[input.plan]

  // Processing fees
  const sp_rate = SP_RATE[input.plan]
  const third_party = input.uses_shopify_payments ? 0 : THIRD_PARTY_FEE[input.plan]
  const processing_fee = round2(
    gross_revenue * (sp_rate + third_party) + input.monthly_orders * FIXED_FEE_PER_ORDER,
  )

  const app_spend = input.app_spend

  // Returns: value of goods returned × (1 + restocking loss %)
  const returns_value = gross_revenue * (input.avg_return_rate_pct / 100)
  const returns_cost = round2(returns_value * (1 + input.return_restocking_pct / 100))

  const shipping_cost = input.monthly_shipping_cost
  const ad_spend = input.monthly_ad_spend

  const total_expenses = round2(
    plan_fee + processing_fee + app_spend + returns_cost + shipping_cost + ad_spend,
  )

  const true_profit = round2(gross_profit - total_expenses)
  const true_margin_pct =
    gross_revenue > 0 ? round1((true_profit / gross_revenue) * 100) : 0

  const revenue_per_ad_dollar =
    ad_spend > 0 ? round2(gross_revenue / ad_spend) : 0

  const effective_rate_pct =
    gross_revenue > 0 ? round2(((plan_fee + processing_fee) / gross_revenue) * 100) : 0

  return {
    gross_revenue,
    gross_profit,
    plan_fee,
    processing_fee,
    app_spend,
    returns_cost,
    shipping_cost,
    ad_spend,
    total_expenses,
    true_profit,
    true_margin_pct,
    revenue_per_ad_dollar,
    effective_rate_pct,
  }
}

function round2(n: number) { return Math.round(n * 100) / 100 }
function round1(n: number) { return Math.round(n * 10) / 10 }

// ── LTV ──────────────────────────────────────────────────────────────────────

export type LtvMode = 'frequency' | 'churn'

export interface LtvInput {
  mode: LtvMode
  avg_order_value: number
  purchases_per_year: number
  customer_lifespan_years?: number   // frequency mode only
  monthly_churn_rate_pct?: number    // churn mode only (e.g. 5 = 5%)
  cac: number
  true_margin_pct: number
}

export interface LtvResult {
  customer_lifespan_months: number
  ltv: number
  net_ltv: number
  ltv_cac_ratio: number
  payback_months: number
  health: 'healthy' | 'tight' | 'danger'
}

export function calcLtv(input: LtvInput): LtvResult {
  const { mode, avg_order_value, purchases_per_year, cac, true_margin_pct } = input

  let customer_lifespan_months: number
  if (mode === 'frequency') {
    customer_lifespan_months = round1((input.customer_lifespan_years ?? 0) * 12)
  } else {
    const churn = input.monthly_churn_rate_pct ?? 0
    customer_lifespan_months = churn > 0 ? round1(100 / churn) : 0
  }

  const customer_lifespan_years = customer_lifespan_months / 12
  const ltv = round2(avg_order_value * purchases_per_year * customer_lifespan_years)
  const net_ltv = round2(ltv * (true_margin_pct / 100) - cac)
  const ltv_cac_ratio = cac > 0 ? round2(ltv / cac) : 0

  const monthly_profit = avg_order_value * (purchases_per_year / 12) * (true_margin_pct / 100)
  const payback_months = monthly_profit > 0 ? round2(cac / monthly_profit) : 0

  const health: LtvResult['health'] =
    cac === 0 ? 'healthy'
    : ltv_cac_ratio >= BENCHMARKS.shopify.ltv_cac_healthy ? 'healthy'
    : ltv_cac_ratio >= 1 ? 'tight'
    : 'danger'

  return { customer_lifespan_months, ltv, net_ltv, ltv_cac_ratio, payback_months, health }
}

// ── Plan Optimizer ────────────────────────────────────────────────────────────

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
  total_platform_cost: number
  true_profit: number
  saves_vs_current: number
  is_cheapest: boolean
}

export interface CrossOver {
  from_plan: ShopifyPlan
  to_plan: ShopifyPlan
  breakeven_revenue: number
}

export interface PlanOptimizerResult {
  rows: PlanRow[]
  crossovers: CrossOver[]
  recommended_plan: ShopifyPlan
}

const PLAN_ORDER: ShopifyPlan[] = ['basic', 'shopify', 'advanced', 'plus']

export function calcPlanOptimizer(input: PlanOptimizerInput): PlanOptimizerResult {
  const computed = PLAN_ORDER.map((plan) => {
    const r = calcShopifyProfit({ ...input, plan })
    return {
      plan,
      total_platform_cost: round2(r.plan_fee + r.processing_fee),
      true_profit: r.true_profit,
    }
  })

  const currentComputed = computed.find(c => c.plan === input.current_plan)!

  const cheapestIdx = computed.reduce(
    (minIdx, c, i) => c.total_platform_cost < computed[minIdx].total_platform_cost ? i : minIdx,
    0,
  )

  const rows: PlanRow[] = computed.map((c, i) => ({
    plan: c.plan,
    total_platform_cost: c.total_platform_cost,
    true_profit: c.true_profit,
    saves_vs_current: round2(currentComputed.total_platform_cost - c.total_platform_cost),
    is_cheapest: i === cheapestIdx,
  }))

  const crossovers: CrossOver[] = []
  for (let i = 0; i < PLAN_ORDER.length - 1; i++) {
    const planA = PLAN_ORDER[i]
    const planB = PLAN_ORDER[i + 1]
    const rateA = SP_RATE[planA] + (input.uses_shopify_payments ? 0 : THIRD_PARTY_FEE[planA])
    const rateB = SP_RATE[planB] + (input.uses_shopify_payments ? 0 : THIRD_PARTY_FEE[planB])
    const rateDiff = rateA - rateB
    if (rateDiff > 0) {
      crossovers.push({
        from_plan: planA,
        to_plan: planB,
        breakeven_revenue: round2((PLAN_MONTHLY_COST[planB] - PLAN_MONTHLY_COST[planA]) / rateDiff),
      })
    }
  }

  const recommended_plan = computed[cheapestIdx].plan

  return { rows, crossovers, recommended_plan }
}

// ── Subscription ──────────────────────────────────────────────────────────────

export interface SubscriptionInput {
  starting_mrr: number
  new_mrr_per_month: number
  churned_mrr_per_month: number
  expansion_mrr_per_month: number
  contraction_mrr_per_month: number
  subscriber_count: number
  gross_margin_pct: number
  cac: number
}

export interface SubscriptionResult {
  mrr_net: number
  arr: number
  nrr_pct: number
  arpu: number
  sub_ltv: number
  payback_months: number
  mrr_projection: number[]
  health: 'healthy' | 'at_risk'
}

export function calcSubscription(input: SubscriptionInput): SubscriptionResult {
  const {
    starting_mrr, new_mrr_per_month, churned_mrr_per_month,
    expansion_mrr_per_month, contraction_mrr_per_month,
    subscriber_count, gross_margin_pct, cac,
  } = input

  const mrr_net = round2(
    starting_mrr + new_mrr_per_month - churned_mrr_per_month +
    expansion_mrr_per_month - contraction_mrr_per_month,
  )
  const arr = round2(mrr_net * 12)

  const nrr_pct = starting_mrr > 0
    ? round1(
        ((starting_mrr - churned_mrr_per_month + expansion_mrr_per_month - contraction_mrr_per_month)
          / starting_mrr) * 100,
      )
    : 0

  const arpu = subscriber_count > 0 ? round2(starting_mrr / subscriber_count) : 0
  const monthly_churn_rate = starting_mrr > 0 ? churned_mrr_per_month / starting_mrr : 0
  // gross revenue LTV (not margin-adjusted — see calcLtv for margin-adjusted net LTV)
  const sub_ltv = monthly_churn_rate > 0 ? round2(arpu / monthly_churn_rate) : 0

  const payback_months =
    arpu > 0 && gross_margin_pct > 0
      ? round2(cac / (arpu * gross_margin_pct / 100))
      : 0

  // projection[0] = current month (mrr_net); projection[11] = 11 months forward
  const mrr_projection: number[] = []
  let current = mrr_net
  for (let i = 0; i < 12; i++) {
    mrr_projection.push(round2(current))
    current = Math.max(0, round2(
      current + new_mrr_per_month
      - current * monthly_churn_rate
      + expansion_mrr_per_month
      - contraction_mrr_per_month,
    ))
  }

  const health: SubscriptionResult['health'] =
    nrr_pct >= BENCHMARKS.shopify.nrr_healthy * 100 ? 'healthy' : 'at_risk'

  return { mrr_net, arr, nrr_pct, arpu, sub_ltv, payback_months, mrr_projection, health }
}
