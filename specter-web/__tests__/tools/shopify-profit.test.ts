import { describe, it, expect } from 'vitest'
import { calcLtv, calcPlanOptimizer, calcSubscription } from '@/lib/tools/shopify-profit'

describe('calcLtv', () => {
  describe('frequency mode', () => {
    it('computes LTV, net_ltv, ratio, payback from lifespan years', () => {
      const r = calcLtv({
        mode: 'frequency',
        avg_order_value: 100,
        purchases_per_year: 4,
        customer_lifespan_years: 3,
        cac: 50,
        true_margin_pct: 40,
      })
      expect(r.customer_lifespan_months).toBe(36)
      expect(r.ltv).toBe(1200)
      expect(r.net_ltv).toBe(430)
      expect(r.ltv_cac_ratio).toBe(24)
      expect(r.payback_months).toBe(3.75)
    })
  })

  describe('churn mode', () => {
    it('computes LTV from monthly churn rate', () => {
      const r = calcLtv({
        mode: 'churn',
        avg_order_value: 100,
        purchases_per_year: 4,
        monthly_churn_rate_pct: 5,
        cac: 50,
        true_margin_pct: 40,
      })
      expect(r.customer_lifespan_months).toBe(20)
      expect(r.ltv).toBe(666.67)
      expect(r.net_ltv).toBe(216.67)
      expect(r.ltv_cac_ratio).toBe(13.33)
      expect(r.payback_months).toBe(3.75)
    })
  })

  describe('health', () => {
    it('returns healthy when ltv_cac_ratio >= 3', () => {
      const r = calcLtv({
        mode: 'frequency',
        avg_order_value: 300,
        purchases_per_year: 1,
        customer_lifespan_years: 1,
        cac: 100,
        true_margin_pct: 40,
      })
      expect(r.ltv_cac_ratio).toBe(3)
      expect(r.health).toBe('healthy')
    })

    it('returns tight when ltv_cac_ratio is 1.5', () => {
      const r = calcLtv({
        mode: 'frequency',
        avg_order_value: 150,
        purchases_per_year: 1,
        customer_lifespan_years: 1,
        cac: 100,
        true_margin_pct: 40,
      })
      expect(r.ltv_cac_ratio).toBe(1.5)
      expect(r.health).toBe('tight')
    })

    it('returns danger when ltv_cac_ratio < 1', () => {
      const r = calcLtv({
        mode: 'frequency',
        avg_order_value: 80,
        purchases_per_year: 1,
        customer_lifespan_years: 1,
        cac: 100,
        true_margin_pct: 40,
      })
      expect(r.ltv_cac_ratio).toBe(0.8)
      expect(r.health).toBe('danger')
    })
  })

  describe('edge cases', () => {
    it('returns ltv_cac_ratio=0 and payback=0 when cac=0', () => {
      const r = calcLtv({
        mode: 'frequency',
        avg_order_value: 100,
        purchases_per_year: 4,
        customer_lifespan_years: 3,
        cac: 0,
        true_margin_pct: 40,
      })
      expect(r.ltv_cac_ratio).toBe(0)
      expect(r.payback_months).toBe(0)
      expect(r.health).toBe('healthy')
    })

    it('net_ltv is negative when cac exceeds margin return', () => {
      const r = calcLtv({
        mode: 'frequency',
        avg_order_value: 10,
        purchases_per_year: 1,
        customer_lifespan_years: 1,
        cac: 50,
        true_margin_pct: 40,
      })
      // ltv = 10, ltv × 0.4 = 4, net_ltv = 4 - 50 = -46
      expect(r.net_ltv).toBe(-46)
    })

    it('returns payback=0 when margin=0', () => {
      const r = calcLtv({
        mode: 'frequency',
        avg_order_value: 100,
        purchases_per_year: 4,
        customer_lifespan_years: 3,
        cac: 50,
        true_margin_pct: 0,
      })
      expect(r.payback_months).toBe(0)
    })
  })
})

