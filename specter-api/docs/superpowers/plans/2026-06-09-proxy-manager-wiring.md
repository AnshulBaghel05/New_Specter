# Proxy Manager Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing pure `ProxyManager` into the http/probe (datacenter) and playwright (residential backup) scraper workers with a Redis-backed write-through health store, per-IP cooldown, tier failover, and an origin-IP-safe exhausted-pool fallback.

**Architecture:** Three new small modules under `scraper/proxy/` — `config.ts` (env → config | null), `redis-health-store.ts` (synchronous `ProxyHealthStore` over an in-memory Map with async write-through + periodic refresh, credential-safe hashed Redis keys), and `runtime.ts` (per-worker `ProxyManager` singleton, one `ProxyAgent` per URL, `selectProxy`/exhausted sentinel, fallback policy). The three workers call these instead of `new ProxyAgent(...)`. The manager itself (`proxy/manager.ts`) is **not** modified.

**Tech Stack:** TypeScript (module: node16), vitest, ioredis (`stateRedis`), undici `ProxyAgent`, BullMQ.

**Working dir for all commands:** `specter-api/scraper`. Tests: `node node_modules/vitest/vitest.mjs run <file>`. Typecheck: `node node_modules/typescript/bin/tsc --noEmit`. Branch: `freemium-backend-foundation`.

**Staging rule (repo-specific):** stage by **explicit path** only — never `git add .`/`-A` (backend source is largely untracked and `node_modules` is not gitignored).

---

### Task 1: Env parsing — `proxy/config.ts`

**Files:**
- Create: `scraper/proxy/config.ts`
- Test: `scraper/proxy/config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// scraper/proxy/config.test.ts
import { describe, it, expect } from 'vitest'
import { parseProxyConfig } from './config'

describe('parseProxyConfig', () => {
  it('returns null when no proxy env is set', () => {
    expect(parseProxyConfig({})).toBeNull()
  })

  it('parses a comma-list of datacenter URLs', () => {
    const cfg = parseProxyConfig({ PROXY_DATACENTER_URLS: 'http://a:1, http://b:2 ,' })
    expect(cfg?.datacenterUrls).toEqual(['http://a:1', 'http://b:2'])
    expect(cfg?.residentialUrls).toEqual([])
  })

  it('falls back to the singular var when the list var is absent', () => {
    const cfg = parseProxyConfig({ PROXY_RESIDENTIAL_URL: 'http://res:9' })
    expect(cfg?.residentialUrls).toEqual(['http://res:9'])
  })

  it('prefers the plural list over the singular when both are set', () => {
    const cfg = parseProxyConfig({
      PROXY_DATACENTER_URLS: 'http://list:1',
      PROXY_DATACENTER_URL: 'http://single:1',
    })
    expect(cfg?.datacenterUrls).toEqual(['http://list:1'])
  })

  it('passes through numeric tunables when present', () => {
    const cfg = parseProxyConfig({ PROXY_DATACENTER_URL: 'http://a:1', PROXY_COOLDOWN_MS: '120000' })
    expect(cfg?.cooldownMs).toBe(120000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run proxy/config.test.ts`
Expected: FAIL — `Cannot find module './config'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// scraper/proxy/config.ts
import type { ProxyManagerConfig } from './manager'

type Env = Record<string, string | undefined>

function list(plural: string | undefined, singular: string | undefined): string[] {
  const raw = plural ?? singular ?? ''
  return raw.split(',').map(s => s.trim()).filter(s => s.length > 0)
}

function num(v: string | undefined): number | undefined {
  if (v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Build a ProxyManagerConfig from the environment, or null when no proxy URLs
 * are configured at all (→ "no-proxy mode": callers fetch direct, as in local dev).
 * Each tier accepts either a single rotating-gateway URL or a comma-list of
 * static endpoints; the manager round-robins over whatever it is given.
 */
export function parseProxyConfig(env: Env): ProxyManagerConfig | null {
  const datacenterUrls  = list(env.PROXY_DATACENTER_URLS,  env.PROXY_DATACENTER_URL)
  const residentialUrls = list(env.PROXY_RESIDENTIAL_URLS, env.PROXY_RESIDENTIAL_URL)
  if (datacenterUrls.length === 0 && residentialUrls.length === 0) return null

  const cfg: ProxyManagerConfig = { datacenterUrls, residentialUrls }
  const cooldownMs     = num(env.PROXY_COOLDOWN_MS)
  const stickyWindowMs = num(env.PROXY_STICKY_WINDOW_MS)
  if (cooldownMs     !== undefined) cfg.cooldownMs     = cooldownMs
  if (stickyWindowMs !== undefined) cfg.stickyWindowMs = stickyWindowMs
  return cfg
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run proxy/config.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scraper/proxy/config.ts scraper/proxy/config.test.ts
git commit -m "feat(scraper): proxy env parsing (plural lists + singular fallback)"
```

