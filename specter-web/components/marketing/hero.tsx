'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'

// Only the Three.js canvas is disabled for SSR — all text content renders on server
const HeroCanvas = dynamic(() => import('./hero-canvas'), { ssr: false })

const SIGNALS = [
  { type: 'RAISE', icon: TrendingUp,   sku: 'Nike Air Max 270',     delta: '+$12', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
  { type: 'LOWER', icon: TrendingDown, sku: 'Adidas Ultraboost 22', delta: '-$8',  color: 'text-rose-400    bg-rose-400/10    border-rose-400/30'    },
  { type: 'HOLD',  icon: Minus,        sku: 'New Balance 574',       delta: '±$0',  color: 'text-amber-400   bg-amber-400/10   border-amber-400/30'   },
]

const ease = [0.22, 1, 0.36, 1] as const

export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-bg">
      {/* Three.js particle background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <HeroCanvas />
      </div>

      {/* Multi-layer radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(0,232,122,0.07),transparent)] pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_50%_40%,rgba(0,255,148,0.04),transparent)] pointer-events-none" aria-hidden="true" />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center pt-24">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0 }}
          className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 text-primary text-xs font-mono uppercase tracking-widest px-4 py-1.5 rounded-full mb-8 animate-border-glow"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
          Real-time competitor intelligence
        </motion.div>

        {/* H1 */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.1 }}
          className="font-display font-bold text-text mb-6"
          style={{ fontSize: 'clamp(2.6rem, 7vw, 4.5rem)', lineHeight: 1.05, letterSpacing: '-0.03em' }}
        >
          Know before{' '}
          <span className="relative inline-block">
            <span className="text-primary">they move.</span>
            <span className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" aria-hidden="true" />
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.2 }}
          className="font-body text-lg md:text-xl text-muted max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          SPECTER tracks competitor prices and stock in real time, then delivers
          AI-powered{' '}
          <span className="text-text font-semibold">RAISE / LOWER / HOLD</span> signals
          directly to your Shopify or WooCommerce dashboard.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-3 justify-center mb-16"
        >
          <Link
            href="/sign-up"
            className="group gradient-primary-cta btn-ripple inline-flex items-center justify-center gap-2 font-semibold px-8 py-3.5 rounded-lg text-base transition-all duration-300 will-change-transform"
          >
            Start free — 14 days
            <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
          </Link>
          <Link
            href="/#product"
            className="inline-flex items-center justify-center gap-2 border border-border text-muted hover:text-text hover:border-primary/40 hover:bg-primary/5 px-8 py-3.5 rounded-lg transition-all duration-300 text-base"
          >
            See it live →
          </Link>
        </motion.div>

        {/* Live signal ticker */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.42 }}
          className="flex flex-wrap justify-center gap-3"
          aria-label="Live pricing signals"
        >
          {SIGNALS.map((s, i) => {
            const Icon = s.icon
            return (
              <motion.div
                key={s.sku}
                initial={{ opacity: 0, scale: 0.88, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease, delay: 0.5 + i * 0.1 }}
                className={`flex items-center gap-2.5 border rounded-xl px-4 py-2.5 font-mono text-xs backdrop-blur-sm ${s.color} ticker-glow`}
              >
                <Icon size={12} aria-hidden="true" />
                <span className="font-bold text-sm">{s.type}</span>
                <span className="text-text/50" aria-hidden="true">·</span>
                <span className="text-text/80 font-body hidden sm:inline">{s.sku}</span>
                <span className="font-bold text-sm">{s.delta}</span>
              </motion.div>
            )
          })}
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-bg to-transparent pointer-events-none" aria-hidden="true" />
    </section>
  )
}
