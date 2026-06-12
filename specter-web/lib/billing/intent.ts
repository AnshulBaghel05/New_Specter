/**
 * Billing intent preservation.
 *
 * A logged-out visitor who clicks "Buy" / "Start trial" on /pricing must not
 * lose that choice through the Supabase email-confirm round-trip. We stash a
 * tiny intent in localStorage, send them to /sign-up, and resume it ONCE on the
 * first authenticated dashboard load (see hooks/use-resume-intent.ts).
 *
 * Pure module — no React, no network — so it is unit-testable in isolation.
 */
export type BillingAction = 'trial' | 'buy'
export type BillingCadence = 'monthly' | 'annual'

export interface BillingIntent {
  action: BillingAction
  plan: string
  cadence: BillingCadence
  ts: number
}

const KEY = 'specter.billing_intent'
const TTL_MS = 60 * 60 * 1000 // 1 hour — a stale intent must never auto-charge

export function saveIntent(intent: Omit<BillingIntent, 'ts'>): void {
  if (typeof localStorage === 'undefined') return
  const withTs: BillingIntent = { ...intent, ts: Date.now() }
  try {
    localStorage.setItem(KEY, JSON.stringify(withTs))
  } catch {
    /* storage full / disabled — intent is best-effort */
  }
}

export function readIntent(): BillingIntent | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as BillingIntent
    if (parsed && (parsed.action === 'trial' || parsed.action === 'buy') && typeof parsed.ts === 'number') {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function clearIntent(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(KEY)
}

export function isFresh(intent: BillingIntent, now: number = Date.now()): boolean {
  return now - intent.ts <= TTL_MS
}
