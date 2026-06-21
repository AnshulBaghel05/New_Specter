/**
 * Pure plan-change classification for the in-dashboard "Change plan" overlay.
 *
 * Given the merchant's current plan, decide for each paid tier whether it is the
 * current plan, a self-serve upgrade/downgrade (handled in-app via Razorpay), or a
 * sales-led tier that routes to contact. Self-serve tiers mirror specter-api's
 * billing rules; PREDATOR/ECLIPSE are sales-led (see settings/billing-card).
 */
export type PlanAction = 'current' | 'upgrade' | 'downgrade' | 'contact'

export interface PlanOption {
  plan: string
  action: PlanAction
}

// Ascending plan order (also the billing hierarchy). Keep in sync with
// specter-api PLAN_HIERARCHY and settings/billing-card ORDER.
export const PLAN_ORDER = ['free', 'recon', 'cipher', 'phantom', 'predator', 'eclipse'] as const

// Tiers a merchant can switch between without sales involvement.
export const SELF_SERVE_PLANS = ['recon', 'cipher', 'phantom'] as const

// Paid tiers shown as cards in the overlay (free is the implicit base, never a card).
const PAID_TIERS = ['recon', 'cipher', 'phantom', 'predator', 'eclipse'] as const

export function planChangeOptions(current: string): PlanOption[] {
  const ci = PLAN_ORDER.indexOf(current as (typeof PLAN_ORDER)[number])
  return PAID_TIERS.map((plan) => {
    if (plan === current) return { plan, action: 'current' as const }
    if (!SELF_SERVE_PLANS.includes(plan as (typeof SELF_SERVE_PLANS)[number])) {
      return { plan, action: 'contact' as const }
    }
    const pi = PLAN_ORDER.indexOf(plan)
    return { plan, action: pi > ci ? ('upgrade' as const) : ('downgrade' as const) }
  })
}
