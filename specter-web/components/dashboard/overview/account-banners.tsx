'use client'

import Link from 'next/link'
import { PlugZap, AlertTriangle, Clock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMerchant } from '@/lib/api'
import { accountBanners, type BannerKind } from '@/lib/dashboard/overview-state'
import { cn } from '@/lib/utils'

const ICONS: Record<BannerKind, LucideIcon> = {
  reconnect: PlugZap,
  read_only: AlertTriangle,
  trial: Clock,
}

export default function AccountBanners() {
  const { data: merchant } = useMerchant()
  const banners = accountBanners(merchant)
  if (banners.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {banners.map((b) => {
        const Icon = ICONS[b.kind]
        const urgent = b.severity === 'urgent'
        return (
          <div
            key={b.kind}
            className={cn(
              'flex items-center gap-3 rounded-xl border px-4 py-3',
              urgent ? 'border-rose-400/30 bg-rose-400/10' : 'border-primary/30 bg-primary/10',
            )}
          >
            <Icon
              size={18}
              className={cn('shrink-0', urgent ? 'text-rose-400' : 'text-primary')}
              aria-hidden="true"
            />
            <p className={cn('font-body text-sm flex-1 min-w-0', urgent ? 'text-rose-300' : 'text-primary')}>
              {b.title}
            </p>
            <Link
              href={b.cta.href}
              className={cn(
                'font-body text-xs font-medium shrink-0 whitespace-nowrap hover:underline',
                urgent ? 'text-rose-300' : 'text-primary',
              )}
            >
              {b.cta.label} →
            </Link>
          </div>
        )
      })}
    </div>
  )
}
