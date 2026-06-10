# Shopify Calculator Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Shopify True Profit Calculator with LTV + repeat purchase model, plan optimizer, and full subscription revenue analytics, plus wire the shared currency/scenario/export infrastructure.

**Architecture:** Three new pure calc functions added to `lib/tools/shopify-profit.ts`. Page wires `useCurrency`/`ScenarioPanel`/`ExportBar`/`PrintReport` (same pattern as FBA). Three new section cards appended below the existing P&L grid. No new component files.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Vitest, Recharts via `ToolLineChart` from `components/tools/tool-chart.tsx`, Tailwind CSS, `useCurrency` hook from `hooks/use-currency.ts`

---

## File Map

| File | Action |
|------|--------|
| `lib/tools/benchmarks.ts` | Modify — add `shopify: { ltv_cac_healthy: 3, nrr_healthy: 1.0 }` |
| `lib/tools/shopify-profit.ts` | Modify — add `LtvInput/Result`, `PlanOptimizerInput/Result`, `SubscriptionInput/Result`, `calcLtv`, `calcPlanOptimizer`, `calcSubscription` |
| `__tests__/tools/shopify-profit.test.ts` | Create — unit tests for all three new functions |
| `app/tools/shopify-profit-calculator/page.tsx` | Modify — wire infrastructure + add three cards |

---

## Task 1: calcLtv + shopify benchmarks

**Files:**
- Modify: `lib/tools/benchmarks.ts`
- Modify: `lib/tools/shopify-profit.ts`
- Create: `__tests__/tools/shopify-profit.test.ts`

- [ ] **Step 1: Update benchmarks.ts**

Replace the entire file content:

```ts
export const BENCHMARKS = {
  fba_margins: {
    healthy: 0.15,
    tight: 0.08,
  },
  shopify: {
    ltv_cac_healthy: 3,
    nrr_healthy: 1.0,
  },
} as const
```

- [ ] **Step 2: Write the failing tests**

Create `__tests__/tools/shopify-profit.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calcLtv } from '@/lib/tools/shopify-profit'

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
```

- [ ] **Step 3: Run tests to verify they fail**

```
npx vitest run __tests__/tools/shopify-profit.test.ts
```

Expected: FAIL — `calcLtv` is not exported from `@/lib/tools/shopify-profit`

- [ ] **Step 4: Add import + types + calcLtv to shopify-profit.ts**

At the top of `lib/tools/shopify-profit.ts`, add this import after the existing comment:

```ts
import { BENCHMARKS } from './benchmarks'
```

Then append to the end of `lib/tools/shopify-profit.ts`:

```ts
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
    customer_lifespan_months = (input.customer_lifespan_years ?? 0) * 12
  } else {
    const churn = input.monthly_churn_rate_pct ?? 0
    customer_lifespan_months = churn > 0 ? 100 / churn : 0
  }

  const customer_lifespan_years = customer_lifespan_months / 12
  const ltv = round2(avg_order_value * purchases_per_year * customer_lifespan_years)
  const net_ltv = round2(ltv * (true_margin_pct / 100) - cac)
  const ltv_cac_ratio = cac > 0 ? round2(ltv / cac) : 0

  const monthly_profit = avg_order_value * (purchases_per_year / 12) * (true_margin_pct / 100)
  const payback_months = monthly_profit > 0 ? round2(cac / monthly_profit) : 0

  const health: LtvResult['health'] =
    ltv_cac_ratio >= BENCHMARKS.shopify.ltv_cac_healthy ? 'healthy'
    : ltv_cac_ratio >= 1 ? 'tight'
    : 'danger'

  return { customer_lifespan_months, ltv, net_ltv, ltv_cac_ratio, payback_months, health }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```
npx vitest run __tests__/tools/shopify-profit.test.ts
```

Expected: all calcLtv tests PASS

- [ ] **Step 6: Commit**

```
git add lib/tools/benchmarks.ts lib/tools/shopify-profit.ts __tests__/tools/shopify-profit.test.ts
git commit -m "feat(shopify): add calcLtv with frequency and churn modes"
```

---

## Task 2: calcPlanOptimizer

**Files:**
- Modify: `lib/tools/shopify-profit.ts`
- Modify: `__tests__/tools/shopify-profit.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `__tests__/tools/shopify-profit.test.ts`:

```ts
import { calcPlanOptimizer } from '@/lib/tools/shopify-profit'

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
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run __tests__/tools/shopify-profit.test.ts
```

Expected: FAIL — `calcPlanOptimizer` is not exported

- [ ] **Step 3: Add types + calcPlanOptimizer to shopify-profit.ts**

Append to `lib/tools/shopify-profit.ts`:

