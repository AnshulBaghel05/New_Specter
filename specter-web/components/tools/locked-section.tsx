'use client'

import Link from 'next/link'
import { Lock, Zap, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { type GateLevel, getGateCTA, getGateLabel } from '@/lib/feature-gates'

// ── "MARKET INTELLIGENCE" variant ─────────────────────────────────────────

interface MarketIntelligenceProps {
  title?: string
  level: GateLevel
  ctaText?: string
  children: React.ReactNode
  className?: string
}

export function LockedMarketIntelligence({
  title = 'MARKET INTELLIGENCE',
  level,
  ctaText,
  children,
  className,
}: MarketIntelligenceProps) {
  const { text, href } = getGateCTA(level)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'relative rounded-xl border border-primary/20 bg-primary/5 overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <Lock size={12} className="text-primary" aria-hidden="true" />
        <span className="font-mono text-[10px] font-bold text-primary uppercase tracking-widest">
          {title}
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted border border-border rounded-full px-2 py-0.5">
          {getGateLabel(level)}
        </span>
      </div>

      {/* Blurred preview content */}
      <div className="relative px-5 pb-5">
        <div className="pointer-events-none select-none" aria-hidden="true">
          {children}
        </div>
        {/* Blur overlay */}
        <div
          className="absolute inset-0 backdrop-blur-sm bg-bg/40 rounded-b-xl"
          aria-hidden="true"
        />
        {/* CTA on top of blur */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
          <Link
            href={href}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
              'gradient-primary-cta font-semibold text-sm transition-all duration-200',
            )}
          >
            {ctaText ?? text}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ── "AUTOMATE THIS" variant ────────────────────────────────────────────────

interface AutomateThisProps {
  ctaText?: string
  ctaHref?: string
  subtext?: string
  className?: string
}

export function LockedAutomateThis({
  ctaText = 'Start 14-day free trial →',
  ctaHref = '/sign-up',
  subtext = 'SPECTER monitors this for you 24/7. First signal in under 12 minutes.',
  className,
}: AutomateThisProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className={cn(
        'rounded-xl border border-border bg-surface p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4',
        className,
      )}
    >
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
        <Zap size={16} className="text-primary" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">
          AUTOMATE THIS
        </p>
        <p className="font-body text-sm text-muted leading-relaxed">{subtext}</p>
      </div>
      <Link
        href={ctaHref}
        className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary-cta font-semibold text-sm transition-all duration-200 whitespace-nowrap"
      >
        {ctaText}
      </Link>
    </motion.div>
  )
}

// ── Default export: both sections stacked ─────────────────────────────────

interface LockedSectionProps {
  level: GateLevel
  intelligenceTitle?: string
  intelligenceCta?: string
  children: React.ReactNode
  automateCta?: string
  automateHref?: string
  automateSubtext?: string
  className?: string
}

export default function LockedSection({
  level,
  intelligenceTitle,
  intelligenceCta,
  children,
  automateCta,
  automateHref,
  automateSubtext,
  className,
}: LockedSectionProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <LockedMarketIntelligence
        level={level}
        title={intelligenceTitle}
        ctaText={intelligenceCta}
      >
        {children}
      </LockedMarketIntelligence>
      <LockedAutomateThis
        ctaText={automateCta}
        ctaHref={automateHref}
        subtext={automateSubtext}
      />
    </div>
  )
}
