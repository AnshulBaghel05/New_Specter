'use client'

import { useState, useMemo, useEffect } from 'react'
import ToolLayout, {
  CalcCard, Field, Input, Select, Metric,
  ResultVerdict, SupportingMetrics, ToolInsightCard, ToolSection, FullBreakdown,
} from '@/components/tools/tool-layout'
import ScenarioPanel from '@/components/tools/scenario-panel'
import ShareResult from '@/components/tools/share-result'
import { buildShareUrl, decodeShareState, type InventoryShareState } from '@/lib/tools/share'
import ExportBar from '@/components/tools/export-bar'
import PrintReport from '@/components/tools/print-report'
import QuickAnswer from '@/components/tools/quick-answer'
import ToolFAQ from '@/components/tools/tool-faq'
import { useCurrency } from '@/hooks/use-currency'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  calcInventory,
  calcSeasonalInventory,
  calcAbcClassification,
  SEASONALITY_PRESETS,
  MONTH_NAMES,
  Z_SCORES,
  type ServiceLevel,
  type SeasonalityPreset,
  type SkuInput,
} from '@/lib/tools/inventory'
import { inventoryInsights } from '@/lib/tools/insights'
import { INVENTORY_SCHEMA } from '@/lib/tools/schema'
import ToolDisclaimer from '@/components/tools/tool-disclaimer'
import type { Scenario } from '@/lib/tools/scenarios'
import { cn } from '@/lib/utils'

const SERVICE_LEVELS: { value: ServiceLevel; label: string }[] = [
  { value: '90', label: '90% — z=1.28' },
  { value: '95', label: '95% — z=1.645' },
  { value: '99', label: '99% — z=2.326' },
]

const PRESET_OPTIONS: { value: SeasonalityPreset; label: string }[] = [
  { value: 'flat',           label: 'Flat / Even year-round' },
  { value: 'holiday_heavy',  label: 'Holiday Heavy (Q4 peak)' },
  { value: 'summer_peak',    label: 'Summer Peak (June–Aug)' },
  { value: 'back_to_school', label: 'Back to School (Aug–Sep)' },
]

const ABC_COLORS = { A: 'text-primary', B: 'text-amber-400', C: 'text-muted' }
const ABC_BG    = { A: 'bg-primary/10 border-primary/20', B: 'bg-amber-400/10 border-amber-400/20', C: 'bg-surface border-border' }

function defaultSkus(): SkuInput[] {
  return [
    { sku_id: 'SKU-001', unit_cost: 50, annual_units: 1000 },
    { sku_id: 'SKU-002', unit_cost: 20, annual_units: 500 },
    { sku_id: 'SKU-003', unit_cost: 15, annual_units: 400 },
  ]
}

