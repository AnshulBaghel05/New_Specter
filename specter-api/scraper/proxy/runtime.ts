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
