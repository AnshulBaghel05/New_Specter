'use client'

import Link from 'next/link'
import { ArrowRight, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { type GateLevel, getGateCTA, getGateLabel } from '@/lib/feature-gates'

interface UpgradePromptProps {
  level: GateLevel
  headline: string
  body: string
  ctaText?: string
  dismissable?: boolean
  onDismiss?: () => void
  variant?: 'inline' | 'banner'
  className?: string
}

export default function UpgradePrompt({
  level,
  headline,
  body,
  ctaText,
  dismissable = true,
  onDismiss,
  variant = 'inline',
  className,
}: UpgradePromptProps) {
  const [dismissed, setDismissed] = useState(false)
  const { text, href } = getGateCTA(level)

  function handleDismiss() {
    setDismissed(true)
    onDismiss?.()
  }

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'relative rounded-xl border bg-surface',
            variant === 'banner'
              ? 'border-primary/30 bg-primary/5 px-5 py-4'
              : 'border-border px-5 py-4',
            className,
          )}
        >
          {/* Tier badge */}
          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-primary uppercase tracking-widest mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
            {getGateLabel(level)}
          </span>

          {dismissable && (
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss"
              className="absolute top-3 right-3 text-muted hover:text-text transition-colors"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}

          <p className="font-display text-sm font-semibold text-text mb-1 pr-5">{headline}</p>
          <p className="font-body text-xs text-muted mb-4 leading-relaxed">{body}</p>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <Link
              href={href}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary-cta font-semibold text-sm transition-all duration-200"
            >
              {ctaText ?? text}
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
            {dismissable && (
              <button
                type="button"
                onClick={handleDismiss}
                className="font-body text-xs text-muted hover:text-text transition-colors"
              >
                No thanks, I&apos;ll do this manually
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
