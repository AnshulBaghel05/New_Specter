'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { Plus, X, ExternalLink } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { calcPricePosition, type Competitor } from '@/lib/tools/price-position'
import { decodeShareState, type PricePositionShareState } from '@/lib/tools/share'
import { Field, Input, Metric, SignalBadge } from '@/components/tools/tool-layout'

const fmtPct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
const fmt    = (n: number) => `$${n.toFixed(2)}`

function PricePositionEmbed() {
  const searchParams = useSearchParams()

  const [my_price, setMyPrice]   = useState('89.99')
  const [competitors, setComps]  = useState<{ name: string; price: string }[]>([
    { name: 'Competitor A', price: '79.99' },
    { name: 'Competitor B', price: '94.99' },
    { name: 'Competitor C', price: '84.99' },
  ])

  // Load pre-filled state from ?s= param
  useEffect(() => {
    const s = searchParams.get('s')
    if (!s) return
    const state = decodeShareState<PricePositionShareState>(s)
    if (!state) return
    if (typeof state.p === 'number') setMyPrice(String(state.p))
    if (Array.isArray(state.c)) {
      setComps(state.c.map(c => ({ name: c.n, price: String(c.p) })))
    }
  }, [searchParams])

  const parsedCompetitors: Competitor[] = competitors
    .map(c => ({ name: c.name, price: parseFloat(c.price) || 0 }))
    .filter(c => c.price > 0)

  const r = useMemo(
    () => calcPricePosition({ my_price: parseFloat(my_price) || 0, competitors: parsedCompetitors }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [my_price, JSON.stringify(parsedCompetitors)],
  )

  const barMax = r.market_high || 1

  function addComp() {
    if (competitors.length >= 3) return
    setComps(p => [...p, { name: `Competitor ${p.length + 1}`, price: '' }])
  }

  return (
    <div className="p-4 space-y-4">
      {/* Compact header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] text-primary uppercase tracking-widest">Price Position Analyzer</p>
          <p className="font-body text-xs text-muted">by SPECTER</p>
        </div>
        <Link
          href="/tools/price-position-analyzer"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-primary transition-colors"
        >
          Full tool
          <ExternalLink size={10} aria-hidden="true" />
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Inputs */}
        <div className="space-y-3">
          <Field label="My Price">
            <Input value={my_price} onChange={setMyPrice} prefix="$" step={0.01} min={0} />
          </Field>

          <div>
            <label className="block font-body text-xs font-medium text-text/70 mb-1.5 uppercase tracking-wide">
              Competitors ({competitors.length}/3)
            </label>
            <div className="space-y-2">
              {competitors.map((c, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  <input
                    value={c.name}
                    onChange={e => setComps(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    className="flex-1 min-w-0 bg-bg border border-border rounded-lg px-2.5 py-2 font-body text-xs text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/50"
                    placeholder={`Competitor ${i + 1}`}
                  />
                  <div className="relative w-24 shrink-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-muted pointer-events-none">$</span>
                    <input
                      type="number"
                      value={c.price}
                      onChange={e => setComps(p => p.map((x, j) => j === i ? { ...x, price: e.target.value } : x))}
                      placeholder="0.00"
                      step={0.01}
                      min={0}
                      className="w-full bg-bg border border-border rounded-lg pl-6 pr-2.5 py-2 font-mono text-xs text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  <button onClick={() => setComps(p => p.filter((_, j) => j !== i))} className="text-muted hover:text-rose-400 transition-colors shrink-0" aria-label="Remove">
                    <X size={13} />
                  </button>
                </div>
              ))}
              {competitors.length < 3 && (
                <button onClick={addComp} className="text-xs font-mono text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                  <Plus size={11} aria-hidden="true" /> Add competitor
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-3">
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="font-body text-xs text-muted uppercase tracking-widest mb-2">Signal</p>
            <div className="flex justify-center mb-2">
              <SignalBadge signal={r.signal} />
            </div>
            <p className="font-body text-xs text-muted">{r.signal_reason}</p>
            {r.signal !== 'HOLD' && (
              <p className="font-mono text-lg font-bold text-primary mt-2">{fmt(r.suggested_price)}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Metric label="Market Low"  value={fmt(r.market_low)}  variant="positive" />
            <Metric label="Market High" value={fmt(r.market_high)} variant="negative" />
            <Metric label="Market Avg"  value={fmt(r.market_avg)}  variant="highlight" />
            <Metric label="vs Avg"      value={fmtPct(r.gap_pct_vs_avg)} variant={r.gap_pct_vs_avg < -5 ? 'positive' : r.gap_pct_vs_avg > 5 ? 'negative' : 'default'} />
          </div>

          {r.market_high > 0 && (
            <div className="bg-surface border border-border rounded-xl p-3">
              <div className="relative h-1.5 bg-border rounded-full">
                <div className="absolute h-full bg-primary/20 rounded-full" style={{ left: `${(r.market_low / barMax) * 100}%`, width: `${((r.market_high - r.market_low) / barMax) * 100}%` }} />
                <div className="absolute w-0.5 h-3 bg-primary/50 -top-0.5" style={{ left: `${(r.market_avg / barMax) * 100}%` }} />
                <div
                  className={cn('absolute w-2.5 h-2.5 rounded-full border-2 -top-0.5 -translate-x-1/2', r.signal === 'RAISE' ? 'bg-emerald-400 border-emerald-400' : r.signal === 'LOWER' ? 'bg-rose-400 border-rose-400' : 'bg-primary border-primary')}
                  style={{ left: `${Math.min(96, Math.max(4, ((parseFloat(my_price) || 0) / barMax) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="font-mono text-[10px] text-muted">{fmt(r.market_low)}</span>
                <span className="font-mono text-[10px] text-muted/60">↑ you</span>
                <span className="font-mono text-[10px] text-muted">{fmt(r.market_high)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Powered-by footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <p className="font-body text-xs text-muted">Powered by SPECTER — free pricing intelligence</p>
        <Link
          href="/sign-up"
          target="_blank"
          rel="noopener"
          className="font-mono text-xs text-primary hover:underline"
        >
          Monitor automatically →
        </Link>
      </div>
    </div>
  )
}

export default function PricePositionEmbedPage() {
  return (
    <Suspense fallback={<div className="p-4 text-muted font-body text-sm">Loading…</div>}>
      <PricePositionEmbed />
    </Suspense>
  )
}
