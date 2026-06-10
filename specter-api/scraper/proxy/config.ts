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
