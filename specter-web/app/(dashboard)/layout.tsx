'use client'

import { Suspense, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  LayoutGrid,
  Radio,
  Globe,
  Boxes,
  BellRing,
  SlidersHorizontal,
  TrendingUp,
  Settings,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSignalSummary, useMerchant } from '@/lib/api'
import NotificationBell from '@/components/dashboard/notification-bell'
import { useResumeIntent } from '@/hooks/use-resume-intent'
import { identifyMerchant } from '@/lib/analytics'
import { cn } from '@/lib/utils'

// A SINGLE, STABLE nav order for every plan. The order must not depend on async
// state (e.g. the merchant's plan): if it did, the list would render one order on
// first paint (while `merchant` is still loading) and reorder once the query
// resolves — the nav tags visibly jumping up/down on load. Free accounts still see
// every tab (platform tabs render their preview/demo state), just in a fixed order.
const NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/signals', label: 'Signals', icon: Radio },
  { href: '/competitors', label: 'Competitors', icon: Globe },
  { href: '/products', label: 'Products', icon: Boxes },
  { href: '/alerts', label: 'Alerts', icon: BellRing },
  { href: '/repricing', label: 'Repricing', icon: SlidersHorizontal },
  { href: '/attribution', label: 'Attribution', icon: TrendingUp },
  { href: '/workspace', label: 'Workspace', icon: LayoutGrid },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useResumeIntent()
  const pathname = usePathname()
  const router = useRouter()

  // Active-OOS badge in the nav — uses the same 60s-refetch summary query.
  const { data: summary } = useSignalSummary()
  const activeOos = summary?.active_oos_count ?? 0

  // Merchant is loaded only for analytics identity now — NOT for nav ordering,
  // which is fixed (see NAV) so the tabs never reshuffle on load.
  const { data: merchant } = useMerchant()

  // Attach merchant_id (+ plan) to every PostHog event once the merchant loads.
  useEffect(() => {
    if (merchant?.id) identifyMerchant(merchant.id, merchant.plan)
  }, [merchant?.id, merchant?.plan])

  async function signOut() {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {
      /* Supabase not configured (e.g. local preview) — fall through to redirect */
    }
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-2">
          <Link href="/dashboard" className="font-display text-xl font-bold text-text tracking-tight">
            SPECTER<span className="text-primary">.</span>
          </Link>
          <NotificationBell />
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl font-body text-sm transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted hover:text-text hover:bg-border/40',
                )}
              >
                <Icon size={17} aria-hidden="true" />
                {label}
                {href === '/alerts' && activeOos > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-rose-400/15 text-rose-400 text-xs font-semibold tabular-nums">
                    {activeOos}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <button
          onClick={signOut}
          className="m-3 flex items-center gap-3 px-3 py-2.5 rounded-xl font-body text-sm text-muted hover:text-text hover:bg-border/40 transition-colors"
        >
          <LogOut size={17} aria-hidden="true" />
          Sign out
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 px-8 py-8 max-w-6xl">
        <Suspense
          fallback={
            <div className="h-24 rounded-xl bg-surface border border-border animate-pulse" />
          }
        >
          {children}
        </Suspense>
      </main>
    </div>
  )
}