describe('calcPlanOptimizer', () => {
  const baseInput = {
    monthly_revenue: 0,
    monthly_orders: 0,
    uses_shopify_payments: true,
    cogs: 0,
    app_spend: 0,
    avg_return_rate_pct: 0,
    return_restocking_pct: 0,
    monthly_shipping_cost: 0,
    monthly_ad_spend: 0,
    current_plan: 'shopify' as const,
  }

  it('computes basic→shopify crossover at $22,000/mo (Shopify Payments)', () => {
    const r = calcPlanOptimizer(baseInput)
    const co = r.crossovers.find(c => c.from_plan === 'basic' && c.to_plan === 'shopify')!
    expect(co.breakeven_revenue).toBe(22000)
  })

  it('computes shopify→advanced crossover at $147,000/mo', () => {
    const r = calcPlanOptimizer(baseInput)
    const co = r.crossovers.find(c => c.from_plan === 'shopify' && c.to_plan === 'advanced')!
    expect(co.breakeven_revenue).toBe(147000)
  })

  it('returns 4 plan rows at $200K revenue — advanced cheaper than shopify', () => {
    const r = calcPlanOptimizer({ ...baseInput, monthly_revenue: 200000 })
    expect(r.rows).toHaveLength(4)
    const shopifyRow = r.rows.find(row => row.plan === 'shopify')!
    const advancedRow = r.rows.find(row => row.plan === 'advanced')!
    expect(advancedRow.total_platform_cost).toBeLessThan(shopifyRow.total_platform_cost)
  })

  it('recommended_plan is cheapest plan at current revenue', () => {
    const r = calcPlanOptimizer({ ...baseInput, monthly_revenue: 200000 })
    const cheapest = r.rows.reduce((a, b) =>
      a.total_platform_cost <= b.total_platform_cost ? a : b
    )
    expect(r.recommended_plan).toBe(cheapest.plan)
  })

  it('saves_vs_current is positive for cheaper plans', () => {
    const r = calcPlanOptimizer({
      ...baseInput,
      monthly_revenue: 200000,
      current_plan: 'basic',
    })
    const shopifyRow = r.rows.find(row => row.plan === 'shopify')!
    expect(shopifyRow.saves_vs_current).toBeGreaterThan(0)
  })

  it('saves_vs_current is 0 for the current plan', () => {
    const r = calcPlanOptimizer({ ...baseInput, monthly_revenue: 50000 })
    const currentRow = r.rows.find(row => row.plan === 'shopify')!
    expect(currentRow.saves_vs_current).toBe(0)
  })

  it('is_cheapest is true for exactly one row', () => {
    const r = calcPlanOptimizer({ ...baseInput, monthly_revenue: 100000 })
    const cheapestRows = r.rows.filter(row => row.is_cheapest)
    expect(cheapestRows).toHaveLength(1)
  })
})

describe('calcSubscription', () => {
  it('computes NRR=110% and health=healthy', () => {
    const r = calcSubscription({
      starting_mrr: 10000,
      new_mrr_per_month: 1000,
      churned_mrr_per_month: 1000,
      expansion_mrr_per_month: 2000,
      contraction_mrr_per_month: 0,
      subscriber_count: 200,
      gross_margin_pct: 70,
      cac: 200,
    })
    expect(r.nrr_pct).toBe(110)
    expect(r.health).toBe('healthy')
  })

  it('computes NRR=80% and health=at_risk', () => {
    const r = calcSubscription({
      starting_mrr: 10000,
      new_mrr_per_month: 500,
      churned_mrr_per_month: 2000,
      expansion_mrr_per_month: 0,
      contraction_mrr_per_month: 0,
      subscriber_count: 100,
      gross_margin_pct: 60,
      cac: 200,
    })
    expect(r.nrr_pct).toBe(80)
    expect(r.health).toBe('at_risk')
  })

  it('computes ARR = mrr_net × 12', () => {
    const r = calcSubscription({
      starting_mrr: 10000,
      new_mrr_per_month: 500,
      churned_mrr_per_month: 200,
      expansion_mrr_per_month: 0,
      contraction_mrr_per_month: 0,
      subscriber_count: 100,
      gross_margin_pct: 70,
      cac: 0,
    })
    // mrr_net = 10000 + 500 - 200 = 10300
    expect(r.mrr_net).toBe(10300)
    expect(r.arr).toBe(123600)
  })

  it('computes payback_months correctly', () => {
    const r = calcSubscription({
      starting_mrr: 5000,
      new_mrr_per_month: 0,
      churned_mrr_per_month: 0,
      expansion_mrr_per_month: 0,
      contraction_mrr_per_month: 0,
      subscriber_count: 100,
      gross_margin_pct: 60,
      cac: 200,
    })
    // arpu = 5000 / 100 = 50
    // payback = 200 / (50 × 0.6) = 6.67
    expect(r.arpu).toBe(50)
    expect(r.payback_months).toBe(6.67)
  })

  it('returns 12 entries in mrr_projection', () => {
    const r = calcSubscription({
      starting_mrr: 10000,
      new_mrr_per_month: 500,
      churned_mrr_per_month: 200,
      expansion_mrr_per_month: 0,
      contraction_mrr_per_month: 0,
      subscriber_count: 100,
      gross_margin_pct: 70,
      cac: 200,
    })
    expect(r.mrr_projection).toHaveLength(12)
    expect(r.mrr_projection[0]).toBe(10300)
  })

  it('returns arpu=0 when subscriber_count=0 (no divide-by-zero)', () => {
    const r = calcSubscription({
      starting_mrr: 10000,
      new_mrr_per_month: 0,
      churned_mrr_per_month: 0,
      expansion_mrr_per_month: 0,
      contraction_mrr_per_month: 0,
      subscriber_count: 0,
      gross_margin_pct: 70,
      cac: 200,
    })
    expect(r.arpu).toBe(0)
    expect(r.sub_ltv).toBe(0)
  })

  it('returns sub_ltv=0 when churned_mrr=0 (no divide-by-zero)', () => {
    const r = calcSubscription({
      starting_mrr: 10000,
      new_mrr_per_month: 500,
      churned_mrr_per_month: 0,
      expansion_mrr_per_month: 0,
      contraction_mrr_per_month: 0,
      subscriber_count: 100,
      gross_margin_pct: 70,
      cac: 200,
    })
    expect(r.sub_ltv).toBe(0)
  })
})
