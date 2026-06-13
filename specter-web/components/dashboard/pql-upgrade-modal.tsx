'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight, Check } from 'lucide-react'
import { shouldShowPqlModal, markPqlModalSeen } from '@/lib/tools/pql'
import { trackLockedValueCardViewed, trackLockedValueCardCTA } from '@/lib/analytics'
import { useStartTrial } from '@/lib/api'
import { toast, formatApiError } from '@/lib/toast'

const SURFACE = 'pql_modal'

/**
 * One-time contextual upgrade modal for a product-qualified lead (free user who
 * has crossed the save threshold). Names the exact next outcome — connect your
 * store, start a 14-day RECON trial. Result-first / no dark pattern: it only
 * appears after the user has already gotten value (N saved reports), shows once,
 * and is always dismissible.
 */
export default function PqlUpgradeModal({
  savedCount,
  threshold,
  active,
}: {
  savedCount: number
  threshold: number
  /** Gate so it only fires for free users (caller passes merchant.plan === 'free'). */
  active: boolean
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const startTrial = useStartTrial()

  async function activateTrial() {
    trackLockedValueCardCTA(SURFACE, 'recon')
    try {
      await startTrial.mutateAsync()
      toast.success('Your 14-day RECON trial is active.')
      close()
      router.push('/dashboard')
    } catch (err) {
      toast.error(formatApiError(err))
    }
  }

  useEffect(() => {
    if (!active) return
    if (shouldShowPqlModal(savedCount, threshold)) {
      // Mark seen immediately so a re-render / refetch can't re-trigger it.
      markPqlModalSeen()
      setOpen(true)
      trackLockedValueCardViewed(SURFACE, 'recon')
    }
  }, [active, savedCount, threshold])

  function close() {
    setOpen(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pql-modal-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-md rounded-2xl border border-primary/20 bg-surface shadow-2xl shadow-black/50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-4 top-4 text-muted hover:text-text transition-colors"
            >
              <X size={16} aria-hidden="true" />
            </button>

            <div className="p-6">
              <span className="inline-flex items-center font-mono text-[10px] uppercase tracking-wide text-primary border border-primary/30 rounded-full px-2 py-0.5 mb-3">
                You&apos;re ready for the next step
              </span>
              <h2 id="pql-modal-title" className="font-display text-xl font-bold text-text">
                You&apos;ve analyzed {savedCount} reports — now make the prices live.
              </h2>
              <p className="font-body text-sm text-muted mt-2">
                Every number in your Workspace is built on prices that move daily. Connect your
                store and start a 14-day RECON trial to turn those snapshots into always-on
                signals — no card required.
              </p>

              <ul className="space-y-1.5 mt-4">
                {[
                  'Live competitor prices, refreshed automatically',
                  'RAISE / LOWER / HOLD the moment a rival moves',
                  'Out-of-stock alerts so you can capture the demand',
                ].map((v) => (
                  <li key={v} className="flex items-start gap-2">
                    <Check size={14} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="font-body text-sm text-text">{v}</span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={activateTrial}
                  disabled={startTrial.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-primary-cta btn-ripple font-semibold text-sm transition-all duration-200 disabled:opacity-60"
                >
                  Start a 14-day RECON trial
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="font-body text-sm text-muted hover:text-text transition-colors"
                >
                  Keep exploring free
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