```ts
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
  const allPlans: ShopifyPlan[] = ['basic', 'shopify', 'advanced', 'plus']

  const computed = allPlans.map((plan) => {
    const r = calcShopifyProfit({ ...input, plan })
    return {
      plan,
      total_platform_cost: round2(r.plan_fee + r.processing_fee),
      true_profit: r.true_profit,
    }
  })

  const currentComputed = computed.find(c => c.plan === input.current_plan)!
  const minCost = Math.min(...computed.map(c => c.total_platform_cost))

  const rows: PlanRow[] = computed.map(c => ({
    plan: c.plan,
    total_platform_cost: c.total_platform_cost,
    true_profit: c.true_profit,
    saves_vs_current: round2(currentComputed.total_platform_cost - c.total_platform_cost),
    is_cheapest: c.total_platform_cost === minCost,
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

  const recommended_plan = rows.reduce((a, b) =>
    a.total_platform_cost <= b.total_platform_cost ? a : b
  ).plan

  return { rows, crossovers, recommended_plan }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run __tests__/tools/shopify-profit.test.ts
```

Expected: all calcLtv + calcPlanOptimizer tests PASS

- [ ] **Step 5: Commit**

```
git add lib/tools/shopify-profit.ts __tests__/tools/shopify-profit.test.ts
git commit -m "feat(shopify): add calcPlanOptimizer with crossover breakeven analysis"
```

---

## Task 3: calcSubscription

**Files:**
- Modify: `lib/tools/shopify-profit.ts`
- Modify: `__tests__/tools/shopify-profit.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `__tests__/tools/shopify-profit.test.ts`:

```ts
import { calcSubscription } from '@/lib/tools/shopify-profit'

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
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run __tests__/tools/shopify-profit.test.ts
```

Expected: FAIL — `calcSubscription` is not exported

- [ ] **Step 3: Add types + calcSubscription to shopify-profit.ts**

Append to `lib/tools/shopify-profit.ts`:

```ts
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
  const sub_ltv = monthly_churn_rate > 0 ? round2(arpu / monthly_churn_rate) : 0

  const payback_months =
    arpu > 0 && gross_margin_pct > 0
      ? round2(cac / (arpu * gross_margin_pct / 100))
      : 0

  const mrr_projection: number[] = []
  let current = mrr_net
  for (let i = 0; i < 12; i++) {
    mrr_projection.push(round2(current))
    current = current + new_mrr_per_month
      - current * monthly_churn_rate
      + expansion_mrr_per_month
      - contraction_mrr_per_month
  }

  const health: SubscriptionResult['health'] =
    nrr_pct >= BENCHMARKS.shopify.nrr_healthy * 100 ? 'healthy' : 'at_risk'

  return { mrr_net, arr, nrr_pct, arpu, sub_ltv, payback_months, mrr_projection, health }
}
```

- [ ] **Step 4: Run all tests to verify they pass**

```
npx vitest run __tests__/tools/shopify-profit.test.ts
```

Expected: ALL tests PASS (calcLtv + calcPlanOptimizer + calcSubscription)

- [ ] **Step 5: Run the full test suite to confirm no regressions**

```
npm test
```

Expected: all test files pass

- [ ] **Step 6: Commit**

```
git add lib/tools/shopify-profit.ts __tests__/tools/shopify-profit.test.ts
git commit -m "feat(shopify): add calcSubscription with NRR, LTV, payback, 12-month projection"
```

---

## Task 4: Wire shared infrastructure in page.tsx

**Context:** The existing page hardcodes `const fmt = (n) => new Intl.NumberFormat(...)` and uses no shared hooks. This task wires `useCurrency`, `ScenarioPanel`, `ExportBar`, `PrintReport` — exactly as the FBA calculator does. No new UI sections yet. Also fixes the `h-5.5` Tailwind bug.

**Files:**
- Modify: `app/tools/shopify-profit-calculator/page.tsx`

- [ ] **Step 1: Replace imports at top of page.tsx**

Replace the existing import block (lines 1–8) with:

```tsx
'use client'

import { useState, useMemo } from 'react'
import ToolLayout, {
  CalcCard, Field, Input, Select, Metric,
} from '@/components/tools/tool-layout'
import {
  calcShopifyProfit, ShopifyPlan, PLAN_MONTHLY_COST, SP_RATE,
} from '@/lib/tools/shopify-profit'
import { useCurrency } from '@/hooks/use-currency'
import type { ExportRow } from '@/lib/tools/export'
import ScenarioPanel from '@/components/tools/scenario-panel'
import ExportBar from '@/components/tools/export-bar'
import PrintReport from '@/components/tools/print-report'
import type { Scenario } from '@/lib/tools/scenarios'
import { cn } from '@/lib/utils'
```

- [ ] **Step 2: Remove hardcoded fmt, add useCurrency + currencySymbol**

Remove this line inside the component (currently line 17–18):
```tsx
const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
```

Add these lines directly after the `useState` declarations (after `const [uses_sp, setUsesSp] = useState(true)`):

```tsx
const { currency, toUSD, fromUSD, fmt, currencies } = useCurrency()
const currencySymbol = currencies.find((c) => c.code === currency)?.symbol ?? '$'
```

- [ ] **Step 3: Wrap calc input in useMemo with toUSD conversions**

Replace the existing `const r = useMemo(...)` block with:

```tsx
const input_usd = useMemo(
  () => ({
    plan,
    monthly_revenue:       toUSD(parseFloat(revenue)     || 0),
    cogs:                  toUSD(parseFloat(cogs)         || 0),
    monthly_orders:        parseFloat(orders)             || 0,
    app_spend:             toUSD(parseFloat(app_spend)    || 0),
    avg_return_rate_pct:   parseFloat(return_rate)        || 0,
    return_restocking_pct: parseFloat(restocking)         || 0,
    monthly_shipping_cost: toUSD(parseFloat(shipping)     || 0),
    monthly_ad_spend:      toUSD(parseFloat(ad_spend)     || 0),
    uses_shopify_payments: uses_sp,
  }),
  [plan, revenue, cogs, orders, app_spend, return_rate, restocking, shipping, ad_spend, uses_sp, toUSD],
)

