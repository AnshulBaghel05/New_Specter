# Proxy Manager Wiring — Design Spec (Audit Fix #3)

**Date:** 2026-06-09
**Repo:** specter-api (scraper)
**Status:** Approved (design), pending implementation

## Problem

`scraper/proxy/manager.ts` is a complete, pure, unit-tested proxy rotator
(round-robin, per-IP score/cooldown on bans, sticky-per-domain, datacenter↔
residential failover) but it is **not wired into any worker**. Today:

- `http.ts` / `probe.ts` do `new ProxyAgent(process.env.PROXY_DATACENTER_URL)`
  **per job** (no pooling, no health, no failover).
- `playwright.ts` reads a single `PROXY_RESIDENTIAL_URL` at browser launch.

A banned datacenter IP keeps getting reused; there is no cooldown, no failover
to residential, and no cross-pod ban sharing. This wastes proxy spend on
dead-on-arrival fetches and risks cascading blocks.

## Goals

1. Source proxies from `ProxyManager.next()` and feed outcomes back via
   `reportResult()` in all three workers.
2. Share ban knowledge across worker pods via Redis (`proxy:health:{id}`).
3. Reuse one `ProxyAgent` per proxy URL (drop per-job `new ProxyAgent`).
4. Be **provider-agnostic**: a single rotating gateway and a static pool of IPs
   both work per tier; degrade cleanly to today's behavior when no proxy is set.
5. Never expose the origin IP in production when the pool is exhausted.

## Topology decision (from brainstorming)

Provider model is not finalized, so build for **both** and degrade gracefully:

- **Datacenter = default workhorse** (~70–80% of traffic is HTTP via http.ts).
- **Residential = JS/Playwright backup** (~20–30%), and the failover tier for
  datacenter.
- A "pool" may contain one URL (single rotating gateway) or many (static IPs);
  the manager round-robins over whatever it is given. Tier-failover works either
  way.

## Components

### 1. `scraper/proxy/config.ts` — env parsing

`parseProxyConfig(env): ProxyManagerConfig | null`

- `datacenterUrls` ← `PROXY_DATACENTER_URLS` (comma-split, trimmed, empties
  dropped) **else** singular `PROXY_DATACENTER_URL`.
- `residentialUrls` ← `PROXY_RESIDENTIAL_URLS` **else** `PROXY_RESIDENTIAL_URL`.
- Returns `null` when **both** pools are empty → callers run in "no-proxy mode"
  (direct fetch, exactly as local dev does today).
- Optional tunables (sensible defaults already in `ProxyManager`):
  `PROXY_COOLDOWN_MS`, `PROXY_STICKY_WINDOW_MS`.

### 2. `scraper/proxy/redis-health-store.ts` — cross-pod health

`RedisProxyHealthStore implements ProxyHealthStore` (the **synchronous**
interface — the manager stays pure and is not modified).

Write-through cache:
- In-memory `Map<id, ProxyHealth>` is the synchronous read/write surface
  `next()` uses on the hot path.
- `set(url, health)` updates the Map **and** fires `SET proxy:health:{id}
  <json> PX <cooldownMs+grace>` (fire-and-forget; Redis errors swallowed).
- A periodic refresh (`startRefresh(intervalMs=15000)`) does a best-effort scan/
  mget of `proxy:health:*` and merges other pods' bans into the Map, taking the
  **stricter** (later) `cooldownUntil`. Returns a stop handle for shutdown.
- **Key safety:** `{id}` = first 12 hex of `sha256(proxyUrl)`. The raw URL
  (which contains credentials) never appears in a Redis key or log line. The Map
  is keyed by `id` too; `next()` returns the real URL, so an `id→url` lookup is
  unnecessary — the manager already hands the URL to `reportResult`, and the
  store hashes consistently on the way in.

> Note: the manager's `store.get(ip)`/`set(ip, …)` are called with the proxy
> **URL string** as `ip` (that is how manager.ts already uses it). The store
> hashes that string to form the Redis key; the in-memory Map may key on the
> hash so the URL is never retained as a key.

### 3. `scraper/proxy/runtime.ts` — per-worker singleton + agent pool

- `getProxyManager()` — lazily builds one `ProxyManager` from
  `parseProxyConfig(process.env)` + `RedisProxyHealthStore`, starts the refresh
  loop, caches it. Returns `null` in no-proxy mode.
- `agentFor(url)` — `Map<url, ProxyAgent>`; one undici `ProxyAgent` per URL,
  created on first use.
