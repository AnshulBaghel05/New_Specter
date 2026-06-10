'use client'

import { useState, useEffect, forwardRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useScrollReveal } from '@/hooks/use-scroll-reveal'
import { TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react'

type SignalType = 'RAISE' | 'LOWER' | 'HOLD'

interface Signal {
  id: number
  type: SignalType
  sku: string
  delta: string
  store: string
  ts: string
  detail: string
}

const MOCK_SIGNALS: Signal[] = [
  { id: 1, type: 'RAISE', sku: 'Nike Air Max 270 – Size 10', delta: '+$12', store: 'footlocker.com', ts: '2m ago', detail: 'Competitor price $122 · Your price $110 · 3 in-stock competitors' },
  { id: 2, type: 'LOWER', sku: 'Adidas Ultraboost 22 – Black', delta: '-$12', store: 'adidas.com', ts: '5m ago', detail: 'Median competitor $168 · Your price $180 · 5 competitors tracked' },
  { id: 3, type: 'HOLD',  sku: 'New Balance 574 – White/Grey', delta: '±$0', store: 'newbalance.com', ts: '8m ago', detail: 'Within ±2% of median · $99 across 4 competitors' },
  { id: 4, type: 'RAISE', sku: 'Puma RS-X3 – Red/White', delta: '+$18', store: 'puma.com', ts: '11m ago', detail: 'Competitor OOS · demand surge detected' },
  { id: 5, type: 'LOWER', sku: 'Reebok Classic – Size 11', delta: '-$15', store: 'reebok.com', ts: '14m ago', detail: 'Flash sale detected · -20% on competitor' },
]

const SIGNAL_CONFIG: Record<SignalType, {
  icon: React.ElementType
  color: string
  bg: string
  border: string
  leftBorder: string
}> = {
  RAISE: { icon: TrendingUp,   color: 'text-emerald-400', bg: 'bg-emerald-400/8',  border: 'border-emerald-400/25', leftBorder: 'signal-raise' },
  LOWER: { icon: TrendingDown, color: 'text-rose-400',    bg: 'bg-rose-400/8',     border: 'border-rose-400/25',    leftBorder: 'signal-lower' },
  HOLD:  { icon: Minus,        color: 'text-amber-400',   bg: 'bg-amber-400/8',    border: 'border-amber-400/25',   leftBorder: 'signal-hold'  },
}

const SignalRow = forwardRef<HTMLDivElement, { signal: Signal }>(function SignalRow({ signal }, ref) {
  const [expanded, setExpanded] = useState(false)
  const cfg = SIGNAL_CONFIG[signal.type]
  const Icon = cfg.icon

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: -18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,   scale: 1    }}
      exit={{ opacity: 0, x: 14, scale: 0.96 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className={`${cfg.leftBorder} ${cfg.bg} border ${cfg.border} rounded-xl mb-2 overflow-hidden cursor-pointer group`}
      onClick={() => setExpanded(v => !v)}
      role="button"
      aria-expanded={expanded}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(v => !v) }}
    >
      <div className="flex items-center gap-4 p-4">
        <div className="flex items-center gap-1.5 min-w-[76px]">
          <Icon size={14} className={cfg.color} aria-hidden="true" />
          <span className={`font-mono text-xs font-bold ${cfg.color}`}>{signal.type}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-body text-sm text-text truncate">{signal.sku}</p>
          <p className="font-mono text-xs text-muted">{signal.store}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`font-mono font-bold ${cfg.color}`} style={{ fontSize: '0.9rem' }}>{signal.delta}</p>
          <div className="flex items-center gap-1 justify-end">
            <Clock size={10} className="text-muted" aria-hidden="true" />
            <span className="font-mono text-xs text-muted">{signal.ts}</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="px-4 pb-3"
          >
            <p className="font-body text-xs text-muted border-t border-current/10 pt-2">{signal.detail}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})

export default function ProductDemo() {
  const [visibleIds, setVisibleIds] = useState([1, 2, 3])
  const headingRef = useScrollReveal<HTMLDivElement>({ y: 20 })
  const ref = useScrollReveal<HTMLDivElement>({ y: 24 })

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleIds((prev) => {
        const next = (prev[prev.length - 1] % MOCK_SIGNALS.length) + 1
        return [...prev.slice(-2), next]
      })
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const displayed = MOCK_SIGNALS.filter((s) => visibleIds.includes(s.id))

  return (
    <section id="product" className="py-24 bg-surface/30">
      <div className="max-w-7xl mx-auto px-6">
        <div ref={headingRef} className="text-center mb-16">
          <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">
            Live Signals
          </p>
          <h2
            className="font-display font-bold text-text mb-4"
            style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', letterSpacing: '-0.025em' }}
          >
            Your pricing co-pilot,{' '}
            <span className="text-primary">always on.</span>
          </h2>
          <p className="font-body text-muted max-w-xl mx-auto">
            Every price change and stock event triggers an AI signal within minutes.
            Click any signal to see the data behind it.
          </p>
        </div>

        <div ref={ref} className="max-w-2xl mx-auto">
          <div className="bg-surface border border-border rounded-2xl overflow-hidden ticker-glow">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                <span className="font-mono text-xs text-muted">Live signal feed</span>
              </div>
              <span className="font-mono text-xs text-muted">{MOCK_SIGNALS.length} signals today</span>
            </div>

            <div className="p-4">
              <AnimatePresence mode="popLayout">
                {displayed.map((signal) => (
                  <SignalRow key={signal.id} signal={signal} />
                ))}
              </AnimatePresence>
            </div>

            <div className="px-5 pb-4 text-center">
              <p className="font-body text-xs text-muted">
                Updates every 4s · Click any row for details
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