const r = useMemo(() => calcShopifyProfit(input_usd), [input_usd])
```

- [ ] **Step 4: Add export + scenario memos and handleLoadScenario**

After `const r = useMemo(...)`, add:

```tsx
const resultLabels: Record<string, string> = {
  true_profit:        'True Profit',
  true_margin_pct:    'Margin %',
  revenue_per_ad_dollar: 'ROAS',
  gross_profit:       'Gross Profit',
  total_expenses:     'Total Expenses',
  effective_rate_pct: 'Effective Rate %',
}

const exportInputs: ExportRow[] = useMemo(() => [
  { label: 'Plan',             value: plan },
  { label: 'Monthly Revenue',  value: fmt(fromUSD(parseFloat(revenue) || 0)) },
  { label: 'COGS',             value: fmt(fromUSD(parseFloat(cogs)    || 0)) },
  { label: 'Monthly Orders',   value: orders },
  { label: 'App Spend',        value: fmt(fromUSD(parseFloat(app_spend)  || 0)) },
  { label: 'Return Rate',      value: `${return_rate}%` },
  { label: 'Restocking Loss',  value: `${restocking}%` },
  { label: 'Shipping Cost',    value: fmt(fromUSD(parseFloat(shipping)   || 0)) },
  { label: 'Ad Spend',         value: fmt(fromUSD(parseFloat(ad_spend)   || 0)) },
  { label: 'Shopify Payments', value: uses_sp ? 'Yes' : 'No' },
], [fmt, fromUSD, plan, revenue, cogs, orders, app_spend, return_rate, restocking, shipping, ad_spend, uses_sp])

const exportResults: ExportRow[] = useMemo(() => [
  { label: 'True Profit',       value: fmt(fromUSD(r.true_profit)) },
  { label: 'Margin',            value: `${r.true_margin_pct}%` },
  { label: 'ROAS',              value: `${r.revenue_per_ad_dollar}×` },
  { label: 'Gross Profit',      value: fmt(fromUSD(r.gross_profit)) },
  { label: 'Total Expenses',    value: fmt(fromUSD(r.total_expenses)) },
  { label: 'Effective Rate',    value: `${r.effective_rate_pct}%` },
], [fmt, fromUSD, r])

const currentInputs: Record<string, string | boolean> = useMemo(() => ({
  plan, revenue, cogs, orders, app_spend, return_rate,
  restocking, shipping, ad_spend, uses_sp: String(uses_sp),
}), [plan, revenue, cogs, orders, app_spend, return_rate, restocking, shipping, ad_spend, uses_sp])

const currentResults: Record<string, number> = useMemo(() => ({
  true_profit:           r.true_profit,
  true_margin_pct:       r.true_margin_pct,
  revenue_per_ad_dollar: r.revenue_per_ad_dollar,
  gross_profit:          r.gross_profit,
  total_expenses:        r.total_expenses,
  effective_rate_pct:    r.effective_rate_pct,
}), [r])

