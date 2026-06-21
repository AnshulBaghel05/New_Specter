'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Radio, PackageX, CreditCard, Info, Check } from 'lucide-react'
import {
  useUnreadCount,
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type NotificationItem,
  type NotificationType,
} from '@/lib/api'
import { severityTone } from '@/lib/dashboard/notification-meta'
import { timeAgo } from '@/lib/time-ago'
import { cn } from '@/lib/utils'

const TYPE_ICON: Record<NotificationType, typeof Radio> = {
  signal: Radio,
  oos: PackageX,
  billing: CreditCard,
  competitor_change: Radio,
  system: Info,
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const { data: count } = useUnreadCount()
  const unread = count?.unread ?? 0
  // Only fetch the list while the panel is open (keeps the closed bell cheap).
  const { data, isLoading } = useNotifications({ limit: 8 })
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function openItem(n: NotificationItem) {
    if (!n.read) markRead.mutate(n.id)
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  const items = data?.items ?? []

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        className="relative p-2 rounded-lg text-muted hover:text-text hover:bg-border/40 transition-colors"
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-rose-400 text-bg text-[10px] font-bold tabular-nums">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 w-80 max-w-[calc(100vw-2rem)] bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <span className="font-display text-sm font-bold text-text">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="font-body text-xs text-primary hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-6 space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-10 rounded-lg bg-border/30 animate-pulse" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={20} className="mx-auto text-muted/50" aria-hidden="true" />
                <p className="mt-2 font-body text-xs text-muted">No notifications yet.</p>
              </div>
            ) : (
              items.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Info
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => openItem(n)}
                    className={cn(
                      'w-full text-left flex gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-border/20 transition-colors',
                      !n.read && 'bg-primary/[0.04]',
                    )}
                  >
                    <Icon size={15} className={cn('mt-0.5 shrink-0', severityTone(n.severity))} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-body text-sm text-text truncate">{n.title}</span>
                        {!n.read && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />}
                      </span>
                      <span className="block font-body text-xs text-muted truncate">{n.body}</span>
                      <span className="block font-mono text-[10px] text-muted/70 mt-0.5">{timeAgo(n.created_at)}</span>
                    </span>
                  </button>
                )
              })
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1 px-4 py-2.5 border-t border-border font-body text-xs text-primary hover:bg-border/20 transition-colors"
          >
            <Check size={12} aria-hidden="true" /> View all notifications
          </Link>
        </div>
      )}
    </div>
  )
}
