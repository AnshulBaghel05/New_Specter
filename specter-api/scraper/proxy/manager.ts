/**
 * Proxy rotation manager — pure, deterministic, unit-testable with NO Redis
 * and NO network.
 *
 * DEFERRED (infra wave):
 *   - Redis-backed ProxyHealthStore adapter (key: `proxy:health:{ip}`)
 *     — slot in by implementing the ProxyHealthStore interface below.
 *   - Worker wiring: http.ts / probe.ts / playwright.ts source proxies from
 *     ProxyManager.next() and call reportResult() after each request.
 *   - ProxyAgent reuse: one undici ProxyAgent per IP, kept in a Map, so the
 *     per-job `new ProxyAgent(url)` in http.ts:53 is replaced.
 *   - process.env parsing: parse PROXY_DATACENTER_URLS / PROXY_RESIDENTIAL_URLS
 *     (comma-lists) at the worker entry point and pass into the constructor.
 *
 * The two injectable seams that make this unit-testable:
 *   1. ProxyHealthStore — synchronous get/set of per-IP health state.
 *      InMemoryProxyHealthStore is the default; swap for a Redis adapter in prod.
 *   2. now: () => number — injectable clock (default: Date.now).
 *      Tests advance the clock by mutating a shared object, making cooldown
 *      and sticky-window expiry fully deterministic.
 */

// ── Score constants ───────────────────────────────────────────────────────────

/** Score value at or above which an IP is considered healthy. */
const DEFAULT_HEALTHY_SCORE = 100

/** Score penalty applied per ban event (403/429/CAPTCHA). */
const DEFAULT_PENALTY_PER_BAN = 50

/** Score recovery applied per success. */
const DEFAULT_RECOVERY_PER_OK = 10

/** Status codes that trigger a ban/cooldown (in addition to banStatuses config). */
export const CAPTCHA_STATUS = 0   // sentinel: caller detected a CAPTCHA page

// ── Types and interfaces ──────────────────────────────────────────────────────

export interface ProxyHealth {
  /** Current score: starts at DEFAULT_HEALTHY_SCORE. Drops on ban, rises on ok. */
  score: number
  /** Unix-ms timestamp after which the IP is available again. 0 = not cooling. */
  cooldownUntil: number
}

/**
 * Injectable health store. The default InMemoryProxyHealthStore is used in
 * tests and as the standalone fallback. A Redis adapter implementing this
 * interface will share ban knowledge across all worker pods.
 */
export interface ProxyHealthStore {
  get(ip: string): ProxyHealth
  set(ip: string, health: ProxyHealth): void
}

export interface ProxyManagerConfig {
  datacenterUrls:   string[]
  residentialUrls:  string[]
  /** How long (ms) a banned IP is excluded from rotation. Default: 5 minutes. */
  cooldownMs?:      number
  /** How long (ms) a domain stays pinned to the same IP. Default: 30 seconds. */
  stickyWindowMs?:  number
  /** HTTP status codes that trigger a ban. Default: [403, 429, 0]. */
  banStatuses?:     number[]
  /** Score at/above which an IP is healthy. Default: 100. */
  healthyScore?:    number
  /** Score penalty per ban event. Default: 50. */
  penaltyPerBan?:   number
  /** Score recovery per success event. Default: 10. */
  recoveryPerOk?:   number
}

// ── InMemoryProxyHealthStore ──────────────────────────────────────────────────

/** Default health store — synchronous Map-backed, no external deps. */
export class InMemoryProxyHealthStore implements ProxyHealthStore {
  private readonly store = new Map<string, ProxyHealth>()

  get(ip: string): ProxyHealth {
    return this.store.get(ip) ?? { score: DEFAULT_HEALTHY_SCORE, cooldownUntil: 0 }
  }

  set(ip: string, health: ProxyHealth): void {
    this.store.set(ip, health)
  }
}

// ── StickyEntry (internal) ────────────────────────────────────────────────────

interface StickyEntry {
  ip:         string
  expiresAt:  number
}

// ── ProxyManager ─────────────────────────────────────────────────────────────

/**
 * Manages proxy rotation with per-IP health tracking, cooldown on bans, and
 * provider failover across datacenter ↔ residential tiers.
 *
 * Thread-safety note: all state is synchronous and single-threaded (Node.js
 * event loop). The Redis adapter will provide cross-pod consistency.
 */
export class ProxyManager {
  private readonly datacenterUrls:  readonly string[]
  private readonly residentialUrls: readonly string[]
  private readonly cooldownMs:      number
  private readonly stickyWindowMs:  number
  private readonly banStatuses:     ReadonlySet<number>
  private readonly healthyScore:    number
  private readonly penaltyPerBan:   number
  private readonly recoveryPerOk:   number

  private readonly store: ProxyHealthStore
  private readonly now:   () => number

  /** Round-robin cursors, one per tier. */
  private readonly cursors: Record<'datacenter' | 'residential', number> = {
    datacenter:  0,
    residential: 0,
  }

  /** Sticky assignments: `${tier}:${domain}` → StickyEntry */
  private readonly sticky = new Map<string, StickyEntry>()

