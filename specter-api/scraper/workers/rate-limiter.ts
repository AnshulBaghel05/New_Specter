import type { Redis } from 'ioredis'

// ── Default rate limits (requests per 60-second window) ───────────────────────

const AMAZON_LIMIT   = 6
const FLIPKART_LIMIT = 10
const SHOPIFY_LIMIT  = 30
const DEFAULT_LIMIT  = 20

const WINDOW_MS = 60_000  // token-refill window

// Per-domain ceiling on *simultaneous* in-flight requests — the concurrency
// lease, distinct from the per-window rate. A hard cap on parallelism is the
// other half of ban defense alongside rate limiting and even spreading.
const AMAZON_CONCURRENCY  = 2
const SHOPIFY_CONCURRENCY = 8
const DEFAULT_CONCURRENCY = 5
const CONCURRENCY_TTL_MS  = 120_000  // self-heal a leaked slot after 2 minutes

function defaultLimit(domain: string): number {
  if (/amazon\./i.test(domain))       return AMAZON_LIMIT
  if (/flipkart\.com/i.test(domain))  return FLIPKART_LIMIT
  if (/myshopify\.com/i.test(domain)) return SHOPIFY_LIMIT
  return DEFAULT_LIMIT
}

function defaultConcurrency(domain: string): number {
  if (/amazon\./i.test(domain))       return AMAZON_CONCURRENCY
  if (/myshopify\.com/i.test(domain)) return SHOPIFY_CONCURRENCY
  return DEFAULT_CONCURRENCY
}

// ── Result + bucket types ─────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed:      boolean
  /** Milliseconds to wait before a token is available. 0 when allowed. */
  retryAfterMs: number
}

export interface BucketState {
  tokens: number
  ts:     number
}

export interface TokenDecision extends RateLimitResult {
  /** Bucket state to persist for the next evaluation (what the Lua HMSETs). */
  tokens: number
  ts:     number
}

// ── Pure token-bucket decision (mirrors RATE_LIMIT_LUA exactly) ───────────────

/**
 * Decide one request against a token bucket. Pure and deterministic — the Redis
 * Lua script below performs the same arithmetic atomically; this function is
 * what the unit tests pin so the algorithm can never silently drift from the
 * script. Refill is continuous: `limit` tokens regenerate per `windowMs`. A
 * request is allowed iff at least one whole token is available; otherwise the
 * caller learns how long until the next token (`retryAfterMs`).
 */
export function evaluateTokenBucket(
  state: BucketState | null,
  limit: number,
  windowMs: number,
  nowMs: number,
): TokenDecision {
  let tokens = state ? state.tokens : limit
  const lastTs = state ? state.ts : nowMs
  // Clamp to 0 so a backward clock (nowMs < lastTs) can never drain the bucket.
  const refill = Math.max(0, ((nowMs - lastTs) * limit) / windowMs)
  tokens = Math.min(limit, tokens + refill)

  if (tokens < 1) {
    const retryAfterMs = Math.ceil(((1 - tokens) * windowMs) / limit)
    return { allowed: false, retryAfterMs, tokens, ts: nowMs }
  }
  tokens = tokens - 1
  return { allowed: true, retryAfterMs: 0, tokens, ts: nowMs }
}

/** Atomic token-bucket check. KEYS[1]=bucket; ARGV=limit,window_ms,now_ms → {allowed,retryAfterMs}. */
export const RATE_LIMIT_LUA = `
local data = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
local limit = tonumber(ARGV[1])
local win = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
if tokens == nil or ts == nil then tokens = limit ; ts = now end
local refill = math.max(0, (now - ts) * limit / win)
tokens = math.min(limit, tokens + refill)
if tokens < 1 then
  redis.call('HMSET', KEYS[1], 'tokens', tokens, 'ts', now)
  redis.call('PEXPIRE', KEYS[1], win)
  return {0, math.ceil((1 - tokens) * win / limit)}
end
tokens = tokens - 1
redis.call('HMSET', KEYS[1], 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', KEYS[1], win)
return {1, 0}
`

// ── Crawl-delay (robots.txt) min-spacing ──────────────────────────────────────

/**
 * Decide one request against a robots.txt `Crawl-delay` minimum spacing. Pure
 * and deterministic — CRAWL_DELAY_LUA performs the same check atomically. A
 * request is allowed iff at least `crawlDelayMs` has elapsed since the last
 * allowed request to the domain (or there was none). This is *spacing*, not a
 * rate window: it caps how *close together* two hits land, honoring the target's
 * stated politeness policy on top of the token bucket.
 */
export function decideCrawlDelay(
  lastAllowedMs: number | null,
  crawlDelayMs: number,
  nowMs: number,
): RateLimitResult {
  if (crawlDelayMs <= 0 || lastAllowedMs === null) {
    return { allowed: true, retryAfterMs: 0 }
  }
  const elapsed = nowMs - lastAllowedMs
  if (elapsed >= crawlDelayMs) {
    return { allowed: true, retryAfterMs: 0 }
  }
  return { allowed: false, retryAfterMs: crawlDelayMs - elapsed }
}

