'use client'

import { useState, useMemo, useEffect } from 'react'
import ToolLayout, {
  CalcCard, Field, Input, Select, Metric,
  ResultVerdict, SupportingMetrics, ToolInsightCard, ToolSection, FullBreakdown,
} from '@/components/tools/tool-layout'
import ScenarioPanel from '@/components/tools/scenario-panel'
import ShareResult from '@/components/tools/share-result'
import { buildShareUrl, decodeShareState, type ShippingShareState } from '@/lib/tools/share'
import ExportBar from '@/components/tools/export-bar'
import PrintReport from '@/components/tools/print-report'
import QuickAnswer from '@/components/tools/quick-answer'
import ToolFAQ from '@/components/tools/tool-faq'
import { useCurrency } from '@/hooks/use-currency'
import {
  calcShipping,
  calcShippingInternational,
  calcBulkShipment,
  calcPackagingOptimizer,
  type Zone,
  type CarrierRate,
  type IntlMarket,
  type ProductCategory,
  type BoxSpec,
} from '@/lib/tools/shipping'
import { shippingInsights } from '@/lib/tools/insights'
import { SHIPPING_SCHEMA } from '@/lib/tools/schema'
import ToolDisclaimer from '@/components/tools/tool-disclaimer'
import type { Scenario } from '@/lib/tools/scenarios'
import { cn } from '@/lib/utils'

// ── Constants ──────────────────────────────────────────────────────────────

const ZONE_OPTIONS: { value: Zone; label: string }[] = [
  { value: 2, label: 'Zone 2 — Local (≤150 miles)' },
  { value: 3, label: 'Zone 3 — ≤300 miles' },
  { value: 4, label: 'Zone 4 — ≤600 miles' },
  { value: 5, label: 'Zone 5 — ≤1000 miles' },
  { value: 6, label: 'Zone 6 — ≤1400 miles' },
  { value: 7, label: 'Zone 7 — ≤1800 miles' },
  { value: 8, label: 'Zone 8 — Cross-country (1800+ miles)' },
]

const MARKET_OPTIONS: { value: IntlMarket; label: string }[] = [
  { value: 'uk', label: 'United Kingdom' },
  { value: 'ca', label: 'Canada' },
  { value: 'au', label: 'Australia' },
  { value: 'nz', label: 'New Zealand' },
]

const CATEGORY_OPTIONS: { value: ProductCategory; label: string }[] = [
  { value: 'general',     label: 'General merchandise' },
  { value: 'apparel',     label: 'Apparel / Clothing' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'home',        label: 'Home & Garden' },
  { value: 'beauty',      label: 'Beauty / Personal care' },
]