---

### Task 2: Redis-backed health store — `proxy/redis-health-store.ts`

The manager's `ProxyHealthStore` is **synchronous**. This adapter keeps an in-memory `Map` as the synchronous surface, mirrors every `set` to Redis under a credential-safe hashed key, and periodically merges other pods' bans back in. The store is constructed with the full set of proxy URLs so `refresh` can `mget` exactly their keys (no `KEYS`/`SCAN`).

**Files:**
- Create: `scraper/proxy/redis-health-store.ts`
- Test: `scraper/proxy/redis-health-store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// scraper/proxy/redis-health-store.test.ts
import { describe, it, expect, vi } from 'vitest'
import { RedisProxyHealthStore, proxyHealthKey } from './redis-health-store'

function fakeRedis() {
  const sets: Array<[string, string]> = []
  return {
    sets,
    set: vi.fn(async (k: string, v: string) => { sets.push([k, v]); return 'OK' }),
    mget: vi.fn(async (..._keys: string[]) => []),
  }
}

const URL_A = 'http://user:secret@gw.example.com:8080'

describe('RedisProxyHealthStore', () => {
  it('hashes the proxy URL into the key — no credentials leak', () => {
    const key = proxyHealthKey(URL_A)
    expect(key.startsWith('proxy:health:')).toBe(true)
    expect(key).not.toContain('secret')
    expect(key).not.toContain('gw.example.com')
  })

  it('get returns the default health for an unseen url', () => {
    const store = new RedisProxyHealthStore(fakeRedis() as any, [URL_A])
    expect(store.get(URL_A)).toEqual({ score: 100, cooldownUntil: 0 })
  })

  it('set updates the in-memory map synchronously and mirrors to redis', () => {
    const redis = fakeRedis()
    const store = new RedisProxyHealthStore(redis as any, [URL_A])
    store.set(URL_A, { score: 50, cooldownUntil: 1_000 })
    expect(store.get(URL_A)).toEqual({ score: 50, cooldownUntil: 1_000 })   // sync read-back
    expect(redis.set).toHaveBeenCalledTimes(1)
    expect(redis.set.mock.calls[0][0]).toBe(proxyHealthKey(URL_A))           // hashed key
  })

  it('swallows redis errors on set (worker keeps running)', () => {
    const redis = { set: vi.fn(async () => { throw new Error('redis down') }), mget: vi.fn() }
    const store = new RedisProxyHealthStore(redis as any, [URL_A])
    expect(() => store.set(URL_A, { score: 0, cooldownUntil: 9 })).not.toThrow()
    expect(store.get(URL_A).score).toBe(0)
  })

  it('refresh merges the stricter (later) cooldown from other pods', async () => {
    const redis = fakeRedis()
    redis.mget = vi.fn(async () => [JSON.stringify({ score: 0, cooldownUntil: 5_000 })])
    const store = new RedisProxyHealthStore(redis as any, [URL_A])
    store.set(URL_A, { score: 100, cooldownUntil: 1_000 })   // our local view: cools sooner
    await store.refreshOnce()
    expect(store.get(URL_A).cooldownUntil).toBe(5_000)        // adopt the later cooldown
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run proxy/redis-health-store.test.ts`
Expected: FAIL — `Cannot find module './redis-health-store'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// scraper/proxy/redis-health-store.ts
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
    void Promise.resolve()
      .then(() => this.redis.set(this.keyFor(url), JSON.stringify(health), 'PX', ttl))
      .catch(() => {})   // best-effort cross-pod mirror
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run proxy/redis-health-store.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scraper/proxy/redis-health-store.ts scraper/proxy/redis-health-store.test.ts
git commit -m "feat(scraper): redis-backed proxy health store (write-through, hashed keys)"
```

