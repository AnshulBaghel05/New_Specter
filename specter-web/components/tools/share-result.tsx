'use client'

import { useState, useRef, useEffect } from 'react'
import { Share2, Link, Check, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { copyToClipboard } from '@/lib/tools/share'

interface ShareResultProps {
  shareUrl: string
  signal?: 'RAISE' | 'LOWER' | 'HOLD'
  toolName?: string
  resultSummary?: string
  /** Optional "can you beat it?" line — turns the share into a peer challenge
   *  (the virality loop). E.g. "I net $4.20/unit on Amazon FBA. Beat that?" */
  challenge?: string
  className?: string
}

const SIGNAL_EMOJI = { RAISE: '📈', LOWER: '📉', HOLD: '⏸️' }
const SIGNAL_COPY  = {
  RAISE: 'My pricing signal says RAISE — I\'m underpriced vs the market.',
  LOWER: 'My pricing signal says LOWER — I need to get more competitive.',
  HOLD:  'My pricing signal says HOLD — I\'m right in the market sweet spot.',
}

export default function ShareResult({
  shareUrl,
  signal,
  toolName = 'this calculation',
  resultSummary,
  challenge,
  className,
}: ShareResultProps) {
  const [open, setOpen]           = useState(false)
  const [copied, setCopied]       = useState(false)
  const containerRef              = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  async function handleCopy() {
    const ok = await copyToClipboard(shareUrl)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const tweetText = encodeURIComponent(
    [
      signal ? `${SIGNAL_EMOJI[signal]} ${SIGNAL_COPY[signal]}` : `I just used ${toolName}.`,
      resultSummary ? `\n${resultSummary}` : '',
      `\n\nFree tool by @specterapp_io:`,
      shareUrl,
    ].join(''),
  )
  const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}`

  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`

  const challengeTweetUrl = challenge
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        `${challenge}\n\nCheck yours free (no sign-up) 👇\n${shareUrl}`,
      )}`
    : null

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Share this result"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-semibold',
          'border border-border text-muted hover:text-text hover:border-primary/40 hover:bg-primary/5',
          'transition-all duration-200',
          open && 'border-primary/40 bg-primary/5 text-primary',
        )}
      >
        <Share2 size={12} aria-hidden="true" />
        Share
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute right-0 top-full mt-2 z-50 w-72',
              'bg-surface border border-border rounded-xl shadow-2xl shadow-black/40',
              'overflow-hidden',
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
              <p className="font-display text-sm font-semibold text-text">Share your result</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-muted hover:text-text transition-colors"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Signal pill */}
              {signal && (
                <div className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono font-semibold',
                  signal === 'RAISE' ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400' :
                  signal === 'LOWER' ? 'bg-rose-400/10 border-rose-400/20 text-rose-400' :
                  'bg-amber-400/10 border-amber-400/20 text-amber-400',
                )}>
                  <span>{SIGNAL_EMOJI[signal]}</span>
                  <span>{SIGNAL_COPY[signal]}</span>
                </div>
              )}

              {/* Copy link */}
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 min-w-0 bg-bg border border-border rounded-lg px-3 py-2 font-mono text-xs text-muted truncate focus:outline-none"
                  onFocus={e => e.target.select()}
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className={cn(
                    'shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs font-semibold transition-all duration-200',
                    copied
                      ? 'bg-emerald-400/10 border border-emerald-400/20 text-emerald-400'
                      : 'gradient-primary-cta',
                  )}
                >
                  {copied ? <Check size={12} aria-hidden="true" /> : <Link size={12} aria-hidden="true" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Social share */}
              <div className="flex gap-2">
                <a
                  href={tweetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-muted hover:text-text hover:border-[#1d9bf0]/40 hover:bg-[#1d9bf0]/5 text-xs font-semibold transition-all duration-200"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  Post on X
                </a>
                <a
                  href={linkedInUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-muted hover:text-text hover:border-blue-500/40 hover:bg-blue-500/5 text-xs font-semibold transition-all duration-200"
                >
                  {/* LinkedIn icon */}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
                    <circle cx="4" cy="4" r="2"/>
                  </svg>
                  LinkedIn
                </a>
              </div>

              {/* Challenge a peer — the virality loop */}
              {challengeTweetUrl && (
                <a
                  href={challengeTweetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 text-xs font-semibold transition-all duration-200"
                >
                  <span aria-hidden="true">🏆</span>
                  Challenge a peer to beat it
                </a>
              )}

              <p className="font-body text-xs text-muted text-center pt-1">
                Link pre-fills all inputs — recipients see your exact result.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
