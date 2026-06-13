'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ArrowRight, Mail } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { trackEmailGateShown, trackEmailGateDismissed, trackEmailCaptured, type ToolId } from '@/lib/analytics'

const STORAGE_KEY = 'specter_email_captured'
const DELAY_MS = 3000

interface EmailCaptureGateProps {
  /** The trigger: set to true once the calculation result is ready */
  isResultReady: boolean
  /** Called when user submits email */
  onCapture?: (email: string) => void
  /** Called when user dismisses */
  onDismiss?: () => void
  /** Override the tool name in copy */
  toolName?: string
  /** Tool ID for analytics */
  toolId?: ToolId
  className?: string
}

export default function EmailCaptureGate({
  isResultReady,
  onCapture,
  onDismiss,
  toolName = 'this calculation',
  toolId,
  className,
}: EmailCaptureGateProps) {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Check if already captured in a previous session
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const captured = localStorage.getItem(STORAGE_KEY)
      if (captured) setDismissed(true)
    }
  }, [])

  // Show gate 3 seconds after result is ready
  useEffect(() => {
    if (!isResultReady || dismissed) return

    timerRef.current = setTimeout(() => {
      setVisible(true)
      if (toolId) trackEmailGateShown(toolId)
    }, DELAY_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isResultReady, dismissed, toolId])

  function handleDismiss() {
    setVisible(false)
    setDismissed(true)
    if (toolId) trackEmailGateDismissed(toolId)
    onDismiss?.()
  }

  function validateEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }
    setError('')
    localStorage.setItem(STORAGE_KEY, email)
    setSubmitted(true)
    onCapture?.(email)
    if (toolId) trackEmailCaptured(toolId, 'gate')

    // POST to capture API (fire-and-forget)
    fetch('/api/email-capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, tool: toolId }),
    }).catch(() => { /* ignore network errors — analytics still fired */ })

    setTimeout(() => {
      setVisible(false)
      setDismissed(true)
    }, 2000)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="email-gate"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={cn(
            'fixed bottom-6 right-6 z-50 w-full max-w-sm',
            'bg-surface border border-primary/30 rounded-2xl shadow-2xl shadow-black/60',
            className,
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-gate-title"
        >
          {/* Close */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="absolute top-3 right-3 text-muted hover:text-text transition-colors"
          >
            <X size={14} aria-hidden="true" />
          </button>

          <div className="p-5">
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-2"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                  <Mail size={18} className="text-primary" aria-hidden="true" />
                </div>
                <p className="font-display text-sm font-semibold text-text mb-1">Result saved!</p>
                <p className="font-body text-xs text-muted">
                  We&apos;ll email you a copy. Check Day 3 for a live data comparison.
                </p>
              </motion.div>
            ) : (
              <>
                {/* Badge */}
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold text-primary uppercase tracking-widest mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                  Save your result — free
                </span>

                <p
                  id="email-gate-title"
                  className="font-display text-sm font-semibold text-text mb-1"
                >
                  Want to save {toolName}?
                </p>
                <p className="font-body text-xs text-muted mb-4 leading-relaxed">
                  Drop your email and we&apos;ll save it — plus send you a live competitor
                  comparison in 3 days, free.
                </p>

                <form onSubmit={handleSubmit} noValidate>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (error) setError('')
                      }}
                      placeholder="you@yourstore.com"
                      autoComplete="email"
                      aria-label="Email address"
                      className={cn(
                        'flex-1 min-w-0 bg-bg border rounded-lg px-3 py-2 font-body text-sm text-text',
                        'focus:outline-none focus:ring-1 transition-colors placeholder:text-muted/50',
                        error
                          ? 'border-rose-500/50 focus:border-rose-500/70 focus:ring-rose-500/20'
                          : 'border-border focus:border-primary/50 focus:ring-primary/20',
                      )}
                    />
                    <button
                      type="submit"
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg gradient-primary-cta font-semibold text-sm transition-all duration-200"
                    >
                      Save
                      <ArrowRight size={13} aria-hidden="true" />
                    </button>
                  </div>
                  {error && (
                    <p className="font-body text-xs text-rose-400 mt-1.5" role="alert">
                      {error}
                    </p>
                  )}
                </form>

                {/* Trial path */}
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <p className="font-body text-xs text-muted">Want live monitoring instead?</p>
                  <a
                    href="/sign-up"
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    14-day free trial →
                  </a>
                </div>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="mt-3 w-full text-center font-body text-xs text-muted/60 hover:text-muted transition-colors"
                >
                  No thanks, I&apos;ll recalculate manually
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