function handleLoadScenario(scenario: Scenario) {
  if (scenario.inputs.plan)         setPlan(String(scenario.inputs.plan) as ShopifyPlan)
  if (scenario.inputs.revenue)      setRevenue(String(scenario.inputs.revenue))
  if (scenario.inputs.cogs)         setCogs(String(scenario.inputs.cogs))
  if (scenario.inputs.orders)       setOrders(String(scenario.inputs.orders))
  if (scenario.inputs.app_spend)    setAppSpend(String(scenario.inputs.app_spend))
  if (scenario.inputs.return_rate)  setReturnRate(String(scenario.inputs.return_rate))
  if (scenario.inputs.restocking)   setRestocking(String(scenario.inputs.restocking))
  if (scenario.inputs.shipping)     setShipping(String(scenario.inputs.shipping))
  if (scenario.inputs.ad_spend)     setAdSpend(String(scenario.inputs.ad_spend))
  setUsesSp(scenario.inputs.uses_sp === 'true')
}
```

- [ ] **Step 5: Update expenseRows to use fromUSD**

Replace the `expenseRows` array (it currently uses raw `r.*` values which are already USD):

```tsx
const expenseRows = [
  { label: 'Shopify Subscription', value: r.plan_fee },
  { label: 'Payment Processing',   value: r.processing_fee },
  { label: 'App Subscriptions',    value: r.app_spend },
  { label: 'Returns Cost',         value: r.returns_cost },
  { label: 'Outbound Shipping',    value: r.shipping_cost },
  { label: 'Ad Spend',             value: r.ad_spend },
]
```

This stays the same — `r.*` values are USD, and `fmt(fromUSD(value))` is used in the render. In the JSX, every `{fmt(value)}` call becomes `{fmt(fromUSD(value))}`. Update all `{fmt(...)}` calls in the JSX to `{fmt(fromUSD(...))}`.

- [ ] **Step 6: Update ToolLayout to add headerRight + fix input prefix + fix h-5.5**

In the JSX, update `<ToolLayout` to:

```tsx
<ToolLayout
  toolId="shopify"
  badge="Free Shopify Tool"
  title="Shopify True Profit Margin Calculator"
  description="See your real monthly profit after Shopify fees, payment processing, apps, returns, shipping, and ad spend — not just gross margin."
  headerRight={
    <>
      <ScenarioPanel
        toolId="shopify"
        currentInputs={currentInputs}
        currentResults={currentResults}
        currency={currency}
        resultLabels={resultLabels}
        onLoad={handleLoadScenario}
      />
      <ExportBar
        toolId="shopify"
        inputs={exportInputs}
        results={exportResults}
        currency={currency}
      />
    </>
  }
>
```

Change all `prefix="$"` on `<Input>` to `prefix={currencySymbol}`.

Fix the toggle button: change `h-5.5` → `h-6`:
```tsx
className={cn(
  'w-10 h-6 rounded-full transition-colors relative flex items-center shrink-0',
  uses_sp ? 'bg-primary' : 'bg-border',
)}
```

Add `<PrintReport>` just before the closing `</ToolLayout>`, after the disclaimer `<p>`:

```tsx
<PrintReport
  toolName="Shopify True Profit Calculator"
  toolId="shopify"
  currency={currency}
  inputs={exportInputs}
  results={exportResults}
/>
```

- [ ] **Step 7: Run dev server and verify P&L section still works**

```
npm run dev
```

Open `http://localhost:3000/tools/shopify-profit-calculator`. Enter sample inputs. Verify the profit waterfall calculates correctly. Verify currency selector appears. Verify ScenarioPanel and ExportBar appear in the header. Verify no console errors.

- [ ] **Step 8: Commit**

```
git add app/tools/shopify-profit-calculator/page.tsx
git commit -m "feat(shopify): wire currency, scenarios, export, print — fix h-5.5 bug"
```

---

## Task 5: LTV card UI

**Context:** Add the Customer LTV card below the P&L grid. It needs new state, a memoized input, and a results display with a health badge and toggle between frequency/churn modes.

**Files:**
- Modify: `app/tools/shopify-profit-calculator/page.tsx`

- [ ] **Step 1: Add LTV state variables**

After the existing `useState` declarations, add:

```tsx
// LTV state
const [ltv_mode, setLtvMode] = useState<'frequency' | 'churn'>('frequency')
const [ltv_aov, setLtvAov] = useState('85')
const [ltv_purchases, setLtvPurchases] = useState('3')
const [ltv_lifespan, setLtvLifespan] = useState('2')
const [ltv_churn, setLtvChurn] = useState('5')
const [ltv_cac, setLtvCac] = useState('40')
```

- [ ] **Step 2: Add calcLtv import and ltv_result memo**

Add `calcLtv, LtvMode` to the import from `@/lib/tools/shopify-profit`:

```tsx
import {
  calcShopifyProfit, calcLtv, ShopifyPlan, PLAN_MONTHLY_COST, SP_RATE, LtvMode,
} from '@/lib/tools/shopify-profit'
```

After the `currentResults` memo, add:

```tsx
const ltv_result = useMemo(() =>
  calcLtv({
    mode: ltv_mode,
    avg_order_value:           toUSD(parseFloat(ltv_aov)      || 0),
    purchases_per_year:        parseFloat(ltv_purchases)       || 0,
    customer_lifespan_years:   parseFloat(ltv_lifespan)        || 0,
    monthly_churn_rate_pct:    parseFloat(ltv_churn)           || 0,
    cac:                       toUSD(parseFloat(ltv_cac)       || 0),
    true_margin_pct:           r.true_margin_pct,
  }),
  [ltv_mode, ltv_aov, ltv_purchases, ltv_lifespan, ltv_churn, ltv_cac, r.true_margin_pct, toUSD],
)
```

- [ ] **Step 3: Add LTV card to JSX**

After the closing `</div>` of the P&L grid (the `md:grid-cols-2` div) and before the disclaimer `<p>`, add:

