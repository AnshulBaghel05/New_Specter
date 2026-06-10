import Link from 'next/link'
import { X } from 'lucide-react'
import type { PriceChange } from '@/lib/api'
import { formatDayLabel } from '@/lib/dashboard/attribution-day'
import { formatSignedUsd } from '@/lib/dashboard/attribution-breakdown'
import { cn } from '@/lib/utils'

export default function AttributionDayPanel({
  day,
  changes,
  onDismiss,
}: {
  day: string
  changes: PriceChange[]
  onDismiss: () => void
}) {
  return (
    <section className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-text">
          {formatDayLabel(day)} · {changes.length} change{changes.length === 1 ? '' : 's'}
        </h3>
        <button
          onClick={onDismiss}
          aria-label="Dismiss day details"
          className="text-muted hover:text-text transition-colors"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {changes.length === 0 ? (
        <p className="font-body text-sm text-muted">No attributed changes on this day.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {changes.map((c) => {
            const delta = c.revenue_delta ?? 0
            return (
              <li key={c.id} className="flex items-center gap-4">
                <Link
                  href={`/repricing?sku=${c.sku_id}`}
                  className="min-w-0 flex-1 font-body text-sm text-text truncate hover:text-primary transition-colors"
                >
                  {c.sku_title}
                </Link>
                <span className="font-mono text-xs text-muted tabular-nums shrink-0">
                  ${c.old_price.toFixed(2)} → ${c.new_price.toFixed(2)}
                </span>
                <span
                  className={cn(
                    'font-mono text-xs tabular-nums w-20 text-right shrink-0',
                    delta >= 0 ? 'text-primary' : 'text-rose-400',
                  )}
                >
                  {formatSignedUsd(delta)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
