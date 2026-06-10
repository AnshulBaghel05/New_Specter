'use client'

import { useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  calcShopifyProfit, type ShopifyPlan,
  PLAN_MONTHLY_COST,
} from '@/lib/tools/shopify-profit'
import { Field, Input, Select, Metric } from '@/components/tools/tool-layout'
import { decodeShareState, type ShopifyShareState } from '@/lib/tools/share'

const PLANS: { value: ShopifyPlan; label: string }[] = [
  { value: 'basic',    label: `Basic — $${PLAN_MONTHLY_COST.basic}/mo` },
  { value: 'shopify',  label: `Shopify — $${PLAN_MONTHLY_COST.shopify}/mo` },
  { value: 'advanced', label: `Advanced — $${PLAN_MONTHLY_COST.advanced}/mo` },
  { value: 'plus',     label: `Plus — $${PLAN_MONTHLY_COST.plus}/mo` },
]

function ShopifyEmbed() {
  const searchParams = useSearchParams()

  const [plan, setPlan]     = useState<ShopifyPlan>('shopify')
  const [revenue, setRev]   = useState('50000')
  const [cogs, setCogs]     = useState('25000')
  const [orders, setOrders] = useState('500')
  const [adSpend, setAd]    = useState('3000')

  useState(() => {
    const s = searchParams.get('s')
    if (!s) return
    const st = decodeShareState<ShopifyShareState>(s)
    if (!st) return
    if (typeof st.rv === 'number') setRev(String(st.rv))
    if (typeof st.pl === 'string') setPlan(st.pl as ShopifyPlan)
    if (typeof st.cg === 'number') setCogs(String(st.cg))
    if (typeof st.or === 'number') setOrders(String(st.or))
    if (typeof st.as === 'number') setAd(String(st.as))
  })

  const r = useMemo(() => calcShopifyProfit({
    plan,
    monthly_revenue:       parseFloat(revenue) || 0,
    cogs:                  parseFloat(cogs)    || 0,
    monthly_orders:        parseFloat(orders)  || 0,
    app_spend:             0,
    avg_return_rate_pct:   3,
    return_restocking_pct: 20,
    monthly_shipping_cost: 0,
    monthly_ad_spend:      parseFloat(adSpend) || 0,
    uses_shopify_payments: true,
  }), [plan, revenue, cogs, orders, adSpend])

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] text-primary uppercase tracking-widest">Shopify Profit Calculator</p>
          <p className="font-body text-xs text-muted">by SPECTER</p>
        </div>
        <Link href="/tools/shopify-profit-calculator" target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-primary transition-colors">
          Full tool <ExternalLink size={10} aria-hidden="true" />
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Field label="Plan">
            <Select value={plan} onChange={v => setPlan(v as ShopifyPlan)}>
              {PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly Revenue">
              <Input value={revenue} onChange={setRev} prefix="$" step={100} min={0} />
            </Field>
            <Field label="COGS">
              <Input value={cogs} onChange={setCogs} prefix="$" step={100} min={0} />
            </Field>
            <Field label="Monthly Orders">
              <Input value={orders} onChange={setOrders} step={1} min={0} />
            </Field>
            <Field label="Ad Spend">
              <Input value={adSpend} onChange={setAd} prefix="$" step={100} min={0} />
            </Field>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="font-body text-xs text-muted uppercase tracking-widest mb-1">True Monthly Profit</p>
            <p className={cn('font-display text-3xl font-bold', r.true_profit >= 0 ? 'text-primary' : 'text-rose-400')}>
              ${r.true_profit.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
            <p className={cn('font-mono text-xs mt-1', r.true_margin_pct >= 0 ? 'text-primary' : 'text-rose-400')}>
              {r.true_margin_pct.toFixed(1)}% true margin
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Metric label="Plan Fee"        value={`$${r.plan_fee.toLocaleString()}`}        variant="negative" />
            <Metric label="Processing"      value={`${r.effective_rate_pct.toFixed(2)}%`}     variant="default" />
            <Metric label="Total Expenses"  value={`$${r.total_expenses.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} variant="negative" />
            <Metric label="Gross Profit"    value={`$${r.gross_profit.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}   variant="positive" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <p className="font-body text-xs text-muted">Powered by SPECTER — free pricing intelligence</p>
        <Link href="/tools/shopify-profit-calculator" target="_blank" rel="noopener" className="font-mono text-xs text-primary hover:underline">
          Full analysis →
        </Link>
      </div>
    </div>
  )
}

export default function ShopifyEmbedPage() {
  return (
    <Suspense fallback={<div className="p-4 text-muted font-body text-sm">Loading…</div>}>
      <ShopifyEmbed />
    </Suspense>
  )
}
