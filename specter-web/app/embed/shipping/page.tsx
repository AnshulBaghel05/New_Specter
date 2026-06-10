'use client'

import { useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { calcShipping, type Zone } from '@/lib/tools/shipping'
import { Field, Input, Select } from '@/components/tools/tool-layout'
import { decodeShareState, type ShippingShareState } from '@/lib/tools/share'

const ZONES: { value: Zone; label: string }[] = [
  { value: 2, label: 'Zone 2 (local)' },
  { value: 3, label: 'Zone 3' },
  { value: 4, label: 'Zone 4' },
  { value: 5, label: 'Zone 5' },
  { value: 6, label: 'Zone 6' },
  { value: 7, label: 'Zone 7' },
  { value: 8, label: 'Zone 8 (far)' },
]

function ShippingEmbed() {
  const searchParams = useSearchParams()

  const [weight, setWeight]   = useState('2')
  const [zone,   setZone]     = useState<Zone>(4)
  const [length, setLength]   = useState('12')
  const [width,  setWidth]    = useState('10')
  const [height, setHeight]   = useState('6')

  useState(() => {
    const s = searchParams.get('s')
    if (!s) return
    const st = decodeShareState<ShippingShareState>(s)
    if (!st) return
    if (typeof st.wt === 'number') setWeight(String(st.wt))
    if (typeof st.zn === 'number') setZone(st.zn as Zone)
    if (typeof st.ln === 'number') setLength(String(st.ln))
    if (typeof st.wd === 'number') setWidth(String(st.wd))
    if (typeof st.ht === 'number') setHeight(String(st.ht))
  })

  const r = useMemo(() => calcShipping({
    weight_lb: parseFloat(weight) || 0,
    length_in: parseFloat(length) || 0,
    width_in:  parseFloat(width)  || 0,
    height_in: parseFloat(height) || 0,
    zone,
  }), [weight, zone, length, width, height])

  const cheapest = r.cheapest
  const top3 = r.rates.slice(0, 3)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] text-primary uppercase tracking-widest">Shipping Calculator</p>
          <p className="font-body text-xs text-muted">by SPECTER</p>
        </div>
        <Link href="/tools/shipping-calculator" target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-primary transition-colors">
          Full tool <ExternalLink size={10} aria-hidden="true" />
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Weight (lb)">
              <Input value={weight} onChange={setWeight} suffix="lb" step={0.1} min={0} />
            </Field>
            <Field label="Zone">
              <Select value={String(zone)} onChange={v => setZone(Number(v) as Zone)}>
                {ZONES.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="L (in)"><Input value={length} onChange={setLength} step={0.5} min={0} /></Field>
            <Field label="W (in)"><Input value={width}  onChange={setWidth}  step={0.5} min={0} /></Field>
            <Field label="H (in)"><Input value={height} onChange={setHeight} step={0.5} min={0} /></Field>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="font-body text-xs text-muted uppercase tracking-widest mb-1">Cheapest Rate</p>
            <p className="font-display text-3xl font-bold text-primary">
              ${cheapest?.rate.toFixed(2) ?? '—'}
            </p>
            <p className="font-mono text-xs text-muted mt-1">
              {cheapest?.carrier} · {cheapest?.service}
            </p>
          </div>

          <div className="space-y-1.5">
            {top3.map((rate, i) => (
              <div key={i} className={cn('flex items-center justify-between rounded-lg px-3 py-2', i === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-surface border border-border')}>
                <div>
                  <p className="font-body text-xs text-text">{rate.carrier}</p>
                  <p className="font-mono text-[10px] text-muted">{rate.service} · {rate.est_days}</p>
                </div>
                <p className={cn('font-mono text-sm font-bold', i === 0 ? 'text-primary' : 'text-text')}>${rate.rate.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <p className="font-body text-xs text-muted">Powered by SPECTER — free pricing intelligence</p>
        <Link href="/tools/shipping-calculator" target="_blank" rel="noopener" className="font-mono text-xs text-primary hover:underline">
          Full analysis →
        </Link>
      </div>
    </div>
  )
}

export default function ShippingEmbedPage() {
  return (
    <Suspense fallback={<div className="p-4 text-muted font-body text-sm">Loading…</div>}>
      <ShippingEmbed />
    </Suspense>
  )
}
