'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { shouldShowCoachmark, dismissCoachmark, COACHMARK_HERO } from '@/lib/tools/coachmark'

/**
 * First-visit, dismiss-once nudge anchored above the hero answer. Tells a new
 * user "this is the number you came for" — lightweight, never blocks the result,
 * and never reappears once dismissed. Shown globally across all public tools.
 */
export default function HeroCoachmark({ className }: { className?: string }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Defer to client so the static page never renders it server-side.
    if (shouldShowCoachmark(COACHMARK_HERO)) setShow(true)
  }, [])

  function dismiss() {
    dismissCoachmark(COACHMARK_HERO)
    setShow(false)
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'flex items-center gap-2 mx-auto mb-3 w-fit max-w-full',
            'rounded-full border border-primary/30 bg-primary/10 pl-3 pr-2 py-1.5',
            className,
          )}
        >
          <Sparkles size={13} className="text-primary shrink-0" aria-hidden="true" />
          <span className="font-body text-xs text-text">
            This is the number you came for — everything below explains it.
          </span>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss tip"
            className="text-muted hover:text-text transition-colors shrink-0 ml-0.5"
          >
            <X size={13} aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
