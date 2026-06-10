'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Lock, Check, X, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trackLockedValueCardViewed, trackLockedValueCardCTA } from '@/lib/analytics'

const PLAN_LABEL: Record<string, string> = {
  recon: 'RECON',
  cipher: 'CIPHER',
  phantom: 'PHANTOM',
  predator: 'PREDATOR',
  eclipse: 'ECLIPSE',
}

const SUPPRESS_DAYS = 7
const SUPPRESS_MS = SUPPRESS_DAYS * 24 * 60 * 60 * 1000

function dismissKey(surface: string): string {
  return `specter_lvc_dismissed_${surface}`
}

function isSuppressed(surface: string): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    const ts = Number(localStorage.getItem(dismissKey(surface)))
    return Number.isFinite(ts) && ts > 0 && Date.now() - ts < SUPPRESS_MS
  } catch {
    return false
  }
}

/**
 * Honest, non-dark-pattern upgrade surface for a Paid capability. Shows the
 * problem it solves, the value, why you'd want it, and a *real* preview (never
 * blurred fake data). The result/answer is always shown elsewhere first; this
 * is additive and dismissible (suppressed 7 days), per MONETIZATION.md F-GATE.
 */
export default function LockedValueCard({
  surface,
  title,
  requiredPlan,
  problem,
  value,
  why,
  preview,
  ctaHref = '/pricing',
  ctaLabel,
  dismissible = true,
  className,
}: {
  surface: string
  title: string
  requiredPlan: string
  problem: string
  value: string[]
  why: string
  preview?: React.ReactNode
  ctaHref?: string
  ctaLabel?: string
  dismissible?: boolean
  className?: string
}) {
  const [ready, setReady] = useState(false)
  const [hidden, setHidden] = useState(false)

  const label = PLAN_LABEL[requiredPlan] ?? requiredPlan.toUpperCase()

  useEffect(() => {
    if (isSuppressed(surface)) {
      setHidden(true)
    } else {
      trackLockedValueCardViewed(surface, requiredPlan)
    }
    setReady(true)
  }, [surface, requiredPlan])

  if (!ready || hidden) return null

  function dismiss() {
    try {
      localStorage.setItem(dismissKey(surface), String(Date.now()))
    } catch {
      /* ignore */
    }
    setHidden(true)
  }

  return (
    <div className={cn('rounded-2xl border border-primary/20 bg-primary/5 overflow-hidden', className)}>
      <div className="flex items-start gap-3 p-5">
        <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Lock size={16} className="text-primary" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-semibold text-text">{title}</h3>
            <span className="font-mono text-[10px] uppercase tracking-wide text-primary border border-primary/30 rounded-full px-2 py-0.5">
              {label}
            </span>
          </div>
          <p className="font-body text-sm text-muted mt-1">{problem}</p>
        </div>
        {dismissible && (
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="text-muted hover:text-text transition-colors shrink-0"
          >
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Real preview — no blur, no fake data */}
      {preview && <div className="px-5 pb-4">{preview}</div>}

      <div className="px-5 pb-5">
        <ul className="space-y-1.5 mb-4">
          {value.map((v, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check size={14} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
              <span className="font-body text-sm text-text">{v}</span>
            </li>
          ))}
        </ul>
        <p className="font-body text-xs text-muted mb-4">{why}</p>
        <Link
          href={ctaHref}
          onClick={() => trackLockedValueCardCTA(surface, requiredPlan)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-primary-cta btn-ripple font-semibold text-sm transition-all duration-200"
        >
          {ctaLabel ?? `Unlock with ${label}`}
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
