'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Radio, PackageX, CreditCard, Info, X } from 'lucide-react'
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDismissNotification,
  type NotificationItem,
  type NotificationType,
} from '@/lib/api'
import { severityTone, typeLabel } from '@/lib/dashboard/notification-meta'
import EmptyState from '@/components/dashboard/empty-state'
import { timeAgo } from '@/lib/time-ago'
import { cn } from '@/lib/utils'

const PAGE = 20

const TYPE_ICON: Record<NotificationType, typeof Radio> = {
  signal: Radio,
  oos: PackageX,
  billing: CreditCard,
  competitor_change: Radio,
  system: Info,
}

const FILTERS: { value: NotificationType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'signal', label: 'Signals' },
  { value: 'oos', label: 'Out of stock' },
  { value: 'billing', label: 'Billing' },
]

export default function NotificationsPage() {
  const [filter, setFilter] = useState<NotificationType | 'all'>('all')
  const [page, setPage] = useState(0)
  const router = useRouter()

  const { data, isLoading, error } = useNotifications({
    limit: PAGE,
    offset: page * PAGE,
    type: filter === 'all' ? undefined : filter,
  })
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const dismiss = useDismissNotification()

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE))

  function setFilterReset(f: NotificationType | 'all') {
    setFilter(f)
    setPage(0)
  }

  function openItem(n: NotificationItem) {
    if (!n.read) markRead.mutate(n.id)
    if (n.link) router.push(n.link)
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Notifications</h1>
          <p className="font-body text-sm text-muted mt-1">
            Price signals, stock changes, and account events — newest first.
          </p>
        </div>
        {(data?.unread ?? 0) > 0 && (
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="font-body text-sm text-primary hover:underline disabled:opacity-50 shrink-0"
          >
            Mark all read
          </button>
        )}
      </header>

      {/* Type filter */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilterReset(f.value)}
            className={cn(
              'px-3 py-1.5 rounded-lg font-body text-xs font-semibold transition-colors',
              filter === f.value
                ? 'bg-primary/10 text-primary'
                : 'border border-border text-muted hover:text-text hover:border-primary/40',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 font-body text-sm text-rose-300">
          Couldn&rsquo;t load notifications. Refresh to try again.
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="When a price signal fires, a competitor goes out of stock, or a billing event happens, it'll show up here."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {items.map((n) => {
              const Icon = TYPE_ICON[n.type] ?? Info
              return (
                <li
                  key={n.id}
                  className={cn(
                    'group bg-surface border rounded-xl flex items-start gap-3 px-4 py-3 transition-colors',
                    n.read ? 'border-border' : 'border-primary/30 bg-primary/[0.04]',
                  )}
                >
                  <Icon size={17} className={cn('mt-0.5 shrink-0', severityTone(n.severity))} aria-hidden="true" />
                  <button type="button" onClick={() => openItem(n)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-body text-sm text-text">{n.title}</span>
                      <span className="font-mono text-[10px] text-muted/70 border border-border rounded px-1.5 py-0.5 shrink-0">
                        {typeLabel(n.type)}
                      </span>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />}
                    </div>
                    <p className="font-body text-xs text-muted mt-0.5">{n.body}</p>
                    <p className="font-mono text-[10px] text-muted/70 mt-1">{timeAgo(n.created_at)}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => dismiss.mutate(n.id)}
                    disabled={dismiss.isPending}
                    aria-label="Dismiss"
                    className="p-1 rounded text-muted/60 hover:text-rose-400 hover:bg-border/40 transition-colors disabled:opacity-50"
                  >
                    <X size={14} />
                  </button>
                </li>
              )
            })}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between font-body text-xs text-muted">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-border hover:text-text hover:border-primary/40 disabled:opacity-40 disabled:pointer-events-none"
              >
                ← Newer
              </button>
              <span className="tabular-nums">Page {page + 1} of {totalPages}</span>
              <button
                type="button"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-border hover:text-text hover:border-primary/40 disabled:opacity-40 disabled:pointer-events-none"
              >
                Older →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
