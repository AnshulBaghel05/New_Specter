/**
 * Pure Redis connection config — no live connections, so it is unit-testable.
 *
 * SPECTER runs (at least) two logical Redis roles:
 *   - **broker**  — BullMQ queues/workers (durable job stream).
 *   - **state**   — rate-limit buckets, locks, domain:class, cycle counters,
 *                   proxy health (ephemeral; wants `maxmemory-policy allkeys-lru`).
 *
 * In production these are separate instances (`BROKER_REDIS_URL`,
 * `STATE_REDIS_URL`) so a flood of state churn can't evict queued jobs and a
 * broker restart can't drop rate-limit state. Locally both default to the one
 * `UPSTASH_REDIS_URL`, so nothing extra is needed to run.
 */
export type EnvLike = Record<string, string | undefined>

export interface RedisOptions {
  host: string
  port: number
  username: string
  password: string
  tls: Record<string, never> | undefined
  maxRetriesPerRequest: null
  enableReadyCheck: false
}

function pick(env: EnvLike, primary: string): string {
  const url = env[primary] || env.UPSTASH_REDIS_URL
  if (!url) {
    throw new Error(
      `Redis URL missing: set ${primary} or UPSTASH_REDIS_URL`,
    )
  }
  return url
}

/** URL for the BullMQ broker (jobs). */
export function resolveBrokerUrl(env: EnvLike): string {
  return pick(env, 'BROKER_REDIS_URL')
}

/** URL for the ephemeral state store (rate-limit, locks, cycle counters, proxy health). */
export function resolveStateUrl(env: EnvLike): string {
  return pick(env, 'STATE_REDIS_URL')
}

/**
 * Parse a redis(s):// URL into ioredis/BullMQ connection options.
 * - rediss:// → TLS on (Upstash); redis:// → TLS off.
 * - password is URL-decoded (passwords/tokens may contain reserved chars).
 * - maxRetriesPerRequest:null + enableReadyCheck:false are required by BullMQ
 *   and by Upstash's serverless connection reset behaviour, respectively.
 */
export function redisOptionsFromUrl(rawUrl: string): RedisOptions {
  const parsed = new URL(rawUrl)
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    username: parsed.username || 'default',
    password: decodeURIComponent(parsed.password),
    tls: parsed.protocol === 'rediss:' ? ({} as Record<string, never>) : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  }
}
