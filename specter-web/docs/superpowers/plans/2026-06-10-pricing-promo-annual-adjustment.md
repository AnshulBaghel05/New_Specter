# Pricing Promo + Annual-Discount Adjustment — Implementation Plan

**Date:** 2026-06-10
**Goal:** Apply a *temporary, easily-removable* 100% promo to RECON/CIPHER/PHANTOM, change the annual discount 20%→15%, and exclude PREDATOR + ECLIPSE from any annual discount — **without** altering pricing architecture, plan hierarchy, feature allocation, layout, conversion strategy, or billing/monetization logic.

## Verified current state (pre-change)

- **Backend holds no dollar amounts.** `services/billing.py` maps `(plan, cadence) → Razorpay plan ID` via env vars; real monthly *and* annual prices live in the Razorpay dashboard. Subscribe always creates a Razorpay subscription; the webhook elevates the plan on charge. **No pricing API** serves the frontend.
- **Prices are display-only in code**, hardcoded in: `app/(marketing)/pricing/page.tsx`, `components/marketing/pricing-section.tsx` (both `discounted()=monthly*0.8`, "−20%"), and `lib/dashboard/plan-meta.ts`.
- `cost_model.py _PLAN_REVENUE` (79/249/699/1799) drives margin modeling; asserted in `test_cost_model.py`.
- `docs/PRICING.md` line 36 currently grants the annual discount to "RECON, CIPHER, PHANTOM, **PREDATOR**" — must drop PREDATOR.

## Locked decisions

1. **100% promo = display-only.** One removable config flag drives `$0` display; the real $0 charge is a Razorpay-dashboard 100%-off offer / $0 promo plan IDs (runbook below). **No billing-code change.**
2. **Keep list revenue** in `cost_model._PLAN_REVENUE` (margin baseline unpolluted) — backend untouched, no test change there.
3. **Display:** `$0/mo` + struck original + "Limited-time 100% off" badge on the three promo plans.

## Architecture

A single source of truth — `lib/pricing.ts` — drives every display surface, so the whole promo flips off in one line. Billing stays Razorpay-driven and is never touched.

### Files

- **Create `specter-web/lib/pricing.ts`** — promo set, annual rate, exclusions, pure `priceDisplay()` / `monthlyPriceLabel()` helpers.
- **Create `specter-web/lib/pricing.test.ts`** — pure-logic unit tests (TDD).
- **Modify `specter-web/app/(marketing)/pricing/page.tsx`** — `priceDisplay()`; `$0`+strike+badge; toggle "−15%"; annual FAQ; footer strip.
- **Modify `specter-web/components/marketing/pricing-section.tsx`** — same display logic; toggle "−15%".
- **Modify `specter-web/lib/dashboard/plan-meta.ts`** + **`plan-meta.test.ts`** — promo-aware `priceLabel`.
- **Modify `docs/PRICING.md`** — annual 15% (RECON/CIPHER/PHANTOM only; PREDATOR & ECLIPSE none); temporary-promo section + removal + Razorpay runbook.
- **Modify `docs/MONETIZATION.md`** — pricing copy consistency.
- **No backend changes.** `services/billing.py`, `routers/billing.py`, `cost_model.py`, seeds, migrations, plan_gate: untouched.

---

### Task 1: Shared pricing module (TDD)

**Files:** Create `lib/pricing.ts`, `lib/pricing.test.ts`.