```tsx
{/* ── Customer LTV ── */}
<div className="mt-6">
  <CalcCard
    title="Customer LTV"
    headerRight={
      <div className="flex items-center gap-2">
        <span className={cn('font-body text-xs', ltv_mode === 'frequency' ? 'text-text' : 'text-muted')}>
          Frequency
        </span>
        <button
          onClick={() => setLtvMode(ltv_mode === 'frequency' ? 'churn' : 'frequency')}
          className={cn(
            'w-10 h-6 rounded-full transition-colors relative flex items-center',
            'bg-primary',
          )}
          role="switch"
          aria-checked={ltv_mode === 'churn'}
        >
          <span className={cn(
            'w-4 h-4 rounded-full bg-white shadow transition-transform absolute',
            ltv_mode === 'churn' ? 'translate-x-5' : 'translate-x-0.5',
          )} />
        </button>
        <span className={cn('font-body text-xs', ltv_mode === 'churn' ? 'text-text' : 'text-muted')}>
          Churn
        </span>
      </div>
    }
  >
    <div className="grid md:grid-cols-2 gap-6">
      {/* Inputs */}
      <div className="grid grid-cols-2 gap-4">
        <Field label={`Avg Order Value`}>
          <Input value={ltv_aov} onChange={setLtvAov} prefix={currencySymbol} step={0.01} min={0} />
        </Field>
        <Field label="Purchases / Year">
          <Input value={ltv_purchases} onChange={setLtvPurchases} step={0.1} min={0} />
        </Field>
        {ltv_mode === 'frequency' ? (
          <Field label="Customer Lifespan (yrs)">
            <Input value={ltv_lifespan} onChange={setLtvLifespan} step={0.5} min={0} />
          </Field>
        ) : (
          <Field label="Monthly Churn Rate" hint="% of customers who don't repurchase">
            <Input value={ltv_churn} onChange={setLtvChurn} suffix="%" step={0.1} min={0} max={100} />
          </Field>
        )}
        <Field label="Customer Acq. Cost (CAC)">
          <Input value={ltv_cac} onChange={setLtvCac} prefix={currencySymbol} step={0.01} min={0} />
        </Field>
      </div>

      {/* Results */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Metric label="LTV"      value={fmt(fromUSD(ltv_result.ltv))}     variant="highlight" />
          <Metric label="Net LTV"  value={fmt(fromUSD(ltv_result.net_ltv))} variant={ltv_result.net_ltv >= 0 ? 'positive' : 'negative'} />
          <Metric label="LTV : CAC" value={`${ltv_result.ltv_cac_ratio}×`}  variant="default" sub={`Avg lifespan: ${ltv_result.customer_lifespan_months.toFixed(0)} mo`} />
          <Metric label="Payback"  value={`${ltv_result.payback_months} mo`} variant="default" />
        </div>
        <div className={cn(
          'rounded-xl px-4 py-3 border flex items-center gap-3',
          ltv_result.health === 'healthy' ? 'bg-primary/5 border-primary/20'
          : ltv_result.health === 'tight'  ? 'bg-amber-400/5 border-amber-400/20'
          : 'bg-rose-400/5 border-rose-400/20',
        )}>
          <div className={cn(
            'w-2 h-2 rounded-full shrink-0',
            ltv_result.health === 'healthy' ? 'bg-primary'
            : ltv_result.health === 'tight'  ? 'bg-amber-400'
            : 'bg-rose-400',
          )} />
          <div>
            <p className={cn(
              'font-mono text-sm font-bold',
              ltv_result.health === 'healthy' ? 'text-primary'
              : ltv_result.health === 'tight'  ? 'text-amber-400'
              : 'text-rose-400',
            )}>
              {ltv_result.health === 'healthy' ? 'Healthy LTV' : ltv_result.health === 'tight' ? 'Tight LTV' : 'Danger Zone'}
            </p>
            <p className="font-body text-xs text-muted">
              {ltv_result.health === 'healthy'
                ? `LTV:CAC ≥ 3 — strong unit economics`
                : ltv_result.health === 'tight'
                ? `LTV:CAC < 3 — consider improving retention`
                : `LTV:CAC < 1 — acquiring customers at a loss`}
            </p>
          </div>
        </div>
      </div>
    </div>
  </CalcCard>
</div>
```

Note: `CalcCard` must accept a `headerRight` prop. Check `components/tools/tool-layout.tsx` — if it doesn't have `headerRight`, add `headerRight?: React.ReactNode` to `CalcCardProps` and render it in the card header row alongside the title.

- [ ] **Step 4: Verify in browser**

```
npm run dev
```

Open `http://localhost:3000/tools/shopify-profit-calculator`. Scroll down to see the LTV card. Toggle between Frequency and Churn modes. Verify health badge changes color with different inputs.

- [ ] **Step 5: Commit**

```
git add app/tools/shopify-profit-calculator/page.tsx components/tools/tool-layout.tsx
git commit -m "feat(shopify): add Customer LTV card with frequency/churn toggle"
```

---

## Task 6: Plan Optimizer card UI

