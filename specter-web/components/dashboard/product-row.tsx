'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Product } from '@/lib/api'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/time-ago'
import CompetitorRowMenu from '@/components/dashboard/competitor-row-menu'
import LinkCompetitorInline from '@/components/dashboard/link-competitor-inline'

const SIGNAL_TONE: Record<string, string> = {
  RAISE: 'text-emerald-400', LOWER: 'text-rose-400', HOLD: 'text-amber-400',
}

// Per-URL scrape health → dot tone + short label (full reason in the title tooltip).
const STATUS_TONE: Record<string, string> = {
  live: 'text-emerald-400', stale: 'text-amber-400',
  failing: 'text-rose-400', blocked: 'text-rose-400', pending: 'text-muted/70',
}
const STATUS_LABEL: Record<string, string> = {
  live: 'live', stale: 'stale', failing: 'failing', blocked: 'blocked', pending: 'queued',
}

export default function ProductRow({ product, maxCompetitors }: { product: Product; maxCompetitors: number | null }) {
  const [open, setOpen] = useState(false)
  const sig = product.latest_signal
  const price = product.current_price != null ? `$${product.current_price.toFixed(2)}` : '—'

  return (
    <li className="bg-surface border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-border/20 transition-colors"
        aria-expanded={open}
      >
        <ChevronRight size={15} className={cn('text-muted transition-transform shrink-0', open && 'rotate-90')} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-body text-sm text-text truncate">{product.title}</span>
            <span className="font-mono text-[10px] text-muted/70 border border-border rounded px-1.5 py-0.5 shrink-0">
              {product.source}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 font-mono text-xs">
            <span className="text-muted">{price}</span>
            {sig && (
              <span className={cn('font-semibold', SIGNAL_TONE[sig.type])}>
                {sig.type}
                {sig.price_suggestion != null && ` → $${sig.price_suggestion.toFixed(2)}`}
                {` (${Math.round(sig.confidence * 100)}%)`}
              </span>
            )}
            {sig && <span className="text-muted/70">· updated {timeAgo(sig.created_at)}</span>}
            {!sig && <span className="text-muted/70">· awaiting first signal</span>}
          </div>
        </div>
        <span className="font-mono text-xs text-muted shrink-0">{product.competitor_count} competitors</span>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 flex flex-col gap-2">
          {product.competitors.length === 0 && (
            <p className="font-body text-xs text-muted">No competitors linked yet.</p>
          )}
          {product.competitors.map(c => (
            <div key={c.tracking_id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 font-mono text-xs">
              <span className="text-text truncate flex-1">{c.domain}</span>
              <span className="text-muted w-16 text-right">
                {c.latest_price != null ? `$${c.latest_price.toFixed(2)}` : '—'}
              </span>
              <span className={cn('w-16 text-right', c.in_stock === false ? 'text-rose-400' : c.in_stock ? 'text-emerald-400' : 'text-muted/60')}>
                {c.in_stock == null ? 'checking…' : c.in_stock ? 'in-stock' : 'OOS'}
              </span>
              <span
                className={cn('w-16 text-right', STATUS_TONE[c.status] ?? 'text-muted/60')}
                title={c.status_label}
              >
                ● {STATUS_LABEL[c.status] ?? c.status}
              </span>
              <span className="text-muted/70 w-16 text-right">{c.last_checked_at ? timeAgo(c.last_checked_at) : '—'}</span>
              <CompetitorRowMenu trackingId={c.tracking_id} silenced={c.silenced_oos} />
            </div>
          ))}
          <div className="pt-1">
            <LinkCompetitorInline
              productId={product.id}
              atProductLimit={maxCompetitors != null && product.competitor_count >= maxCompetitors}
            />
          </div>
          <div className="pt-2 mt-1 border-t border-border/50 flex items-center justify-between gap-3 font-mono text-xs">
            <span className="text-muted">
              floor {product.floor_price != null ? `$${product.floor_price.toFixed(2)}` : '—'} · ceiling {product.ceiling_price != null ? `$${product.ceiling_price.toFixed(2)}` : '—'}
            </span>
            <a href="/repricing" className="text-primary hover:underline">Auto-reprice →</a>
          </div>
        </div>
      )}
    </li>
  )
}
