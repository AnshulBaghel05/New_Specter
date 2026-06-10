'use client'

import Link from 'next/link'
import { CheckCircle2, Circle } from 'lucide-react'
import type { ChecklistStep } from '@/lib/dashboard/overview-state'
import { cn } from '@/lib/utils'

export default function GettingStarted({ steps }: { steps: ChecklistStep[] }) {
  const done = steps.filter((s) => s.done).length
  const pct = Math.round((done / steps.length) * 100)

  return (
    <section className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-text">Get started with SPECTER</h2>
          <span className="font-mono text-xs text-muted">{pct}% complete</span>
        </div>
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ul className="flex flex-col gap-4">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-3">
            {step.done ? (
              <CheckCircle2 size={20} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <Circle size={20} className="text-muted shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'font-body text-sm font-medium',
                  step.done ? 'text-muted line-through' : 'text-text',
                )}
              >
                {step.label}
              </p>
              <p className="font-body text-xs text-muted mt-0.5">{step.hint}</p>
            </div>
            {!step.done && step.cta && (
              <Link
                href={step.cta.href}
                className="font-body text-xs text-primary hover:underline shrink-0 whitespace-nowrap mt-0.5"
              >
                {step.cta.label} →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
