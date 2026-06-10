'use client'

import { useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { calcRoas } from '@/lib/tools/roas'
import { Field, Input, Metric } from '@/components/tools/tool-layout'
import { decodeShareState, type RoasShareState } from '@/lib/tools/share'

function RoasEmbed() {
  const searchParams = useSearchParams()

  const [adSpend,     setAdSpend]     = useState('2000')
  const [revenue,     setRevenue]     = useState('8000')
  const [cogs,        setCogs]        = useState('3000')
  const [fulfillment, setFulfillment] = useState('500')

  useState(() => {
    const s = searchParams.get('s')
    if (!s) return
    const st = decodeShareState<RoasShareState>(s)
    if (!st) return
    if (typeof st.sp === 'number') setAdSpend(String(st.sp))
    if (typeof st.rv === 'number') setRevenue(String(st.rv))
    if (typeof st.cg === 'number') setCogs(String(st.cg))
    if (typeof st.fl === 'number') setFulfillment(String(st.fl))
  })

  const r = useMemo(() => calcRoas({
    ad_spend:                 parseFloat(adSpend)     || 0,
    revenue:                  parseFloat(revenue)     || 0,
    cogs:                     parseFloat(cogs)        || 0,
    fulfillment_and_shipping: parseFloat(fulfillment) || 0,
  }), [adSpend, revenue, cogs, fulfillment])

  const roasColor = r.roas >= r.break_even_roas ? 'text-primary' : 'text-rose-400'

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] text-primary uppercase tracking-widest">ROAS Calculator</p>
          <p className="font-body text-xs text-muted">by SPECTER</p>
        </div>
        <Link href="/tools/roas-calculator" target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-primary transition-colors">
          Full tool <ExternalLink size={10} aria-hidden="true" />
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ad Spend">
              <Input value={adSpend}     onChange={setAdSpend}     prefix="$" step={100} min={0} />
            </Field>
            <Field label="Revenue">
              <Input value={revenue}     onChange={setRevenue}     prefix="$" step={100} min={0} />
            </Field>
            <Field label="COGS">
              <Input value={cogs}        onChange={setCogs}        prefix="$" step={100} min={0} />
            </Field>
            <Field label="Fulfillment">
              <Input value={fulfillment} onChange={setFulfillment} prefix="$" step={50}  min={0} />
            </Field>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="font-body text-xs text-muted uppercase tracking-widest mb-1">ROAS</p>
            <p className={cn('font-display text-3xl font-bold', roasColor)}>
              {r.roas.toFixed(2)}×
            </p>
            <p className="font-mono text-xs text-muted mt-1">
              Break-even: {r.break_even_roas.toFixed(2)}×
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Metric label="True ROAS"      value={`${r.troas.toFixed(2)}×`}          variant={r.troas >= r.break_even_roas ? 'positive' : 'negative'} />
            <Metric label="Net Profit"     value={`$${r.net_profit.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} variant={r.net_profit >= 0 ? 'positive' : 'negative'} />
            <Metric label="Gross Margin"   value={`${r.gross_margin_pct.toFixed(1)}%`} variant="default" />
            <Metric label="$/Ad Dollar"    value={`$${r.profit_per_ad_dollar.toFixed(2)}`} variant={r.profit_per_ad_dollar >= 0 ? 'positive' : 'negative'} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <p className="font-body text-xs text-muted">Powered by SPECTER — free pricing intelligence</p>
        <Link href="/tools/roas-calculator" target="_blank" rel="noopener" className="font-mono text-xs text-primary hover:underline">
          Full analysis →
        </Link>
      </div>
    </div>
  )
}

export default function RoasEmbedPage() {
  return (
    <Suspense fallback={<div className="p-4 text-muted font-body text-sm">Loading…</div>}>
      <RoasEmbed />
    </Suspense>
  )
}
