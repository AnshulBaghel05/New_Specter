'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { DomainGroup } from '@/lib/dashboard/group-by-domain'
import CompetitorRowMenu from '@/components/dashboard/competitor-row-menu'
import { timeAgo } from '@/lib/time-ago'
import { cn } from '@/lib/utils'

const HEALTH = {
  healthy:  { label: '● Healthy',  cls: 'text-emerald-400' },
  degraded: { label: '◐ Degraded', cls: 'text-amber-400' },
  blocked:  { label: '⚠ Blocked',  cls: 'text-rose-400' },
} as const

export default function CompetitorDomainGroup({ group }: { group: DomainGroup }) {
  const [open, setOpen] = useState(false)
  const h = HEALTH[group.health]
  const gap = group.avgPriceGap == null ? null : `${group.avgPriceGap > 0 ? '+' : ''}${(group.avgPriceGap * 100).toFixed(0)}%`
  return (
    <li className="bg-surface border border-border rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-border/20" aria-expanded={open}>
        <ChevronRight size={15} className={cn('text-muted transition-transform shrink-0', open && 'rotate-90')} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <span className="font-body text-sm text-text">{group.domain}</span>
          <div className="flex items-center gap-2 mt-0.5 font-mono text-xs flex-wrap">
            <span className="text-muted">{group.productCount} products</span>
            {gap && <span className="text-muted">· avg gap {gap}</span>}
            {group.health !== 'blocked' && <span className="text-muted">· {group.inStock} in-stock / {group.oos} OOS</span>}
            <span className={h.cls}>· {h.label}</span>
            {group.lastCheckedAt && <span className="text-muted/70">· {timeAgo(group.lastCheckedAt)}</span>}
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3 flex flex-col gap-2">
          {group.health === 'blocked' && (
            <p className="font-body text-xs text-rose-400">robots.txt disallows automated tracking for this domain.</p>
          )}
          {group.pairings.map(p => (
            <div key={p.trackingId} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 font-mono text-xs">
              <span className="text-text truncate flex-1">{p.productTitle}</span>
              <span className="text-muted w-16 text-right">{p.latestPrice != null ? `$${p.latestPrice.toFixed(2)}` : '—'}</span>
              <span className={cn('w-16 text-right', p.inStock === false ? 'text-rose-400' : p.inStock ? 'text-emerald-400' : 'text-muted/60')}>
                {p.inStock == null ? 'checking…' : p.inStock ? 'in-stock' : 'OOS'}
              </span>
              <span className="text-muted/70 w-16 text-right">{p.lastCheckedAt ? timeAgo(p.lastCheckedAt) : '—'}</span>
              <CompetitorRowMenu trackingId={p.trackingId} silenced={p.silencedOos} />
            </div>
          ))}
        </div>
      )}
    </li>
  )
}
