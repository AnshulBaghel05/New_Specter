/**
 * Shared BullMQ worker reliability options.
 *
 * Without these, a worker pod that crashes mid-job leaves the job "active"
 * forever (the price is never scraped, the cycle never completes). With a bounded
 * lock + stalled detection, BullMQ reclaims a crashed pod's jobs and retries them:
 *
 *   - lockDuration   — how long a job's lock is held before it's eligible to be
 *                      considered stalled. Must exceed the slowest fetch
 *                      (Playwright + CAPTCHA can run ~60s), so set generously.
 *   - stalledInterval— how often the worker scans for stalled jobs.
 *   - maxStalledCount— how many times a job may be reclaimed before it is failed
 *                      (and dead-lettered) instead of looping forever.
 */
export const WORKER_RELIABILITY = {
  lockDuration: 90_000, // 90s — longer than the slowest (Playwright) fetch
  stalledInterval: 30_000, // scan for stalled jobs every 30s
  maxStalledCount: 2, // reclaim at most twice, then fail → dead-letter
} as const