- `selectProxy(mgr, tier, domain)` — wraps `mgr.next(tier, domain)`; on the
  manager's "no healthy proxy" throw, returns a sentinel `{ exhausted: true }`
  rather than throwing into the worker.
- `ALLOW_DIRECT_FALLBACK` (env, **default `false`**) exposed as
  `allowDirectFallback()`.

### 4. Worker wiring

**http.ts / probe.ts (datacenter):**
```
mgr = getProxyManager()
if (mgr) {
  sel = selectProxy(mgr, 'datacenter', domain)
  if (sel.exhausted) → handleExhausted(job)   // see fallback policy
  else getOptions.dispatcher = agentFor(sel.url)
}   // mgr === null → no dispatcher → direct fetch (unchanged dev path)
...fetch...
if (mgr && sel?.url) mgr.reportResult(sel.url, statusCode)   // 403/429/0 → cooldown
// network-error catch path: mgr.reportResult(sel.url, 0)
```

**playwright.ts (residential backup):** select at the **browser-(re)launch
boundary** (every `CONTEXT_REFRESH_EVERY` jobs), not per job — residential is
low-volume backup and may be a single gateway, so per-context per-job rotation
is not worth the Chromium `proxy:{server:'per-context'}` launch-mode change.
The chosen residential URL feeds `buildProxyConfig()`; after each job, report
nav success/ban against the launch's proxy URL. Empty residential pool →
manager failover to datacenter; fully exhausted → fallback policy.

### 5. Fallback policy (origin-IP safety)

Two distinct cases — only the second is governed by the flag:

| Situation | Behavior |
|---|---|
| **No proxy configured** (`manager === null`) | Direct fetch. Unchanged local-dev/preview path; there is nothing to fall back *from*. |
| **Proxy configured, pool fully cooling** (`next()` exhausted) AND `ALLOW_DIRECT_FALLBACK=false` (default, prod) | `job.moveToDelayed(Date.now() + PROXY_REQUEUE_DELAY_MS)` (default 60s). Does **not** consume a retry attempt (same mechanism as rate-limit/crawl-delay). Origin IP never exposed. |
| **Proxy configured, pool fully cooling** AND `ALLOW_DIRECT_FALLBACK=true` (dev/preview) | Direct fetch. |

`handleExhausted(job)` returns a small result object (`{ proxyExhausted: true,
requeued: true }` or `{ proxyExhausted: true, direct: true }`) and, in the
requeue case, calls `moveToDelayed` and short-circuits the worker.

## Data flow

```
job → worker → getProxyManager()
   ├─ null  → direct fetch
   └─ mgr   → selectProxy(tier, domain)
              ├─ url       → agentFor(url) → fetch → reportResult(url, status)
              └─ exhausted → ALLOW_DIRECT_FALLBACK ? direct : moveToDelayed(requeue)
reportResult → RedisProxyHealthStore.set → Map + async SET proxy:health:{hash}
refresh loop (15s) → mget proxy:health:* → merge stricter cooldown into Map
```

## Error handling

- Redis down: write-through `set` and refresh both swallow errors; the in-memory
  Map keeps the worker fully functional (just no cross-pod sharing until Redis
  returns).
- Malformed proxy URL: `agentFor` failure is caught → treated as exhausted for
  that pick → reportFailure on that URL so it cools out of rotation.
- `next()` throw (all cooling) is converted to the `exhausted` sentinel inside
  `selectProxy`; workers never see the raw throw.

## Testing (vitest)

- `proxy/config.test.ts` — plural list, singular fallback, both-set precedence,
  empty → null, whitespace/empty-item trimming.
- `proxy/redis-health-store.test.ts` — `set` mirrors to Redis with a **hashed**
  key (assert the raw URL/credentials are absent from the key) and a TTL; sync
  `get`/`set` contract; refresh merges the stricter cooldown; Redis-throw is
  swallowed and the Map still serves.
- `proxy/runtime.test.ts` — `selectProxy` returns a url when healthy and the
  `exhausted` sentinel when `next()` throws; `agentFor` returns the **same**
  agent instance per URL; `allowDirectFallback()` reads the env default false.
- Existing `proxy/proxy-manager.test.ts` stays green (manager untouched).
- `tsc --noEmit` clean; full scraper vitest green.

## Out of scope

- The manager algorithm, captcha, and browser-farm logic (untouched).
- Infra provisioning / real proxy credentials. `.env.example` documents the new
  `PROXY_*_URLS` and `ALLOW_DIRECT_FALLBACK` keys; no secrets committed.
- Per-context per-job residential rotation (deferred; revisit if residential
  volume grows or moves to a static pool).
```
