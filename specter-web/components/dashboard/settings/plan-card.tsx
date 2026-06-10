'use client'

import { Zap } from 'lucide-react'
import { planMeta } from '@/lib/dashboard/plan-meta'
import { daysLeft } from '@/lib/dashboard/trial'
import { cn } from '@/lib/utils'
import SettingsCard from './settings-card'

export default function PlanCard({
  plan,
  trialEndsAt,
  skuLimit,
  maxCompetitors,
}: {
  plan: string
  trialEndsAt: string | null
  skuLimit: number | null
  maxCompetitors: number | null
}) {
  const meta = planMeta(plan)
  const isFree = plan === 'free'
  const trial = daysLeft(trialEndsAt)

  return (
    <SettingsCard title="Plan">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center px-3 py-1 rounded-lg bg-primary/10 text-primary font-display text-sm font-bold tracking-wide">
              {meta.label}
            </span>
            {meta.priceLabel && <span className="font-body text-sm text-muted">{meta.priceLabel}</span>}
            {meta.priorityLabel && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-bg font-body text-xs text-muted"
                title="Your scrape-queue priority"
              >
                <Zap size={11} className="text-primary" aria-hidden="true" />
                {meta.priorityLabel}
              </span>
            )}
          </div>
          {trial != null && (
            <p className={cn('font-body text-xs', trial <= 2 ? 'text-amber-400' : 'text-muted')}>
              Trial — {trial} {trial === 1 ? 'day' : 'days'} left
            </p>
          )}
          {!isFree && (
            <p className="font-body text-xs text-muted">
              {skuLimit != null ? `${skuLimit} SKUs` : 'Unlimited SKUs'}
              {maxCompetitors != null ? ` · up to ${maxCompetitors} competitors/product` : ''}
              {` · refresh ${meta.refreshLabel}`}
            </p>
          )}
        </div>
        {isFree ? (
          <a
            href="/pricing"
            className="gradient-primary-cta btn-ripple px-5 py-2.5 rounded-xl font-semibold text-sm shrink-0"
          >
            Start 14-day trial
          </a>
        ) : (
          <a href="/pricing" className="font-body text-sm text-primary hover:underline shrink-0">
            Change plan
          </a>
        )}
      </div>
    </SettingsCard>
  )
}
