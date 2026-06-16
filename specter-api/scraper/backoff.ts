/**
 * Retry backoff ladder for scrape jobs: 1 min → 5 min → 30 min.
 *
 * Registered as the BullMQ custom backoff strategy on every worker
 * (worker-options.ts); queue jobs opt in with `backoff: { type: 'custom' }`.
 * Replaces the exponential 60s·2ⁿ curve (1/2/4 min) with this explicit ladder: a
 * flaky target gets a short first retry, then backs off hard before the final
 * attempt — so a persistently-failing URL wastes far fewer fetches on its way to
 * the dead-letter queue.
 *
 * Pure + side-effect-free so the ladder is unit-testable (like ./plans).
 */

// Indexed by (attemptsMade − 1): after the 1st failure → 1 min, 2nd → 5 min,
// 3rd → 30 min. With the default attempts:3, only the first two rungs are used
// (2 retries); the 30-min rung applies if a queue is configured for more attempts.
export const RETRY_BACKOFF_LADDER_MS = [60_000, 300_000, 1_800_000] as const

/**
 * Delay (ms) before the next retry given how many attempts have already been made.
 * BullMQ passes `attemptsMade` ≥ 1 after a failure. Clamped to the last rung so a
 * higher max-attempts config keeps backing off at 30 min rather than wrapping.
 */
export function retryBackoffDelay(attemptsMade: number): number {
  const idx = Math.min(
    Math.max(attemptsMade, 1) - 1,
    RETRY_BACKOFF_LADDER_MS.length - 1,
  )
  return RETRY_BACKOFF_LADDER_MS[idx]
}
