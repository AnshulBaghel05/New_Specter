/**
 * Atomic per-URL dispatch lock — the core of multi-tenant scrape dedup.
 *
 * Lives in its own side-effect-free module (no live Redis/Queue connections) so it
 * can be unit-tested with a tiny fake, the same way ./plans and ./state-ttl are.
 *
 * The lock guarantees that for a given `scrape:lock:{domain}:{urlPath}` exactly ONE
 * outbound fetch is created per interval — every other merchant tracking the same
 * URL is batched onto that single job. The previous implementation read the lock
 * and then set it in two separate calls; under concurrency two dispatchers could
 * both observe "no lock" and both enqueue a fetch (duplicate egress + CAPTCHA cost,
 * and a merchant silently dropped from the batch). Claiming the lock with `SET NX`
 * closes that window: the set is atomic, so only the first caller wins.
 */

/** Minimal slice of ioredis used to claim the lock (matches the live `set`/`get`). */
export interface LockRedis {
  set(
    key: string,
    value: string,
    pxToken: 'PX',
    ttlMs: number,
    nxToken: 'NX',
  ): Promise<'OK' | null>
  get(key: string): Promise<string | null>
}

export interface LockClaim {
  /** True when THIS caller acquired the lock (and must run the scrape). */
  won: boolean
  /** The jobId that now owns the lock — `candidateJobId` if we won, else the
   *  concurrent winner's id (null only if its TTL already elapsed). */
  holder: string | null
}

/**
 * Atomically claim the dispatch lock for a URL.
 *
 * @param redis          Redis client (NX semantics required).
 * @param lockKey        `scrape:lock:{domain}:{urlPath}`.
 * @param candidateJobId The job we just enqueued and want the lock to point at.
 * @param ttlMs          Lock lifetime = the URL's adaptive scrape interval.
 */
export async function claimDomainLock(
  redis: LockRedis,
  lockKey: string,
  candidateJobId: string,
  ttlMs: number,
): Promise<LockClaim> {
  const res = await redis.set(lockKey, candidateJobId, 'PX', ttlMs, 'NX')
  if (res === 'OK') {
    return { won: true, holder: candidateJobId }
  }
  // Lost the race — report who holds it now so the caller can batch onto them.
  const holder = await redis.get(lockKey)
  return { won: false, holder }
}
