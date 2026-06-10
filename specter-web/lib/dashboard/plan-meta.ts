import { monthlyPriceLabel } from '@/lib/pricing'

export interface PlanMeta {
  label: string
  /** List monthly price in USD; null for custom (ECLIPSE), 0 for free. */
  listMonthly: number | null
  /** Promo-aware display label, derived from listMonthly via lib/pricing. */
  priceLabel: string
  refreshLabel: string
  // Scrape-queue priority shown as a settings badge. Mirrors _PLAN_PRIORITY in
  // specter-api/queue_client.py (eclipse=20, predator=10, … recon=1); null = no
  // live scraping (free).
  priorityLabel: string | null
}

// Base display data. priceLabel is derived from monthlyPriceLabel so the temporary
// 100% promo (RECON/CIPHER/PHANTOM → "$0/mo") stays consistent with the public
// pricing surfaces and reverts in one place (lib/pricing.ts).
interface PlanMetaBase {
  label: string
  listMonthly: number | null
  refreshLabel: string
  priorityLabel: string | null
}

const PLAN_META_BASE: Record<string, PlanMetaBase> = {
  free:     { label: 'Free',     listMonthly: 0,    refreshLabel: '—',          priorityLabel: null },
  recon:    { label: 'RECON',    listMonthly: 79,   refreshLabel: 'every 6 hr', priorityLabel: 'Standard queue' },
  cipher:   { label: 'CIPHER',   listMonthly: 249,  refreshLabel: 'every 3 hr', priorityLabel: 'Priority queue' },
  phantom:  { label: 'PHANTOM',  listMonthly: 699,  refreshLabel: 'every 2 hr', priorityLabel: 'High priority' },
  predator: { label: 'PREDATOR', listMonthly: 1799, refreshLabel: 'every 1 hr', priorityLabel: 'Top priority' },
  eclipse:  { label: 'ECLIPSE',  listMonthly: null, refreshLabel: '5–15 min',   priorityLabel: 'Dedicated workers' },
}

function withPriceLabel(plan: string, base: PlanMetaBase): PlanMeta {
  // The free plan shows "$0" (not "$0/mo"); priced/custom plans go through the
  // promo-aware label so the discount reflects everywhere at once.
  const priceLabel = base.listMonthly === 0 ? '$0' : monthlyPriceLabel(plan, base.listMonthly)
  return { ...base, priceLabel }
}

export const PLAN_META: Record<string, PlanMeta> = Object.fromEntries(
  Object.entries(PLAN_META_BASE).map(([plan, base]) => [plan, withPriceLabel(plan, base)]),
)

export function planMeta(plan: string): PlanMeta {
  return PLAN_META[plan] ?? { label: plan.toUpperCase(), listMonthly: null, priceLabel: '', refreshLabel: '—', priorityLabel: null }
}
