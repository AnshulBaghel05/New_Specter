'use client'

import { useState, useMemo, Suspense } from 'react'
import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  calcFbaFees, type FbaCategory, type FbaInput, REFERRAL_RATES,
} from '@/lib/tools/fba'
import { Field, Input, Select, Metric } from '@/components/tools/tool-layout'

const CATEGORIES: { value: FbaCategory; label: string }[] = [
  { value: 'most_products',        label: 'Most Products (15%)' },
  { value: 'electronics',          label: 'Electronics (8%)' },
  { value: 'clothing_accessories', label: 'Clothing & Accessories (17%)' },
  { value: 'books_media',          label: 'Books / Media (15%)' },
  { value: 'toys_games',           label: 'Toys & Games (15%)' },
  { value: 'home_garden',          label: 'Home & Garden (15%)' },
  { value: 'baby_products',        label: 'Baby Products (8%)' },
  { value: 'beauty',               label: 'Beauty (8%)' },
]

const TIER_LABELS: Record<string, string> = {
  small_standard: 'Small Std', large_standard: 'Large Std',
  large_bulky: 'Large Bulky', extra_large_0_50: 'XL 0–50',
  extra_large_50_70: 'XL 50–70', extra_large_70_150: 'XL 70–150',
  extra_large_150_plus: 'XL 150+',
}

function FbaEmbed() {
  const [selling_price, setSellingPrice] = useState('29.99')
  const [product_cost,  setProductCost]  = useState('8.00')
  const [weight_oz,     setWeightOz]     = useState('12')
  const [length_in,     setLength]       = useState('10')
  const [width_in,      setWidth]        = useState('8')
  const [height_in,     setHeight]       = useState('4')
  const [category, setCategory]          = useState<FbaCategory>('most_products')

  const input: FbaInput = useMemo(() => ({
    selling_price: parseFloat(selling_price) || 0,
    product_cost:  parseFloat(product_cost)  || 0,
    weight_oz:     parseFloat(weight_oz)     || 0,
    length_in:     parseFloat(length_in)     || 0,
    width_in:      parseFloat(width_in)      || 0,
    height_in:     parseFloat(height_in)     || 0,
    category,
    avg_monthly_units_stored: 50,
    is_peak_season: false,
  }), [selling_price, product_cost, weight_oz, length_in, width_in, height_in, category])

  const r = useMemo(() => calcFbaFees(input), [input])

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] text-primary uppercase tracking-widest">Amazon FBA Calculator</p>
          <p className="font-body text-xs text-muted">by SPECTER</p>
        </div>
        <Link href="/tools/amazon-fba-calculator" target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-primary transition-colors">
          Full tool <ExternalLink size={10} aria-hidden="true" />
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Selling Price">
              <Input value={selling_price} onChange={setSellingPrice} prefix="$" step={0.01} min={0} />
            </Field>
            <Field label="Product Cost">
              <Input value={product_cost} onChange={setProductCost} prefix="$" step={0.01} min={0} />
            </Field>
            <Field label="Weight (oz)">
              <Input value={weight_oz} onChange={setWeightOz} suffix="oz" step={0.1} min={0} />
            </Field>
          </div>
          <Field label="Category">
            <Select value={category} onChange={v => setCategory(v as FbaCategory)}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="L (in)"><Input value={length_in} onChange={setLength} step={0.1} min={0} /></Field>
            <Field label="W (in)"><Input value={width_in}  onChange={setWidth}  step={0.1} min={0} /></Field>
            <Field label="H (in)"><Input value={height_in} onChange={setHeight} step={0.1} min={0} /></Field>
          </div>
        </div>

        <div className="space-y-3">
          {/* Net profit */}
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="font-body text-xs text-muted uppercase tracking-widest mb-1">Net Profit / Unit</p>
            <p className={cn('font-display text-3xl font-bold', r.net_profit > 0 ? 'text-primary' : 'text-rose-400')}>
              ${r.net_profit.toFixed(2)}
            </p>
            <div className="flex items-center justify-center gap-3 mt-2">
              <span className="font-mono text-xs text-muted">Margin: <span className={r.margin_pct >= 0 ? 'text-primary' : 'text-rose-400'}>{r.margin_pct}%</span></span>
              <span className="text-border">·</span>
              <span className="font-mono text-xs text-muted">ROI: <span className={r.roi_pct >= 0 ? 'text-primary' : 'text-rose-400'}>{r.roi_pct}%</span></span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Metric label="Total Fees"       value={`$${r.total_fees.toFixed(2)}`}       variant="negative" />
            <Metric label="Fulfillment Fee"  value={`$${r.fulfillment_fee.toFixed(2)}`}  variant="default" />
            <Metric label="Referral Fee"     value={`${(REFERRAL_RATES[category] * 100).toFixed(0)}%`} variant="default" sub={`$${r.referral_fee.toFixed(2)}`} />
            <Metric label="Size Tier"        value={TIER_LABELS[r.size_tier] || r.size_tier} variant="highlight" />
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
            <p className="font-body text-xs text-muted mb-0.5">Break-even price</p>
            <p className="font-mono text-lg font-bold text-primary">${r.break_even_price.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <p className="font-body text-xs text-muted">Powered by SPECTER — free pricing intelligence</p>
        <Link href="/tools/amazon-fba-calculator" target="_blank" rel="noopener" className="font-mono text-xs text-primary hover:underline">
          Full analysis →
        </Link>
      </div>
    </div>
  )
}

export default function FbaEmbedPage() {
  return (
    <Suspense fallback={<div className="p-4 text-muted font-body text-sm">Loading…</div>}>
      <FbaEmbed />
    </Suspense>
  )
}
