'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart3,
  Zap,
  Radar,
  Sparkles,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

const ease = [0.22, 1, 0.36, 1] as const

type Feature = {
  icon: LucideIcon
  title: string
  body: string
}

// The rotating intel reel on the brand panel — mirrors the product's pillars.
const FEATURES: Feature[] = [
  {
    icon: BarChart3,
    title: 'Deep Analytics',
    body: 'Uncover competitor strategies in real-time.',
  },
  {
    icon: Zap,
    title: 'Automated Actions',
    body: 'Trigger pricing adjustments autonomously.',
  },
  {
    icon: Sparkles,
    title: 'AI Signals',
    body: 'RAISE · LOWER · HOLD, computed continuously.',
  },
  {
    icon: Radar,
    title: 'Live Recon',
    body: 'Track every competitor price the moment it moves.',
  },
]

const ROTATE_MS = 4200

function BrandPanel() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = setInterval(
      () => setActive((i) => (i + 1) % FEATURES.length),
      ROTATE_MS,
    )
    return () => clearInterval(id)
  }, [])

  const feature = FEATURES[active]
  const Icon = feature.icon

  return (
    <div className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 xl:p-16">
      {/* Layered atmosphere: deep navy base + teal glow bleeding from the floor */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(155deg, #06070D 0%, #0B0E1C 45%, #07141A 100%)',
        }}
      />
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 90% 60% at 15% 110%, rgba(0,232,122,0.16) 0%, transparent 60%)',
        }}
      />
      {/* Faint engineering grid for texture */}
      <div
        className="absolute inset-0 opacity-[0.4]"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage:
            'radial-gradient(ellipse 80% 80% at 50% 40%, black 30%, transparent 80%)',
        }}
      />

      {/* Top: wordmark + tagline chip */}
      <div className="relative z-10 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3 group">
          <span className="font-display text-2xl font-bold text-text tracking-tight">
            SPECTER<span className="text-primary">.</span>
          </span>
        </Link>
        <span className="font-mono text-[10px] tracking-[0.18em] text-primary/80 border border-primary/20 bg-primary/5 rounded-full px-2.5 py-1 uppercase">
          AI-Powered Intelligence
        </span>
      </div>

      {/* Middle: rotating intel reel */}
      <div className="relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, ease }}
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 shadow-[0_0_24px_rgba(0,232,122,0.18)]">
              <Icon size={22} className="text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-display text-2xl font-semibold text-text mb-2 tracking-tight">
              {feature.title}
            </h2>
            <p className="font-body text-[15px] text-muted max-w-xs leading-relaxed">
              {feature.body}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Progress dots */}
        <div className="flex items-center gap-2 mt-8" role="tablist" aria-label="Product highlights">
          {FEATURES.map((f, i) => (
            <button
              key={f.title}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={f.title}
              onClick={() => setActive(i)}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === active
                  ? 'w-7 bg-primary'
                  : 'w-1.5 bg-text/20 hover:bg-text/40'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Bottom: stealth badge + the hook */}
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-5">
          <ShieldCheck size={14} className="text-primary/70" aria-hidden="true" />
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase">
            Stealth Protocol Active
          </span>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
        </div>
        <p className="font-display text-3xl xl:text-[2.1rem] font-bold text-text leading-[1.1] tracking-tight">
          Win the Market
          <br />
          <span className="italic text-primary font-medium">While They Sleep.</span>
        </p>
      </div>
    </div>
  )
}

/**
 * Split-screen auth shell. Left = animated brand panel (lg+ only); right = the
 * form `children`, rendered on the dark surface so it matches Dark Intelligence.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-bg lg:grid lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      <div className="relative flex flex-col items-center justify-center px-6 py-12 sm:px-10">
        {/* Ambient glow behind the form */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 30%, rgba(0,232,122,0.05) 0%, transparent 70%)',
          }}
        />

        {/* Back to home */}
        <Link
          href="/"
          className="absolute top-6 left-6 flex items-center gap-1.5 text-muted hover:text-text transition-colors text-sm font-body"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to home
        </Link>

        {/* Mobile-only wordmark (brand panel is hidden < lg) */}
        <Link href="/" className="lg:hidden mb-8">
          <span className="font-display text-2xl font-bold text-text tracking-tight">
            SPECTER<span className="text-primary">.</span>
          </span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
          className="relative w-full max-w-[400px]"
        >
          {children}
        </motion.div>
      </div>
    </main>
  )
}