/** Atomic crawl-delay gate. KEYS[1]=last-ts key; ARGV=delay_ms,now_ms → {allowed,retryAfterMs}. */
export const CRAWL_DELAY_LUA = `
local last = tonumber(redis.call('GET', KEYS[1]))
local delay = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
if delay <= 0 or last == nil then
  redis.call('SET', KEYS[1], now)
  redis.call('PEXPIRE', KEYS[1], delay * 2)
  return {1, 0}
end
local elapsed = now - last
if elapsed >= delay then
  redis.call('SET', KEYS[1], now)
  redis.call('PEXPIRE', KEYS[1], delay * 2)
  return {1, 0}
end
return {0, delay - elapsed}
`

/**
 * Enforce a domain's robots.txt Crawl-delay as minimum spacing. The delay (in
 * seconds) is cached at `crawl-delay:config:{domain}` when robots.txt is parsed
 * (see robots.ts), so fetch workers honor it without re-fetching robots. Returns
 * {allowed:true} immediately when no crawl-delay applies.
 */
export async function enforceCrawlDelay(
  domain: string,
  redisClient: Redis,
): Promise<RateLimitResult> {
  const cfg = await redisClient.get(`crawl-delay:config:${domain}`)
  const delaySeconds = cfg !== null ? parseFloat(cfg) : 0
  if (!delaySeconds || delaySeconds <= 0) {
    return { allowed: true, retryAfterMs: 0 }
  }
  const res = await redisClient.eval(
    CRAWL_DELAY_LUA, 1, `crawl-delay:last:${domain}`,
    String(Math.ceil(delaySeconds * 1000)), String(Date.now()),
  )
  if (!Array.isArray(res) || res.length < 2) {
    throw new Error(`CRAWL_DELAY_LUA returned unexpected result: ${JSON.stringify(res)}`)
  }
  return { allowed: Number(res[0]) === 1, retryAfterMs: Number(res[1]) || 0 }
}

// ── Concurrency lease ─────────────────────────────────────────────────────────

/** Pure ceiling test: may a new request acquire a slot given `current` in-flight? */
export function decideAcquire(current: number, max: number): boolean {
  return current < max
}

/** Atomic acquire. KEYS[1]=counter; ARGV=max,ttl_ms → 1 acquired / 0 refused. */
export const ACQUIRE_SLOT_LUA = `
local cur = tonumber(redis.call('GET', KEYS[1]) or '0')
if cur >= tonumber(ARGV[1]) then return 0 end
redis.call('INCR', KEYS[1])
redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[2]))
return 1
`

/** Atomic release. KEYS[1]=counter → DECR only when > 0 so it can't go negative. */
export const RELEASE_SLOT_LUA = `
local cur = tonumber(redis.call('GET', KEYS[1]) or '0')
if cur > 0 then redis.call('DECR', KEYS[1]) end
return 1
`

// ── Redis-backed wrappers (thin; the pure decisions above are what's tested) ──

/**
 * Atomic per-domain rate check. Same signature as before so worker callers are
 * unchanged. Ops override: `ratelimit:config:{domain}` hash field `limit`.
 */
export async function checkRateLimit(
  domain: string,
  redisClient: Redis,
  isShopify = false,
): Promise<RateLimitResult> {
  const overrideStr = await redisClient.hget(`ratelimit:config:${domain}`, 'limit')
  const limit = overrideStr !== null
    ? (parseInt(overrideStr, 10) || DEFAULT_LIMIT)
    : (isShopify ? SHOPIFY_LIMIT : defaultLimit(domain))

  const res = await redisClient.eval(
    RATE_LIMIT_LUA, 1, `ratelimit:${domain}`,
    String(limit), String(WINDOW_MS), String(Date.now()),
  )
  if (!Array.isArray(res) || res.length < 2) {
    throw new Error(`RATE_LIMIT_LUA returned unexpected result: ${JSON.stringify(res)}`)
  }
  return { allowed: Number(res[0]) === 1, retryAfterMs: Number(res[1]) || 0 }
}

/** Acquire one concurrency slot for a domain; false when at the in-flight ceiling. */
export async function acquireSlot(
  domain: string,
  redisClient: Redis,
  max: number = defaultConcurrency(domain),
): Promise<boolean> {
  const res = await redisClient.eval(
    ACQUIRE_SLOT_LUA, 1, `concurrency:${domain}`,
    String(max), String(CONCURRENCY_TTL_MS),
  )
  return Number(res) === 1
}

/** Release one concurrency slot, floored at zero so a double-release can't go negative. */
export async function releaseSlot(domain: string, redisClient: Redis): Promise<void> {
  await redisClient.eval(RELEASE_SLOT_LUA, 1, `concurrency:${domain}`)
}
