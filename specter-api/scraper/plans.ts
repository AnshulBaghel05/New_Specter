/**
 * Pure plan constants (no imports with side effects), so scheduling math and
 * TTL helpers can use them without pulling in live Redis/queue connections.
 * `scheduler.ts` re-exports these for back-compat.
 */

// Higher number = processed first in BullMQ.
export const PLAN_PRIORITY: Record<string, number> = {
  ECLIPSE: 20,
  PREDATOR: 10,
  PHANTOM: 5,
  CIPHER: 3,
  RECON: 1,
}

// Plan repeat intervals in milliseconds (ECLIPSE default is merchant-configurable).
// This is the FLOOR — the fastest cadence a plan pays for. Adaptive backoff can
// only ever scrape a URL LESS often than this, never more.
export const PLAN_INTERVALS: Record<string, number> = {
  RECON: 21_600_000, // 6 hr
  CIPHER: 10_800_000, // 3 hr
  PHANTOM: 7_200_000, // 2 hr
  PREDATOR: 3_600_000, // 1 hr
  ECLIPSE: 300_000, // 5 min
}

// Maximum staleness ceiling per plan, in milliseconds. A URL whose price/stock
// stops changing backs off toward this cap but never past it — so premium plans
// stay fresher. Caps are plan-aware on purpose (24h for RECON ↓ 1h for ECLIPSE).
export const PLAN_MAX_INTERVALS: Record<string, number> = {
  RECON: 86_400_000, // 24 hr
  CIPHER: 43_200_000, // 12 hr
  PHANTOM: 28_800_000, // 8 hr
  PREDATOR: 14_400_000, // 4 hr
  ECLIPSE: 3_600_000, // 1 hr
}

// ── Adaptive change-detection scheduling ──────────────────────────────────────

/**
 * Balanced backoff multiplier for a URL's unchanged-streak (number of consecutive
 * scrapes where price + stock were identical to the previous one):
 *   streak <3 → 1× (full plan speed)   3–5 → 2×   6–8 → 4×   ≥9 → cap.
 * Returns +Infinity at saturation so the caller clamps straight to the plan cap.
 */
export function adaptiveIntervalMultiplier(streak: number): number {
  if (streak >= 9) return Number.POSITIVE_INFINITY
  if (streak >= 6) return 4
  if (streak >= 3) return 2
  return 1
}

/**
 * Effective scrape interval (ms) for a URL given its plan and unchanged-streak.
 * Clamped to [planFloor, planCap]: never faster than the paid cadence, never
 * slower than the plan's staleness ceiling. A price/stock change resets the
 * streak to 0 elsewhere, which snaps this straight back to the floor.
 */
export function computeAdaptiveInterval(
  plan: string,
  streak: number,
  eclipseIntervalMs: number = PLAN_INTERVALS.ECLIPSE,
): number {
  const planKey = plan.toUpperCase()
  const floor = planKey === 'ECLIPSE'
    ? eclipseIntervalMs
    : (PLAN_INTERVALS[planKey] ?? PLAN_INTERVALS.RECON)
  const capBase = planKey === 'ECLIPSE'
    ? PLAN_MAX_INTERVALS.ECLIPSE
    : (PLAN_MAX_INTERVALS[planKey] ?? PLAN_MAX_INTERVALS.RECON)
  // The cap can never fall below the paid floor (e.g. a merchant who configures
  // ECLIPSE slower than the 1h cap simply gets no backoff).
  const cap = Math.max(capBase, floor)
  return Math.min(floor * adaptiveIntervalMultiplier(streak), cap)
}
