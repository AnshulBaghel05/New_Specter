'use client'

import { useState } from 'react'
import { Code, Check, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { copyToClipboard } from '@/lib/tools/share'

interface EmbedCodeProps {
  toolPath: string        // e.g. "price-position"
  toolName: string
  defaultHeight?: number
  shareState?: string    // optional ?s= param to pre-fill state
  className?: string
}

export default function EmbedCode({
  toolPath,
  toolName,
  defaultHeight = 620,
  shareState,
  className,
}: EmbedCodeProps) {
  const [open, setCopied_open] = useState(false)
  const [copied, setCopied]    = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://specterapp.io'
  const src    = `${origin}/embed/${toolPath}${shareState ? `?s=${shareState}` : ''}`
  const code   = `<iframe\n  src="${src}"\n  width="100%"\n  height="${defaultHeight}"\n  frameborder="0"\n  style="border-radius:12px;border:1px solid #1A1D2E"\n  title="${toolName} — powered by SPECTER"\n  loading="lazy"\n></iframe>`

  async function handleCopy() {
    const ok = await copyToClipboard(code)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <div className={cn('rounded-xl border border-border bg-surface overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setCopied_open(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-surface/80 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Code size={13} className="text-muted" aria-hidden="true" />
          <span className="font-mono text-xs text-muted">Embed this calculator</span>
        </div>
        <span className="font-mono text-[10px] text-primary/70 uppercase tracking-wider">
          {open ? 'Hide' : 'Get code'}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 pb-5 border-t border-border space-y-3 pt-4">
              <p className="font-body text-xs text-muted">
                Copy and paste this code into any webpage to embed the calculator.
                It runs client-side — no API calls, no data sent to SPECTER.
              </p>

              {/* Code block */}
              <div className="relative">
                <pre className="bg-bg border border-border rounded-lg p-3 font-mono text-xs text-text/80 overflow-x-auto whitespace-pre leading-relaxed">
                  {code}
                </pre>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={cn(
                    'absolute top-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg',
                    'font-mono text-[10px] font-semibold transition-all duration-200',
                    copied
                      ? 'bg-emerald-400/10 border border-emerald-400/20 text-emerald-400'
                      : 'bg-surface border border-border text-muted hover:text-text hover:border-primary/40',
                  )}
                >
                  {copied ? <Check size={10} aria-hidden="true" /> : <Code size={10} aria-hidden="true" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Preview link */}
              <div className="flex items-center justify-between">
                <p className="font-body text-xs text-muted">Height adjustable — minimum 500px recommended.</p>
                <Link
                  href={`/embed/${toolPath}${shareState ? `?s=${shareState}` : ''}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                >
                  Preview embed
                  <ExternalLink size={10} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
