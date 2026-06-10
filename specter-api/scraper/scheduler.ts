import 'dotenv/config'
import { redis } from './redis'
import {
  probeQueue,
  httpQueue,
  playwrightQueue,
  ALL_QUEUES,
} from './queue'
import type { Plan, ScrapeJob } from './types'

// Plan priority + intervals live in the side-effect-free ./plans module so TTL
// helpers can use them without importing this entrypoint's live connections.
// Re-exported here so existing `from '../scheduler'` imports keep working.
export { PLAN_PRIORITY, PLAN_INTERVALS } from './plans'
import { PLAN_PRIORITY, PLAN_INTERVALS, computeAdaptiveInterval } from './plans'
import { getUnchangedStreak } from './state-ttl'

// ── Queue selection by domain classification ──────────────────────────────────

function selectQueue(classRaw: string | null): typeof probeQueue {
  switch (classRaw) {
    case 'http_ok':     return httpQueue
    case 'js_required': return playwrightQueue
    default:            return probeQueue  // null (UNKNOWN) → probe to classify
  }
}

// ── Core dispatch: route + domain batching ────────────────────────────────────

/**
 * Dispatch a scrape job with classification-based routing and domain batching.
 *
 * 1. Reads `domain:class:{domain}` from Redis.
 * 2. If BLOCKED — returns null, no job created.
 * 3. Checks `scrape:lock:{domain}:{urlPath}` for an in-flight job.
 *    - Lock exists  → merge competitorTrackingIds into the existing job (no new job).
 *    - Lock absent  → create job in the correct queue + set lock with TTL = plan interval.
 *
 * @param job              - The scrape job payload to dispatch.
 * @param eclipseIntervalMs - Override for ECLIPSE plan interval (merchant-configured).
 */
export async function dispatchScrapeJob(
  job: ScrapeJob,
  eclipseIntervalMs = PLAN_INTERVALS.ECLIPSE,
): Promise<{ jobId: string; batched: boolean } | null> {
  const planKey = job.plan.toUpperCase()
  const priority = PLAN_PRIORITY[planKey] ?? PLAN_PRIORITY.RECON

  // ── 1. Domain classification lookup ─────────────────────────────────────────
  const classRaw = await redis.get(`domain:class:${job.domain}`)
  if (classRaw === 'blocked') return null

  const queue = selectQueue(classRaw)

  // ── 2. Domain batching lock ──────────────────────────────────────────────────
  const lockKey = `scrape:lock:${job.domain}:${job.urlPath}`
  const existingJobId = await redis.get(lockKey)

  if (existingJobId) {
    // Lock exists — add competitorTrackingIds to the in-flight job rather than creating
    // a second outbound request to the same URL.
    const existingJob = await queue.getJob(existingJobId)
    if (existingJob) {
      const merged = [
        ...new Set([...existingJob.data.competitorTrackingIds, ...job.competitorTrackingIds]),
      ]
      await existingJob.updateData({ ...existingJob.data, competitorTrackingIds: merged })
    }
    return { jobId: existingJobId, batched: true }
  }

  // ── 3. No lock — create new job and set lock ─────────────────────────────────
  const newJob = await queue.add(`${job.domain}:${job.urlPath}`, job, { priority })
  // Lock TTL = the URL's ADAPTIVE interval: a stable URL (high unchanged-streak)
  // backs off toward its plan cap, so re-dispatches inside that window are batched
  // away instead of triggering a fresh fetch. A price/stock change resets the
  // streak elsewhere, snapping the next lock straight back to the plan floor.
  const streak = await getUnchangedStreak(redis, job.domain, job.urlPath)
  const intervalMs = computeAdaptiveInterval(planKey, streak, eclipseIntervalMs)
  await redis.set(lockKey, newJob.id!, 'PX', intervalMs)

  return { jobId: newJob.id!, batched: false }
}

// ── Repeat job scheduling ─────────────────────────────────────────────────────

/**
 * Register BullMQ repeat jobs for a set of competitor URLs under a given plan.
 *
 * Each URL gets a recurring job in the queue that matches its current domain
 * classification. The repeat fires at the plan's interval. Once a domain is
 * reclassified by the probe worker, subsequent calls to this function (or a
 * re-schedule on classification change) update the queue assignment.
 *
 * @param plan             - Merchant plan tier.
 * @param entries          - URLs to schedule.
 * @param eclipseIntervalMs - Override for ECLIPSE plan interval.
 */
export async function scheduleRepeatJobs(
  plan: Plan,
  entries: Array<Pick<ScrapeJob, 'url' | 'domain' | 'urlPath' | 'competitorTrackingIds'>>,
  eclipseIntervalMs = PLAN_INTERVALS.ECLIPSE,
): Promise<void> {
  const planKey = plan.toUpperCase()
  const priority = PLAN_PRIORITY[planKey] ?? PLAN_PRIORITY.RECON

  for (const entry of entries) {
    // Skip blocked domains — merchant has already been notified.
    const classRaw = await redis.get(`domain:class:${entry.domain}`)
    if (classRaw === 'blocked') continue

    const queue = selectQueue(classRaw)
    const jobData: ScrapeJob = { ...entry, plan }

    // Adaptive repeat interval: re-registering a stable URL (read its current
    // unchanged-streak) widens the cadence toward the plan cap; a URL that just
    // changed re-registers at the plan floor. Never faster than the plan.
    const streak = await getUnchangedStreak(redis, entry.domain, entry.urlPath)
    const everyMs = computeAdaptiveInterval(planKey, streak, eclipseIntervalMs)

    // Use a stable jobId so BullMQ deduplicates on re-schedule:
    // if the same domain:urlPath is re-registered under the same plan, BullMQ
    // updates the repeat rather than adding a second copy.
    await queue.add(
      `${entry.domain}:${entry.urlPath}`,
      jobData,
      {
        priority,
        repeat: { every: everyMs },
        jobId: `repeat:${plan}:${entry.domain}:${entry.urlPath}`,
      },
    )
  }
}

// ── Startup ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('[scheduler] SPECTER scrape scheduler starting…')

  // Verify all 6 queues are reachable and log current counts.
  // Order must match ALL_QUEUES in queue.ts.
  const names = [
    'scrape:probe',
    'scrape:http',
    'scrape:playwright',
    'captcha:solve',
    'scrape:dead-letter',
    'scrape:validation-errors',
    'scrape:ai-errors',
  ]

  console.log('[scheduler] Queue health check:')
  for (let i = 0; i < ALL_QUEUES.length; i++) {
    const counts = await ALL_QUEUES[i].getJobCounts(
      'waiting', 'active', 'completed', 'failed', 'delayed',
    )
    console.log(`  ${names[i]}:`, counts)
  }

  console.log('[scheduler] All queues healthy. Ready to accept entries.')
  console.log('[scheduler] Call scheduleRepeatJobs(plan, entries) to register recurring scrapes.')

  // Graceful shutdown: close all queue connections before exit.
  const shutdown = async (signal: string) => {
    console.log(`[scheduler] ${signal} received — closing queues…`)
    await Promise.all(ALL_QUEUES.map(q => q.close()))
    await redis.quit()
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT',  () => void shutdown('SIGINT'))
}

main().catch((err: unknown) => {
  console.error('[scheduler] Fatal:', err)
  process.exit(1)
})