**Context:** Add the Plan Optimizer card showing a comparison table of all 4 Shopify plans at the user's current revenue, plus a `ToolLineChart` showing platform cost vs revenue with cross-over points.

**Files:**
- Modify: `app/tools/shopify-profit-calculator/page.tsx`

- [ ] **Step 1: Add calcPlanOptimizer import and optimizer_result memo**

Add `calcPlanOptimizer, PlanOptimizerInput` to the import from `@/lib/tools/shopify-profit`.

After `ltv_result`, add:

```tsx
const optimizer_result = useMemo(() =>
  calcPlanOptimizer({
    monthly_revenue:       input_usd.monthly_revenue,
    monthly_orders:        input_usd.monthly_orders,
    uses_shopify_payments: input_usd.uses_shopify_payments,
    cogs:                  input_usd.cogs,
    app_spend:             input_usd.app_spend,
    avg_return_rate_pct:   input_usd.avg_return_rate_pct,
    return_restocking_pct: input_usd.return_restocking_pct,
    monthly_shipping_cost: input_usd.monthly_shipping_cost,
    monthly_ad_spend:      input_usd.monthly_ad_spend,
    current_plan:          plan,
  }),
  [input_usd, plan],
)
```

- [ ] **Step 2: Add chart data memo**

```tsx
const PLAN_COLORS: Record<ShopifyPlan, string> = {
  basic:    '#6B7280',
  shopify:  '#60A5FA',
  advanced: '#C084FC',
  plus:     '#00E87A',
}

const PLAN_LABELS: Record<ShopifyPlan, string> = {
  basic:    'Basic ($39)',
  shopify:  'Shopify ($105)',
  advanced: 'Advanced ($399)',
  plus:     'Plus ($2,000)',
}

// Generate 20 data points from $0 to $200K
const optimizerChartData = useMemo(() => {
  const points = Array.from({ length: 21 }, (_, i) => i * 10000)
  return points.map((rev) => {
    const entry: Record<string, number> = { revenue: rev }
    const plans: ShopifyPlan[] = ['basic', 'shopify', 'advanced', 'plus']
    for (const p of plans) {
      const rate = SP_RATE[p]
      const fee = PLAN_MONTHLY_COST[p]
      // fixed_per_order not included here (no orders input for chart) — simple rate × revenue
      entry[p] = Math.round((fee + rev * rate) * 100) / 100
    }
    return entry
  })
}, [])
```

- [ ] **Step 3: Add Plan Optimizer card to JSX**

After the LTV card closing `</div>`, add:

```tsx
{/* ── Plan Optimizer ── */}
<div className="mt-6">
  <CalcCard title="Plan Optimizer">
    {/* Comparison table */}
    <div className="overflow-x-auto mb-6">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border">
            {['Plan', 'Monthly Fee', 'Processing', 'Total Cost', 'True Profit', 'vs Current'].map(h => (
              <th key={h} className="font-body text-xs text-muted uppercase tracking-wide pb-2 pr-4 last:text-right">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {optimizer_result.rows.map((row) => {
            const isCurrent = row.plan === plan
            const isRecommended = row.plan === optimizer_result.recommended_plan
            return (
              <tr
                key={row.plan}
                className={cn(
                  'border-b border-border/50 last:border-0',
                  isCurrent && 'bg-primary/5 border-l-2 border-l-primary',
                )}
              >
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-2">
                    <span className={cn('font-body text-sm', isCurrent ? 'text-primary font-semibold' : 'text-text')}>
                      {PLAN_LABELS[row.plan]}
                    </span>
                    {isRecommended && !isCurrent && (
                      <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        Best
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 pr-4 font-mono text-xs text-muted">
                  {fmt(fromUSD(PLAN_MONTHLY_COST[row.plan]))}
                </td>
                <td className="py-2 pr-4 font-mono text-xs text-muted">
                  {fmt(fromUSD(row.total_platform_cost - PLAN_MONTHLY_COST[row.plan]))}
                </td>
                <td className={cn('py-2 pr-4 font-mono text-sm', isCurrent ? 'text-primary font-semibold' : 'text-text')}>
                  {fmt(fromUSD(row.total_platform_cost))}
                </td>
                <td className={cn('py-2 pr-4 font-mono text-sm', row.true_profit >= 0 ? 'text-primary' : 'text-rose-400')}>
                  {fmt(fromUSD(row.true_profit))}
                </td>
                <td className={cn('py-2 font-mono text-sm text-right', row.saves_vs_current > 0 ? 'text-primary' : row.saves_vs_current < 0 ? 'text-rose-400' : 'text-muted')}>
                  {row.saves_vs_current === 0 ? '—' : `${row.saves_vs_current > 0 ? '+' : ''}${fmt(fromUSD(row.saves_vs_current))}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>

    {/* Cost vs Revenue line chart */}
    <div>
      <p className="font-body text-xs text-muted uppercase tracking-wide mb-3">
        Platform Cost vs Monthly Revenue
      </p>
      <ToolLineChart
        data={optimizerChartData}
        xKey="revenue"
        lines={[
          { key: 'basic',    label: PLAN_LABELS.basic,    color: PLAN_COLORS.basic },
          { key: 'shopify',  label: PLAN_LABELS.shopify,  color: PLAN_COLORS.shopify },
          { key: 'advanced', label: PLAN_LABELS.advanced, color: PLAN_COLORS.advanced },
          { key: 'plus',     label: PLAN_LABELS.plus,     color: PLAN_COLORS.plus },
        ]}
        height={240}
        yFormatter={(v) => fmt(fromUSD(v))}
      />
      <p className="font-body text-xs text-muted mt-2">
        Cross-over points:{' '}
        {optimizer_result.crossovers.map((co, i) => (
          <span key={i}>
            {i > 0 && ' · '}
            {PLAN_LABELS[co.from_plan].split(' ')[0]}→{PLAN_LABELS[co.to_plan].split(' ')[0]} at{' '}
            <span className="text-text">{fmt(fromUSD(co.breakeven_revenue))}/mo</span>
          </span>
        ))}
      </p>
    </div>
  </CalcCard>
