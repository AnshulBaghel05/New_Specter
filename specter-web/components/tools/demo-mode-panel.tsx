'use client'

import { useMemo } from 'react'
import { Lock, ArrowRight, Zap, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { CalcCard, Metric, SignalBadge } from '@/components/tools/tool-layout'
import { calcPricePosition } from '@/lib/tools/price-position'

// ── Demo scenario ──────────────────────────────────────────────────────────
// Manual (3 competitors): avg ≈ $86.66 → gap +3.8% → HOLD
// Full SPECTER (11 competitors): avg ≈ $102 → gap -11.8% → RAISE
// The gap creates urgency: you think you're fine, but you're under-priced.

const DEMO_MY_PRICE = 89.99

const DEMO_MANUAL_COMPETITORS = [
  { name: 'Competitor A', price: 79.99, domain: 'budgetearpods.com' },
  { name: 'Competitor B', price: 94.99, domain: 'audiovalue.co' },
  { name: 'Competitor C', price: 84.99, domain: 'cheapbuds.net' },
]

const DEMO_SPECTER_COMPETITORS = [
  { domain: 'premiumaudio.com',   price: 109.99 },
  { domain: 'topearphones.co',    price: 112.00 },
  { domain: 'elitebuds.com',      price: 97.50  },
  { domain: 'proaudio-store.com', price: 119.00 },
  { domain: 'soundpro.shop',      price: 104.00 },
  { domain: 'audioelite.co',      price: 98.00  },
  { domain: 'premierbuds.com',    price: 107.00 },
  { domain: 'hiresounds.net',     price: 115.00 },
]

const fmtPct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`

export default function DemoModePanel({ className }: { className?: string }) {
  const manualResult = useMemo(() =>
    calcPricePosition({
      my_price: DEMO_MY_PRICE,
      competitors: DEMO_MANUAL_COMPETITORS.map(c => ({ name: c.name, price: c.price })),
    }), [])

  const fullResult = useMemo(() =>
    calcPricePosition({
      my_price: DEMO_MY_PRICE,
      competitors: [
        ...DEMO_MANUAL_COMPETITORS.map(c => ({ name: c.name, price: c.price })),
        ...DEMO_SPECTER_COMPETITORS.map((c, i) => ({ name: `SPECTER-${i + 1}`, price: c.price })),
      ],
    }), [])

  const revenueLiftEst = ((fullResult.suggested_price - DEMO_MY_PRICE) / DEMO_MY_PRICE * 100).toFixed(1)
  const monthlyLiftEst = Math.round((fullResult.suggested_price - DEMO_MY_PRICE) * 120) // ~120 units/mo

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('space-y-5', className)}
    >
      {/* Demo banner */}
      <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
        <Zap size={14} className="text-primary shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[10px] text-primary uppercase tracking-widest mb-0.5">
            Demo — Wireless Earbuds ($89.99)
          </p>
          <p className="font-body text-xs text-muted">
            This is simulated SPECTER live data. Your 3 manual competitors are shown alongside 8 competitors SPECTER found automatically.
          </p>
        </div>
      </div>

      {/* Side-by-side signal comparison */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Manual signal */}
        <div className="rounded-xl border border-border bg-surface/60 p-4">
          <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-3">
            Your manual data (3 competitors)
          </p>
          <div className="text-center py-2">
            <div className="flex justify-center mb-2">
              <SignalBadge signal={manualResult.signal} />
            </div>
            <p className="font-body text-xs text-muted mt-2">{manualResult.signal_reason}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric label="Market Avg" value={`$${manualResult.market_avg.toFixed(2)}`} />
              <Metric label="vs Avg" value={fmtPct(manualResult.gap_pct_vs_avg)}
                variant={manualResult.gap_pct_vs_avg > 5 ? 'negative' : manualResult.gap_pct_vs_avg < -5 ? 'positive' : 'default'}
              />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {DEMO_MANUAL_COMPETITORS.map(c => (
              <div key={c.domain} className="flex items-center justify-between text-xs">
                <span className="font-body text-muted">{c.domain}</span>
                <span className="font-mono text-text">${c.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SPECTER live signal */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 relative">
          <p className="font-mono text-[10px] text-primary uppercase tracking-widest mb-3">
            SPECTER live data ({DEMO_MANUAL_COMPETITORS.length + DEMO_SPECTER_COMPETITORS.length} competitors)
          </p>
          <div className="text-center py-2">
            <div className="flex justify-center mb-2">
              <SignalBadge signal={fullResult.signal} />
            </div>
            <p className="font-body text-xs text-muted mt-2">{fullResult.signal_reason}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric label="Market Avg" value={`$${fullResult.market_avg.toFixed(2)}`} variant="highlight" />
              <Metric
                label="vs Avg"
                value={fmtPct(fullResult.gap_pct_vs_avg)}
                variant={fullResult.gap_pct_vs_avg < -5 ? 'positive' : fullResult.gap_pct_vs_avg > 5 ? 'negative' : 'default'}
              />
            </div>
            {fullResult.signal === 'RAISE' && (
              <div className="mt-3 p-2 rounded-lg bg-emerald-400/10 border border-emerald-400/20">
                <p className="font-body text-xs text-muted mb-0.5">Suggested price</p>
                <p className="font-mono text-xl font-bold text-emerald-400">${fullResult.suggested_price.toFixed(2)}</p>
                <p className="font-body text-xs text-emerald-400">+{revenueLiftEst}% per sale</p>
              </div>
            )}
          </div>

          {/* SPECTER-found competitors — first visible, rest blurred */}
          <div className="mt-3 space-y-1.5">
            {DEMO_MANUAL_COMPETITORS.map(c => (
              <div key={c.domain} className="flex items-center justify-between text-xs opacity-60">
                <span className="font-body text-muted">{c.domain}</span>
                <span className="font-mono text-muted">${c.price.toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t border-border/50 pt-1.5 mt-1">
              <p className="font-mono text-[9px] text-primary uppercase tracking-wider mb-1">
                SPECTER found {DEMO_SPECTER_COMPETITORS.length} more ↓
              </p>
              {DEMO_SPECTER_COMPETITORS.map((c, i) => (
                <div key={c.domain} className="flex items-center justify-between text-xs py-0.5">
                  <span className="font-body text-text/80">{c.domain}</span>
                  {i < 2 ? (
                    <span className="font-mono text-text">${c.price.toFixed(2)}</span>
                  ) : (
                    <span className="font-mono text-muted bg-border/50 rounded px-1.5 select-none">
                      $██.██
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Revenue lift callout */}
      {fullResult.signal === 'RAISE' && (
        <CalcCard>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
              <TrendingUp size={18} className="text-emerald-400" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <p className="font-display text-sm font-semibold text-text mb-1">
                Your manual signal said <span className="text-amber-400">HOLD</span>. Live data says <span className="text-emerald-400">RAISE</span>.
              </p>
              <p className="font-body text-xs text-muted leading-relaxed">
                3 low-priced competitors skewed your manual average. With the full {DEMO_MANUAL_COMPETITORS.length + DEMO_SPECTER_COMPETITORS.length}-competitor market, you&apos;re actually{' '}
                <span className="text-text font-semibold">{Math.abs(fullResult.gap_pct_vs_avg).toFixed(1)}% below market average</span> — and leaving{' '}
                <span className="font-mono text-emerald-400">
                  ~${monthlyLiftEst.toLocaleString()}/month
                </span>{' '}
                of margin on the table.
              </p>
            </div>
          </div>
        </CalcCard>
      )}

      {/* Signal timeline — 30-day trend (blurred) */}
      <div className="relative rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-4 pb-3">
          <Lock size={11} className="text-primary" aria-hidden="true" />
          <span className="font-mono text-[10px] font-bold text-primary uppercase tracking-widest">
            30-DAY PRICE TREND
          </span>
          <span className="ml-auto font-mono text-[10px] text-muted border border-border rounded-full px-2 py-0.5">
            CIPHER+
          </span>
        </div>
        {/* Fake sparkline */}
        <div className="px-5 pb-4 pointer-events-none select-none" aria-hidden="true">
          <div className="flex items-end gap-1 h-12">
            {[40,45,38,52,48,44,55,51,49,58,54,62,59,65,61,67,63,70,68,72,69,74,71,78,75,80,77,83,79,86]
              .map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-primary/20"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <p className="font-body text-xs text-muted mt-2">
            Market avg trended from $86 → $102 over 30 days — 3 competitors exited, 2 premium entrants.
          </p>
        </div>
        {/* Blur overlay */}
        <div className="absolute inset-0 backdrop-blur-[3px] bg-bg/50 flex items-center justify-center">
          <div className="text-center">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary-cta font-semibold text-sm"
            >
              Unlock 30-day trend — CIPHER+
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
            <p className="font-body text-xs text-muted mt-2">See when your market shifted and why</p>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="rounded-xl border border-border bg-surface px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-mono text-[10px] text-primary uppercase tracking-widest mb-1">
            SPECTER RECON · $79/mo
          </p>
          <p className="font-display text-sm font-semibold text-text mb-0.5">
            Get this signal automatically, for every SKU.
          </p>
          <p className="font-body text-xs text-muted">
            No manual entry. First signal in under 12 minutes after install.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end shrink-0">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary-cta font-semibold text-sm whitespace-nowrap"
          >
            Start free trial
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
          <p className="font-body text-xs text-muted">14 days · no credit card</p>
        </div>
      </div>
    </motion.div>
  )
}
