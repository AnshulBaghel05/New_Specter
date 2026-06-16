/**
 * Per-job batched-trackingId set — closes the read-modify-write race in the
 * dispatcher's batching path.
 *
 * When several merchants dispatch the SAME url inside one lock window, the extra
 * competitorTrackingIds are accumulated in a Redis SET (`scrape:batch:{jobId}`)
 * with atomic SADD, instead of being merged into the BullMQ job's data via a
 * read-modify-write (`getJob` → `updateData`) where two concurrent merges could
 * clobber each other and drop a tracker. The worker UNIONS the job's own ids with
 * the set when it runs.
 *
 * Read is non-destructive (no DEL): a job can be re-delivered (moveToDelayed on
 * rate-limit / 429 / proxy-exhaustion) and must still see the batched ids on the
 * re-run, so the set self-expires via TTL rather than being drained on first read.
 *
 * Side-effect-free (no live Redis): unit-testable with a tiny fake, like ./plans
 * and ./state-ttl.
 */

/** Minimal slice of ioredis used here (atomic SADD + TTL + read). */
export interface BatchSetRedis {
  sadd(key: string, ...members: string[]): Promise<number>
  pexpire(key: string, ms: number): Promise<number>
  smembers(key: string): Promise<string[]>
}

export const batchSetKey = (jobId: string): string => `scrape:batch:${jobId}`

// The set only needs to outlive the gap between dispatch and the worker reading
// it. Generous and self-expiring, so a dropped job's set never lingers.
export const BATCH_SET_TTL_MS = 30 * 60_000 // 30 minutes

/** Atomically add batched trackingIds to a job's set (a no-op for an empty list). */
export async function addToBatch(
  redis: BatchSetRedis,
  jobId: string,
  trackingIds: readonly string[],
  ttlMs: number = BATCH_SET_TTL_MS,
): Promise<void> {
  if (trackingIds.length === 0) return
  const key = batchSetKey(jobId)
  await redis.sadd(key, ...trackingIds)
  await redis.pexpire(key, ttlMs)
}

/**
 * Union a job's own trackingIds with any batched onto it. Order-stable, de-duped.
 * Non-destructive so a re-delivered job still sees them.
 */
export async function unionBatchedTrackingIds(
  redis: BatchSetRedis,
  jobId: string,
  baseIds: readonly string[],
): Promise<string[]> {
  const extra = await redis.smembers(batchSetKey(jobId))
  if (extra.length === 0) return [...baseIds]
  return [...new Set([...baseIds, ...extra])]
}