---

### Task 3: Worker runtime — singleton, agent pool, selection + fallback policy

**Files:**
- Create: `scraper/proxy/runtime.ts`
- Test: `scraper/proxy/runtime.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// scraper/proxy/runtime.test.ts
import { describe, it, expect, vi } from 'vitest'
import { selectProxy, allowDirectFallback, requeueDelayMs } from './runtime'
import { ProxyManager } from './manager'

function mgrWith(urls: string[]) {
  return new ProxyManager({ datacenterUrls: urls, residentialUrls: [] })
}

describe('selectProxy', () => {
  it('returns a url when a healthy proxy exists', () => {
    const sel = selectProxy(mgrWith(['http://a:1']), 'datacenter', 'shop.com')
    expect(sel).toEqual({ exhausted: false, url: 'http://a:1' })
  })

  it('returns the exhausted sentinel when the manager throws (all cooling)', () => {
    const mgr = mgrWith(['http://a:1'])
    mgr.reportResult('http://a:1', 403)   // cool the only proxy
    const sel = selectProxy(mgr, 'datacenter', 'shop.com')
    expect(sel).toEqual({ exhausted: true })
  })
})

describe('fallback policy env', () => {
  it('allowDirectFallback defaults to false (production-safe)', () => {
    expect(allowDirectFallback({})).toBe(false)
    expect(allowDirectFallback({ ALLOW_DIRECT_FALLBACK: 'true' })).toBe(true)
    expect(allowDirectFallback({ ALLOW_DIRECT_FALLBACK: '1' })).toBe(true)
  })

  it('requeueDelayMs defaults to 60s and honours the env override', () => {
    expect(requeueDelayMs({})).toBe(60_000)
    expect(requeueDelayMs({ PROXY_REQUEUE_DELAY_MS: '30000' })).toBe(30_000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run proxy/runtime.test.ts`
Expected: FAIL — `Cannot find module './runtime'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// scraper/proxy/runtime.ts
import { ProxyAgent } from 'undici'
import { stateRedis } from '../redis'
import { ProxyManager } from './manager'
import { parseProxyConfig } from './config'
import { RedisProxyHealthStore, type HealthRedis } from './redis-health-store'

type Env = Record<string, string | undefined>
type Tier = 'datacenter' | 'residential'

export type ProxySelection =
  | { exhausted: false; url: string }
  | { exhausted: true }

let _mgr: ProxyManager | null = null
let _built = false
const _agents = new Map<string, ProxyAgent>()

/** Lazily build one ProxyManager per worker process (null in no-proxy mode). */
export function getProxyManager(): ProxyManager | null {
  if (_built) return _mgr
  _built = true
  const cfg = parseProxyConfig(process.env)
  if (cfg === null) { _mgr = null; return null }
  const allUrls = [...cfg.datacenterUrls, ...cfg.residentialUrls]
  const store = new RedisProxyHealthStore(stateRedis as unknown as HealthRedis, allUrls)
  store.startRefresh()
  _mgr = new ProxyManager(cfg, store)
  return _mgr
}

/** One undici ProxyAgent per proxy URL (reused across jobs). */
export function agentFor(url: string): ProxyAgent {
  let a = _agents.get(url)
  if (a === undefined) { a = new ProxyAgent(url); _agents.set(url, a) }
  return a
}

/** Wrap manager.next so an exhausted pool is a sentinel, not a throw. */
export function selectProxy(mgr: ProxyManager, tier: Tier, domain: string): ProxySelection {
  try {
    return { exhausted: false, url: mgr.next(tier, domain) }
  } catch {
    return { exhausted: true }
  }
}

/** Production-safe default: do NOT expose the origin IP unless explicitly allowed. */
export function allowDirectFallback(env: Env = process.env): boolean {
  const v = (env.ALLOW_DIRECT_FALLBACK ?? '').toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}

export function requeueDelayMs(env: Env = process.env): number {
  const n = Number(env.PROXY_REQUEUE_DELAY_MS)
  return Number.isFinite(n) && n > 0 ? n : 60_000
}

/** Test-only reset of the module singletons. */
export function __resetProxyRuntimeForTests(): void {
  _mgr = null; _built = false; _agents.clear()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run proxy/runtime.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scraper/proxy/runtime.ts scraper/proxy/runtime.test.ts
git commit -m "feat(scraper): proxy worker runtime (singleton, agent pool, selection, fallback policy)"
```

