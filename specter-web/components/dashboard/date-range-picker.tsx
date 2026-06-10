'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import type { Plan } from '@/lib/dashboard/date-range'
import { RANGE_PRESETS, presetAllowed } from '@/lib/dashboard/date-range'
import { cn } from '@/lib/utils'

/**
 * History-window picker for the Signals feed (F9).
 *
 * PREDATOR/ECLIPSE can select up to 90 days back; lower plans are capped at 30,
 * so the 90-day preset renders locked with an inline upgrade link. The backend
 * still enforces the cap (400 range_exceeds_plan) — this is UI guidance only.
 */
export default function DateRangePicker({
  plan,
  selectedDays,
  onSelect,
}: {
  plan: Plan | undefined
  selectedDays: number
  onSelect: (days: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-body text-xs text-muted">History</span>
      <div className="flex items-center gap-1.5">
        {RANGE_PRESETS.map((p) => {
          const allowed = presetAllowed(p.days, plan)
          if (!allowed) {
            return (
              <Link
                key={p.days}
                href="/pricing"
                title="90-day history is a PREDATOR feature — upgrade to unlock"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-border font-body text-sm text-muted hover:text-primary hover:border-primary/40 transition-colors"
              >
                <Lock size={12} aria-hidden="true" />
                {p.label}
              </Link>
            )
          }
          return (
            <button
              key={p.days}
              onClick={() => onSelect(p.days)}
              className={cn(
                'px-3 py-1.5 rounded-lg font-body text-sm transition-colors',
                selectedDays === p.days
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:text-text hover:bg-border/40',
              )}
            >
              {p.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