</div>
```

Also add `ToolLineChart` to the import from `@/components/tools/tool-chart`:
```tsx
import { ToolLineChart } from '@/components/tools/tool-chart'
```

- [ ] **Step 4: Verify in browser**

Open `http://localhost:3000/tools/shopify-profit-calculator`. Scroll to Plan Optimizer. Verify table shows 4 rows with correct values. Verify the line chart renders 4 lines. Verify current plan is highlighted with green left border.

- [ ] **Step 5: Commit**

```
git add app/tools/shopify-profit-calculator/page.tsx
git commit -m "feat(shopify): add Plan Optimizer card with comparison table and cost chart"
```

---

## Task 7: Subscription card UI

**Context:** Add the Subscription Revenue card, toggled on/off by a header switch. When visible, shows inputs for MRR, churn, expansion, contraction, a results strip, health badge, and a 12-month MRR projection line chart.

**Files:**
- Modify: `app/tools/shopify-profit-calculator/page.tsx`

- [ ] **Step 1: Add subscription state variables**

After the LTV state declarations, add:

```tsx
// Subscription state
const [show_subscription, setShowSubscription] = useState(false)
const [sub_starting_mrr, setSubStartingMrr] = useState('10000')
const [sub_new_mrr, setSubNewMrr] = useState('500')
const [sub_churned_mrr, setSubChurnedMrr] = useState('200')
const [sub_expansion_mrr, setSubExpansionMrr] = useState('0')
const [sub_contraction_mrr, setSubContractionMrr] = useState('0')
const [sub_subscribers, setSubSubscribers] = useState('200')
const [sub_margin, setSubMargin] = useState('70')
const [sub_cac, setSubCac] = useState('40')
```

- [ ] **Step 2: Add calcSubscription import and sub_result memo**

Add `calcSubscription, SubscriptionInput` to the import from `@/lib/tools/shopify-profit`.

After `optimizer_result`, add:

```tsx
const sub_result = useMemo(() =>
  calcSubscription({
    starting_mrr:             toUSD(parseFloat(sub_starting_mrr) || 0),
    new_mrr_per_month:        toUSD(parseFloat(sub_new_mrr)       || 0),
    churned_mrr_per_month:    toUSD(parseFloat(sub_churned_mrr)   || 0),
    expansion_mrr_per_month:  toUSD(parseFloat(sub_expansion_mrr) || 0),
    contraction_mrr_per_month: toUSD(parseFloat(sub_contraction_mrr) || 0),
    subscriber_count:         parseFloat(sub_subscribers)          || 0,
    gross_margin_pct:         parseFloat(sub_margin)               || 0,
    cac:                      toUSD(parseFloat(sub_cac)            || 0),
  }),
  [sub_starting_mrr, sub_new_mrr, sub_churned_mrr, sub_expansion_mrr,
   sub_contraction_mrr, sub_subscribers, sub_margin, sub_cac, toUSD],
)

const subChartData = useMemo(() =>
  sub_result.mrr_projection.map((mrr, i) => ({
    month: `M${i + 1}`,
    mrr: fromUSD(mrr),
  })),
  [sub_result.mrr_projection, fromUSD],
)
```

- [ ] **Step 3: Add Subscription card to JSX**

After the Plan Optimizer card closing `</div>`, add:

