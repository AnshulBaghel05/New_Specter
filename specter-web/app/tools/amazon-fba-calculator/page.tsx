'use client'

import { useState, useMemo, useEffect } from 'react'
import ToolLayout, {
  CalcCard, Field, Input, Select, Metric,
  ResultVerdict, SupportingMetrics, ToolInsightCard, ToolSection, FullBreakdown,
} from '@/components/tools/tool-layout'
import ShareResult from '@/components/tools/share-result'
import { buildShareUrl, decodeShareState, type FbaShareState } from '@/lib/tools/share'
import {
  calcFbaFees, FbaCategory, FbaInput, FbaSizeTier, REFERRAL_RATES,
  VAT_RATES, effectivePriceAfterVat, calcBreakevenAcos,
  findCheaperTierDimensions, SIZE_TIERS, calcFulfillmentFee, RATES_YEAR,
} from '@/lib/tools/fba'
import { fbaInsights } from '@/lib/tools/insights'
import { FBA_SCHEMA } from '@/lib/tools/schema'
import { BENCHMARKS } from '@/lib/tools/benchmarks'
import { ToolPieChart, ToolBarChart, CHART_THEME } from '@/components/tools/tool-chart'
import { useCurrency } from '@/hooks/use-currency'
import type { ExportRow } from '@/lib/tools/export'
import ScenarioPanel from '@/components/tools/scenario-panel'
import ExportBar from '@/components/tools/export-bar'
import PrintReport from '@/components/tools/print-report'
import QuickAnswer from '@/components/tools/quick-answer'
import ToolFAQ from '@/components/tools/tool-faq'
import ToolDisclaimer from '@/components/tools/tool-disclaimer'
import type { Scenario } from '@/lib/tools/scenarios'
import { cn } from '@/lib/utils'

const CATEGORIES: { value: FbaCategory; label: string }[] = [
  { value: 'most_products', label: 'Most Products (15%)' },
  { value: 'electronics', label: 'Electronics (8%)' },
  { value: 'clothing_accessories', label: 'Clothing & Accessories (17%)' },
  { value: 'shoes_handbags', label: 'Shoes & Handbags (15%)' },
  { value: 'computers', label: 'Computers (8%)' },
  { value: 'camera_photo', label: 'Camera & Photo (8%)' },
  { value: 'cell_phones', label: 'Cell Phones (8%)' },
  { value: 'books_media', label: 'Books / Media (15%)' },
  { value: 'baby_products', label: 'Baby Products (8%)' },
  { value: 'beauty', label: 'Beauty (8%)' },
  { value: 'health_personal_care', label: 'Health & Personal Care (8%)' },
  { value: 'home_garden', label: 'Home & Garden (15%)' },
  { value: 'sports_outdoors', label: 'Sports & Outdoors (15%)' },
  { value: 'toys_games', label: 'Toys & Games (15%)' },
  { value: 'automotive', label: 'Automotive (12%)' },
  { value: 'furniture', label: 'Furniture (15%)' },
  { value: 'grocery_gourmet', label: 'Grocery & Gourmet (8%)' },
  { value: 'jewelry_watches', label: 'Jewelry & Watches (20%)' },
  { value: 'musical_instruments', label: 'Musical Instruments (15%)' },
  { value: 'office_products', label: 'Office Products (15%)' },
]

const TIER_LABELS: Record<string, string> = {
  small_standard: 'Small Standard',
  large_standard: 'Large Standard',
  large_bulky: 'Large Bulky',
  extra_large_0_50: 'Extra-Large (0–50 lb)',
  extra_large_50_70: 'Extra-Large (50–70 lb)',
  extra_large_70_150: 'Extra-Large (70–150 lb)',
  extra_large_150_plus: 'Extra-Large (150 lb+)',
}

const r2 = (n: number) => Math.round(n * 100) / 100

