'use client'

import Link from 'next/link'
import { BellRing, BellOff, Bell, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAlerts, useSilenceAlert } from '@/lib/api'
import EmptyState from '@/components/dashboard/empty-state'
import { timeAgo } from '@/lib/time-ago'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { useQueryParams } from '@/lib/dashboard/use-query-params'
import { parseAlertStatus, parseAlertSort } from '@/lib/dashboard/url-params'
import { repricingHref } from '@/lib/dashboard/deep-links'
import {
  sortAlerts,
  alertCounts,
  oosDurationMs,
  formatOosDuration,
  isUrgentOOS,
} from '@/lib/dashboard/alert-helpers'

const FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Active', value: 'active' as const },
  { label: 'Resolved', value: 'resolved' as const },
]

const SORTS = [
  { label: 'Newest', value: 'recent' as const },
  { label: 'Oldest', value: 'oldest' as const },
  { label: 'Domain', value: 'domain' as const },
]

export default function AlertsPage() {
  const { get, set } = useQueryParams()
  const filter = parseAlertStatus(get('status'))
  const sort = parseAlertSort(get('sort'))
  const { data, isLoading } = useAlerts(filter)
  const silenceMut = useSilenceAlert()

  const rawAlerts = data?.items ?? []
  const alerts = sortAlerts(rawAlerts, sort)
  const counts = alertCounts(rawAlerts)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-text">Out-of-stock alerts</h1>
        <p className="font-body text-sm text-muted mt-1">
          When a tracked competitor goes out of stock, that&apos;s your window to raise
          price and capture demand.
        </p>
        {rawAlerts.length > 0 && (
          <p className="font-mono text-xs text-muted mt-2">
            <span className="text-rose-400">{counts.active} active</span>
            {' · '}
            <span className="text-primary">{counts.resolved} resolved</span>
          </p>
        )}
      </header>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => set({ status: f.value ?? null })}
            className={cn(
              'px-3.5 py-1.5 rounded-lg font-body text-sm transition-colors',
              filter === f.value
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:text-text hover:bg-border/40',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Sort control */}
      <label className="flex items-center gap-2 font-body text-xs text-muted">
        Sort
        <select
          value={sort}
          onChange={(e) => set({ sort: e.target.value === 'recent' ? null : e.target.value })}
          className="bg-surface border border-border rounded-lg px-2.5 py-1.5 font-body text-sm text-text focus:outline-none focus:border-primary/40"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </label>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="No alerts"
          description="You'll be notified here (and by email) the moment a tracked competitor goes out of stock. Nothing to action right now."
          cta={{ label: 'Manage competitors', href: '/competitors' }}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {alerts.map((a) => {
            const isActive = a.status === 'active'
            const urgent = isUrgentOOS(a)
            const duration = formatOosDuration(oosDurationMs(a))
            return (
              <li
                key={a.id}
                className={cn(
                  'flex items-center gap-4 border rounded-xl px-4 py-3',
                  urgent
                    ? 'border-rose-400/50 bg-rose-400/[0.07]'
                    : 'border-border bg-surface',
                )}
              >
                <div className="shrink-0">
                  {isActive ? (
                    <AlertCircle size={18} className="text-rose-400" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 size={18} className="text-primary" aria-hidden="true" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm text-text truncate">
                    <span className="font-medium">{a.competitor_domain}</span> out of stock
                    <span className="text-muted"> · your {a.sku_title}</span>
                  </p>
                  <p className="font-body text-xs text-muted mt-0.5">
                    {isActive ? (
                      <>Detected {timeAgo(a.detected_at)} · out of stock for {duration}</>
                    ) : (
                      <>Resolved {a.resolved_at ? timeAgo(a.resolved_at) : ''} · restocked after {duration}</>
                    )}
                  </p>
                </div>

                <span
                  className={cn(
                    'inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs font-semibold uppercase shrink-0',
                    isActive
                      ? 'border-rose-400/25 bg-rose-400/12 text-rose-400'
                      : 'border-primary/25 bg-primary/12 text-primary',
                  )}
                >
                  {a.status}
                </span>

                {isActive && (
                  <Link
                    href={repricingHref(a.sku_id, 'alerts')}
                    className="font-body text-xs text-primary hover:underline shrink-0 whitespace-nowrap"
                  >
                    Review &amp; act →
                  </Link>
                )}

                {/* Silence toggle (per competitor URL) */}
                <button
                  onClick={() =>
                    silenceMut.mutate(
                      { alertId: a.id, silenced: !a.silenced },
                      {
                        onSuccess: () =>
                          toast.success(
                            `Alerts ${!a.silenced ? 'silenced' : 'unsilenced'} for ${a.competitor_domain}`,
                          ),
                      },
                    )
                  }
                  disabled={silenceMut.isPending}
                  title={a.silenced ? 'Alerts silenced for this URL' : 'Silence alerts for this URL'}
                  className={cn(
                    'p-2 rounded-lg transition-colors shrink-0',
                    a.silenced
                      ? 'text-muted hover:text-text hover:bg-border/40'
                      : 'text-primary hover:bg-primary/10',
                  )}
                >
                  {a.silenced ? <BellOff size={16} /> : <Bell size={16} />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