---

### Task 4: Wire the datacenter workers (`http.ts` + `probe.ts`)

Replace per-job `new ProxyAgent(PROXY_URL)` with manager-sourced selection + health reporting + the exhausted-pool fallback. **No new test** — logic under test lives in `runtime.ts` (Task 3); these are integration edits verified by `tsc` + the full suite.

**Files:**
- Modify: `scraper/workers/http.ts` (imports; lines 15, 45–63, 69–89; dead-letter unaffected)
- Modify: `scraper/workers/probe.ts` (imports; lines 14, 74–106)

- [ ] **Step 1: Edit `http.ts` imports and remove the old single-URL const**

Replace line 3 and line 15 region. Remove `import { ProxyAgent } from 'undici'` and the `const PROXY_URL = …` line; add:

```ts
import { getProxyManager, agentFor, selectProxy, allowDirectFallback, requeueDelayMs } from '../proxy/runtime'
```

- [ ] **Step 2: Replace the GET-options proxy block (was lines 48–63)**

The `getOptions` object stays; replace the `if (PROXY_URL) { getOptions.dispatcher = new ProxyAgent(PROXY_URL) }` block with manager-sourced selection. Insert **before** building `getOptions` so we can short-circuit on exhaustion:

```ts
    // ── Proxy selection (datacenter tier; health-aware, with failover) ─────────
    const proxyMgr = getProxyManager()
    let proxyUrl: string | null = null
    if (proxyMgr) {
      const sel = selectProxy(proxyMgr, 'datacenter', domain)
      if (sel.exhausted) {
        // All proxies cooling. Never expose the origin IP in prod: requeue unless
        // ALLOW_DIRECT_FALLBACK is set (dev/preview). moveToDelayed does not
        // consume a retry attempt.
        if (!allowDirectFallback()) {
          await job.moveToDelayed(Date.now() + requeueDelayMs())
          return { proxyExhausted: true, requeued: true, domain }
        }
      } else {
        proxyUrl = sel.url
      }
    }

    const getOptions: Record<string, unknown> = {
      timeout:         { request: 15_000 },
      throwHttpErrors: false,
      followRedirect:  true,
      decompress:      true,
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    }
    if (proxyUrl) getOptions.dispatcher = agentFor(proxyUrl)
```

- [ ] **Step 3: Report proxy outcome around the GET (was the try/catch at lines 69–89)**

In the `try` after `statusCode = response.statusCode`, add a success/ban report; in the `catch (err)`, report a failure before re-throwing:

```ts
    try {
      const response = await got(url, getOptions)
      statusCode = response.statusCode
      html       = String(response.body)
      if (proxyMgr && proxyUrl) proxyMgr.reportResult(proxyUrl, statusCode)
      // …existing Shopify-header re-check stays unchanged…
    } catch (err) {
      if (proxyMgr && proxyUrl) proxyMgr.reportResult(proxyUrl, 0)   // network error → cool the IP
      await incrementHttpFailCounter(domain, job.data, priority)
      throw err
    }
```

- [ ] **Step 4: Apply the identical pattern to `probe.ts`**

`probe.ts` classifies via a HEAD (no proxy) then a GET (datacenter proxy, lines 74–106). Replace `import { ProxyAgent } from 'undici'`/`const PROXY_URL` with the runtime import (same line as Step 1). In `classifyUrl`, the proxy GET cannot `moveToDelayed` (no `job` in scope) — so probe uses the simpler rule: **use a proxy when one is healthy, else go direct only if `allowDirectFallback()`, otherwise treat as `js_required`** (defer to a browser, which has its own proxy + retry). Replace the `if (PROXY_URL) { getOptions.dispatcher = new ProxyAgent(PROXY_URL) }` block (lines 90–94) with:

