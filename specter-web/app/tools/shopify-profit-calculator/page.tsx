'use client'

import { useState, useMemo, useEffect } from 'react'
import ToolLayout, {
  CalcCard, Field, Input, Select, Metric,
  ResultVerdict, SupportingMetrics, ToolInsightCard, ToolSection, FullBreakdown,
} from '@/components/tools/tool-layout'
import {
  calcShopifyProfit, calcLtv, calcPlanOptimizer, calcSubscription,
  ShopifyPlan, PLAN_MONTHLY_COST, SP_RATE, LtvMode,
} from '@/lib/tools/shopify-profit'
import { shopifyProfitInsights } from '@/lib/tools/insights'
import { SHOPIFY_SCHEMA } from '@/lib/tools/schema'
import { ToolLineChart } from '@/components/tools/tool-chart'
import { useCurrency } from '@/hooks/use-currency'
import type { ExportRow } from '@/lib/tools/export'
import ScenarioPanel from '@/components/tools/scenario-panel'
import ShareResult from '@/components/tools/share-result'
import { buildShareUrl, decodeShareState, type ShopifyShareState } from '@/lib/tools/share'
import ExportBar from '@/components/tools/export-bar'
import PrintReport from '@/components/tools/print-report'
import QuickAnswer from '@/components/tools/quick-answer'
import ToolFAQ from '@/components/tools/tool-faq'
import AdvancedAccordion from '@/components/tools/advanced-accordion'
import ToolDisclaimer from '@/components/tools/tool-disclaimer'
import type { Scenario } from '@/lib/tools/scenarios'
import { cn } from '@/lib/utils'

const PLANS: { value: ShopifyPlan; label: string }[] = [
  { value: 'basic',    label: `Basic — $${PLAN_MONTHLY_COST.basic}/mo (${(SP_RATE.basic * 100).toFixed(1)}% + $0.30)` },
  { value: 'shopify',  label: `Shopify — $${PLAN_MONTHLY_COST.shopify}/mo (${(SP_RATE.shopify * 100).toFixed(1)}% + $0.30)` },
  { value: 'advanced', label: `Advanced — $${PLAN_MONTHLY_COST.advanced}/mo (${(SP_RATE.advanced * 100).toFixed(1)}% + $0.30)` },
  { value: 'plus',     label: `Shopify Plus — $${PLAN_MONTHLY_COST.plus}/mo (0.15% + $0.30)` },
]

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

const resultLabels: Record<string, string> = {
  true_profit:           'True Profit',
  true_margin_pct:       'Margin %',
  revenue_per_ad_dollar: 'ROAS',
  gross_profit:          'Gross Profit',
  total_expenses:        'Total Expenses',
  effective_rate_pct:    'Effective Rate %',
}