const CARRIER_COLORS: Record<string, string> = {
  UPS:   'text-amber-400',
  FedEx: 'text-purple-400',
  USPS:  'text-blue-400',
  DHL:   'text-yellow-400',
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ShippingCalculatorPage() {
  const { currency, fmt, fromUSD } = useCurrency()

  // ── Domestic state (the public hero) ──────────────────────────────────
  const [domWeight,  setDomWeight]  = useState('2')
  const [domLength,  setDomLength]  = useState('12')
  const [domWidth,   setDomWidth]   = useState('10')
  const [domHeight,  setDomHeight]  = useState('6')
  const [domZone,    setDomZone]    = useState<Zone>(4)

  const domResult = useMemo(() => calcShipping({
    weight_lb: parseFloat(domWeight)  || 0.1,
    length_in: parseFloat(domLength)  || 1,
    width_in:  parseFloat(domWidth)   || 1,
    height_in: parseFloat(domHeight)  || 1,
    zone: domZone,
  }), [domWeight, domLength, domWidth, domHeight, domZone])

  const insight = useMemo(() => shippingInsights(domResult), [domResult])

  // Rehydrate inputs from a shared ?s= link (client-only, keeps the page static)
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('s')
    if (!s) return
    const st = decodeShareState<ShippingShareState>(s)
    if (!st) return
    if (typeof st.wt === 'number') setDomWeight(String(st.wt))
    if (typeof st.ln === 'number') setDomLength(String(st.ln))
    if (typeof st.wd === 'number') setDomWidth(String(st.wd))
    if (typeof st.ht === 'number') setDomHeight(String(st.ht))
    if (typeof st.zn === 'number') setDomZone(st.zn as Zone)
  }, [])

  const shareUrl = useMemo(
    () => buildShareUrl('/tools/shipping-calculator', {
      wt: parseFloat(domWeight) || 0,
      zm: 'domestic',
      zn: domZone,
      ln: parseFloat(domLength) || 0,
      wd: parseFloat(domWidth) || 0,
      ht: parseFloat(domHeight) || 0,
    } satisfies ShippingShareState),
    [domWeight, domZone, domLength, domWidth, domHeight],
  )
  const shareChallenge = `Cheapest I can ship this is ${fmt(fromUSD(domResult.cheapest.rate))} via ${domResult.cheapest.carrier}. Can you beat my shipping cost?`

  // ── International state ───────────────────────────────────────────────
  const [intlWeight,   setIntlWeight]   = useState('2')
  const [intlLength,   setIntlLength]   = useState('12')
  const [intlWidth,    setIntlWidth]    = useState('10')
  const [intlHeight,   setIntlHeight]   = useState('6')
  const [intlDeclared, setIntlDeclared] = useState('100')
  const [intlDest,     setIntlDest]     = useState<IntlMarket>('uk')
  const [intlCat,      setIntlCat]      = useState<ProductCategory>('general')

  const intlResult = useMemo(() => calcShippingInternational({
    weight_lb:          parseFloat(intlWeight)   || 0.1,
    length_in:          parseFloat(intlLength)   || 1,
    width_in:           parseFloat(intlWidth)    || 1,
    height_in:          parseFloat(intlHeight)   || 1,
    declared_value_usd: parseFloat(intlDeclared) || 0,
    destination:        intlDest,
    product_category:   intlCat,
  }), [intlWeight, intlLength, intlWidth, intlHeight, intlDeclared, intlDest, intlCat])

  // ── Bulk state ────────────────────────────────────────────────────────
  const [bulkWeight,  setBulkWeight]  = useState('2')
  const [bulkLength,  setBulkLength]  = useState('12')
  const [bulkWidth,   setBulkWidth]   = useState('10')
  const [bulkHeight,  setBulkHeight]  = useState('6')
  const [bulkUnits,   setBulkUnits]   = useState('50')
  const [bulkZone,    setBulkZone]    = useState<Zone>(4)

  const bulkResult = useMemo(() => calcBulkShipment({
    weight_lb_per_unit: parseFloat(bulkWeight) || 0.1,
    length_in:          parseFloat(bulkLength) || 1,
    width_in:           parseFloat(bulkWidth)  || 1,
    height_in:          parseFloat(bulkHeight) || 1,
    unit_count:         parseInt(bulkUnits)    || 0,
    zone:               bulkZone,
  }), [bulkWeight, bulkLength, bulkWidth, bulkHeight, bulkUnits, bulkZone])

  // ── Packaging optimizer state ─────────────────────────────────────────
  const [pkgProdLength, setPkgProdLength] = useState('10')
  const [pkgProdWidth,  setPkgProdWidth]  = useState('8')
  const [pkgProdHeight, setPkgProdHeight] = useState('5')
  const [pkgProdWeight, setPkgProdWeight] = useState('2')
  const [pkgZone,       setPkgZone]       = useState<Zone>(4)
  const [customBoxes,   setCustomBoxes]   = useState<BoxSpec[]>([])
  const [newBoxName,    setNewBoxName]    = useState('')
  const [newBoxL,       setNewBoxL]       = useState('')
  const [newBoxW,       setNewBoxW]       = useState('')
  const [newBoxH,       setNewBoxH]       = useState('')

  const pkgResult = useMemo(() => calcPackagingOptimizer({
    product_length_in: parseFloat(pkgProdLength) || 1,
    product_width_in:  parseFloat(pkgProdWidth)  || 1,
    product_height_in: parseFloat(pkgProdHeight) || 1,
    product_weight_lb: parseFloat(pkgProdWeight) || 0.1,
    custom_boxes: customBoxes,
    zone: pkgZone,
  }), [pkgProdLength, pkgProdWidth, pkgProdHeight, pkgProdWeight, customBoxes, pkgZone])

  function addBox() {
    const l = parseFloat(newBoxL), w = parseFloat(newBoxW), h = parseFloat(newBoxH)
    if (!l || !w || !h || customBoxes.length >= 5) return
    const name = newBoxName.trim() || `Box ${customBoxes.length + 1}`
    setCustomBoxes([...customBoxes, { name, length_in: l, width_in: w, height_in: h }])
    setNewBoxName(''); setNewBoxL(''); setNewBoxW(''); setNewBoxH('')
  }

  // ── Local-first save/compare (domestic hero) ──────────────────────────
  const domInputsForScenario: Record<string, string> = {
    weight_lb: domWeight, length_in: domLength, width_in: domWidth,
    height_in: domHeight, zone: String(domZone),
  }
  const domResultsForScenario: Record<string, number> = {
    cheapest_rate: domResult.cheapest.rate,
    billable_weight: domResult.billable_weight_ups_lb,
  }
  function onLoadDomScenario(s: Scenario) {
    const i = s.inputs as Record<string, string>
    if (i.weight_lb)  setDomWeight(i.weight_lb)
    if (i.length_in)  setDomLength(i.length_in)
    if (i.width_in)   setDomWidth(i.width_in)
    if (i.height_in)  setDomHeight(i.height_in)
    if (i.zone)       setDomZone(parseInt(i.zone) as Zone)
  }

  const exportInputs = [
    { label: 'Weight (lbs)',       value: domWeight },
    { label: 'Dimensions (L×W×H)', value: `${domLength}×${domWidth}×${domHeight} in` },
    { label: 'Zone',               value: String(domZone) },
  ]
  const exportResults = [
    { label: 'Cheapest Carrier', value: `${domResult.cheapest.carrier} ${domResult.cheapest.service}` },
    { label: 'Cheapest Rate',    value: fmt(fromUSD(domResult.cheapest.rate)) },
    { label: 'Billable Weight',  value: `${domResult.billable_weight_ups_lb} lbs` },
  ]

  const domDimApplies = domResult.billable_weight_ups_lb > domResult.actual_weight_lb
  const nextCheapest = domResult.rates.find((r) => r.rate > domResult.cheapest.rate)
  const recDiffers =
    domResult.recommended.carrier !== domResult.cheapest.carrier ||
    domResult.recommended.service !== domResult.cheapest.service

  return (
    <ToolLayout
      toolId="shipping"
      toolHref="/tools/shipping-calculator"
      badge="Free Shipping Tool"
      title="Multi-Carrier Shipping Rate Estimator"
      description="Find the cheapest way to ship your package across UPS, FedEx, USPS, and DHL — with international landed cost, bulk freight, and packaging tools when you need to go deeper."
      headerRight={
        <div className="flex items-center gap-3">
          <ScenarioPanel
            toolId="shipping-domestic"
            currentInputs={domInputsForScenario}
            currentResults={domResultsForScenario}
            resultLabels={{ cheapest_rate: 'Cheapest Rate', billable_weight: 'Billable Weight (lb)' }}
            onLoad={onLoadDomScenario}
            currency={currency}
          />
          <ExportBar toolId="shipping" inputs={exportInputs} results={exportResults} currency={currency} />
          <ShareResult
            shareUrl={shareUrl}
            toolName="the Shipping Calculator"
            resultSummary={`${fmt(fromUSD(domResult.cheapest.rate))} via ${domResult.cheapest.carrier} ${domResult.cheapest.service}`}
            challenge={shareChallenge}
          />
        </div>
      }
    >
      <PrintReport
        toolName="Multi-Carrier Shipping Rate Estimator"
        toolId="shipping"
        currency={currency}
        inputs={exportInputs}
        results={exportResults}
      />

      <QuickAnswer text={SHIPPING_SCHEMA.quickAnswer} />

      {/* ── Inputs (compact) ── */}
      <CalcCard title="Your package">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Length (in)"><Input value={domLength} onChange={setDomLength} step={0.1} min={1} /></Field>
            <Field label="Width (in)"><Input value={domWidth}  onChange={setDomWidth}  step={0.1} min={1} /></Field>
            <Field label="Height (in)"><Input value={domHeight} onChange={setDomHeight} step={0.1} min={1} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Weight (lbs)">
              <Input value={domWeight} onChange={setDomWeight} suffix="lbs" step={0.1} min={0.1} />
            </Field>
            <Field label="Zone" hint="Distance from your warehouse">
              <Select value={String(domZone)} onChange={(v) => setDomZone(parseInt(v) as Zone)}>
                {ZONE_OPTIONS.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
              </Select>
            </Field>
          </div>
        </div>
      </CalcCard>

      {/* ── THE ANSWER ── */}
      <div className="mt-6 space-y-6">
        <ResultVerdict
          heroLabel={`Cheapest rate to Zone ${domZone}`}
          hero={fmt(fromUSD(domResult.cheapest.rate))}
          whatThisMeans={`${domResult.cheapest.carrier} ${domResult.cheapest.service} is your lowest rate, arriving in ${domResult.cheapest.est_days}.`}
          doThisNext={
            recDiffers
              ? `Need it faster? ${domResult.recommended.carrier} ${domResult.recommended.service} arrives in ${domResult.recommended.est_days} for ${fmt(fromUSD(domResult.recommended.rate))}.`
              : 'Compare every carrier in the full breakdown below before you buy a label.'
          }
        />

        <SupportingMetrics>
          <Metric
            label="Billable weight"
            value={`${domResult.billable_weight_ups_lb.toFixed(2)} lbs`}
            variant={domDimApplies ? 'warning' : 'positive'}
            sub={domDimApplies ? 'Dim weight charged' : 'Actual weight'}
          />
          <Metric label="Est. delivery" value={domResult.cheapest.est_days} sub={domResult.cheapest.carrier} />
          <Metric
            label="Next cheapest"
            value={nextCheapest ? fmt(fromUSD(nextCheapest.rate)) : '—'}
            sub={nextCheapest ? `${nextCheapest.carrier} ${nextCheapest.service}` : 'Only one rate'}
          />
        </SupportingMetrics>

        <ToolInsightCard insight={insight} />

        {/* ── Full breakdown (collapsed, still in DOM) ── */}
        <FullBreakdown label="See all carrier rates & weight detail">
          <div className="space-y-1 mb-6">
            {domResult.rates.map((rate: CarrierRate, i) => (
              <div
                key={`${rate.carrier}-${rate.service}-${i}`}
                className={cn(
                  'flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg',
                  i === 0 ? 'bg-primary/5 border border-primary/20' : 'hover:bg-surface/60 transition-colors',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('font-mono text-xs font-bold', CARRIER_COLORS[rate.carrier] || 'text-text')}>{rate.carrier}</span>
                    <span className="font-body text-xs text-text truncate">{rate.service}</span>
                    {i === 0 && <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">CHEAPEST</span>}
                  </div>
                  <p className="font-body text-xs text-muted mt-0.5">{rate.est_days}{rate.notes ? ` · ${rate.notes}` : ''}</p>
                </div>
                <span className="font-mono text-sm font-bold text-text shrink-0">{fmt(fromUSD(rate.rate))}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border">
            <Metric label="Actual weight"        value={`${domResult.actual_weight_lb} lbs`} />
            <Metric label="UPS/FedEx dim weight" value={`${domResult.ups_dim_weight_lb.toFixed(2)} lbs`} sub="Volume ÷ 139" variant={domDimApplies ? 'warning' : 'default'} />
            <Metric label="USPS dim weight"      value={domResult.usps_dim_weight_lb > 0 ? `${domResult.usps_dim_weight_lb.toFixed(2)} lbs` : 'N/A'} sub={domResult.usps_dim_weight_lb > 0 ? 'Volume ÷ 166' : '>1 cu ft only'} />
            <Metric label="Billable weight"      value={`${domResult.billable_weight_ups_lb.toFixed(2)} lbs`} variant={domDimApplies ? 'warning' : 'positive'} sub={domDimApplies ? 'Dim weight charged' : 'Actual weight'} />
          </div>
        </FullBreakdown>
      </div>

      {/* ── Deeper analyses (collapsed; promoted to the Workspace later) ── */}
      <div className="mt-6 space-y-4">
        {/* International */}
        <ToolSection title="International shipping & landed cost" subtitle="Duties, VAT/GST and total landed cost for UK, CA, AU, NZ">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-5">
              <CalcCard title="Package details">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <Field label="Length (in)"><Input value={intlLength} onChange={setIntlLength} step={0.1} min={1} /></Field>
                  <Field label="Width (in)"><Input value={intlWidth}  onChange={setIntlWidth}  step={0.1} min={1} /></Field>
                  <Field label="Height (in)"><Input value={intlHeight} onChange={setIntlHeight} step={0.1} min={1} /></Field>
                </div>
                <Field label="Actual weight (lbs)">
                  <Input value={intlWeight} onChange={setIntlWeight} suffix="lbs" step={0.1} min={0.1} />
                </Field>
              </CalcCard>

              <CalcCard title="Shipment details">
                <div className="flex flex-col gap-4">
                  <Field label="Declared value (USD)" hint="Used to calculate duties and VAT">
                    <Input value={intlDeclared} onChange={setIntlDeclared} prefix="$" step={1} min={0} />
                  </Field>
                  <Field label="Destination">
                    <Select value={intlDest} onChange={(v) => setIntlDest(v as IntlMarket)}>
                      {MARKET_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Product category" hint="Determines applicable duty rate">
                    <Select value={intlCat} onChange={(v) => setIntlCat(v as ProductCategory)}>
                      {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </Select>
                  </Field>
                </div>
              </CalcCard>
            </div>

            <div className="flex flex-col gap-5">
              <CalcCard>
                <div className="text-center py-2">
                  <p className="font-body text-xs text-muted uppercase tracking-widest mb-2">Cheapest landed cost</p>
                  <p className="font-display text-4xl font-bold text-primary mb-1">
                    {fmt(fromUSD(intlResult.cheapest.total_landed_cost))}
                  </p>
                  <p className="font-mono text-sm text-muted">{intlResult.cheapest.carrier} · {intlResult.cheapest.service}</p>
                  <p className="font-body text-xs text-muted mt-1">{intlResult.cheapest.transit_days}–{intlResult.cheapest.transit_days + 1} business days</p>
                </div>
              </CalcCard>

              <div className="grid grid-cols-2 gap-4">
                <Metric label="Duty rate"       value={`${intlResult.duty_rate_pct}%`}        sub="On declared value" />
                <Metric label="VAT / GST"       value={`${intlResult.destination_vat_pct}%`}  sub="On value+duty+ship" />
                <Metric label="Billable weight" value={`${intlResult.billable_weight_lb} lbs`} sub="max(actual, dim)" />
                <Metric label="Duty on order"   value={fmt(fromUSD(intlResult.cheapest.estimated_duty))} variant="warning" sub="Cheapest carrier" />
              </div>

              <CalcCard title="All carrier landed costs">
                <div className="space-y-1">
                  {intlResult.rates.map((rate, i) => (
                    <div
                      key={`${rate.carrier}-${rate.service}`}
                      className={cn(
                        'flex items-start justify-between gap-3 py-2.5 px-3 rounded-lg',
                        i === 0 ? 'bg-primary/5 border border-primary/20' : 'hover:bg-surface/60 transition-colors',
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn('font-mono text-xs font-bold', CARRIER_COLORS[rate.carrier] || 'text-text')}>{rate.carrier}</span>
                          <span className="font-body text-xs text-text">{rate.service}</span>
                          {i === 0 && <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">CHEAPEST</span>}
                        </div>
                        <div className="flex gap-3 mt-1 flex-wrap">
                          <span className="font-body text-xs text-muted">Ship: {fmt(fromUSD(rate.base_rate + rate.fuel_surcharge))}</span>
                          {rate.estimated_duty > 0 && <span className="font-body text-xs text-amber-400">Duty: {fmt(fromUSD(rate.estimated_duty))}</span>}
                          <span className="font-body text-xs text-blue-400">VAT: {fmt(fromUSD(rate.estimated_vat))}</span>
                        </div>
                      </div>
                      <span className="font-mono text-sm font-bold text-text shrink-0">{fmt(fromUSD(rate.total_landed_cost))}</span>
                    </div>
                  ))}
                </div>
                <p className="font-body text-xs text-muted mt-3 pt-3 border-t border-border">
                  Landed cost = shipping + duties + VAT/GST. Actual duties may vary by customs classification.
                </p>
              </CalcCard>
            </div>
          </div>
        </ToolSection>

        {/* Bulk shipment */}
        <ToolSection title="Bulk shipment — parcel vs LTL freight" subtitle="Find the per-unit cost and the LTL crossover point for large orders">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-5">
              <CalcCard title="Unit details">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <Field label="Length (in)"><Input value={bulkLength} onChange={setBulkLength} step={0.1} min={1} /></Field>
                  <Field label="Width (in)"><Input value={bulkWidth}  onChange={setBulkWidth}  step={0.1} min={1} /></Field>
                  <Field label="Height (in)"><Input value={bulkHeight} onChange={setBulkHeight} step={0.1} min={1} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Weight / unit (lbs)">
                    <Input value={bulkWeight} onChange={setBulkWeight} suffix="lbs" step={0.1} min={0.1} />
                  </Field>
                  <Field label="Unit count">
                    <Input value={bulkUnits} onChange={setBulkUnits} step={1} min={1} />
                  </Field>
                </div>
              </CalcCard>

              <CalcCard title="Destination zone">
                <Field label="Shipping zone">
                  <Select value={String(bulkZone)} onChange={(v) => setBulkZone(parseInt(v) as Zone)}>
                    {ZONE_OPTIONS.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
                  </Select>
                </Field>
              </CalcCard>

              <div className="grid grid-cols-2 gap-4">
                <Metric label="Total actual weight"   value={`${bulkResult.total_weight_lb} lbs`} />
                <Metric
                  label="Total billable weight"
                  value={`${bulkResult.billable_weight_lb} lbs`}
                  sub="After dim weight"
                  variant={bulkResult.billable_weight_lb > bulkResult.total_weight_lb ? 'warning' : 'default'}
                />
                <Metric
                  label="LTL threshold"
                  value="150 lbs"
                  sub={bulkResult.ltl_rate != null ? 'LTL available' : 'Below threshold'}
                  variant={bulkResult.ltl_rate != null ? 'positive' : 'default'}
                />
                {Number.isFinite(bulkResult.ltl_crossover_units) && (
                  <Metric
                    label="LTL crossover"
                    value={`${bulkResult.ltl_crossover_units} units`}
                    sub="LTL beats parcel above this"
                    variant="highlight"
                  />
                )}
              </div>
            </div>

            <div className="flex flex-col gap-5">
              {bulkResult.ltl_rate != null && (
                <div
                  className={cn(
                    'rounded-xl p-4 flex items-center justify-between gap-3 border',
                    bulkResult.recommended_mode === 'ltl' ? 'bg-primary/5 border-primary/20' : 'bg-surface border-border',
                  )}
                >
                  <div>
                    <p className={cn('font-body text-xs uppercase tracking-wide mb-0.5 font-semibold', bulkResult.recommended_mode === 'ltl' ? 'text-primary' : 'text-muted')}>
                      {bulkResult.recommended_mode === 'ltl' ? 'Recommended — LTL freight' : 'LTL freight'}
                    </p>
                    <p className="font-body text-xs text-muted">Total shipment · {bulkResult.total_weight_lb} lbs actual</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-xl font-bold text-primary">{fmt(fromUSD(bulkResult.ltl_rate))}</p>
                    <p className="font-body text-xs text-muted">{fmt(fromUSD(bulkResult.ltl_cost_per_unit ?? 0))} / unit</p>
                  </div>
                </div>
              )}

              <CalcCard title="Parcel rates — cost per unit">
                {bulkResult.parcel_rates.length === 0 ? (
                  <p className="font-body text-xs text-muted">Enter unit count to see rates.</p>
                ) : (
                  <div className="space-y-1">
                    {bulkResult.parcel_rates.map((r, i) => (
                      <div
                        key={r.carrier}
                        className={cn(
                          'flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg',
                          i === 0 && bulkResult.recommended_mode === 'parcel' ? 'bg-primary/5 border border-primary/20' : 'hover:bg-surface/60 transition-colors',
                        )}
                      >
                        <div>
                          <p className={cn('font-mono text-xs font-bold', CARRIER_COLORS[r.carrier.split(' ')[0]] || 'text-text')}>{r.carrier}</p>
                          <p className="font-body text-xs text-muted">Total: {fmt(fromUSD(r.total_cost))}</p>
                        </div>
                        <p className="font-mono text-sm font-bold text-text">{fmt(fromUSD(r.cost_per_unit))} / unit</p>
                      </div>
                    ))}
                  </div>
                )}
              </CalcCard>

              {!bulkResult.ltl_rate && bulkResult.total_weight_lb > 0 && (
                <div className="p-3 rounded-lg bg-surface border border-border">
                  <p className="font-body text-xs text-muted">
                    LTL freight becomes available at 150+ lbs billable weight. Current: {bulkResult.billable_weight_lb} lbs.
                    {Number.isFinite(bulkResult.ltl_crossover_units) && (
                      <> LTL crossover at <span className="text-text font-semibold">{bulkResult.ltl_crossover_units} units</span>.</>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </ToolSection>

        {/* Packaging optimizer */}
        <ToolSection title="Packaging optimizer" subtitle="Find the ideal box and score your packaging catalog against it">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Product dims + ideal box */}
            <div className="flex flex-col gap-4">
              <p className="font-body text-xs font-semibold text-text/70 uppercase tracking-wide">Product dimensions</p>
              <div className="grid grid-cols-3 gap-2">
                <Field label="L (in)"><Input value={pkgProdLength} onChange={setPkgProdLength} step={0.1} min={0.1} /></Field>
                <Field label="W (in)"><Input value={pkgProdWidth}  onChange={setPkgProdWidth}  step={0.1} min={0.1} /></Field>
                <Field label="H (in)"><Input value={pkgProdHeight} onChange={setPkgProdHeight} step={0.1} min={0.1} /></Field>
              </div>
              <Field label="Product weight (lbs)">
                <Input value={pkgProdWeight} onChange={setPkgProdWeight} suffix="lbs" step={0.1} min={0.1} />
              </Field>
              <Field label="Shipping zone">
                <Select value={String(pkgZone)} onChange={(v) => setPkgZone(parseInt(v) as Zone)}>
                  {ZONE_OPTIONS.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
                </Select>
              </Field>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="font-body text-xs text-primary uppercase tracking-wide mb-2 font-semibold">Ideal box</p>
                <p className="font-mono text-sm text-text font-bold">
                  {pkgResult.ideal_box.length_in}″ × {pkgResult.ideal_box.width_in}″ × {pkgResult.ideal_box.height_in}″
                </p>
                <p className="font-body text-xs text-muted mt-1">Dim weight: {pkgResult.ideal_dim_weight_lb} lbs</p>
                <p className="font-body text-xs text-muted">2″ padding per side</p>
              </div>
            </div>

            {/* Add box */}
            <div className="flex flex-col gap-4">
              <p className="font-body text-xs font-semibold text-text/70 uppercase tracking-wide">
                Add box to catalog <span className="text-muted normal-case font-normal">({customBoxes.length}/5)</span>
              </p>
              <Field label="Box name (optional)">
                <Input value={newBoxName} onChange={setNewBoxName} type="text" placeholder="e.g. Medium Brown Box" />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="L (in)"><Input value={newBoxL} onChange={setNewBoxL} step={0.1} min={1} placeholder="12" /></Field>
                <Field label="W (in)"><Input value={newBoxW} onChange={setNewBoxW} step={0.1} min={1} placeholder="10" /></Field>
                <Field label="H (in)"><Input value={newBoxH} onChange={setNewBoxH} step={0.1} min={1} placeholder="6" /></Field>
              </div>
              <button
                onClick={addBox}
                disabled={customBoxes.length >= 5 || !newBoxL || !newBoxW || !newBoxH}
                className="w-full py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary font-mono text-xs font-semibold hover:bg-primary/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Add box
              </button>
              {customBoxes.length > 0 && (
                <div className="space-y-1">
                  {customBoxes.map((b, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-lg border border-border">
                      <span className="font-body text-xs text-text truncate">{b.name}</span>
                      <span className="font-mono text-xs text-muted shrink-0">{b.length_in}×{b.width_in}×{b.height_in}</span>
                      <button
                        onClick={() => setCustomBoxes(customBoxes.filter((_, j) => j !== i))}
                        className="text-muted hover:text-rose-400 transition-colors font-mono text-xs shrink-0"
                        aria-label={`Remove ${b.name}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Catalog scoring */}
            <div className="flex flex-col gap-3">
              <p className="font-body text-xs font-semibold text-text/70 uppercase tracking-wide">Catalog scoring</p>
              {pkgResult.catalog_matches.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-6 border border-dashed border-border rounded-xl min-h-32">
                  <p className="font-body text-xs text-muted text-center">Add boxes above to score them against your product</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pkgResult.catalog_matches.map((m, i) => (
                    <div
                      key={m.box.name}
                      className={cn('p-3 rounded-xl border transition-colors', i === 0 && m.fits ? 'bg-primary/5 border-primary/20' : 'border-border')}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-xs font-mono font-bold px-1.5 py-0.5 rounded', m.fits ? 'bg-emerald-400/10 text-emerald-400' : 'bg-rose-400/10 text-rose-400')}>
                            {m.fits ? 'FITS' : 'NO FIT'}
                          </span>
                          <span className="font-body text-xs text-text font-medium truncate">{m.box.name}</span>
                        </div>
                        <span className="font-mono text-sm font-bold text-primary shrink-0">{fmt(fromUSD(m.cheapest_rate_usd))}</span>
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        <span className="font-body text-xs text-muted">{m.box.length_in}×{m.box.width_in}×{m.box.height_in}″</span>
                        <span className="font-body text-xs text-muted">Billable: {m.billable_weight_lb} lbs</span>
                        <span className="font-body text-xs text-muted">Void: {m.void_fill_in3} in³</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ToolSection>
      </div>

      {/* ── Educational content (collapsed, in DOM for AEO) ── */}
      <div className="mt-6">
        <ToolSection title="How shipping rates are calculated" subtitle="Dimensional weight, zones and billable weight — in plain English">
          <div className="space-y-5 font-body text-sm text-muted leading-relaxed">
            <div>
              <h3 className="font-display text-base font-semibold text-text mb-1.5">What is billable weight?</h3>
              <p>
                Carriers charge on the <span className="text-text font-medium">greater of</span> your package&apos;s actual
                weight and its <span className="text-text font-medium">dimensional (DIM) weight</span> — a measure of how
                much space it takes up. A big, light box is billed as if it were heavier.
              </p>
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-text mb-1.5">The dimensional weight formula</h3>
              <p className="font-mono text-xs text-text bg-bg border border-border rounded-lg px-3 py-2 inline-block">
                DIM weight (lb) = (Length × Width × Height in inches) ÷ 139
              </p>
              <p className="mt-2">
                UPS and FedEx use a divisor of 139; USPS uses 166 and only applies DIM weight to packages over one cubic foot.
                <span className="text-text"> Worked example:</span> a 12″ × 10″ × 6″ box = 720 in³ ÷ 139 ≈
                <span className="text-text font-medium"> 5.18 lb</span>. If the contents actually weigh 2 lb, you are still
                billed for 5.18 lb — so tighter packaging directly lowers your rate.
              </p>
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-text mb-1.5">What are shipping zones?</h3>
              <p>
                A zone (2–8) is how far the parcel travels from your warehouse. Zone 2 is local; Zone 8 is cross-country.
                The same package costs more to a higher zone, which is why your origin location matters when you compare
                carriers.
              </p>
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-text mb-1.5">What goes into international landed cost?</h3>
              <p>
                Landed cost is the full door-to-door price: <span className="text-text">shipping + import duty + VAT/GST</span>.
                Duty is charged on the declared value; VAT/GST is then charged on the value plus duty plus shipping. For
                cross-border ecommerce this commonly adds 15–40% on top of the product cost.
              </p>
            </div>
          </div>
        </ToolSection>
      </div>

      <ToolFAQ items={SHIPPING_SCHEMA.faqItems} />

      <ToolDisclaimer toolSpecific="Shipping rates shown are approximate 2024 retail/commercial estimates. Negotiated contract rates are typically 40–70% lower. International duties, taxes, and brokerage fees vary by country, product category, and declared value. Always confirm current rates and customs requirements directly with carriers before shipping." />
    </ToolLayout>
  )
}