```ts
  const proxyMgr = getProxyManager()
  let proxyUrl: string | null = null
  if (proxyMgr) {
    const sel = selectProxy(proxyMgr, 'datacenter', domain)
    if (sel.exhausted) {
      // Pool exhausted: don't burn the origin IP on a probe. Defer to a browser
      // (its own proxy + retry) unless direct fallback is explicitly allowed.
      if (!allowDirectFallback()) {
        return { classification: 'js_required', via: 'heuristic' }
      }
    } else {
      proxyUrl = sel.url
    }
  }
  if (proxyUrl) getOptions.dispatcher = agentFor(proxyUrl)
```

Then, after the GET succeeds (`html = String(getResp.body)`), report success; in the surrounding `catch`, report failure:

```ts
  try {
    const getResp = await got(url, getOptions)
    html           = String(getResp.body)
    cfMitigatedGet = String(getResp.headers['cf-mitigated'] ?? '')
    if (proxyMgr && proxyUrl) proxyMgr.reportResult(proxyUrl, getResp.statusCode)
  } catch {
    if (proxyMgr && proxyUrl) proxyMgr.reportResult(proxyUrl, 0)
    return { classification: 'js_required', via: 'heuristic' }
  }
```

- [ ] **Step 5: Typecheck + run the full scraper suite**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no output (clean).
Run: `node node_modules/vitest/vitest.mjs run`
Expected: all test files pass (existing 121 + the new proxy tests).

- [ ] **Step 6: Commit**

```bash
git add scraper/workers/http.ts scraper/workers/probe.ts
git commit -m "feat(scraper): source datacenter proxy from ProxyManager (http+probe) with health reporting + origin-IP-safe fallback"
```

---

### Task 5: Wire the residential worker (`playwright.ts`)

Residential is the JS/backup tier (~20–30%). Select at the **browser-(re)launch boundary** (not per job) and report nav outcome against the launch's proxy.

**Files:**
- Modify: `scraper/workers/playwright.ts` (imports; lines 27, 95–143; the worker body around nav lines 336–341)

- [ ] **Step 1: Edit imports and the residential URL source**

Add the runtime import and remove the static `const PROXY_RESIDENTIAL_URL = …` (line 27):

```ts
import { getProxyManager, selectProxy, allowDirectFallback } from '../proxy/runtime'
```

Add a module-level holder for the proxy chosen at the current launch:

```ts
let activeProxyUrl: string | null = null   // residential proxy bound to the live browser
```

- [ ] **Step 2: Choose the residential proxy when the browser (re)launches**

`buildProxyConfig()` currently reads the env URL. Change it to take a URL argument, and have `getBrowser()` pick one via the manager at launch. Replace `buildProxyConfig` (lines 95–108) with:

```ts
function buildProxyConfig(proxyUrl: string | null): Record<string, string> | undefined {
  if (!proxyUrl) return undefined
  try {
    const u = new URL(proxyUrl)
    return {
      server:   `${u.protocol}//${u.hostname}:${u.port}`,
      username: u.username,
      password: decodeURIComponent(u.password),
    }
  } catch {
    return undefined   // malformed — launch without proxy rather than crashing
  }
}
```

In `getBrowser()`, inside the `needsNewBrowser` branch for a **local launch** (the `else` that calls `chromium.launch`, lines 123–135), choose the proxy first:

```ts
      const mgr = getProxyManager()
      activeProxyUrl = null
      if (mgr) {
        const sel = selectProxy(mgr, 'residential', 'playwright')
        if (!sel.exhausted) activeProxyUrl = sel.url
        // exhausted residential + datacenter failover already handled inside next();
        // a fully-cooling pool just launches without a proxy when direct is allowed.
        else if (!allowDirectFallback()) activeProxyUrl = null
      }
      browser = (await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
        ...(buildProxyConfig(activeProxyUrl) ? { proxy: buildProxyConfig(activeProxyUrl) } : {}),
      })) as Browser