- [ ] **Step 1 — failing test** `lib/pricing.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  priceDisplay, monthlyPriceLabel, isPromoFree, annualDiscountApplies,
  ANNUAL_DISCOUNT_PCT, PROMO_FREE_PLANS,
} from './pricing'

describe('promo membership', () => {
  it('RECON/CIPHER/PHANTOM are 100% off, others are not', () => {
    expect(isPromoFree('recon')).toBe(true)
    expect(isPromoFree('CIPHER')).toBe(true)
    expect(isPromoFree('phantom')).toBe(true)
    expect(isPromoFree('predator')).toBe(false)
    expect(isPromoFree('eclipse')).toBe(false)
    expect(PROMO_FREE_PLANS).toEqual(['recon', 'cipher', 'phantom'])
  })
})

describe('annual discount eligibility', () => {
  it('applies to everything except PREDATOR and ECLIPSE', () => {
    expect(annualDiscountApplies('recon')).toBe(true)
    expect(annualDiscountApplies('phantom')).toBe(true)
    expect(annualDiscountApplies('predator')).toBe(false)
    expect(annualDiscountApplies('eclipse')).toBe(false)
    expect(ANNUAL_DISCOUNT_PCT).toBe(15)
  })
})

describe('priceDisplay', () => {
  it('promo plan shows $0 with the list price struck (monthly + annual)', () => {
    expect(priceDisplay('recon', 79, false)).toEqual({ now: 0, was: 79, promoFree: true })
    expect(priceDisplay('recon', 79, true)).toEqual({ now: 0, was: 79, promoFree: true })
  })
  it('PREDATOR has NO annual discount — same price either cadence, no strike', () => {
    expect(priceDisplay('predator', 1799, false)).toEqual({ now: 1799, was: null, promoFree: false })
    expect(priceDisplay('predator', 1799, true)).toEqual({ now: 1799, was: null, promoFree: false })
  })
  it('ECLIPSE (custom) has no numeric price', () => {
    expect(priceDisplay('eclipse', null, true)).toEqual({ now: null, was: null, promoFree: false })
  })
  it('a non-promo eligible plan gets 15% off annually with the monthly struck', () => {
    // Use a non-promo eligible plan to isolate the annual path from the promo.
    expect(priceDisplay('vanguard', 200, true)).toEqual({ now: 170, was: 200, promoFree: false })
    expect(priceDisplay('vanguard', 200, false)).toEqual({ now: 200, was: null, promoFree: false })
  })
})

describe('monthlyPriceLabel', () => {
  it('promo plans read $0/mo; others their list price; null is Custom', () => {
    expect(monthlyPriceLabel('recon', 79)).toBe('$0/mo')
    expect(monthlyPriceLabel('predator', 1799)).toBe('$1,799/mo')
    expect(monthlyPriceLabel('eclipse', null)).toBe('Custom')
  })
})
```

- [ ] **Step 2 — run, expect FAIL** (`vitest run lib/pricing.test.ts`).

- [ ] **Step 3 — implement `lib/pricing.ts`:**

```typescript
/**
 * SPECTER pricing PROMO + annual-discount display config — the single source of
 * truth for what prices the UI *shows*. Billing is Razorpay-driven (plan IDs);
 * this module never charges. It only computes display.
 *
 * ── TEMPORARY 100% PROMO (RECON / CIPHER / PHANTOM) ──
 * To END the promo: set PROMO_FREE_PLANS = [] (one line) — every surface reverts
 * to list pricing automatically. Then revert the Razorpay 100%-off offer / promo
 * plan IDs (see docs/PRICING.md "Temporary promo runbook").
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
```

- [ ] **Step 4 — run, expect PASS.**
- [ ] **Step 5 — commit** (`feat(pricing): shared promo + annual-discount display module`).

---

### Task 2: Full pricing page

**File:** `app/(marketing)/pricing/page.tsx`.

