// Pure state for the adaptive Overview page: activation, the onboarding
// checklist, and account banners. The single source of branching truth so the
// page and its section components stay as thin glue.

import type { Merchant, ProductsResponse } from '@/lib/api'

// ── Activation ────────────────────────────────────────────────────────────────
// The single source of truth for "this account has received value."
// Today: a tracked product has produced at least one signal. Evolve here only.
export function isActivated(products: ProductsResponse | undefined): boolean {
  if (!products) return false
  return products.items.some((p) => p.latest_signal !== null)
}

// ── Onboarding checklist ──────────────────────────────────────────────────────
export interface ChecklistStep {
  id: 'products' | 'competitors' | 'signal'
  label: string
  hint: string
  done: boolean
  cta?: { label: string; href: string } // omitted for the automatic signal step
}

export interface OverviewState {
  activated: boolean
  steps: ChecklistStep[]
}

// Returns null while products is still loading (caller shows skeletons).
export function deriveOverviewState(
  products: ProductsResponse | undefined,
  _merchant: Merchant | undefined,
): OverviewState | null {
  if (!products) return null

  const hasProducts = products.items.length > 0
  const hasCompetitor = products.items.some((p) => p.competitor_count > 0)
  const activated = isActivated(products) // step 3 == activation

  const steps: ChecklistStep[] = [
    {
      id: 'products',
      label: 'Add your products',
      hint: 'Connect Shopify to import your catalog, or add a product manually.',
      done: hasProducts,
      cta: { label: hasProducts ? 'Manage products' : 'Add a product', href: '/products' },
    },
    {
      id: 'competitors',
      label: 'Link a competitor',
      hint: 'Track at least one competitor URL so SPECTER can compare prices.',
      done: hasCompetitor,
      cta: { label: 'Link a competitor', href: '/products' },
    },
    {
      id: 'signal',
      label: 'Receive your first signal',
      hint: 'Signals arrive within one scrape cycle after you link a competitor.',
      done: activated,
    },
  ]

  return { activated, steps }
}

// ── Account banners ───────────────────────────────────────────────────────────
export type BannerKind = 'reconnect' | 'read_only' | 'trial'

export interface Banner {
  kind: BannerKind
  severity: 'urgent' | 'info'
  title: string
  cta: { label: string; href: string }
}

// Whole days remaining in the trial, or null if no active (future) trial.
export function trialDaysLeft(trialEndsAt: string | null, now: Date = new Date()): number | null {
  if (!trialEndsAt) return null
  const end = new Date(trialEndsAt).getTime()
  if (Number.isNaN(end)) return null
  const ms = end - now.getTime()
  if (ms <= 0) return null
  return Math.ceil(ms / 86_400_000)
}

// Ordered list of banners to show, urgent first. Empty array → render nothing.
export function accountBanners(merchant: Merchant | undefined, now: Date = new Date()): Banner[] {
  if (!merchant) return []
  const banners: Banner[] = []

  if (merchant.shopify_reconnect_required) {
    banners.push({
      kind: 'reconnect',
      severity: 'urgent',
      title: 'Your Shopify connection needs attention — reconnect to keep prices syncing.',
      cta: { label: 'Reconnect', href: '/settings' },
    })
  }
  if (merchant.read_only) {
    banners.push({
      kind: 'read_only',
      severity: 'urgent',
      title: 'Your account is read-only due to a billing issue. Update billing to resume repricing.',
      cta: { label: 'Fix billing', href: '/settings' },
    })
  }
  const days = trialDaysLeft(merchant.trial_ends_at, now)
  if (days !== null) {
    banners.push({
      kind: 'trial',
      severity: 'info',
      title: days === 1 ? '1 day left in your trial.' : `${days} days left in your trial.`,
      cta: { label: 'View plans', href: '/pricing' },
    })
  }
  return banners
}
