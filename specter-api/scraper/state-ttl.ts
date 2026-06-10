/**
 * TTLs for ephemeral state keys, so the state Redis self-heals instead of
 * accumulating stale keys forever (it runs `allkeys-lru` in production, but
 * explicit TTLs are correctness, not just memory hygiene):
 *
 *   - `last-price:{domain}:{path}` — used for next-scrape spike detection.
 *     Must outlive the gap to the next scrape, so TTL = 2× the plan interval.
 *     Without a TTL, a delisted URL's price lingers and skews future deltas.
 *   - `domain:class:{domain}` — cached fetch-tier classification. A 7-day TTL
 *     makes reclassification self-healing: a site that adds/removes JS
 *     requirements is re-probed within a week instead of being pinned forever.
 */
import { PLAN_INTERVALS, PLAN_MAX_INTERVALS } from './plans'

export const DOMAIN_CLASS_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

// Minimal slice of ioredis we use — lets helpers be tested with a tiny fake.
export interface TtlRedis {
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>
}

// Richer slice for the unchanged-streak counter (needs get/incr/expire too).
export interface StreakRedis {
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<unknown>
}

/** last-price TTL = 2× the plan's scrape interval, in whole seconds. */
export function lastPriceTtlSeconds(plan: string): number {
  const intervalMs = PLAN_INTERVALS[plan.toUpperCase()] ?? PLAN_INTERVALS.RECON
  return Math.ceil((intervalMs * 2) / 1000)
}

export async function cacheLastPrice(
  redis: TtlRedis,
  domain: string,
  urlPath: string,
  price: number,
  plan: string,
): Promise<void> {
  await redis.set(
    `last-price:${domain}:${urlPath}`,
    String(price),
    'EX',
    lastPriceTtlSeconds(plan),
  )
}

export async function cacheDomainClass(
  redis: TtlRedis,
  domain: string,
  classification: string,
): Promise<void> {
  await redis.set(
    `domain:class:${domain}`,
    classification,
    'EX',
    DOMAIN_CLASS_TTL_SECONDS,
  )
}

// ── Unchanged-streak counter (adaptive change-detection scheduling) ────────────
// Tracks how many consecutive scrapes saw an identical price + stock for a URL.
// The scheduler reads this to back a stable URL off toward its plan cap; any
// change resets it so the next schedule snaps straight back to the plan floor.

const streakKey = (domain: string, urlPath: string): string => `scrape:streak:${domain}:${urlPath}`
const obsKey    = (domain: string, urlPath: string): string => `scrape:obs:${domain}:${urlPath}`

/** Streak-key TTL = 2× the plan's max interval, so the key outlives the longest
 *  possible backoff gap (a delisted URL's streak then self-expires). */
export function streakTtlSeconds(plan: string, eclipseIntervalMs: number = PLAN_INTERVALS.ECLIPSE): number {
  const planKey = plan.toUpperCase()
  const capMs = planKey === 'ECLIPSE'
    ? Math.max(PLAN_MAX_INTERVALS.ECLIPSE, eclipseIntervalMs)
    : (PLAN_MAX_INTERVALS[planKey] ?? PLAN_MAX_INTERVALS.RECON)
  return Math.ceil((capMs * 2) / 1000)
}

/**
 * Record one price/stock observation and return the resulting unchanged-streak.
 * Compares a `price:stock` fingerprint to the previous one: identical → increment
 * the streak; different (or first sighting) → reset to 0. Both keys carry a TTL so
 * they self-heal. Call this once per successful snapshot (right where the worker
 * already caches the last price).
 */
export async function recordPriceObservation(
  redis: StreakRedis,
  domain: string,
  urlPath: string,
  price: number,
  inStock: boolean,
  plan: string,
  eclipseIntervalMs: number = PLAN_INTERVALS.ECLIPSE,
): Promise<number> {
  const ttl = streakTtlSeconds(plan, eclipseIntervalMs)
  const fingerprint = `${price}:${inStock ? 1 : 0}`
  const sKey = streakKey(domain, urlPath)
  const oKey = obsKey(domain, urlPath)

  const prev = await redis.get(oKey)
  if (prev === fingerprint) {
    const streak = await redis.incr(sKey)
    await redis.expire(sKey, ttl)
    await redis.expire(oKey, ttl)
    return streak
  }
  // First sighting or a price/stock change — reset the streak.
  await redis.set(sKey, '0', 'EX', ttl)
  await redis.set(oKey, fingerprint, 'EX', ttl)
  return 0
}

/** Current unchanged-streak for a URL (0 when none recorded yet). */
export async function getUnchangedStreak(
  redis: Pick<StreakRedis, 'get'>,
  domain: string,
  urlPath: string,
): Promise<number> {
  const v = await redis.get(streakKey(domain, urlPath))
  const n = v !== null ? parseInt(v, 10) : 0
  return Number.isNaN(n) ? 0 : n
}