const TIER_LIMITS: Record<FbaSizeTier, { maxL: string; maxW: string; maxH: string; maxWt: string }> = {
  small_standard:       { maxL: '15 in', maxW: '12 in', maxH: '0.75 in', maxWt: '1 lb'   },
  large_standard:       { maxL: '18 in', maxW: '14 in', maxH: '8 in',    maxWt: '20 lb'  },
  large_bulky:          { maxL: '59 in', maxW: '33 in', maxH: '33 in',   maxWt: '50 lb'  },
  extra_large_0_50:     { maxL: '—',     maxW: '—',     maxH: '—',       maxWt: '50 lb'  },
  extra_large_50_70:    { maxL: '—',     maxW: '—',     maxH: '—',       maxWt: '70 lb'  },
  extra_large_70_150:   { maxL: '—',     maxW: '—',     maxH: '—',       maxWt: '150 lb' },
  extra_large_150_plus: { maxL: '—',     maxW: '—',     maxH: '—',       maxWt: '—'      },
}

const r1 = (n: number) => Math.round(n * 10) / 10

const TIER_LABELS_SHORT: Record<FbaSizeTier, string> = {
  small_standard:       'Small Std',
  large_standard:       'Large Std',
  large_bulky:          'Bulky',
  extra_large_0_50:     'XL 0–50',
  extra_large_50_70:    'XL 50–70',
  extra_large_70_150:   'XL 70–150',
  extra_large_150_plus: 'XL 150+',
}

const resultLabels: Record<string, string> = {
  net_profit: 'Net Profit',
  margin_pct: 'Margin %',
  roi_pct: 'ROI %',
  total_fees: 'Total Fees',
  fulfillment_fee: 'Fulfillment Fee',
  referral_fee: 'Referral Fee',
  monthly_storage_fee: 'Storage Fee',
  break_even_price: 'Break-even Price',
}

