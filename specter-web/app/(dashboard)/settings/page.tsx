'use client'

import { useMerchant, useProducts } from '@/lib/api'
import PlanCard from '@/components/dashboard/settings/plan-card'
import UsageCard from '@/components/dashboard/settings/usage-card'
import ShopifyCard from '@/components/dashboard/settings/shopify-card'
import NotificationsCard from '@/components/dashboard/settings/notifications-card'
import AccountCard from '@/components/dashboard/settings/account-card'
import EclipseIntervalCard from '@/components/dashboard/settings/eclipse-interval-card'

export default function SettingsPage() {
  const { data: merchant, isLoading, error } = useMerchant()
  const products = useProducts()

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-text">Settings</h1>
        <p className="font-body text-sm text-muted mt-1">
          Manage your plan, usage, store connection, and account.
        </p>
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      ) : error || !merchant ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 font-body text-sm text-rose-300">
          {"Couldn't load your settings. Refresh to try again."}
        </div>
      ) : (
        <>
          <PlanCard
            plan={merchant.plan}
            trialEndsAt={merchant.trial_ends_at}
            skuLimit={products.data?.sku_limit ?? null}
            maxCompetitors={merchant.max_competitors_per_sku}
          />
          <UsageCard
            plan={merchant.plan}
            used={products.data?.sku_used ?? 0}
            limit={products.data?.sku_limit ?? null}
            maxCompetitors={products.data?.max_competitors_per_sku ?? merchant.max_competitors_per_sku}
            error={!!products.error}
          />
          {merchant.plan === 'eclipse' && <EclipseIntervalCard intervalMs={merchant.eclipse_interval_ms} />}
          <ShopifyCard merchant={merchant} />
          {merchant.plan !== 'free' && <NotificationsCard enabled={merchant.email_notifications_enabled} />}
          <AccountCard />
        </>
      )}
    </div>
  )
}