- [ ] Replace the local `discounted()` with `priceDisplay` from `@/lib/pricing`; import `PROMO_BADGE`, `ANNUAL_DISCOUNT_PCT`.
- [ ] In `TierCard`, compute `const pd = priceDisplay(tier.name, tier.monthly, annual)`. Render:
  - numeric price → `${pd.now}` (so promo shows `$0`);
  - when `pd.was !== null` → struck `${pd.was}/mo`;
  - when `pd.promoFree` → a small badge using `PROMO_BADGE` (reuse the existing badge styling block; don't change layout).
- [ ] Toggle label `−20%` → `−{ANNUAL_DISCOUNT_PCT}%`.
- [ ] FAQ "How does the … annual discount work?" → "15% … on RECON, CIPHER, and PHANTOM. PREDATOR and ECLIPSE are billed at the same rate monthly or annually." (drop the 20%/PREDATOR claim).
- [ ] Footer price strip line → reflect promo (e.g. "RECON, CIPHER & PHANTOM free for a limited time · PREDATOR $1,799/mo · ECLIPSE custom").
- [ ] `tsc --noEmit` + `next lint` clean. Commit.

---

### Task 3: Homepage pricing section

**File:** `components/marketing/pricing-section.tsx`.

- [ ] Same swap: `priceDisplay` for the inline `discounted()`; `$0`+strike+`PROMO_BADGE`; toggle `−{ANNUAL_DISCOUNT_PCT}%`. Keep layout + CTAs untouched.
- [ ] `tsc` + lint. Commit.

---

### Task 4: Dashboard settings price label

**Files:** `lib/dashboard/plan-meta.ts`, `lib/dashboard/plan-meta.test.ts`.

- [ ] Add a per-plan `listMonthly` to `PLAN_META` (recon 79, cipher 249, phantom 699, predator 1799, free 0, eclipse null) and derive `priceLabel` via `monthlyPriceLabel(plan, listMonthly)` so promo plans read `$0/mo`. Keep all other fields + the public shape identical.
- [ ] Update `plan-meta.test.ts`: recon `priceLabel` now `$0/mo`; add a PREDATOR assertion (`$1,799/mo`) and an ECLIPSE `Custom` assertion; keep the key-coverage + fallback tests.
- [ ] `vitest run lib/dashboard/plan-meta.test.ts` green. Commit.

---

### Task 5: Documentation

**Files:** `docs/PRICING.md`, `docs/MONETIZATION.md`.

- [ ] `PRICING.md`: change the annual-discount line to **15% on RECON, CIPHER, PHANTOM only; PREDATOR & ECLIPSE have no annual discount (annual = 12× monthly)**. Add a clearly-marked **"Temporary promotion"** subsection: RECON/CIPHER/PHANTOM are 100% off for a limited time; list pricing and plan structure are unchanged; **removal runbook** = empty `PROMO_FREE_PLANS` in `specter-web/lib/pricing.ts` + revert the Razorpay 100%-off offer / restore the standard `RAZORPAY_PLAN_*` plan IDs.
- [ ] Add a **Razorpay runbook** note: to make the promo real, apply a 100%-off offer (or point the `RAZORPAY_PLAN_RECON/CIPHER/PHANTOM_*` env vars at $0 promo plans); set the `_ANNUAL` plan amounts to 15% off for RECON/CIPHER/PHANTOM and to 12× monthly for PREDATOR.
- [ ] `MONETIZATION.md`: update any "20%"/annual or starting-price copy for consistency.
- [ ] Commit.

---

### Task 6: Verification sweep

- [ ] `cd specter-web && node node_modules/typescript/bin/tsc --noEmit` → exit 0.
- [ ] `node node_modules/vitest/vitest.mjs run lib/pricing.test.ts lib/dashboard/plan-meta.test.ts` → green.
- [ ] `npx next lint --file app/(marketing)/pricing/page.tsx --file components/marketing/pricing-section.tsx --file lib/pricing.ts --file lib/dashboard/plan-meta.ts` → clean.
- [ ] `npm run build` → compiles; `/pricing` static.
- [ ] Serve build, confirm: RECON/CIPHER/PHANTOM show `$0/mo` + struck list + promo badge; toggle reads −15%; on annual, PREDATOR stays `$1,799` with no strike; ECLIPSE `Custom`.
- [ ] (Backend untouched — optional) `pytest -q` still 337.

## Out of scope / unchanged (guardrails)

Plan hierarchy, feature lists, card order/layout, CTA wiring (incl. the PREDATOR/ECLIPSE contact modal shipped earlier), `services/billing.py`, `routers/billing.py`, `auth/plan_gate.py`, `cost_model._PLAN_REVENUE`, DB models/migrations, seed data. The promo is additive and reverts via one array.
