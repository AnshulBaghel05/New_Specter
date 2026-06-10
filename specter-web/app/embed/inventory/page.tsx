'use client'

import { useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { calcInventory } from '@/lib/tools/inventory'
import { Field, Input, Metric } from '@/components/tools/tool-layout'
import { decodeShareState, type InventoryShareState } from '@/lib/tools/share'

function InventoryEmbed() {
  const searchParams = useSearchParams()

  const [dailyDemand,   setDailyDemand]   = useState('20')
  const [orderCost,     setOrderCost]     = useState('50')
  const [holdingCost,   setHoldingCost]   = useState('25')
  const [unitCost,      setUnitCost]      = useState('12')
  const [leadTime,      setLeadTime]      = useState('7')

  useState(() => {
    const s = searchParams.get('s')
    if (!s) return
    const st = decodeShareState<InventoryShareState>(s)
    if (!st) return
    if (typeof st.dd === 'number') setDailyDemand(String(st.dd))
    if (typeof st.oc === 'number') setOrderCost(String(st.oc))
    if (typeof st.hc === 'number') setHoldingCost(String(st.hc))
    if (typeof st.up === 'number') setUnitCost(String(st.up))
    if (typeof st.lt === 'number') setLeadTime(String(st.lt))
  })

  const r = useMemo(() => calcInventory({
    avg_daily_demand:  parseFloat(dailyDemand) || 0,
    demand_std_dev:    Math.max(1, (parseFloat(dailyDemand) || 0) * 0.2),
    lead_time_days:    parseFloat(leadTime)    || 7,
    order_cost:        parseFloat(orderCost)   || 0,
    unit_cost:         parseFloat(unitCost)    || 0,
    holding_cost_pct:  parseFloat(holdingCost) || 25,
    service_level:     '95',
  }), [dailyDemand, orderCost, holdingCost, unitCost, leadTime])

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] text-primary uppercase tracking-widest">Inventory EOQ Calculator</p>
          <p className="font-body text-xs text-muted">by SPECTER</p>
        </div>
        <Link href="/tools/inventory-reorder-calculator" target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-primary transition-colors">
          Full tool <ExternalLink size={10} aria-hidden="true" />
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Daily Demand">
              <Input value={dailyDemand} onChange={setDailyDemand} suffix="units" step={1} min={0} />
            </Field>
            <Field label="Lead Time">
              <Input value={leadTime}    onChange={setLeadTime}    suffix="days"  step={1} min={1} />
            </Field>
            <Field label="Order Cost">
              <Input value={orderCost}   onChange={setOrderCost}   prefix="$"     step={1} min={0} />
            </Field>
            <Field label="Unit Cost">
              <Input value={unitCost}    onChange={setUnitCost}    prefix="$"     step={0.5} min={0} />
            </Field>
          </div>
          <Field label="Holding Cost (% of unit cost / yr)">
            <Input value={holdingCost} onChange={setHoldingCost} suffix="%" step={1} min={0} max={100} />
          </Field>
        </div>

        <div className="space-y-3">
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="font-body text-xs text-muted uppercase tracking-widest mb-1">Optimal Order Qty (EOQ)</p>
            <p className="font-display text-3xl font-bold text-primary">
              {Math.round(r.eoq).toLocaleString()}
            </p>
            <p className="font-mono text-xs text-muted mt-1">units per order</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Metric label="Reorder Point"    value={`${Math.round(r.reorder_point)} units`}   variant="highlight" />
            <Metric label="Safety Stock"     value={`${Math.round(r.safety_stock)} units`}    variant="default" />
            <Metric label="Orders / Year"    value={r.orders_per_year.toFixed(1)}              variant="default" />
            <Metric label="Inventory Turns"  value={r.inventory_turns.toFixed(1) + '×'}       variant={r.inventory_turns >= 4 ? 'positive' : 'warning'} />
          </div>

          <div className={cn('rounded-xl p-3 border', r.total_annual_cost > 0 ? 'bg-primary/5 border-primary/20' : 'bg-surface border-border')}>
            <p className="font-body text-xs text-muted mb-0.5">Total Annual Inventory Cost</p>
            <p className="font-mono text-lg font-bold text-primary">
              ${r.total_annual_cost.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <p className="font-body text-xs text-muted">Powered by SPECTER — free pricing intelligence</p>
        <Link href="/tools/inventory-reorder-calculator" target="_blank" rel="noopener" className="font-mono text-xs text-primary hover:underline">
          Full analysis →
        </Link>
      </div>
    </div>
  )
}

export default function InventoryEmbedPage() {
  return (
    <Suspense fallback={<div className="p-4 text-muted font-body text-sm">Loading…</div>}>
      <InventoryEmbed />
    </Suspense>
  )
}
