'use client'

import { Mail, Loader2 } from 'lucide-react'
import { useUpdateMerchant } from '@/lib/api'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import SettingsCard from './settings-card'

export default function NotificationsCard({ enabled }: { enabled: boolean }) {
  const update = useUpdateMerchant()

  return (
    <SettingsCard title="Notifications">
      <label className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Mail size={18} className="text-muted shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-body text-sm text-text">Email notifications</p>
            <p className="font-body text-xs text-muted">Out-of-stock alerts, scrape failures, and reconnect reminders.</p>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          disabled={update.isPending}
          onClick={() =>
            update.mutate(
              { email_notifications_enabled: !enabled },
              { onSuccess: () => toast.success('Notifications updated') },
            )
          }
          className={cn(
            'relative w-11 h-6 rounded-full shrink-0 transition-colors disabled:opacity-50',
            enabled ? 'bg-primary' : 'bg-border',
          )}
        >
          {update.isPending ? (
            <Loader2 size={14} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-bg" />
          ) : (
            <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-bg transition-transform', enabled && 'translate-x-5')} />
          )}
        </button>
      </label>
      {update.isError && <p className="font-body text-xs text-rose-400">{"Couldn't update. Try again."}</p>}
    </SettingsCard>
  )
}