  constructor(
    config: ProxyManagerConfig,
    store: ProxyHealthStore = new InMemoryProxyHealthStore(),
    now: () => number = Date.now,
  ) {
    if (config.datacenterUrls.length === 0 && config.residentialUrls.length === 0) {
      throw new Error('ProxyManager: at least one proxy URL must be provided')
    }
    this.datacenterUrls  = config.datacenterUrls
    this.residentialUrls = config.residentialUrls
    this.cooldownMs      = config.cooldownMs     ?? 5 * 60_000
    this.stickyWindowMs  = config.stickyWindowMs ?? 30_000
    this.healthyScore    = config.healthyScore   ?? DEFAULT_HEALTHY_SCORE
    this.penaltyPerBan   = config.penaltyPerBan  ?? DEFAULT_PENALTY_PER_BAN
    this.recoveryPerOk   = config.recoveryPerOk  ?? DEFAULT_RECOVERY_PER_OK
    this.banStatuses     = new Set(config.banStatuses ?? [403, 429, CAPTCHA_STATUS])
    this.store           = store
    this.now             = now
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Returns the URL of a healthy proxy for the given tier.
   * When `domain` is supplied the result is sticky: the same IP is returned
   * for that domain within the sticky window, unless the IP starts cooling.
   * Fails over to the other tier if the requested tier is fully cooling.
   * Throws when no healthy proxy exists in either tier.
   */
  next(tier: 'datacenter' | 'residential', domain?: string): string {
    // 1. Check sticky assignment for this domain+tier
    if (domain !== undefined) {
      const key   = `${tier}:${domain}`
      const entry = this.sticky.get(key)
      if (entry !== undefined) {
        const isWindowOpen = entry.expiresAt > this.now()
        const isStillHealthy = this.isHealthy(entry.ip)
        if (isWindowOpen && isStillHealthy) {
          return entry.ip
        }
        // Expired or banned — clear so we reassign below
        this.sticky.delete(key)
      }
    }

    // 2. Try the requested tier, then the other tier
    const primaryPool   = this.poolFor(tier)
    const fallbackTier  = tier === 'datacenter' ? 'residential' : 'datacenter'
    const fallbackPool  = this.poolFor(fallbackTier)

    const ip =
      this.pickHealthy(primaryPool, tier) ??
      this.pickHealthy(fallbackPool, fallbackTier)

    if (ip === null) {
      throw new Error(
        `ProxyManager: no healthy proxy available — all IPs in both tiers are cooling`,
      )
    }

    // 3. Record sticky assignment for this domain
    if (domain !== undefined) {
      const key = `${tier}:${domain}`
      this.sticky.set(key, { ip, expiresAt: this.now() + this.stickyWindowMs })
    }

    return ip
  }

  /**
   * Call when a request to `ip` returned a ban status (403, 429, CAPTCHA).
   * Drops the IP's score and sets a cooldown so it is not handed out until
   * `cooldownMs` has elapsed.
   */
  reportFailure(ip: string, status: number): void {
    const h = this.store.get(ip)
    this.store.set(ip, {
      score:         Math.max(0, h.score - this.penaltyPerBan),
      cooldownUntil: this.now() + this.cooldownMs,
    })
    // Evict any sticky assignments that point at this IP
    for (const [key, entry] of this.sticky.entries()) {
      if (entry.ip === ip) this.sticky.delete(key)
    }
  }

  /**
   * Call when a request to `ip` succeeded. Raises the IP's score and clears
   * any active cooldown.
   */
  reportSuccess(ip: string): void {
    const h = this.store.get(ip)
    this.store.set(ip, {
      score:         Math.min(this.healthyScore, h.score + this.recoveryPerOk),
      cooldownUntil: 0,
    })
  }

  /**
   * Unified entry point: routes to reportSuccess or reportFailure based on
   * whether `status` is in the configured ban set. All three methods are part
   * of the public API; the plan names reportResult, and it delegates here.
   */
  reportResult(ip: string, status: number): void {
    if (this.banStatuses.has(status)) {
      this.reportFailure(ip, status)
    } else {
      this.reportSuccess(ip)
    }
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private poolFor(tier: 'datacenter' | 'residential'): readonly string[] {
    return tier === 'datacenter' ? this.datacenterUrls : this.residentialUrls
  }

  /** Returns true when `ip` is not currently cooling. */
  private isHealthy(ip: string): boolean {
    const h = this.store.get(ip)
    return h.cooldownUntil <= this.now()
  }

  /**
   * Round-robins across `pool` starting from the tier cursor and returns the
   * first healthy IP, advancing the cursor past it. Returns null when every IP
   * in the pool is cooling.
   */
  private pickHealthy(
    pool: readonly string[],
    tier: 'datacenter' | 'residential',
  ): string | null {
    if (pool.length === 0) return null

    const start = this.cursors[tier]
    for (let offset = 0; offset < pool.length; offset++) {
      const idx = (start + offset) % pool.length
      const ip  = pool[idx]
      if (this.isHealthy(ip)) {
        // Advance cursor to the slot AFTER this one for next call
        this.cursors[tier] = (idx + 1) % pool.length
        return ip
      }
    }
    return null
  }
}
