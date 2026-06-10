'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, Loader2, ArrowRight, Lock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface CountResult {
  count: number
  sample_domains: string[]
  response_time_ms: number
  product: string
}

const SCAN_MESSAGES = [
  'Scanning Google Shopping…',
  'Checking Amazon listings…',
  'Crawling marketplace pages…',
  'Comparing price histories…',
  'Ranking by relevance…',
]

export default function LiveCompetitorCount({ className }: { className?: string }) {
  const [product, setProduct]         = useState('')
  const [scanning, setScanning]       = useState(false)
  const [result, setResult]           = useState<CountResult | null>(null)
  const [msgIdx, setMsgIdx]           = useState(0)
  const [error, setError]             = useState('')
  const [progress, setProgress]       = useState(0)
  const intervalRef                   = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef                   = useRef<ReturnType<typeof setInterval> | null>(null)

  function clearTimers() {
    if (intervalRef.current)  clearInterval(intervalRef.current)
    if (progressRef.current)  clearInterval(progressRef.current)
  }

  useEffect(() => () => clearTimers(), [])

  async function handleScan(e: React.FormEvent) {
    e.preventDefault()
    if (!product.trim() || scanning) return

    setResult(null)
    setError('')
    setScanning(true)
    setMsgIdx(0)
    setProgress(0)

    // Cycle scan messages
    let i = 0
    intervalRef.current = setInterval(() => {
      i = (i + 1) % SCAN_MESSAGES.length
      setMsgIdx(i)
    }, 600)

    // Animate progress bar
    progressRef.current = setInterval(() => {
      setProgress(p => Math.min(p + 2, 90))
    }, 50)

    try {
      // Minimum 2.5 s scan for UX drama
      const [res] = await Promise.all([
        fetch(`/api/competitor-count?product=${encodeURIComponent(product.trim())}`),
        new Promise(r => setTimeout(r, 2500)),
      ])

      if (!res.ok) throw new Error('lookup failed')
      const data: CountResult = await res.json()

      clearTimers()
      setProgress(100)
      setTimeout(() => setResult(data), 200)
    } catch {
      clearTimers()
      setError('Could not complete scan. Try again.')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className={cn('rounded-xl border border-border bg-surface p-5', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
        <p className="font-mono text-[10px] text-primary uppercase tracking-widest">
          Live competitor count
        </p>
      </div>

      <p className="font-body text-sm text-text mb-1">
        How many competitors does SPECTER find for your product?
      </p>
      <p className="font-body text-xs text-muted mb-4">
        Enter a product name or URL — we&apos;ll simulate a live scan.
      </p>

      {/* Input */}
      <form onSubmit={handleScan} className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="text"
            value={product}
            onChange={e => setProduct(e.target.value)}
            placeholder="e.g. wireless earbuds, running shoes, or a product URL"
            className={cn(
              'w-full bg-bg border border-border rounded-lg pl-8 pr-3 py-2.5',
              'font-body text-sm text-text placeholder:text-muted/50',
              'focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors',
            )}
            disabled={scanning}
          />
        </div>
        <button
          type="submit"
          disabled={scanning || !product.trim()}
          className={cn(
            'shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg',
            'font-mono text-xs font-semibold transition-all duration-200',
            scanning || !product.trim()
              ? 'bg-border text-muted cursor-not-allowed'
              : 'gradient-primary-cta',
          )}
        >
          {scanning ? (
            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
          ) : (
            <Search size={13} aria-hidden="true" />
          )}
          {scanning ? 'Scanning…' : 'Scan'}
        </button>
      </form>

      {error && (
        <p className="font-body text-xs text-rose-400 mt-2">{error}</p>
      )}

      {/* Progress bar + messages */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 overflow-hidden"
          >
            <div className="h-1 bg-border rounded-full overflow-hidden mb-2">
              <motion.div
                className="h-full bg-primary rounded-full"
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <p className="font-mono text-xs text-muted">{SCAN_MESSAGES[msgIdx]}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-5"
          >
            {/* Count headline */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-mono text-[10px] text-primary uppercase tracking-widest mb-0.5">
                  Scan complete — {result.response_time_ms}ms
                </p>
                <p className="font-display text-2xl font-bold text-text">
                  {result.count} competitors found
                </p>
                <p className="font-body text-xs text-muted mt-0.5">
                  for &ldquo;{result.product}&rdquo;
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-3xl font-bold text-primary">{result.count}</p>
                <p className="font-mono text-[10px] text-muted">vs your 3 manual</p>
              </div>
            </div>

            {/* Gap callout */}
            <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3 mb-4">
              <p className="font-body text-xs text-amber-400 font-semibold mb-0.5">
                You entered 3 competitors manually.
              </p>
              <p className="font-body text-xs text-muted">
                SPECTER found {result.count - 3} more. Their prices are blurred below — but they&apos;re changing your signal.
              </p>
            </div>

            {/* Domain list — first 3 visible, rest blurred */}
            <div className="space-y-1.5 mb-4">
              {result.sample_domains.map((domain, i) => (
                <div
                  key={domain}
                  className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-bg border border-border/50"
                >
                  <span className={cn('font-body text-xs', i < 3 ? 'text-text' : 'text-muted')}>
                    {domain}
                  </span>
                  <div className="flex items-center gap-2">
                    {i < 3 ? (
                      <span className="font-mono text-xs text-muted">price visible in RECON</span>
                    ) : (
                      <>
                        <Lock size={10} className="text-muted/50" aria-hidden="true" />
                        <span className="font-mono text-xs text-muted bg-border rounded px-1.5 py-0.5 select-none">
                          $██.██
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {result.count > result.sample_domains.length && (
                <p className="font-mono text-xs text-muted text-center py-1">
                  +{result.count - result.sample_domains.length} more competitors not shown
                </p>
              )}
            </div>

            {/* CTA */}
            <Link
              href="/sign-up"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg gradient-primary-cta font-semibold text-sm transition-all duration-200"
            >
              See all {result.count} prices — 14-day free trial
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <p className="font-body text-xs text-muted text-center mt-2">
              No credit card · First signal in under 12 minutes
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
