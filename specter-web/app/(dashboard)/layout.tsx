'use client'

import { Suspense } from 'react'
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
import { cn } from '@/lib/utils'

const WORKSPACE_NAV = { href: '/workspace', label: 'Workspace', icon: LayoutGrid }

const PLATFORM_NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/signals', label: 'Signals', icon: Radio },
  { href: '/competitors', label: 'Competitors', icon: Globe },
  { href: '/products', label: 'Products', icon: Boxes },
  { href: '/alerts', label: 'Alerts', icon: BellRing },
  { href: '/repricing', label: 'Repricing', icon: SlidersHorizontal },
  { href: '/attribution', label: 'Attribution', icon: TrendingUp },
]

const SETTINGS_NAV = { href: '/settings', label: 'Settings', icon: Settings }

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  // Active-OOS badge in the nav — uses the same 60s-refetch summary query.
  const { data: summary } = useSignalSummary()
  const activeOos = summary?.active_oos_count ?? 0

  // Plan-aware ordering: free users live in the Workspace, so it leads; paid
  // users live in the live platform, so it leads. Every item stays visible —
  // platform tabs render their preview/demo state for free, never a blank wall.
  const { data: merchant } = useMerchant()
  const isFree = merchant?.plan === 'free' || merchant === undefined
  const NAV = isFree
    ? [WORKSPACE_NAV, ...PLATFORM_NAV, SETTINGS_NAV]
    : [...PLATFORM_NAV, WORKSPACE_NAV, SETTINGS_NAV]

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
        <div className="px-6 py-5 border-b border-border">
          <Link href="/dashboard" className="font-display text-xl font-bold text-text tracking-tight">
            SPECTER<span className="text-primary">.</span>
          </Link>
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
