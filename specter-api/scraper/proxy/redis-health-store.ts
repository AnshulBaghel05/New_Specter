import { createHash } from 'node:crypto'
import type { ProxyHealth, ProxyHealthStore } from './manager'

const DEFAULT_HEALTH: ProxyHealth = { score: 100, cooldownUntil: 0 }
const KEY_GRACE_MS = 60_000   // keep the Redis key a bit past cooldown for cross-pod reads

/** Minimal slice of ioredis this store needs (keeps it unit-testable). */
export interface HealthRedis {
  set(key: string, value: string, mode: 'PX', ms: number): Promise<unknown>
  mget(...keys: string[]): Promise<Array<string | null>>
}

/** Credential-safe Redis key: hash of the proxy URL, never the raw URL. */
export function proxyHealthKey(url: string): string {
  const h = createHash('sha256').update(url).digest('hex').slice(0, 12)
  return `proxy:health:${h}`
}

/**
 * Synchronous ProxyHealthStore backed by an in-memory Map (the hot-path surface
 * the manager reads/writes) with async write-through to Redis and a periodic
 * refresh that merges other pods' bans. Redis failures are swallowed so a Redis
 * outage degrades to per-pod-only health, never a worker stall.
 */
export class RedisProxyHealthStore implements ProxyHealthStore {
  private readonly map = new Map<string, ProxyHealth>()
  private readonly keyByUrl = new Map<string, string>()
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly redis: HealthRedis,
    urls: string[],
    private readonly now: () => number = Date.now,
  ) {
    for (const u of urls) this.keyByUrl.set(u, proxyHealthKey(u))
  }

  private keyFor(url: string): string {
    let k = this.keyByUrl.get(url)
    if (k === undefined) { k = proxyHealthKey(url); this.keyByUrl.set(url, k) }
    return k
  }

  get(url: string): ProxyHealth {
    return this.map.get(url) ?? { ...DEFAULT_HEALTH }
  }

  set(url: string, health: ProxyHealth): void {
    this.map.set(url, health)
    const ttl = Math.max(KEY_GRACE_MS, health.cooldownUntil - this.now() + KEY_GRACE_MS)
    // Fire the mirror write synchronously (so it actually leaves the process this
    // tick) but never await it; swallow both sync throws and async rejections so a
    // Redis outage degrades to per-pod health rather than stalling the worker.
    try {
      const p = this.redis.set(this.keyFor(url), JSON.stringify(health), 'PX', ttl)
      if (p && typeof (p as Promise<unknown>).catch === 'function') {
        (p as Promise<unknown>).catch(() => {})
      }
    } catch { /* best-effort cross-pod mirror */ }
  }

  /** One refresh pass: pull every known proxy's health and adopt the stricter cooldown. */
  async refreshOnce(): Promise<void> {
    const urls = [...this.keyByUrl.keys()]
    if (urls.length === 0) return
    let values: Array<string | null>
    try {
      values = await this.redis.mget(...urls.map(u => this.keyFor(u)))
    } catch {
      return   // Redis down — keep local view
    }
    urls.forEach((url, i) => {
      const raw = values[i]
      if (!raw) return
      try {
        const remote = JSON.parse(raw) as ProxyHealth
        const local  = this.map.get(url) ?? { ...DEFAULT_HEALTH }
        // Adopt the stricter (later) cooldown + lower score so a ban on any pod wins.
        this.map.set(url, {
          score:         Math.min(local.score, remote.score),
          cooldownUntil: Math.max(local.cooldownUntil, remote.cooldownUntil),
        })
      } catch { /* malformed — ignore */ }
    })
  }

  startRefresh(intervalMs = 15_000): () => void {
    if (this.timer) return () => this.stopRefresh()
    this.timer = setInterval(() => { void this.refreshOnce() }, intervalMs)
    if (typeof this.timer.unref === 'function') this.timer.unref()
    return () => this.stopRefresh()
  }

  stopRefresh(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
  }
}
