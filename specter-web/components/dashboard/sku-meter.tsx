'use client'

import { cn } from '@/lib/utils'

export default function SkuMeter({
  used, limit, maxCompetitors,
}: { used: number; limit: number | null; maxCompetitors: number | null }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const tone = limit && used >= limit ? 'bg-rose-400' : pct >= 80 ? 'bg-amber-400' : 'bg-primary'
  return (
    <div className="flex flex-col gap-1 min-w-48">
      <div className="flex items-center justify-between font-mono text-xs text-muted">
        <span>SKUs {used}{limit != null ? ` / ${limit}` : ''}</span>
        {maxCompetitors != null && <span>up to {maxCompetitors} / product</span>}
      </div>
      <div className="h-1.5 rounded-full bg-border overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${limit ? pct : 4}%` }} />
      </div>
      <p className="font-body text-[11px] text-muted">1 SKU = one of your products tracked against one competitor (one competitor scrape per cycle).</p>
    </div>
  )
}
