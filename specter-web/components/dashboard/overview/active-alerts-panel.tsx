'use client'

import Link from 'next/link'
import { useAlerts } from '@/lib/api'
import { timeAgo } from '@/lib/time-ago'
import { repricingHref } from '@/lib/dashboard/deep-links'

export default function ActiveAlertsPanel() {
  const { data } = useAlerts('active')
  const alerts = (data?.items ?? []).filter((a) => a.status === 'active').slice(0, 5)
  if (alerts.length === 0) return null

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-text">Active OOS alerts</h2>
        <Link href="/alerts?status=active" className="font-body text-sm text-primary hover:underline">
          View all
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {alerts.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-4 bg-surface border border-border rounded-xl px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-body text-sm text-text truncate">
                <span className="font-medium">{a.competitor_domain}</span> out of stock
                <span className="text-muted"> · your {a.sku_title}</span>
              </p>
              <p className="font-body text-xs text-muted mt-0.5">Detected {timeAgo(a.detected_at)}</p>
            </div>
            <Link
              href={repricingHref(a.sku_id, 'overview')}
              className="font-body text-xs text-primary hover:underline shrink-0 whitespace-nowrap"
            >
              Review &amp; act →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