```tsx
{/* ── Subscription Revenue ── */}
<div className="mt-6">
  <CalcCard
    title="Subscription Revenue"
    headerRight={
      <div className="flex items-center gap-2">
        <span className="font-body text-xs text-muted">Enable</span>
        <button
          onClick={() => setShowSubscription(!show_subscription)}
          className={cn(
            'w-10 h-6 rounded-full transition-colors relative flex items-center',
            show_subscription ? 'bg-primary' : 'bg-border',
          )}
          role="switch"
          aria-checked={show_subscription}
        >
          <span className={cn(
            'w-4 h-4 rounded-full bg-white shadow transition-transform absolute',
            show_subscription ? 'translate-x-5' : 'translate-x-0.5',
          )} />
        </button>
      </div>
    }
  >
    {show_subscription ? (
      <div className="flex flex-col gap-6">
        {/* Inputs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Starting MRR">
            <Input value={sub_starting_mrr} onChange={setSubStartingMrr} prefix={currencySymbol} min={0} />
          </Field>
          <Field label="New MRR / mo">
            <Input value={sub_new_mrr} onChange={setSubNewMrr} prefix={currencySymbol} min={0} />
          </Field>
          <Field label="Churned MRR / mo">
            <Input value={sub_churned_mrr} onChange={setSubChurnedMrr} prefix={currencySymbol} min={0} />
          </Field>
          <Field label="Expansion MRR / mo">
            <Input value={sub_expansion_mrr} onChange={setSubExpansionMrr} prefix={currencySymbol} min={0} />
          </Field>
          <Field label="Contraction MRR / mo">
            <Input value={sub_contraction_mrr} onChange={setSubContractionMrr} prefix={currencySymbol} min={0} />
          </Field>
          <Field label="Subscribers">
            <Input value={sub_subscribers} onChange={setSubSubscribers} min={0} />
          </Field>
          <Field label="Gross Margin">
            <Input value={sub_margin} onChange={setSubMargin} suffix="%" min={0} max={100} />
          </Field>
          <Field label="CAC">
            <Input value={sub_cac} onChange={setSubCac} prefix={currencySymbol} min={0} />
          </Field>
        </div>

        {/* Results strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Metric
            label="NRR"
            value={`${sub_result.nrr_pct}%`}
            variant={sub_result.health === 'healthy' ? 'positive' : 'warning'}
            sub={sub_result.health === 'healthy' ? 'Retaining + growing' : 'Revenue shrinking'}
          />
          <Metric label="MRR (Net)"  value={fmt(fromUSD(sub_result.mrr_net))} variant="highlight" />
          <Metric label="ARR"        value={fmt(fromUSD(sub_result.arr))}     variant="default" />
          <Metric label="Sub LTV"    value={fmt(fromUSD(sub_result.sub_ltv))} variant="default" sub="Avg sub lifetime value" />
          <Metric
            label="Payback"
            value={sub_result.payback_months > 0 ? `${sub_result.payback_months} mo` : '—'}
            variant="default"
            sub="Months to recoup CAC"
          />
        </div>

        {/* Health badge */}
        <div className={cn(
          'rounded-xl px-4 py-3 border flex items-center gap-3',
          sub_result.health === 'healthy'
            ? 'bg-primary/5 border-primary/20'
            : 'bg-rose-400/5 border-rose-400/20',
        )}>
          <div className={cn(
            'w-2 h-2 rounded-full shrink-0',
            sub_result.health === 'healthy' ? 'bg-primary' : 'bg-rose-400',
          )} />
          <div>
            <p className={cn(
              'font-mono text-sm font-bold',
              sub_result.health === 'healthy' ? 'text-primary' : 'text-rose-400',
            )}>
              NRR {sub_result.nrr_pct}% — {sub_result.health === 'healthy' ? 'Healthy' : 'At Risk'}
            </p>
            <p className="font-body text-xs text-muted mt-0.5">
              {sub_result.health === 'healthy'
                ? 'Expansion revenue is offsetting churn — strong subscription base'
                : 'Churn exceeds expansion — subscription base is shrinking'}
            </p>
          </div>
        </div>

        {/* 12-month MRR projection */}
        <div>
          <p className="font-body text-xs text-muted uppercase tracking-wide mb-3">
            12-Month MRR Projection
          </p>
          <ToolLineChart
            data={subChartData}
            xKey="month"
            lines={[{ key: 'mrr', label: 'Projected MRR', color: '#00E87A' }]}
            height={200}
            yFormatter={(v) => fmt(v)}
          />
        </div>
      </div>
    ) : (
      <p className="font-body text-sm text-muted text-center py-6">
        Enable the toggle to model your subscription revenue — NRR, ARR, LTV, and 12-month projections.
      </p>
    )}
  </CalcCard>
</div>
```

- [ ] **Step 4: Verify in browser**

Open `http://localhost:3000/tools/shopify-profit-calculator`. Scroll to Subscription Revenue. Toggle it on. Enter sample inputs (e.g. starting MRR=$10K, new=$500, churned=$200, 200 subscribers, 70% margin, CAC=$40). Verify NRR, ARR, payback calculate correctly. Verify the 12-month projection chart renders and trends upward. Toggle off — verify card shows placeholder text.

- [ ] **Step 5: Run full test suite to confirm nothing broke**

```
npm test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```
git add app/tools/shopify-profit-calculator/page.tsx
git commit -m "feat(shopify): add Subscription Revenue card with NRR, ARR, LTV, and projection chart"
```