export default function InventoryReorderPage() {
  const { currency, fmt, fromUSD, toUSD, currencies } = useCurrency()

  // ── EOQ / shared inputs ────────────────────────────────────────────────────
  const [dailyDemand,  setDailyDemand]  = useState('10')
  const [stdDev,       setStdDev]       = useState('3')
  const [leadTime,     setLeadTime]     = useState('7')
  const [orderCost,    setOrderCost]    = useState('50')
  const [unitCost,     setUnitCost]     = useState('20')
  const [holdingPct,   setHoldingPct]   = useState('25')
  const [serviceLevel, setServiceLevel] = useState<ServiceLevel>('95')
  const [sellingPrice, setSellingPrice] = useState('49.99')

  const eoqResult = useMemo(() => calcInventory({
    avg_daily_demand:  parseFloat(dailyDemand)  || 0,
    demand_std_dev:    parseFloat(stdDev)        || 0,
    lead_time_days:    parseFloat(leadTime)      || 1,
    order_cost:        toUSD(parseFloat(orderCost)    || 0),
    unit_cost:         toUSD(parseFloat(unitCost)     || 0),
    holding_cost_pct:  parseFloat(holdingPct)    || 0,
    service_level:     serviceLevel,
    selling_price:     toUSD(parseFloat(sellingPrice) || 0),
  }), [dailyDemand, stdDev, leadTime, orderCost, unitCost, holdingPct, serviceLevel, sellingPrice, toUSD])

  const insight = useMemo(() => inventoryInsights(eoqResult), [eoqResult])

  // Rehydrate inputs from a shared ?s= link (client-only, keeps the page static)
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('s')
    if (!s) return
    const st = decodeShareState<InventoryShareState>(s)
    if (!st) return
    if (typeof st.dd === 'number') setDailyDemand(String(st.dd))
    if (typeof st.oc === 'number') setOrderCost(String(st.oc))
    if (typeof st.hc === 'number') setHoldingPct(String(st.hc))
    if (typeof st.up === 'number') setUnitCost(String(st.up))
    if (typeof st.lt === 'number') setLeadTime(String(st.lt))
  }, [])

  const shareUrl = useMemo(
    () => buildShareUrl('/tools/inventory-reorder-calculator', {
      dd: parseFloat(dailyDemand) || 0,
      oc: parseFloat(orderCost) || 0,
      hc: parseFloat(holdingPct) || 0,
      up: parseFloat(unitCost) || 0,
      lt: parseFloat(leadTime) || 0,
    } satisfies InventoryShareState),
    [dailyDemand, orderCost, holdingPct, unitCost, leadTime],
  )
  const shareChallenge = `My reorder point is ${eoqResult.reorder_point.toLocaleString()} units with an EOQ of ${eoqResult.eoq.toLocaleString()}. Dialed in your inventory yet?`

  // ── Seasonal inputs ────────────────────────────────────────────────────────
  const [preset,      setPreset] = useState<SeasonalityPreset>('flat')
  const [multipliers, setMults]  = useState<number[]>([...SEASONALITY_PRESETS.flat])

  function applyPreset(p: SeasonalityPreset) {
    setPreset(p)
    setMults([...SEASONALITY_PRESETS[p]])
  }

  const seasonalResult = useMemo(() => calcSeasonalInventory({
    avg_daily_demand:  parseFloat(dailyDemand)  || 0,
    demand_std_dev:    parseFloat(stdDev)        || 0,
    lead_time_days:    parseFloat(leadTime)      || 1,
    order_cost:        toUSD(parseFloat(orderCost)    || 0),
    unit_cost:         toUSD(parseFloat(unitCost)     || 0),
    holding_cost_pct:  parseFloat(holdingPct)    || 0,
    service_level:     serviceLevel,
    selling_price:     toUSD(parseFloat(sellingPrice) || 0),
    monthly_multipliers: multipliers,
  }), [dailyDemand, stdDev, leadTime, orderCost, unitCost, holdingPct, serviceLevel, sellingPrice, multipliers, toUSD])

  // ── ABC inputs ─────────────────────────────────────────────────────────────
  const [skus, setSkus] = useState<SkuInput[]>(defaultSkus())

  function updateSku(idx: number, field: keyof SkuInput, value: string) {
    setSkus(prev => prev.map((s, i) => {
      if (i !== idx) return s
      if (field === 'sku_id') return { ...s, sku_id: value }
      return { ...s, [field]: parseFloat(value) || 0 }
    }))
  }

  function addSku() {
    if (skus.length >= 20) return
    setSkus(prev => [...prev, { sku_id: `SKU-${String(prev.length + 1).padStart(3, '0')}`, unit_cost: 10, annual_units: 100 }])
  }

  function removeSku(idx: number) {
    setSkus(prev => prev.filter((_, i) => i !== idx))
  }

  const abcResult = useMemo(
    () => calcAbcClassification(skus.map(s => ({ ...s, unit_cost: toUSD(s.unit_cost) }))),
    [skus, toUSD],
  )

  // ── Scenario wiring ────────────────────────────────────────────────────────
  const scenarioInputs  = { dailyDemand, stdDev, leadTime, orderCost, unitCost, holdingPct, serviceLevel, sellingPrice }
  const scenarioResults = {
    eoq:               eoqResult.eoq,
    reorder_point:     eoqResult.reorder_point,
    safety_stock:      eoqResult.safety_stock,
    total_annual_cost: eoqResult.total_annual_cost,
    inventory_turns:   eoqResult.inventory_turns,
  }
  const scenarioLabels  = {
    eoq:               'EOQ',
    reorder_point:     'Reorder Point',
    safety_stock:      'Safety Stock',
    total_annual_cost: 'Total Annual Cost',
    inventory_turns:   'Inventory Turns',
  }

  function loadScenario(s: Scenario) {
    const v = s.inputs as Record<string, string>
    if (v.dailyDemand  != null) setDailyDemand(v.dailyDemand)
    if (v.stdDev       != null) setStdDev(v.stdDev)
    if (v.leadTime     != null) setLeadTime(v.leadTime)
    if (v.orderCost    != null) setOrderCost(v.orderCost)
    if (v.unitCost     != null) setUnitCost(v.unitCost)
    if (v.holdingPct   != null) setHoldingPct(v.holdingPct)
    if (v.serviceLevel != null) setServiceLevel(v.serviceLevel as ServiceLevel)
    if (v.sellingPrice != null) setSellingPrice(v.sellingPrice)
  }

  const exportInputs  = [
    { label: 'Daily Demand',   value: dailyDemand },
    { label: 'Std Dev',        value: stdDev },
    { label: 'Lead Time',      value: leadTime },
    { label: 'Order Cost',     value: orderCost },
    { label: 'Unit Cost',      value: unitCost },
    { label: 'Holding %',      value: holdingPct },
    { label: 'Service Level',  value: serviceLevel },
    { label: 'Selling Price',  value: sellingPrice },
  ]
  const exportResults = [
    { label: 'EOQ',              value: String(eoqResult.eoq) },
    { label: 'Reorder Point',    value: String(eoqResult.reorder_point) },
    { label: 'Safety Stock',     value: String(eoqResult.safety_stock) },
    { label: 'Inventory Turns',  value: String(eoqResult.inventory_turns) },
    { label: 'Days of Inventory',value: String(eoqResult.days_of_inventory) },
    { label: 'Working Capital',  value: String(eoqResult.working_capital) },
  ]

  const currSymbol = currencies.find(c => c.code === currency)?.symbol ?? '$'

  return (
    <ToolLayout
      toolId="inventory-eoq"
      toolHref="/tools/inventory-reorder-calculator"
      badge="Free Inventory Tool"
      title="Inventory EOQ & Restock Calculator"
      description="Know exactly when to reorder and how much to buy — then plan for seasonal demand and classify your SKU portfolio by annual value."
      headerRight={
        <div className="flex items-center gap-3">
          <ScenarioPanel
            toolId="inventory-eoq"
            currentInputs={scenarioInputs}
            currentResults={scenarioResults}
            currency={currency}
            resultLabels={scenarioLabels}
            onLoad={loadScenario}
          />
          <ExportBar toolId="inventory-eoq" inputs={exportInputs} results={exportResults} currency={currency} />
          <ShareResult
            shareUrl={shareUrl}
            toolName="the Inventory EOQ Calculator"
            resultSummary={`Reorder at ${eoqResult.reorder_point.toLocaleString()} units · EOQ ${eoqResult.eoq.toLocaleString()}`}
            challenge={shareChallenge}
          />
        </div>
      }
    >
      <PrintReport
        toolName="Inventory EOQ & Restock Calculator"
        toolId="inventory-eoq"
        currency={currency}
        inputs={exportInputs}
        results={exportResults}
      />

      <QuickAnswer text={INVENTORY_SCHEMA.quickAnswer} />

      {/* ── Inputs (compact) ── */}
      <div className="grid md:grid-cols-3 gap-5 items-start">
        <CalcCard title="Demand & Lead Time">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Avg Daily Demand" hint="Units sold per day">
              <Input value={dailyDemand} onChange={setDailyDemand} suffix="units" min={0.1} step={0.1} />
            </Field>
            <Field label="Demand Std Dev" hint="Day-to-day variability (σ)">
              <Input value={stdDev} onChange={setStdDev} suffix="units" min={0} step={0.1} />
            </Field>
            <Field label="Lead Time" hint="Days from order to receipt">
              <Input value={leadTime} onChange={setLeadTime} suffix="days" min={1} />
            </Field>
            <Field label="Selling Price" hint="For stockout cost">
              <Input value={sellingPrice} onChange={setSellingPrice} prefix={currSymbol} min={0} step={0.01} />
            </Field>
          </div>
        </CalcCard>

        <CalcCard title="Order & Holding Costs">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Order Cost" hint="Cost to place one PO">
              <Input value={orderCost} onChange={setOrderCost} prefix={currSymbol} min={0} />
            </Field>
            <Field label="Unit Cost (COGS)">
              <Input value={unitCost} onChange={setUnitCost} prefix={currSymbol} min={0} step={0.01} />
            </Field>
            <Field label="Annual Holding Cost" hint="% of unit value">
              <Input value={holdingPct} onChange={setHoldingPct} suffix="%" min={0} max={100} />
            </Field>
          </div>
        </CalcCard>

        <CalcCard title="Service Level">
          <Field label="Target Service Level">
            <Select value={serviceLevel} onChange={v => setServiceLevel(v as ServiceLevel)}>
              {SERVICE_LEVELS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          <div className="mt-3 p-3 rounded-lg bg-bg border border-border">
            <p className="font-body text-xs text-muted">
              Z-score: <span className="font-mono text-primary">{Z_SCORES[serviceLevel]}</span>
              {' '}· Stockout risk: <span className="font-mono text-rose-400">{eoqResult.stockout_risk_pct}%</span>
            </p>
          </div>
        </CalcCard>
      </div>

      {/* ── THE ANSWER ── */}
      <div className="mt-6 space-y-6">
        <ResultVerdict
          heroLabel="Reorder point"
          hero={`${eoqResult.reorder_point.toLocaleString()} units`}
          variant="highlight"
          whatThisMeans={`When stock falls to ${eoqResult.reorder_point.toLocaleString()} units, place a new order. That covers demand across your ${leadTime}-day lead time plus a ${eoqResult.safety_stock.toLocaleString()}-unit safety buffer.`}
          doThisNext={`Order ${eoqResult.eoq.toLocaleString()} units at a time — the quantity that minimises total ordering + holding cost (${fmt(fromUSD(eoqResult.total_annual_cost))}/yr). Each order lasts about ${eoqResult.days_supply_per_order} days.`}
        />

        <SupportingMetrics>
          <Metric label="Safety stock" value={`${eoqResult.safety_stock.toLocaleString()} units`} variant="warning" sub={`${serviceLevel}% service-level buffer`} />
          <Metric label="Order quantity (EOQ)" value={`${eoqResult.eoq.toLocaleString()} units`} variant="highlight" sub={`${eoqResult.orders_per_year} orders/year`} />
          <Metric label="Days of stock / order" value={`${eoqResult.days_supply_per_order}`} sub="how long one EOQ lasts" />
        </SupportingMetrics>

        <ToolInsightCard insight={insight} />

        {/* ── Full breakdown (collapsed, still in DOM) ── */}
        <FullBreakdown label="See the annual cost breakdown">
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border">
              <div>
                <p className="font-body text-sm text-text">Ordering Cost</p>
                <p className="font-body text-xs text-muted">{eoqResult.orders_per_year} orders × {fmt(fromUSD(parseFloat(orderCost) || 0))}/order</p>
              </div>
              <span className="font-mono text-sm text-text">{fmt(fromUSD(eoqResult.annual_ordering_cost))}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <div>
                <p className="font-body text-sm text-text">Holding Cost</p>
                <p className="font-body text-xs text-muted">{eoqResult.avg_inventory} units × {fmt(fromUSD(eoqResult.holding_cost_per_unit))}/unit/yr</p>
              </div>
              <span className="font-mono text-sm text-text">{fmt(fromUSD(eoqResult.annual_holding_cost))}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <div>
                <p className="font-body text-sm text-text">Annual Stockout Cost</p>
                <p className="font-body text-xs text-muted">{eoqResult.safety_stock} units × {fmt(fromUSD(parseFloat(sellingPrice) || 0))} × {eoqResult.stockout_risk_pct}%</p>
              </div>
              <span className="font-mono text-sm text-rose-400">{fmt(fromUSD(eoqResult.annual_stockout_cost))}</span>
            </div>
            <div className="flex justify-between pt-1">
              <p className="font-body text-sm font-semibold text-text">Total Annual Cost</p>
              <span className="font-mono text-sm font-bold text-rose-400">{fmt(fromUSD(eoqResult.total_annual_cost))}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-border">
            <Metric label="Total Annual Cost"  value={fmt(fromUSD(eoqResult.total_annual_cost))}  variant="negative" sub="ordering + holding" />
            <Metric label="Working Capital"    value={fmt(fromUSD(eoqResult.working_capital))}    variant="warning"  sub="avg inventory × unit cost" />
            <Metric label="Inventory Turns"    value={`${eoqResult.inventory_turns}×`}            sub="annual demand / avg inv." />
            <Metric label="Days of Inventory"  value={`${eoqResult.days_of_inventory}`}           sub="365 / turns" />
          </div>
        </FullBreakdown>
      </div>

      {/* ── Deeper analyses (collapsed; promoted to the Workspace later) ── */}
      <div className="mt-6 space-y-4">
        {/* Seasonal planning */}
        <ToolSection title="Seasonal planning" subtitle="Plan EOQ, safety stock and reorder points month-by-month for seasonal demand">
          <div className="flex flex-col gap-6">
            <div className="grid md:grid-cols-2 gap-6">
              <CalcCard title="Seasonality Profile">
                <Field label="Preset" hint="Pre-fill 12-month multipliers">
                  <Select value={preset} onChange={v => applyPreset(v as SeasonalityPreset)}>
                    {PRESET_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </Select>
                </Field>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {MONTH_NAMES.map((name, i) => (
                    <Field key={name} label={name}>
                      <Input
                        value={String(multipliers[i])}
                        onChange={v => {
                          const next = [...multipliers]
                          next[i] = parseFloat(v) || 0
                          setMults(next)
                        }}
                        min={0}
                        step={0.1}
                      />
                    </Field>
                  ))}
                </div>
              </CalcCard>

              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                    <p className="font-body text-xs text-muted uppercase tracking-wide mb-1">Peak Month</p>
                    <p className="font-mono text-2xl font-bold text-primary">{seasonalResult.peak_month.month_name}</p>
                    <p className="font-body text-xs text-muted mt-1">{seasonalResult.peak_month.monthly_demand.toLocaleString()} units</p>
                  </div>
                  <div className="bg-rose-400/5 border border-rose-400/20 rounded-xl p-4 text-center">
                    <p className="font-body text-xs text-muted uppercase tracking-wide mb-1">Lowest Month</p>
                    <p className="font-mono text-2xl font-bold text-rose-400">{seasonalResult.lowest_month.month_name}</p>
                    <p className="font-body text-xs text-muted mt-1">{seasonalResult.lowest_month.monthly_demand.toLocaleString()} units</p>
                  </div>
                </div>

                <CalcCard title="Monthly Demand">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={seasonalResult.monthly_plans} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <XAxis dataKey="month_name" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ background: '#0D0F1A', border: '1px solid #1A1D2E', borderRadius: 8, fontSize: 11 }}
                        formatter={(v: number) => [v.toLocaleString(), 'Units']}
                      />
                      <Bar dataKey="monthly_demand" radius={[3, 3, 0, 0]}>
                        {seasonalResult.monthly_plans.map((m, i) => (
                          <Cell key={i} fill={m.month === seasonalResult.peak_month.month ? '#00E87A' : '#1A1D2E'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CalcCard>
              </div>
            </div>

            <CalcCard title="Monthly Inventory Plan">
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-mono">
                  <thead>
                    <tr className="border-b border-border text-muted text-right">
                      <th className="pb-2 font-body font-medium text-left">Month</th>
                      <th className="pb-2 font-body font-medium">Daily Demand</th>
                      <th className="pb-2 font-body font-medium">Monthly Units</th>
                      <th className="pb-2 font-body font-medium">EOQ</th>
                      <th className="pb-2 font-body font-medium">Safety Stock</th>
                      <th className="pb-2 font-body font-medium">Reorder Point</th>
                      <th className="pb-2 font-body font-medium">Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seasonalResult.monthly_plans.map(m => (
                      <tr
                        key={m.month}
                        className={cn(
                          'border-b border-border/50 last:border-0 text-right',
                          m.month === seasonalResult.peak_month.month ? 'bg-primary/5' : '',
                        )}
                      >
                        <td className="py-1.5 font-body text-text text-left">{m.month_name}</td>
                        <td className="py-1.5 text-muted">{m.daily_demand.toFixed(1)}</td>
                        <td className="py-1.5 text-text">{m.monthly_demand.toLocaleString()}</td>
                        <td className="py-1.5 text-primary">{m.eoq.toLocaleString()}</td>
                        <td className="py-1.5 text-amber-400">{m.safety_stock.toLocaleString()}</td>
                        <td className="py-1.5 text-text">{m.reorder_point.toLocaleString()}</td>
                        <td className="py-1.5 text-muted">{m.orders_this_month}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CalcCard>
          </div>
        </ToolSection>

        {/* ABC analysis */}
        <ToolSection title="ABC analysis — multi-SKU portfolio" subtitle="Classify your SKUs by annual value to focus attention on the vital few (the 80/20 of inventory)">
          <div className="flex flex-col gap-6">
            <div className="grid md:grid-cols-3 gap-4">
              {(['A', 'B', 'C'] as const).map(cls => {
                const items = cls === 'A' ? abcResult.a_skus : cls === 'B' ? abcResult.b_skus : abcResult.c_skus
                const totalPct = items.reduce((acc, s) => acc + s.value_pct, 0)
                return (
                  <div key={cls} className={cn('rounded-xl border p-4 text-center', ABC_BG[cls])}>
                    <p className={cn('font-display text-3xl font-bold mb-1', ABC_COLORS[cls])}>Class {cls}</p>
                    <p className="font-mono text-xl text-text">{items.length} SKUs</p>
                    <p className="font-body text-xs text-muted mt-1">{totalPct.toFixed(1)}% of total value</p>
                    <p className="font-body text-xs text-muted mt-0.5">
                      {cls === 'A' ? 'Top 20% of items' : cls === 'B' ? 'Next 30% of items' : 'Bottom 50% of items'}
                    </p>
                  </div>
                )
              })}
            </div>

            <CalcCard title="SKU Portfolio">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted text-left">
                      <th className="pb-2 font-body font-medium">SKU ID</th>
                      <th className="pb-2 font-body font-medium">Unit Cost ({currSymbol})</th>
                      <th className="pb-2 font-body font-medium">Annual Units</th>
                      <th className="pb-2 font-body font-medium text-right">Annual Value</th>
                      <th className="pb-2 font-body font-medium text-right">% of Total</th>
                      <th className="pb-2 font-body font-medium text-right">Class</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {skus.map((sku, i) => {
                      const classified = abcResult.classifications.find(c => c.sku_id === sku.sku_id)
                      return (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="py-1.5 pr-2">
                            <input
                              value={sku.sku_id}
                              onChange={e => updateSku(i, 'sku_id', e.target.value)}
                              className="w-24 bg-bg border border-border rounded px-2 py-0.5 font-mono text-xs text-text"
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              type="number"
                              value={sku.unit_cost}
                              onChange={e => updateSku(i, 'unit_cost', e.target.value)}
                              className="w-20 bg-bg border border-border rounded px-2 py-0.5 font-mono text-xs text-text"
                              min={0}
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              type="number"
                              value={sku.annual_units}
                              onChange={e => updateSku(i, 'annual_units', e.target.value)}
                              className="w-24 bg-bg border border-border rounded px-2 py-0.5 font-mono text-xs text-text"
                              min={0}
                            />
                          </td>
                          <td className="py-1.5 font-mono text-xs text-right text-text">
                            {classified ? fmt(fromUSD(classified.annual_value)) : '—'}
                          </td>
                          <td className="py-1.5 font-mono text-xs text-right text-muted">
                            {classified ? `${classified.value_pct.toFixed(1)}%` : '—'}
                          </td>
                          <td className="py-1.5 text-right">
                            {classified && (
                              <span className={cn('font-mono text-xs font-bold', ABC_COLORS[classified.class])}>
                                {classified.class}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 pl-2">
                            <button
                              onClick={() => removeSku(i)}
                              className="text-muted hover:text-rose-400 transition-colors text-xs font-mono"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <button
                  onClick={addSku}
                  disabled={skus.length >= 20}
                  className="font-mono text-xs text-primary hover:text-primary/80 disabled:text-muted transition-colors"
                >
                  + Add SKU {skus.length >= 20 ? '(max 20)' : ''}
                </button>
                <p className="font-mono text-xs text-muted">
                  Total: {fmt(fromUSD(abcResult.total_annual_value))}
                </p>
              </div>
            </CalcCard>
          </div>
        </ToolSection>
      </div>

      {/* ── Educational content (collapsed, in DOM for AEO) ── */}
      <div className="mt-6">
        <ToolSection title="How EOQ, safety stock and reorder points work" subtitle="The three numbers that keep you in stock without tying up cash">
          <div className="space-y-5 font-body text-sm text-muted leading-relaxed">
            <div>
              <h3 className="font-display text-base font-semibold text-text mb-1.5">Economic Order Quantity (EOQ)</h3>
              <p className="font-mono text-xs text-text bg-bg border border-border rounded-lg px-3 py-2 inline-block">
                EOQ = √(2 × annual demand × order cost ÷ holding cost per unit)
              </p>
              <p className="mt-2">
                The <span className="text-text font-medium">Wilson EOQ formula</span> finds the order size where ordering
                cost and holding cost are balanced — order too little and you pay to place orders constantly; order too much
                and cash sits on the shelf. It&apos;s the cheapest quantity to buy each time.
              </p>
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-text mb-1.5">Safety stock &amp; service level</h3>
              <p>
                <span className="text-text font-medium">Safety stock = z × σ × √(lead time)</span>. The z-score comes from
                your target service level (95% → z ≈ 1.645). Higher service levels mean a bigger buffer and a smaller chance
                of stocking out, but more cash tied up in inventory.
              </p>
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-text mb-1.5">Reorder point</h3>
              <p className="font-mono text-xs text-text bg-bg border border-border rounded-lg px-3 py-2 inline-block">
                Reorder point = (daily demand × lead time) + safety stock
              </p>
              <p className="mt-2">
                When on-hand stock drops to the reorder point, place a new order of one EOQ. It arrives just as your buffer
                is reached — so you keep selling without overstocking.
              </p>
            </div>
          </div>
        </ToolSection>
      </div>

      <ToolFAQ items={INVENTORY_SCHEMA.faqItems} />

      <ToolDisclaimer toolSpecific="The Wilson EOQ formula assumes constant demand and instantaneous replenishment — a simplified model. Real inventory involves variable lead times, demand spikes, supplier minimums, and carrying costs that this calculator cannot fully capture. ABC classification cutoffs (20%/30%/50%) are conventional guidelines, not universal rules." />
    </ToolLayout>
  )
}