export default function FbaCalculatorPage() {
  const [selling_price, setSellingPrice] = useState('29.99')
  const [product_cost, setProductCost] = useState('8.00')
  const [weight_oz, setWeightOz] = useState('12')
  const [length_in, setLength] = useState('10')
  const [width_in, setWidth] = useState('8')
  const [height_in, setHeight] = useState('4')
  const [category, setCategory] = useState<FbaCategory>('most_products')
  const [units_stored, setUnitsStored] = useState('100')
  const [is_peak, setIsPeak] = useState(false)
  const [vatCode, setVatCode] = useState('NONE')

  const { currency, toUSD, fromUSD, fmt, currencies } = useCurrency()

  const currencySymbol = currencies.find((c) => c.code === currency)?.symbol ?? '$'

  const vatRate = VAT_RATES.find((v) => v.code === vatCode)?.rate ?? 0

  const input_usd: FbaInput = useMemo(
    () => ({
      selling_price: effectivePriceAfterVat(toUSD(parseFloat(selling_price) || 0), vatRate),
      product_cost:  toUSD(parseFloat(product_cost)  || 0),
      weight_oz:     parseFloat(weight_oz)  || 0,
      length_in:     parseFloat(length_in)  || 0,
      width_in:      parseFloat(width_in)   || 0,
      height_in:     parseFloat(height_in)  || 0,
      category,
      avg_monthly_units_stored: parseFloat(units_stored) || 0,
      is_peak_season: is_peak,
    }),
    [selling_price, product_cost, weight_oz, length_in, width_in, height_in,
     category, units_stored, is_peak, toUSD, vatRate],
  )

  const r = useMemo(() => calcFbaFees(input_usd), [input_usd])

  const insight = useMemo(() => fbaInsights(r), [r])

  // Rehydrate inputs from a shared ?s= link so recipients see the exact result.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('s')
    if (!raw) return
    const s = decodeShareState<FbaShareState>(raw)
    if (!s) return
    if (s.sp != null) setSellingPrice(String(s.sp))
    if (s.pc != null) setProductCost(String(s.pc))
    if (s.wo != null) setWeightOz(String(s.wo))
    if (s.li != null) setLength(String(s.li))
    if (s.wi != null) setWidth(String(s.wi))
    if (s.hi != null) setHeight(String(s.hi))
    if (s.ca) setCategory(s.ca as FbaCategory)
  }, [])

  const shareUrl = buildShareUrl('/tools/amazon-fba-calculator', {
    sp: parseFloat(selling_price) || 0,
    pc: parseFloat(product_cost) || 0,
    wo: parseFloat(weight_oz) || 0,
    li: parseFloat(length_in) || 0,
    wi: parseFloat(width_in) || 0,
    hi: parseFloat(height_in) || 0,
    ca: category,
  } satisfies FbaShareState)
  const shareChallenge = `I net ${fmt(fromUSD(r.net_profit))}/unit on Amazon FBA (${r.margin_pct}% margin). Beat it?`

  const breakeven_acos = calcBreakevenAcos(r.net_profit, input_usd.selling_price)

  const suggestion = useMemo(
    () => findCheaperTierDimensions(
      input_usd.weight_oz,
      input_usd.length_in,
      input_usd.width_in,
      input_usd.height_in,
      r.fulfillment_fee,
      category,
      input_usd.selling_price,
    ),
    [input_usd, r.fulfillment_fee],
  )

  const exportInputs: ExportRow[] = useMemo(() => [
    { label: 'Selling Price', value: fmt(fromUSD(parseFloat(selling_price) || 0)) },
    { label: 'Product Cost',  value: fmt(fromUSD(parseFloat(product_cost)  || 0)) },
    { label: 'Weight',        value: `${weight_oz} oz` },
    { label: 'Dimensions',    value: `${length_in} × ${width_in} × ${height_in} in` },
    { label: 'Category',      value: category },
    { label: 'Units Stored',  value: units_stored },
    { label: 'Peak Season',   value: is_peak ? 'Yes' : 'No' },
    { label: 'VAT',           value: vatCode === 'NONE' ? 'None' : `${vatCode} ${(vatRate * 100).toFixed(0)}%` },
  ], [fmt, fromUSD, selling_price, product_cost, weight_oz, length_in, width_in, height_in, category, units_stored, is_peak, vatCode, vatRate])

  const exportResults: ExportRow[] = useMemo(() => [
    { label: 'Net Profit',       value: fmt(fromUSD(r.net_profit)) },
    { label: 'Margin',           value: `${r.margin_pct}%` },
    { label: 'ROI',              value: `${r.roi_pct}%` },
    { label: 'Break-even ACOS', value: r.net_profit <= 0 ? 'N/A' : `${breakeven_acos}%` },
    { label: 'Total Fees',       value: fmt(fromUSD(r.total_fees)) },
    { label: 'Fulfillment Fee',  value: fmt(fromUSD(r.fulfillment_fee)) },
    { label: 'Referral Fee',     value: fmt(fromUSD(r.referral_fee)) },
    { label: 'Storage Fee',      value: fmt(fromUSD(r.monthly_storage_fee)) },
    { label: 'Break-even Price', value: fmt(fromUSD(r.break_even_price)) },
    { label: 'Size Tier',        value: TIER_LABELS[r.size_tier] },
  ], [fmt, fromUSD, r])

  const currentInputs: Record<string, string | boolean> = useMemo(() => ({
    selling_price, product_cost, weight_oz, length_in, width_in,
    height_in, category, units_stored, is_peak: String(is_peak), vat_code: vatCode,
  }), [selling_price, product_cost, weight_oz, length_in, width_in, height_in, category, units_stored, is_peak, vatCode])

  const currentResults: Record<string, number> = useMemo(() => ({
    net_profit: r.net_profit,
    margin_pct: r.margin_pct,
    roi_pct: r.roi_pct,
    total_fees: r.total_fees,
    fulfillment_fee: r.fulfillment_fee,
    referral_fee: r.referral_fee,
    monthly_storage_fee: r.monthly_storage_fee,
    break_even_price: r.break_even_price,
  }), [r])

  function handleLoadScenario(scenario: Scenario) {
    setSellingPrice(String(scenario.inputs.selling_price))
    setProductCost(String(scenario.inputs.product_cost))
    setWeightOz(String(scenario.inputs.weight_oz))
    setLength(String(scenario.inputs.length_in))
    setWidth(String(scenario.inputs.width_in))
    setHeight(String(scenario.inputs.height_in))
    setCategory(scenario.inputs.category          as FbaCategory)
    setUnitsStored(String(scenario.inputs.units_stored))
    setIsPeak(scenario.inputs.is_peak === 'true')
    if (scenario.inputs.vat_code) setVatCode(String(scenario.inputs.vat_code))
  }

  const hasInteracted = parseFloat(selling_price) > 0

  // Chart 1 — cost distribution pie
  const pieData = useMemo(() => [
    { name: 'Product Cost',    value: fromUSD(input_usd.product_cost) },
    { name: 'Fulfillment Fee', value: fromUSD(r.fulfillment_fee)      },
    { name: 'Referral Fee',    value: fromUSD(r.referral_fee)         },
    { name: 'Storage Fee',     value: fromUSD(r.monthly_storage_fee)  },
    ...(r.net_profit > 0 ? [{ name: 'Net Profit', value: fromUSD(r.net_profit) }] : []),
  ], [fromUSD, input_usd, r])

  // Chart 2 — tier fee comparison bar chart
  const tierData = useMemo(() =>
    SIZE_TIERS.map((tier) => ({
      tier:  TIER_LABELS_SHORT[tier],
      fee:   r2(calcFulfillmentFee(tier, r.billable_weight_oz)),
      color: tier === r.size_tier ? CHART_THEME.primary : CHART_THEME.blue,
    })),
    [r.billable_weight_oz, r.size_tier],
  )

  // Insights
  const marginHealth =
    r.margin_pct >= BENCHMARKS.fba_margins.healthy * 100 ? 'Healthy'
    : r.margin_pct >= BENCHMARKS.fba_margins.tight * 100  ? 'Tight'
    : 'Danger'

  const feeBurdenPct = input_usd.selling_price > 0
    ? r1((r.total_fees / input_usd.selling_price) * 100)
    : 0

  const storageVsProfit = r.net_profit > 0
    ? r1((r.monthly_storage_fee / r.net_profit) * 100)
    : null

  const tierCallout = suggestion ? (() => {
    const longestDim = Math.max(input_usd.length_in, input_usd.width_in, input_usd.height_in)
    const distance = Math.round((longestDim - suggestion.threshold_in) * 10) / 10
    if (distance / suggestion.threshold_in >= 0.15) return null
    return (
      <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-3">
        <p className="font-body text-sm font-semibold text-amber-400">
          Within {distance} in of a cheaper tier
        </p>
        <p className="font-body text-xs text-muted mt-0.5">
          Saves {fmt(fromUSD(suggestion.fee_saving))}/unit — see optimizer below
        </p>
      </div>
    )
  })() : null

  return (
    <ToolLayout
      toolId="fba"
      toolHref="/tools/amazon-fba-calculator"
      badge="Free FBA Tool"
      title="Amazon FBA Fee & Profit Calculator"
      description="Calculate your exact Amazon FBA fulfillment fees, referral fees, and storage costs — then see true net profit per unit with 2025 official rates."
      headerRight={
        <>
          <ScenarioPanel
            toolId="fba"
            currentInputs={currentInputs}
            currentResults={currentResults}
            currency={currency}
            resultLabels={resultLabels}
            onLoad={handleLoadScenario}
          />
          {hasInteracted && (
            <ExportBar
              toolId="fba"
              inputs={exportInputs}
              results={exportResults}
              currency={currency}
            />
          )}
          <ShareResult
            shareUrl={shareUrl}
            toolName="the Amazon FBA Calculator"
            resultSummary={`Net profit ${fmt(fromUSD(r.net_profit))}/unit · ${r.margin_pct}% margin`}
            challenge={shareChallenge}
          />
        </>
      }
    >
      <PrintReport
        toolName="Amazon FBA Calculator"
        toolId="fba"
        currency={currency}
        inputs={exportInputs}
        results={exportResults}
      />

      <QuickAnswer text={FBA_SCHEMA.quickAnswer} />

      {/* ── Inputs (compact) ── */}
      <div className="grid md:grid-cols-3 gap-5 items-start">
        <CalcCard title="Product & Pricing">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Selling Price">
                <Input value={selling_price} onChange={setSellingPrice} prefix={currencySymbol} step={0.01} min={0} />
              </Field>
              <Field label="Product Cost (COGS)">
                <Input value={product_cost} onChange={setProductCost} prefix={currencySymbol} step={0.01} min={0} />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Marketplace VAT">
                <Select value={vatCode} onChange={setVatCode}>
                  {VAT_RATES.map((v) => (
                    <option key={v.code} value={v.code}>
                      {v.country}{v.rate > 0 ? ` (${(v.rate * 100).toFixed(0)}%)` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </CalcCard>

          <CalcCard title="Package Dimensions">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Field label="Length (in)">
                <Input value={length_in} onChange={setLength} step={0.1} min={0} />
              </Field>
              <Field label="Width (in)">
                <Input value={width_in} onChange={setWidth} step={0.1} min={0} />
              </Field>
              <Field label="Height (in)">
                <Input value={height_in} onChange={setHeight} step={0.1} min={0} />
              </Field>
            </div>
            <Field label="Unit Weight (oz)">
              <Input value={weight_oz} onChange={setWeightOz} suffix="oz" step={0.1} min={0} />
            </Field>
          </CalcCard>

          <CalcCard title="Category & Storage">
            <div className="flex flex-col gap-4">
              <Field label="Product Category">
                <Select value={category} onChange={(v) => setCategory(v as FbaCategory)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Avg Units Stored / Month"
                hint="Used to calculate your share of monthly storage costs"
              >
                <Input value={units_stored} onChange={setUnitsStored} min={0} />
              </Field>
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-bg border border-border">
                <div>
                  <p className="font-body text-sm text-text">Peak season storage</p>
                  <p className="font-body text-xs text-muted">
                    Oct–Dec: {fmt(fromUSD(2.40))}/cu ft (vs {fmt(fromUSD(0.78))})
                  </p>
                </div>
                <button
                  onClick={() => setIsPeak(!is_peak)}
                  className={cn(
                    'w-10 h-6 rounded-full transition-colors relative flex items-center',
                    is_peak ? 'bg-primary' : 'bg-border',
                  )}
                  role="switch"
                  aria-checked={is_peak}
                >
                  <span
                    className={cn(
                      'w-4 h-4 rounded-full bg-white shadow transition-transform absolute',
                      is_peak ? 'translate-x-5' : 'translate-x-0.5',
                    )}
                  />
                </button>
              </div>
            </div>
          </CalcCard>
      </div>

      {/* ── THE ANSWER ── */}
      <div className="mt-6 space-y-6">
        <ResultVerdict
          heroLabel="Net profit per unit"
          hero={fmt(fromUSD(r.net_profit))}
          variant={r.net_profit > 0 ? 'positive' : r.net_profit < 0 ? 'negative' : 'default'}
          whatThisMeans={
            r.net_profit > 0
              ? `After Amazon's ${fmt(fromUSD(r.total_fees))} in fees and your product cost, you keep ${fmt(fromUSD(r.net_profit))} per unit — a ${r.margin_pct}% margin and ${r.roi_pct}% ROI.`
              : `Amazon's ${fmt(fromUSD(r.total_fees))} in fees plus your product cost exceed your price, so you lose ${fmt(fromUSD(Math.abs(r.net_profit)))} on every unit sold.`
          }
          doThisNext={
            r.net_profit > 0
              ? `Your break-even ACOS is ${breakeven_acos}% — you can spend up to that share of revenue on ads per unit and still profit.`
              : `Raise your price above the ${fmt(fromUSD(r.break_even_price))} break-even, or use the package optimizer below to drop to a cheaper size tier.`
          }
        />

        <SupportingMetrics>
          <Metric label="Margin" value={`${r.margin_pct}%`} variant={r.margin_pct >= 0 ? 'positive' : 'negative'} sub="net profit / price" />
          <Metric label="ROI" value={`${r.roi_pct}%`} variant={r.roi_pct >= 0 ? 'positive' : 'negative'} sub="net profit / product cost" />
          <Metric label="Break-even price" value={fmt(fromUSD(r.break_even_price))} sub="covers cost + all fees" />
        </SupportingMetrics>

        <ToolInsightCard insight={insight} />

        {/* ── Full breakdown (collapsed, still in DOM) ── */}
        <FullBreakdown label="See the full fee & package breakdown">
          {vatCode !== 'NONE' && (
            <p className="font-body text-xs text-muted mb-4">
              VAT-adjusted: effective revenue {fmt(fromUSD(input_usd.selling_price))} of{' '}
              {fmt(fromUSD(toUSD(parseFloat(selling_price) || 0)))}
            </p>
          )}

          {/* Fee breakdown */}
          <div className="space-y-3">
              {[
                { label: 'Fulfillment Fee', value: r.fulfillment_fee, note: TIER_LABELS[r.size_tier] },
                { label: 'Referral Fee', value: r.referral_fee, note: `${(REFERRAL_RATES[category] * 100).toFixed(0)}% of sale price` },
                { label: 'Monthly Storage (per unit)', value: r.monthly_storage_fee, note: `${r.cubic_feet} cu ft × ${is_peak ? fmt(fromUSD(2.40)) : fmt(fromUSD(0.78))}` },
              ].map(({ label, value, note }) => (
                <div key={label} className="flex items-start justify-between gap-2 py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="font-body text-sm text-text">{label}</p>
                    <p className="font-body text-xs text-muted">{note}</p>
                  </div>
                  <span className="font-mono text-sm text-rose-400 shrink-0">{fmt(fromUSD(value))}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
                <p className="font-body text-sm font-semibold text-text">Total Amazon Fees</p>
                <span className="font-mono text-sm font-bold text-rose-400">{fmt(fromUSD(r.total_fees))}</span>
              </div>
            </div>

          {/* Weight / tier info */}
          <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-border">
              <Metric
                label="Actual Weight"
                value={`${input_usd.weight_oz} oz`}
              />
              <Metric
                label="Dim Weight"
                value={`${r.dim_weight_oz} oz`}
                sub="(L×W×H) ÷ 139 × 16"
              />
              <Metric
                label="Billable Weight"
                value={`${r.billable_weight_oz} oz`}
                variant={r.billable_weight_oz > input_usd.weight_oz ? 'warning' : 'default'}
                sub={r.billable_weight_oz > input_usd.weight_oz ? 'Dim weight applies' : 'Actual weight'}
              />
              <Metric
                label="Size Tier"
                value={TIER_LABELS[r.size_tier]}
                variant="highlight"
              />
          </div>

          {tierCallout && <div className="mt-4">{tierCallout}</div>}

          {/* Break-even */}
          <div className="bg-surface/60 border border-primary/20 rounded-xl p-4 mt-4">
            <p className="font-body text-xs text-muted uppercase tracking-wide mb-1">Break-Even Selling Price</p>
            <p className="font-mono text-2xl font-bold text-primary">{fmt(fromUSD(r.break_even_price))}</p>
            <p className="font-body text-xs text-muted mt-1">
              Minimum price to cover product cost + all Amazon fees
            </p>
          </div>
        </FullBreakdown>
      </div>

      {/* ── Deeper analyses (collapsed; promoted to the Workspace later) ── */}
      <div className="mt-6 space-y-4">
        <ToolSection title="Package optimizer" subtitle="Drop to a cheaper Amazon size tier — see the fee at every tier for your billable weight">
          {suggestion && (
            <div className="mb-5 bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="font-body text-sm font-semibold text-text">{suggestion.description}</p>
                <p className="font-body text-xs text-muted mt-0.5">
                  Drops to {TIER_LABELS[suggestion.target_tier]} — saves{' '}
                  {fmt(fromUSD(suggestion.fee_saving))}/unit in fulfillment fees
                </p>
              </div>
              <button
                onClick={() => {
                  setLength(String(suggestion.suggested_length_in))
                  setWidth(String(suggestion.suggested_width_in))
                  setHeight(String(suggestion.suggested_height_in))
                }}
                className="shrink-0 px-4 py-2 rounded-lg bg-primary text-bg font-mono text-xs font-bold hover:bg-primary/90 transition-colors"
              >
                Apply suggestion
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="font-body text-xs text-muted uppercase tracking-wide pb-2 pr-3">Tier</th>
                  <th className="font-body text-xs text-muted uppercase tracking-wide pb-2 pr-3">Max L</th>
                  <th className="font-body text-xs text-muted uppercase tracking-wide pb-2 pr-3">Max W</th>
                  <th className="font-body text-xs text-muted uppercase tracking-wide pb-2 pr-3">Max H</th>
                  <th className="font-body text-xs text-muted uppercase tracking-wide pb-2 pr-3">Max Wt</th>
                  <th className="font-body text-xs text-muted uppercase tracking-wide pb-2 text-right">
                    Fee at current weight
                  </th>
                </tr>
              </thead>
              <tbody>
                {SIZE_TIERS.map((tier) => {
                  const lim = TIER_LIMITS[tier]
                  const tierFee = r2(calcFulfillmentFee(tier, r.billable_weight_oz))
                  const isCurrent = tier === r.size_tier
                  return (
                    <tr
                      key={tier}
                      className={cn(
                        'border-b border-border/50 last:border-0',
                        isCurrent && 'bg-primary/5 border-l-2 border-l-primary',
                      )}
                    >
                      <td className={cn('py-2 pr-3 font-body text-xs', isCurrent ? 'text-primary font-semibold' : 'text-text')}>
                        {TIER_LABELS[tier]}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs text-muted">{lim.maxL}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-muted">{lim.maxW}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-muted">{lim.maxH}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-muted">{lim.maxWt}</td>
                      <td className={cn('py-2 font-mono text-xs text-right', isCurrent ? 'text-primary font-semibold' : 'text-muted')}>
                        {fmt(fromUSD(tierFee))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="font-body text-xs text-muted mt-3">
            Fee at current weight compares what each tier would charge for your product&apos;s billable weight.
          </p>
        </ToolSection>

        {input_usd.selling_price > 0 && (
          <ToolSection title="Cost & fee analysis" subtitle="Where each dollar goes and how fees compare across size tiers">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Pie: cost distribution */}
              <div>
                <p className="font-body text-xs text-muted uppercase tracking-wide mb-3">
                  Cost Distribution
                </p>
                <ToolPieChart
                  data={pieData}
                  height={220}
                  formatter={(v) => fmt(v)}
                />
              </div>

              {/* Bar: fee by tier */}
              <div>
                <p className="font-body text-xs text-muted uppercase tracking-wide mb-3">
                  Fee by Tier at Current Weight
                </p>
                <ToolBarChart
                  data={tierData}
                  xKey="tier"
                  bars={[{ key: 'fee', label: 'Fulfillment Fee', cellColorKey: 'color' }]}
                  height={220}
                  yFormatter={(v) => fmt(fromUSD(v))}
                />
              </div>
            </div>

            {/* Insights strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
              {/* Margin Health */}
              <div className={cn(
                'rounded-xl p-3 border',
                marginHealth === 'Healthy' ? 'bg-primary/5 border-primary/20'
                : marginHealth === 'Tight' ? 'bg-amber-400/5 border-amber-400/20'
                : 'bg-rose-400/5 border-rose-400/20',
              )}>
                <p className="font-body text-xs text-muted uppercase tracking-wide mb-1">Margin Health</p>
                <p className={cn(
                  'font-mono text-lg font-bold',
                  marginHealth === 'Healthy' ? 'text-primary'
                  : marginHealth === 'Tight' ? 'text-amber-400'
                  : 'text-rose-400',
                )}>
                  {marginHealth}
                </p>
                <p className="font-body text-xs text-muted mt-0.5">{r.margin_pct}% margin</p>
              </div>

              {/* Fee Burden */}
              <div className={cn(
                'rounded-xl p-3 border',
                feeBurdenPct > 40
                  ? 'bg-rose-400/5 border-rose-400/20'
                  : 'bg-surface border-border',
              )}>
                <p className="font-body text-xs text-muted uppercase tracking-wide mb-1">Fee Burden</p>
                <p className={cn(
                  'font-mono text-lg font-bold',
                  feeBurdenPct > 40 ? 'text-rose-400' : 'text-primary',
                )}>
                  {feeBurdenPct}%
                </p>
                <p className="font-body text-xs text-muted mt-0.5">
                  {feeBurdenPct > 40
                    ? `Fees consume ${feeBurdenPct}% of sale price`
                    : 'of sale price in fees'}
                </p>
              </div>

              {/* Storage Efficiency */}
              <div className={cn(
                'rounded-xl p-3 border',
                storageVsProfit !== null && storageVsProfit > 15
                  ? 'bg-amber-400/5 border-amber-400/20'
                  : 'bg-surface border-border',
              )}>
                <p className="font-body text-xs text-muted uppercase tracking-wide mb-1">Storage Efficiency</p>
                {storageVsProfit !== null ? (
                  <>
                    <p className={cn(
                      'font-mono text-lg font-bold',
                      storageVsProfit > 15 ? 'text-amber-400' : 'text-primary',
                    )}>
                      {storageVsProfit}%
                    </p>
                    <p className="font-body text-xs text-muted mt-0.5">
                      {storageVsProfit > 15
                        ? 'Storage eating into profit — reduce inventory'
                        : 'of net profit is storage'}
                    </p>
                  </>
                ) : (
                  <p className="font-mono text-lg font-bold text-muted">—</p>
                )}
              </div>
            </div>
          </ToolSection>
        )}
      </div>

      {/* ── Education (collapsed, in DOM for AEO) ── */}
      <div className="mt-6">
        <ToolSection title="How Amazon FBA fees work" subtitle="Fulfillment fees, referral fees, dimensional weight and break-even in plain English">
          <div className="space-y-5 font-body text-sm text-muted leading-relaxed">
            <div>
              <h3 className="font-display text-base font-semibold text-text mb-1.5">The three fees Amazon charges</h3>
              <p>
                Every FBA sale is hit by three costs: a <span className="text-text font-medium">fulfillment fee</span>{' '}
                (a flat per-unit pick-pack-ship charge set by your size tier and billable weight), a{' '}
                <span className="text-text font-medium">referral fee</span> (8–20% of the sale price, by category), and a{' '}
                <span className="text-text font-medium">monthly storage fee</span> (your cubic feet × the per-cu-ft rate).
                Net profit = price − product cost − all three fees.
              </p>
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-text mb-1.5">Dimensional weight &amp; size tiers</h3>
              <p>
                Amazon bills the greater of your actual weight and{' '}
                <span className="text-text font-medium">dimensional weight = (L × W × H) ÷ 139</span> (pounds, for inches).
                A light but bulky box gets billed as if it were heavier. Trimming one dimension to drop a size tier can save
                $2–4 per unit — the package optimizer above flags when you&apos;re close.
              </p>
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-text mb-1.5">Break-even price</h3>
              <p className="font-mono text-xs text-text bg-bg border border-border rounded-lg px-3 py-2 inline-block">
                Break-even = product cost + fulfillment + referral + storage
              </p>
              <p className="mt-2">
                Any selling price below your break-even loses money on every unit. Healthy FBA economics usually target a
                20–30% net margin above break-even to absorb returns, ads and price competition.
              </p>
            </div>
          </div>
        </ToolSection>
      </div>

      <ToolFAQ items={FBA_SCHEMA.faqItems} />

      <ToolDisclaimer toolSpecific={`Rates are based on the Amazon FBA ${RATES_YEAR} fee schedule (effective Feb 5, 2025; non-apparel, standard-size). Actual fees vary by category, account type, product condition, and promotions. Always verify current rates at sellercentral.amazon.com.`} />
    </ToolLayout>
  )
}
