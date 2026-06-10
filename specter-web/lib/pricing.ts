/**
 * SPECTER pricing PROMO + annual-discount display config — the single source of
 * truth for what prices the UI *shows*. Billing is Razorpay-driven (plan IDs);
 * this module never charges. It only computes display.
 *
 * ── TEMPORARY 100% PROMO (RECON / CIPHER / PHANTOM) ──
 * To END the promo: set PROMO_FREE_PLANS = [] (one line) — every surface reverts
 * to list pricing automatically. Then revert the Razorpay 100%-off offer / promo
 * plan IDs (see docs/PRICING.md "Temporary promotion runbook").
 */

/** Plans currently displayed at 100% off. Empty this array to end the promo. */
export const PROMO_FREE_PLANS: readonly string[] = ['recon', 'cipher', 'phantom']

/** Badge shown on promo cards. */
export const PROMO_BADGE = 'Limited-time 100% off'

/** Annual billing discount as a fraction of the monthly rate. */
export const ANNUAL_DISCOUNT = 0.15
export const ANNUAL_DISCOUNT_PCT = Math.round(ANNUAL_DISCOUNT * 100) // 15

/** Plans excluded from any annual discount — annual equals 12× monthly. */
export const NO_ANNUAL_DISCOUNT_PLANS: readonly string[] = ['predator', 'eclipse']

export function isPromoFree(plan: string): boolean {
  return PROMO_FREE_PLANS.includes(plan.toLowerCase())
}

export function annualDiscountApplies(plan: string): boolean {
  return !NO_ANNUAL_DISCOUNT_PLANS.includes(plan.toLowerCase())
}

export interface PriceDisplay {
  /** Effective monthly price to show, or null for a custom (ECLIPSE) plan. */
  now: number | null
  /** List monthly to strike through, or null when nothing is discounted. */
  was: number | null
  /** True when the 100% promo zeroes this plan. */
  promoFree: boolean
}

/**
 * What to show for `plan` at the given cadence. Promo (100% off) dominates;
 * otherwise the annual discount applies to eligible plans only. `listMonthly`
 * null → custom plan (no number, no discount).
 */
export function priceDisplay(plan: string, listMonthly: number | null, annual: boolean): PriceDisplay {
  if (listMonthly === null) return { now: null, was: null, promoFree: false }
  if (isPromoFree(plan)) return { now: 0, was: listMonthly, promoFree: true }
  if (annual && annualDiscountApplies(plan)) {
    return { now: Math.round(listMonthly * (1 - ANNUAL_DISCOUNT)), was: listMonthly, promoFree: false }
  }
  return { now: listMonthly, was: null, promoFree: false }
}

/** Promo-aware monthly label for compact surfaces (dashboard settings). */
export function monthlyPriceLabel(plan: string, listMonthly: number | null): string {
  if (listMonthly === null) return 'Custom'
  if (isPromoFree(plan)) return '$0/mo'
  return `$${listMonthly.toLocaleString()}/mo`
}