export default function ShopifyProfitPage() {
  const [plan, setPlan]              = useState<ShopifyPlan>('shopify')
  const [revenue, setRevenue]        = useState('50000')
  const [cogs, setCogs]              = useState('25000')
  const [orders, setOrders]          = useState('500')
  const [app_spend, setAppSpend]     = useState('200')
  const [return_rate, setReturnRate] = useState('5')
  const [restocking, setRestocking]  = useState('20')
  const [shipping, setShipping]      = useState('2000')
  const [ad_spend, setAdSpend]       = useState('3000')
  const [uses_sp, setUsesSp]         = useState(true)

  // LTV state
  const [ltv_mode, setLtvMode]           = useState<LtvMode>('frequency')
  const [ltv_aov, setLtvAov]             = useState('85')
  const [ltv_purchases, setLtvPurchases] = useState('3')
  const [ltv_lifespan, setLtvLifespan]   = useState('2')
  const [ltv_churn, setLtvChurn]         = useState('5')
  const [ltv_cac, setLtvCac]             = useState('40')

  // Subscription state
  const [sub_starting_mrr, setSubStartingMrr]           = useState('10000')
  const [sub_new_mrr, setSubNewMrr]                     = useState('500')
  const [sub_churned_mrr, setSubChurnedMrr]             = useState('200')
  const [sub_expansion_mrr, setSubExpansionMrr]         = useState('0')
  const [sub_contraction_mrr, setSubContractionMrr]     = useState('0')
  const [sub_subscribers, setSubSubscribers]             = useState('200')
  const [sub_margin, setSubMargin]                       = useState('70')
  const [sub_cac, setSubCac]                             = useState('40')

  const { currency, toUSD, fromUSD, fmt, currencies } = useCurrency()
  const currencySymbol = currencies.find((c) => c.code === currency)?.symbol ?? '$'

  // Rehydrate inputs from a shared ?s= link (client-only, keeps the page static)
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('s')
    if (!s) return
    const st = decodeShareState<ShopifyShareState>(s)
    if (!st) return
    if (st.pl) setPlan(st.pl as ShopifyPlan)
    if (typeof st.rv === 'number') setRevenue(String(st.rv))
    if (typeof st.cg === 'number') setCogs(String(st.cg))
    if (typeof st.or === 'number') setOrders(String(st.or))
    if (typeof st.as === 'number') setAdSpend(String(st.as))
  }, [])

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
  const insight = useMemo(() => shopifyProfitInsights(r), [r])

  const expenseRows = useMemo(() => [
    { label: 'Shopify Subscription', value: r.plan_fee },
    { label: 'Payment Processing',   value: r.processing_fee },
    { label: 'App Subscriptions',    value: r.app_spend },
    { label: 'Returns Cost',         value: r.returns_cost },
    { label: 'Outbound Shipping',    value: r.shipping_cost },
    { label: 'Ad Spend',             value: r.ad_spend },
  ], [r])

  const exportInputs: ExportRow[] = useMemo(() => [
    { label: 'Plan',             value: plan },
    { label: 'Monthly Revenue',  value: fmt(fromUSD(parseFloat(revenue)    || 0)) },
    { label: 'COGS',             value: fmt(fromUSD(parseFloat(cogs)       || 0)) },
    { label: 'Monthly Orders',   value: orders },
    { label: 'App Spend',        value: fmt(fromUSD(parseFloat(app_spend)  || 0)) },
    { label: 'Return Rate',      value: `${return_rate}%` },
    { label: 'Restocking Loss',  value: `${restocking}%` },
    { label: 'Shipping Cost',    value: fmt(fromUSD(parseFloat(shipping)   || 0)) },
    { label: 'Ad Spend',         value: fmt(fromUSD(parseFloat(ad_spend)   || 0)) },
    { label: 'Shopify Payments', value: uses_sp ? 'Yes' : 'No' },
  ], [fmt, fromUSD, plan, revenue, cogs, orders, app_spend, return_rate, restocking, shipping, ad_spend, uses_sp])

  const exportResults: ExportRow[] = useMemo(() => [
    { label: 'True Profit',    value: fmt(fromUSD(r.true_profit)) },
    { label: 'Margin',         value: `${r.true_margin_pct}%` },
    { label: 'ROAS',           value: `${r.revenue_per_ad_dollar}×` },
    { label: 'Gross Profit',   value: fmt(fromUSD(r.gross_profit)) },
    { label: 'Total Expenses', value: fmt(fromUSD(r.total_expenses)) },
    { label: 'Effective Rate', value: `${r.effective_rate_pct}%` },
  ], [fmt, fromUSD, r])

  const currentInputs = useMemo(() => ({
    plan, revenue, cogs, orders, app_spend, return_rate,
    restocking, shipping, ad_spend, uses_sp: String(uses_sp),
  }), [plan, revenue, cogs, orders, app_spend, return_rate, restocking, shipping, ad_spend, uses_sp])

  const shareUrl = useMemo(
    () => buildShareUrl('/tools/shopify-profit-calculator', {
      rv: parseFloat(revenue) || 0,
      pl: plan,
      cg: parseFloat(cogs) || 0,
      or: parseFloat(orders) || 0,
      as: parseFloat(ad_spend) || 0,
    } satisfies ShopifyShareState),
    [revenue, plan, cogs, orders, ad_spend],
  )
  const shareChallenge = `My Shopify store keeps ${r.true_margin_pct}% true margin (${fmt(fromUSD(r.true_profit))}/mo profit) after every fee. Beat it?`

  const currentResults = useMemo(() => ({
    true_profit:           r.true_profit,
    true_margin_pct:       r.true_margin_pct,
    revenue_per_ad_dollar: r.revenue_per_ad_dollar,
    gross_profit:          r.gross_profit,
    total_expenses:        r.total_expenses,
    effective_rate_pct:    r.effective_rate_pct,
  }), [r])

  const ltv_result = useMemo(() =>
    calcLtv({
      mode:                     ltv_mode,
      avg_order_value:          toUSD(parseFloat(ltv_aov)      || 0),
      purchases_per_year:       parseFloat(ltv_purchases)       || 0,
      customer_lifespan_years:  parseFloat(ltv_lifespan)        || 0,
      monthly_churn_rate_pct:   parseFloat(ltv_churn)           || 0,
      cac:                      toUSD(parseFloat(ltv_cac)       || 0),
      true_margin_pct:          r.true_margin_pct,
    }),
    [ltv_mode, ltv_aov, ltv_purchases, ltv_lifespan, ltv_churn, ltv_cac, r.true_margin_pct, toUSD],
  )

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

  // 21 points: $0 to $200K in $10K steps
  const optimizerChartData = useMemo(() => {
    const plans: ShopifyPlan[] = ['basic', 'shopify', 'advanced', 'plus']
    return Array.from({ length: 21 }, (_, i) => {
      const rev = i * 10000
      const entry: Record<string, number> = { revenue: rev }
      for (const p of plans) {
        entry[p] = Math.round((PLAN_MONTHLY_COST[p] + rev * SP_RATE[p]) * 100) / 100
      }
      return entry
    })
  }, [])

  const sub_result = useMemo(() =>
    calcSubscription({
      starting_mrr:              toUSD(parseFloat(sub_starting_mrr)   || 0),
      new_mrr_per_month:         toUSD(parseFloat(sub_new_mrr)         || 0),
      churned_mrr_per_month:     toUSD(parseFloat(sub_churned_mrr)     || 0),
      expansion_mrr_per_month:   toUSD(parseFloat(sub_expansion_mrr)   || 0),
      contraction_mrr_per_month: toUSD(parseFloat(sub_contraction_mrr) || 0),
      subscriber_count:          parseFloat(sub_subscribers)           || 0,
      gross_margin_pct:          parseFloat(sub_margin)                || 0,
      cac:                       toUSD(parseFloat(sub_cac)             || 0),
    }),
    [sub_starting_mrr, sub_new_mrr, sub_churned_mrr, sub_expansion_mrr,
     sub_contraction_mrr, sub_subscribers, sub_margin, sub_cac, toUSD],
  )

  const subChartData = useMemo(() =>
    sub_result.mrr_projection.map((mrr, i) => ({
      month: `M${i + 1}`,
      mrr:   fromUSD(mrr),
    })),
    [sub_result.mrr_projection, fromUSD],
  )

  function handleLoadScenario(scenario: Scenario) {
    if (scenario.inputs.plan)        setPlan(String(scenario.inputs.plan) as ShopifyPlan)
    if (scenario.inputs.revenue)     setRevenue(String(scenario.inputs.revenue))
    if (scenario.inputs.cogs)        setCogs(String(scenario.inputs.cogs))
    if (scenario.inputs.orders)      setOrders(String(scenario.inputs.orders))
    if (scenario.inputs.app_spend)   setAppSpend(String(scenario.inputs.app_spend))
    if (scenario.inputs.return_rate) setReturnRate(String(scenario.inputs.return_rate))
    if (scenario.inputs.restocking)  setRestocking(String(scenario.inputs.restocking))
    if (scenario.inputs.shipping)    setShipping(String(scenario.inputs.shipping))
    if (scenario.inputs.ad_spend)    setAdSpend(String(scenario.inputs.ad_spend))
    setUsesSp(scenario.inputs.uses_sp === 'true')
  }

  return (
    <ToolLayout
      toolId="shopify"
      toolHref="/tools/shopify-profit-calculator"
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
          <ShareResult
            shareUrl={shareUrl}
            toolName="the Shopify Profit Calculator"
            resultSummary={`${fmt(fromUSD(r.true_profit))} true profit · ${r.true_margin_pct}% margin`}
            challenge={shareChallenge}
          />
        </>
      }
    >
      <PrintReport
        toolName="Shopify True Profit Calculator"
        toolId="shopify"
        currency={currency}
        inputs={exportInputs}
        results={exportResults}
      />

      <QuickAnswer text={SHOPIFY_SCHEMA.quickAnswer} />

      {/* ── Inputs (core visible, operating costs in Advanced) ── */}
      <CalcCard title="Your store">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Field label="Shopify plan">
              <Select value={plan} onChange={(v) => setPlan(v as ShopifyPlan)}>
                {PLANS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Monthly revenue">
            <Input value={revenue} onChange={setRevenue} prefix={currencySymbol} min={0} />
          </Field>
          <Field label="Cost of goods sold">
            <Input value={cogs} onChange={setCogs} prefix={currencySymbol} min={0} />
          </Field>
          <Field label="Monthly orders">
            <Input value={orders} onChange={setOrders} min={0} />
          </Field>
          <Field label="Monthly ad spend">
            <Input value={ad_spend} onChange={setAdSpend} prefix={currencySymbol} min={0} />
          </Field>
        </div>
        <div className="flex items-center justify-between mt-4 py-2 px-3 rounded-lg bg-bg border border-border">
          <div>
            <p className="font-body text-sm text-text">Using Shopify Payments</p>
            <p className="font-body text-xs text-muted">Disable to add 3rd-party transaction fee</p>
          </div>
          <button
            onClick={() => setUsesSp(!uses_sp)}
            className={cn('w-10 h-6 rounded-full transition-colors relative flex items-center shrink-0', uses_sp ? 'bg-primary' : 'bg-border')}
            role="switch"
            aria-checked={uses_sp}
          >
            <span className={cn('w-4 h-4 rounded-full bg-white shadow transition-transform absolute', uses_sp ? 'translate-x-5' : 'translate-x-0.5')} />
          </button>
        </div>
      </CalcCard>

      <div className="mt-4">
        <AdvancedAccordion label="Operating costs — apps, shipping, returns">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Monthly app spend">
              <Input value={app_spend} onChange={setAppSpend} prefix={currencySymbol} min={0} />
            </Field>
            <Field label="Outbound shipping">
              <Input value={shipping} onChange={setShipping} prefix={currencySymbol} min={0} />
            </Field>
            <Field label="Return rate" hint="% of orders returned">
              <Input value={return_rate} onChange={setReturnRate} suffix="%" min={0} max={100} />
            </Field>
            <Field label="Restocking loss" hint="% of returned value lost">
              <Input value={restocking} onChange={setRestocking} suffix="%" min={0} max={100} />
            </Field>
          </div>
        </AdvancedAccordion>
      </div>

      {/* ── THE ANSWER ── */}
      <div className="mt-6 space-y-6">
        <ResultVerdict
          heroLabel="True monthly profit"
          hero={fmt(fromUSD(r.true_profit))}
          variant={r.true_profit > 0 ? 'positive' : 'negative'}
          whatThisMeans={`After every fee, you keep ${r.true_margin_pct}% of revenue. Non-COGS costs total ${fmt(fromUSD(r.total_expenses))}/mo.`}
          doThisNext={
            r.true_margin_pct >= 15
              ? 'Healthy margin. Use the LTV and Plan Optimizer below to protect it as you scale.'
              : 'Thin margin — the breakdown below shows which fees are eating it.'
          }
        />

        <SupportingMetrics>
          <Metric label="True margin" value={`${r.true_margin_pct}%`} variant={r.true_margin_pct >= 15 ? 'positive' : 'warning'} sub="after all fees" />
          <Metric label="Total expenses" value={fmt(fromUSD(r.total_expenses))} variant="negative" sub="all non-COGS costs" />
          <Metric label="Processing rate" value={`${r.effective_rate_pct}%`} sub="plan + payments / revenue" />
        </SupportingMetrics>

        <ToolInsightCard insight={insight} />

        {/* ── Full breakdown (collapsed, still in DOM) ── */}
        <FullBreakdown label="See the full profit waterfall">
          <div className="space-y-1">
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="font-body text-sm text-text font-semibold">Gross revenue</span>
              <span className="font-mono text-sm text-primary">{fmt(fromUSD(r.gross_revenue))}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/60">
              <span className="font-body text-sm text-muted">− Cost of goods</span>
              <span className="font-mono text-sm text-rose-400">−{fmt(fromUSD(parseFloat(cogs) || 0))}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border font-semibold">
              <span className="font-body text-sm text-text">= Gross profit</span>
              <span className="font-mono text-sm text-text">{fmt(fromUSD(r.gross_profit))}</span>
            </div>
            {expenseRows.map(({ label, value }) => value > 0 && (
              <div key={label} className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-0">
                <span className="font-body text-xs text-muted">− {label}</span>
                <span className="font-mono text-xs text-rose-400">−{fmt(fromUSD(value))}</span>
              </div>
            ))}
            <div className="flex justify-between items-center py-2.5 border-t border-border mt-1">
              <span className="font-body text-sm font-bold text-text">= True profit</span>
              <span className={cn('font-mono text-sm font-bold', r.true_profit >= 0 ? 'text-primary' : 'text-rose-400')}>
                {fmt(fromUSD(r.true_profit))}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
            <Metric label="Gross profit" value={fmt(fromUSD(r.gross_profit))} variant="positive" sub="before operating expenses" />
            <Metric label="Revenue per $1 ad spend" value={`${r.revenue_per_ad_dollar}×`} variant={r.revenue_per_ad_dollar >= 2 ? 'positive' : 'warning'} sub="advertising ROAS" />
          </div>
        </FullBreakdown>
      </div>

      {/* ── Deeper analyses (collapsed; promoted to the Workspace later) ── */}
      <div className="mt-6 space-y-4">
        {/* Customer LTV */}
        <ToolSection title="Customer LTV" subtitle="Lifetime value, LTV:CAC ratio and payback period">
          <div className="flex items-center gap-2 mb-4">
            <span className={cn('font-body text-xs', ltv_mode === 'frequency' ? 'text-text' : 'text-muted')}>Frequency</span>
            <button
              onClick={() => setLtvMode(ltv_mode === 'frequency' ? 'churn' : 'frequency')}
              className={cn('w-10 h-6 rounded-full transition-colors relative flex items-center', ltv_mode === 'churn' ? 'bg-primary' : 'bg-border')}
              role="switch"
              aria-checked={ltv_mode === 'churn'}
            >
              <span className={cn('w-4 h-4 rounded-full bg-white shadow transition-transform absolute', ltv_mode === 'churn' ? 'translate-x-5' : 'translate-x-0.5')} />
            </button>
            <span className={cn('font-body text-xs', ltv_mode === 'churn' ? 'text-text' : 'text-muted')}>Churn</span>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Avg order value">
                <Input value={ltv_aov} onChange={setLtvAov} prefix={currencySymbol} step={0.01} min={0} />
              </Field>
              <Field label="Purchases / year">
                <Input value={ltv_purchases} onChange={setLtvPurchases} step={0.1} min={0} />
              </Field>
              {ltv_mode === 'frequency' ? (
                <Field label="Customer lifespan (yrs)">
                  <Input value={ltv_lifespan} onChange={setLtvLifespan} step={0.5} min={0} />
                </Field>
              ) : (
                <Field label="Monthly churn rate" hint="% lost per month">
                  <Input value={ltv_churn} onChange={setLtvChurn} suffix="%" step={0.1} min={0} max={100} />
                </Field>
              )}
              <Field label="CAC">
                <Input value={ltv_cac} onChange={setLtvCac} prefix={currencySymbol} step={0.01} min={0} />
              </Field>
            </div>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Metric label="LTV"      value={fmt(fromUSD(ltv_result.ltv))}     variant="highlight" />
                <Metric label="Net LTV"  value={fmt(fromUSD(ltv_result.net_ltv))} variant={ltv_result.net_ltv >= 0 ? 'positive' : 'negative'} />
                <Metric label="LTV : CAC" value={`${ltv_result.ltv_cac_ratio}×`} sub={`Avg lifespan: ${ltv_result.customer_lifespan_months.toFixed(0)} mo`} />
                <Metric label="Payback"  value={`${ltv_result.payback_months} mo`} />
              </div>
              <div className={cn(
                'rounded-xl px-4 py-3 border flex items-center gap-3',
                ltv_result.health === 'healthy' ? 'bg-primary/5 border-primary/20'
                : ltv_result.health === 'tight'  ? 'bg-amber-400/5 border-amber-400/20'
                : 'bg-rose-400/5 border-rose-400/20',
              )}>
                <div className={cn('w-2 h-2 rounded-full shrink-0', ltv_result.health === 'healthy' ? 'bg-primary' : ltv_result.health === 'tight' ? 'bg-amber-400' : 'bg-rose-400')} />
                <div>
                  <p className={cn('font-mono text-sm font-bold', ltv_result.health === 'healthy' ? 'text-primary' : ltv_result.health === 'tight' ? 'text-amber-400' : 'text-rose-400')}>
                    {ltv_result.health === 'healthy' ? 'Healthy LTV' : ltv_result.health === 'tight' ? 'Tight LTV' : 'Danger Zone'}
                  </p>
                  <p className="font-body text-xs text-muted">
                    {ltv_result.health === 'healthy'
                      ? 'LTV:CAC ≥ 3 — strong unit economics'
                      : ltv_result.health === 'tight'
                      ? 'LTV:CAC < 3 — consider improving retention'
                      : 'LTV:CAC < 1 — acquiring customers at a loss'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ToolSection>

        {/* Plan Optimizer */}
        <ToolSection title="Plan optimizer" subtitle="Compare every Shopify plan's total cost and find the cheapest for your revenue">
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  {['Plan', 'Monthly Fee', 'Processing', 'Total Cost', 'True Profit', 'vs Current'].map(h => (
                    <th key={h} className="font-body text-xs text-muted uppercase tracking-wide pb-2 pr-4 last:text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {optimizer_result.rows.map((row) => {
                  const isCurrent = row.plan === plan
                  const isRecommended = row.plan === optimizer_result.recommended_plan
                  return (
                    <tr key={row.plan} className={cn('border-b border-border/50 last:border-0', isCurrent && 'border-l-2 border-l-primary')}>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <span className={cn('font-body text-sm', isCurrent ? 'text-primary font-semibold' : 'text-text')}>{PLAN_LABELS[row.plan]}</span>
                          {isRecommended && !isCurrent && (
                            <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Best</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-muted">{fmt(fromUSD(PLAN_MONTHLY_COST[row.plan]))}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-muted">{fmt(fromUSD(row.total_platform_cost - PLAN_MONTHLY_COST[row.plan]))}</td>
                      <td className={cn('py-2 pr-4 font-mono text-sm', isCurrent ? 'text-primary font-semibold' : 'text-text')}>{fmt(fromUSD(row.total_platform_cost))}</td>
                      <td className={cn('py-2 pr-4 font-mono text-sm', row.true_profit >= 0 ? 'text-primary' : 'text-rose-400')}>{fmt(fromUSD(row.true_profit))}</td>
                      <td className={cn('py-2 font-mono text-sm text-right', row.saves_vs_current > 0 ? 'text-primary' : row.saves_vs_current < 0 ? 'text-rose-400' : 'text-muted')}>
                        {row.saves_vs_current === 0 ? '—' : `${row.saves_vs_current > 0 ? '+' : ''}${fmt(fromUSD(row.saves_vs_current))}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div>
            <p className="font-body text-xs text-muted uppercase tracking-wide mb-3">Platform cost vs monthly revenue</p>
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
            {optimizer_result.crossovers.length > 0 && (
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
            )}
          </div>
        </ToolSection>

        {/* Subscription revenue */}
        <ToolSection title="Subscription revenue (MRR)" subtitle="Model NRR, ARR, subscriber LTV and a 12-month MRR projection">
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Starting MRR"><Input value={sub_starting_mrr} onChange={setSubStartingMrr} prefix={currencySymbol} min={0} /></Field>
              <Field label="New MRR / mo"><Input value={sub_new_mrr} onChange={setSubNewMrr} prefix={currencySymbol} min={0} /></Field>
              <Field label="Churned MRR / mo"><Input value={sub_churned_mrr} onChange={setSubChurnedMrr} prefix={currencySymbol} min={0} /></Field>
              <Field label="Expansion MRR / mo"><Input value={sub_expansion_mrr} onChange={setSubExpansionMrr} prefix={currencySymbol} min={0} /></Field>
              <Field label="Contraction MRR / mo"><Input value={sub_contraction_mrr} onChange={setSubContractionMrr} prefix={currencySymbol} min={0} /></Field>
              <Field label="Subscribers"><Input value={sub_subscribers} onChange={setSubSubscribers} min={0} /></Field>
              <Field label="Gross margin"><Input value={sub_margin} onChange={setSubMargin} suffix="%" min={0} max={100} /></Field>
              <Field label="CAC"><Input value={sub_cac} onChange={setSubCac} prefix={currencySymbol} min={0} /></Field>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Metric label="NRR" value={`${sub_result.nrr_pct}%`} variant={sub_result.health === 'healthy' ? 'positive' : 'warning'} sub={sub_result.health === 'healthy' ? 'Retaining + growing' : 'Revenue shrinking'} />
              <Metric label="MRR (Net)"  value={fmt(fromUSD(sub_result.mrr_net))} variant="highlight" />
              <Metric label="ARR"        value={fmt(fromUSD(sub_result.arr))} />
              <Metric label="Sub LTV"    value={fmt(fromUSD(sub_result.sub_ltv))} sub="Avg subscriber lifetime value" />
              <Metric label="Payback"    value={sub_result.payback_months > 0 ? `${sub_result.payback_months} mo` : '—'} sub="Months to recoup CAC" />
            </div>

            <div>
              <p className="font-body text-xs text-muted uppercase tracking-wide mb-3">12-month MRR projection</p>
              <ToolLineChart
                data={subChartData}
                xKey="month"
                lines={[{ key: 'mrr', label: 'Projected MRR', color: '#00E87A' }]}
                height={200}
                yFormatter={(v) => fmt(v)}
              />
            </div>
          </div>
        </ToolSection>
      </div>

      {/* ── Educational content (collapsed, in DOM for AEO) ── */}
      <div className="mt-6">
        <ToolSection title="How Shopify fees actually work" subtitle="Why gross margin hides a third of your real costs">
          <div className="space-y-5 font-body text-sm text-muted leading-relaxed">
            <div>
              <h3 className="font-display text-base font-semibold text-text mb-1.5">Gross margin vs true profit</h3>
              <p>
                Gross margin only subtracts the cost of the product. <span className="text-text font-medium">True profit</span>{' '}
                also subtracts your Shopify plan fee, payment processing, app subscriptions, returns, outbound shipping and
                ad spend — the costs that quietly turn a &quot;40% margin&quot; into a 12% one.
              </p>
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-text mb-1.5">The transaction fee trap</h3>
              <p>
                If you use a third-party payment processor instead of Shopify Payments, Shopify adds a transaction fee on top
                of your card rate: <span className="text-text">2% on Basic, 1% on Shopify, 0.5% on Advanced</span>. At
                $50k/mo that 2% is $1,000 — often more than the plan fee itself.
              </p>
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-text mb-1.5">When to upgrade your plan</h3>
              <p>
                A higher plan is worth it once the lower processing rate saves more than the higher monthly fee. The
                Plan Optimizer above finds that crossover for your exact revenue — for many stores Basic → Shopify pays off
                around $6,600/mo.
              </p>
            </div>
          </div>
        </ToolSection>
      </div>

      <ToolFAQ items={SHOPIFY_SCHEMA.faqItems} />

      <ToolDisclaimer toolSpecific="Shopify plan pricing and processing rates are based on publicly listed 2024 pricing and may change. Third-party payment processor fees are not included — add your processor rate separately. Always verify current rates at shopify.com/pricing." />
    </ToolLayout>
  )
}
