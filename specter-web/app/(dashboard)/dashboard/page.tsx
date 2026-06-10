'use client'

import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus, DollarSign, BellRing, Radio } from 'lucide-react'
import { useSignals, useSignalSummary, useProducts, useMerchant } from '@/lib/api'
import StatCard from '@/components/dashboard/stat-card'
import SignalBadge from '@/components/dashboard/signal-badge'
import EmptyState from '@/components/dashboard/empty-state'
import SkuMeter from '@/components/dashboard/sku-meter'
import AccountBanners from '@/components/dashboard/overview/account-banners'
import GettingStarted from '@/components/dashboard/overview/getting-started'
import ActiveAlertsPanel from '@/components/dashboard/overview/active-alerts-panel'
import { timeAgo } from '@/lib/time-ago'
import { repricingHref } from '@/lib/dashboard/deep-links'
import { deriveOverviewState } from '@/lib/dashboard/overview-state'

export default function DashboardPage() {
  const { data: merchant } = useMerchant()
  const { data: products } = useProducts()
  const { data: summary, isLoading: summaryLoading } = useSignalSummary()
  const { data: feed, isLoading: feedLoading } = useSignals({ limit: 10 })

  const state = deriveOverviewState(products, merchant)
  const signals = feed?.items ?? []

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Overview</h1>
          <p className="font-body text-sm text-muted mt-1">
            Your competitive pricing intelligence at a glance.
          </p>
        </div>
        {products && (
          <SkuMeter
            used={products.sku_used}
            limit={products.sku_limit}
            maxCompetitors={products.max_competitors_per_sku}
          />
        )}
      </header>

      <AccountBanners />

      {state === null ? (
        // Products still loading.
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-surface border border-border animate-pulse" />
          ))}
        </section>
      ) : !state.activated ? (
        <GettingStarted steps={state.steps} />
      ) : (
        <>
          {/* Revenue hero */}
          <Link
            href="/attribution"
            className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-2 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="font-body text-sm text-muted">Revenue recovered (MTD)</span>
              <DollarSign size={18} className="text-muted" aria-hidden="true" />
            </div>
            <span className="font-display text-4xl sm:text-5xl font-bold tabular-nums text-primary">
              ${(summary?.revenue_recovered_mtd ?? 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="font-body text-xs text-muted">
              From auto-reprice price changes this month →
            </span>
          </Link>

          {/* Secondary stat row */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="RAISE signals (24h)"
              value={summary?.raise_24h ?? 0}
              icon={TrendingUp}
              accent="primary"
              loading={summaryLoading}
              href="/signals?type=RAISE"
            />
            <StatCard
              label="LOWER signals (24h)"
              value={summary?.lower_24h ?? 0}
              icon={TrendingDown}
              accent="rose"
              loading={summaryLoading}
              href="/signals?type=LOWER"
            />
            <StatCard
              label="HOLD signals (24h)"
              value={summary?.hold_24h ?? 0}
              icon={Minus}
              accent="muted"
              loading={summaryLoading}
              href="/signals?type=HOLD"
            />
            <StatCard
              label="Active OOS alerts"
              value={summary?.active_oos_count ?? 0}
              icon={BellRing}
              accent={summary?.active_oos_count ? 'rose' : 'muted'}
              loading={summaryLoading}
              href="/alerts?status=active"
            />
          </section>

          <ActiveAlertsPanel />

          {/* Recent signal feed */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-text">Recent signals</h2>
              <Link href="/signals" className="font-body text-sm text-primary hover:underline">
                View all
              </Link>
            </div>

            {feedLoading ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-surface border border-border animate-pulse" />
                ))}
              </div>
            ) : signals.length === 0 ? (
              <EmptyState
                icon={Radio}
                title="No signals yet"
                description="Once you connect a store and track competitors, RAISE/LOWER/HOLD signals will appear here within one scrape cycle."
                cta={{ label: 'Add competitors', href: '/competitors' }}
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {signals.map((sig) => (
                  <li
                    key={sig.id}
                    className="flex items-center gap-4 bg-surface border border-border rounded-xl px-4 py-3"
                  >
                    <SignalBadge type={sig.type} />
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm text-text truncate">{sig.sku_title}</p>
                      {sig.reasoning && (
                        <p className="font-body text-xs text-muted truncate">{sig.reasoning}</p>
                      )}
                    </div>
                    <span className="font-mono text-xs text-muted tabular-nums shrink-0">
                      {Math.round(sig.confidence * 100)}%
                    </span>
                    <span className="font-body text-xs text-muted shrink-0 w-16 text-right">
                      {timeAgo(sig.created_at)}
                    </span>
                    <Link
                      href={repricingHref(sig.sku_id, 'overview')}
                      className="font-body text-xs text-primary hover:underline shrink-0 whitespace-nowrap"
                    >
                      Review &amp; act →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
