// Shared browser farm vs local launch (Task 3.1).
//
// Each Playwright worker process launches its own Chromium by default — fine for
// a few workers, but memory-heavy and slow to scale. When BROWSER_WS_ENDPOINT is
// set, workers instead connect over CDP to a shared, separately-scaled browser
// pool (e.g. browserless or a self-hosted chrome farm). Browser processes then
// scale independently of worker concurrency, and a worker pod holds only a thin
// CDP client rather than a full Chromium.
//
// Egress proxy in CDP mode is the farm's responsibility (configured on the
// endpoint), since connectOverCDP cannot pass Chromium launch flags. Local launch
// keeps passing the residential proxy as before.

export type BrowserMode = 'cdp' | 'local'

interface BrowserEnv {
  BROWSER_WS_ENDPOINT?: string
}

/** The CDP endpoint, trimmed, or null when none is configured. */
export function resolveBrowserEndpoint(env: BrowserEnv): string | null {
  const v = (env.BROWSER_WS_ENDPOINT ?? '').trim()
  return v.length > 0 ? v : null
}

/** 'cdp' when a farm endpoint is configured, else 'local'. */
export function browserMode(env: BrowserEnv): BrowserMode {
  return resolveBrowserEndpoint(env) ? 'cdp' : 'local'
}

/**
 * Decide whether to (re)acquire the browser. Pure so the lifecycle policy is
 * unit-pinned:
 *   - No live connection → always reacquire (initial or after a drop).
 *   - local: recycle the process-owned Chromium after `refreshEvery` jobs to cap
 *     memory growth.
 *   - cdp: never recycle by job count — the browser is shared, so closing it would
 *     yank other workers' sessions; only a dropped link (connected=false) reconnects.
 */
export function needsNewBrowser(
  mode: BrowserMode,
  connected: boolean,
  jobsOnBrowser: number,
  refreshEvery: number,
): boolean {
  if (!connected) return true
  if (mode === 'cdp') return false
  return jobsOnBrowser >= refreshEvery
}