```

(The CDP/shared-farm branch is unchanged — the farm owns egress there.)

- [ ] **Step 3: Report nav outcome against the active proxy**

In the worker body, the navigation try/catch (lines 336–341) becomes:

```ts
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
        const mgr = getProxyManager()
        if (mgr && activeProxyUrl) mgr.reportResult(activeProxyUrl, 200)   // nav ok
      } catch (navErr) {
        const mgr = getProxyManager()
        if (mgr && activeProxyUrl) mgr.reportResult(activeProxyUrl, 0)     // cool on nav failure
        throw navErr
      }
```

Additionally, when CAPTCHA is detected (`handleCaptcha` returns `offloaded`), cool the proxy — a challenge means this IP is flagged. Right after `if (captcha.kind === 'offloaded') {` and before `moveToDelayed`:

```ts
        const mgrC = getProxyManager()
        if (mgrC && activeProxyUrl) mgrC.reportResult(activeProxyUrl, 0)
```

- [ ] **Step 4: Typecheck + run the full scraper suite**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: clean.
Run: `node node_modules/vitest/vitest.mjs run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add scraper/workers/playwright.ts
git commit -m "feat(scraper): source residential proxy from ProxyManager at browser-launch boundary with nav/captcha health reporting"
```

---

### Task 6: Document env keys + final verification sweep

**Files:**
- Modify: `specter-api/.env.example`

- [ ] **Step 1: Add the proxy env documentation**

Append (do not duplicate existing PROXY keys; replace any singular-only doc):

```dotenv
# ── Proxy pools (Audit #3) ───────────────────────────────────────────────
# Each tier accepts a comma-list of endpoints OR a single rotating-gateway URL.
# Plural list var wins over the singular fallback. Omit both → no-proxy mode
# (direct fetch; intended for local dev/preview only).
PROXY_DATACENTER_URLS=
PROXY_RESIDENTIAL_URLS=
# Backward-compatible singular fallbacks:
# PROXY_DATACENTER_URL=
# PROXY_RESIDENTIAL_URL=
# Origin-IP safety: when proxies ARE configured but the pool is fully cooling,
# default behavior REQUEUES the job rather than exposing the origin IP.
# Set true ONLY in dev/preview to allow direct fetch in that case.
ALLOW_DIRECT_FALLBACK=false
# Optional tunables:
# PROXY_COOLDOWN_MS=300000
# PROXY_STICKY_WINDOW_MS=30000
# PROXY_REQUEUE_DELAY_MS=60000
```

- [ ] **Step 2: Full verification sweep**

Run (from `scraper/`): `node node_modules/typescript/bin/tsc --noEmit`
Expected: clean.
Run: `node node_modules/vitest/vitest.mjs run`
Expected: all test files pass (existing + 14 new proxy tests).

- [ ] **Step 3: Commit**

```bash
git add ../.env.example
git commit -m "docs(scraper): document proxy pool + ALLOW_DIRECT_FALLBACK env keys"
```

---

## Self-Review notes

- **Spec coverage:** config.ts→Task 1; redis-health-store (write-through, hashed key, refresh-merge, swallow)→Task 2; runtime singleton + agent pool + selectProxy + fallback flag→Task 3; http/probe datacenter wiring + reportResult→Task 4; playwright residential at launch boundary→Task 5; fallback policy table (null=direct, exhausted+flag)→Tasks 4/5; `.env.example`→Task 6. All spec sections covered.
- **Type consistency:** `ProxyHealth`/`ProxyHealthStore`/`ProxyManagerConfig` imported from `./manager` (existing exports); `ProxySelection` discriminated union used identically in runtime.ts and both workers; `proxyHealthKey`/`HealthRedis` shared between store + its test. `selectProxy`/`agentFor`/`allowDirectFallback`/`requeueDelayMs` names identical across runtime.ts, tests, and worker edits.
- **No live-DB/browser tests:** all new tests are pure (fake redis, real manager, env objects); worker glue is verified by tsc + the existing suite, per repo testing conventions.
