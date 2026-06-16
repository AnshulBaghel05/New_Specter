import 'dotenv/config'
import { Worker, type Job } from 'bullmq'
import type { Browser, BrowserContext, Page } from 'playwright'
import { redis, bullmqConnection } from '../redis'
import { deadLetterQueue, validationErrorsQueue, captchaSolveQueue } from '../queue'
import { PLAN_PRIORITY } from '../plans'
import { cacheLastPrice, recordPriceObservation } from '../state-ttl'
import { postPriceSnapshot, postScrapeFailed, buildSnapshotBody } from '../lib/ingest-client'
import { WORKER_RELIABILITY } from '../worker-options'
import { enforceCrawlDelay } from './rate-limiter'
import { resolveBrowserEndpoint, browserMode, needsNewBrowser } from './browser-farm'
import {
  detectCaptchaInContent,
  extractSiteKey,
  responseFieldFor,
  solveMethodFor,
  readCachedToken,
  captchaPendingKey,
  CAPTCHA_PENDING_TTL_SECONDS,
  type CaptchaType,
} from './captcha'
import { validateParseResult } from './validate'
import { normaliseCurrency } from '../domains/generic'
import { getParser } from '../domains/index'
import { getProxyManager, selectProxy, allowDirectFallback } from '../proxy/runtime'
import { unionBatchedTrackingIds } from '../batch-set'
import type { ScrapeJob } from '../types'

const CONTEXT_REFRESH_EVERY = 50  // relaunch LOCAL browser process every N jobs to prevent memory leaks

// Residential proxy bound to the live browser instance (chosen at each (re)launch).
let activeProxyUrl: string | null = null
const CAPTCHA_RETRY_DELAY_MS = 65_000  // give the offloaded solver time before the scrape retries

// When set, connect to a shared browser farm over CDP instead of launching a
// per-process Chromium (Task 3.1). Browser pool scales independently of workers.
const BROWSER_WS_ENDPOINT = resolveBrowserEndpoint(process.env)
const BROWSER_MODE        = browserMode(process.env)

// ── Stealth randomisation helpers ────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const CHROME_VERSIONS = ['124.0.0.0', '125.0.0.0', '126.0.0.0', '123.0.0.0', '122.0.0.0'] as const
const WEBGL_VENDORS  = [
  'Google Inc. (NVIDIA)',
  'Google Inc. (AMD)',
  'Google Inc. (Intel)',
] as const
const WEBGL_RENDERERS = [
  'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'ANGLE (Intel, Intel(R) UHD Graphics 770 Direct3D11 vs_5_0 ps_5_0, D3D11)',
] as const
const LANGUAGES = ['en-US', 'en-GB', 'en-AU'] as const

function randomUserAgent(): string {
  const version = randomFrom(CHROME_VERSIONS)
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`
}

// ── Browser lifecycle ─────────────────────────────────────────────────────────
// One Chromium instance per worker process; relaunched every CONTEXT_REFRESH_EVERY jobs.
// Each job creates its own BrowserContext (complete isolation) and closes it after.

let browser: Browser | null = null
let jobsOnBrowser = 0
// playwright-extra and stealth plugin loaded lazily; stealth applied once per chromium object.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _chromium: any = null
let _stealthApplied = false

async function getChromium(): Promise<typeof _chromium> {
  if (_chromium && _stealthApplied) return _chromium
  // playwright-extra is CJS; use dynamic import compatible with module:node16.
  const pe          = (await import('playwright-extra' as string)) as { chromium: typeof _chromium }
  // puppeteer-extra-plugin-stealth: default export is the factory function itself.
  const StealthPlugin = (await import('puppeteer-extra-plugin-stealth' as string)) as {
    default?: () => unknown
  } & ((() => unknown) | unknown)
  if (!_stealthApplied) {
    // Handle both ESM default-wrapped and raw CJS function exports.
    const plugin = typeof StealthPlugin === 'function'
      ? (StealthPlugin as () => unknown)()
      : (StealthPlugin as { default: () => unknown }).default()
    pe.chromium.use(plugin)
    _stealthApplied = true
  }
  _chromium = pe.chromium
  return _chromium
}

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
    // Malformed URL — launch without proxy rather than crashing.
    return undefined
  }
}

async function getBrowser(): Promise<Browser> {
  const connected = !!browser && browser.isConnected()
  if (needsNewBrowser(BROWSER_MODE, connected, jobsOnBrowser, CONTEXT_REFRESH_EVERY)) {
    if (browser) {
      // In CDP mode close() only drops our client link, not the shared browser.
      await browser.close().catch(() => {})
      browser = null
    }
    const chromium = await getChromium()
    if (BROWSER_WS_ENDPOINT) {
      // Shared farm: egress proxy is configured on the farm endpoint, and the pool
      // manages browser lifecycle — we just hold a thin CDP client per worker.
      browser = (await chromium.connectOverCDP(BROWSER_WS_ENDPOINT)) as Browser
    } else {
      // Choose a residential proxy for the life of this browser (re-chosen each
      // relaunch, every CONTEXT_REFRESH_EVERY jobs). next() fails over to the
      // datacenter tier if residential is empty; a fully-cooling pool launches
      // without a proxy only when ALLOW_DIRECT_FALLBACK is set.
      const mgr = getProxyManager()
      activeProxyUrl = null
      if (mgr) {
        const sel = selectProxy(mgr, 'residential', 'playwright')
        if (!sel.exhausted) activeProxyUrl = sel.url
        else if (!allowDirectFallback()) activeProxyUrl = null
      }
      const proxy = buildProxyConfig(activeProxyUrl)
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
        ...(proxy ? { proxy } : {}),
      })) as Browser
    }
    jobsOnBrowser = 0
    // Reset reference if the browser crashes / the CDP link drops between jobs.
    browser.on('disconnected', () => { browser = null; jobsOnBrowser = 0 })
  }
  jobsOnBrowser++
  return browser!
}

// ── Context creation with stealth randomisation ───────────────────────────────

async function createContext(b: Browser): Promise<BrowserContext> {
  const ua       = randomUserAgent()
  const language = randomFrom(LANGUAGES)
  const viewport = { width: randomInt(1280, 1920), height: randomInt(720, 1080) }

  const ctx = await b.newContext({
    userAgent:         ua,
    viewport,
    locale:            language,
    extraHTTPHeaders:  { 'Accept-Language': `${language},en;q=0.9` },
  })

  // WebGL vendor/renderer and canvas fingerprint noise via init script.
  // Injected before any page script runs. Uses string form to avoid TypeScript
  // DOM type conflicts when tsconfig lib does not include "DOM".
  const glVendor   = randomFrom(WEBGL_VENDORS)
  const glRenderer = randomFrom(WEBGL_RENDERERS)

  await ctx.addInitScript(`
    (() => {
      const vendor   = ${JSON.stringify(glVendor)};
      const renderer = ${JSON.stringify(glRenderer)};

      // Override WebGL unmasked vendor/renderer strings.
      const getParam = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(param) {
        if (param === 37445) return vendor;
        if (param === 37446) return renderer;
        return getParam.call(this, param);
      };
      const getParam2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function(param) {
        if (param === 37445) return vendor;
        if (param === 37446) return renderer;
        return getParam2.call(this, param);
      };

      // Canvas fingerprint noise: flip 1 LSB in the last byte of toDataURL output.
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function() {
        const result = origToDataURL.apply(this, arguments);
        const idx = result.length - 1;
        const code = result.charCodeAt(idx) ^ (Math.random() * 10 | 0);
        return result.slice(0, idx) + String.fromCharCode(code);
      };

      // Remove navigator.webdriver flag (belt-and-suspenders alongside stealth plugin).
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    })();
  `)

  return ctx
}

// ── Resource blocking ─────────────────────────────────────────────────────────
// Block non-essential resource types and known tracking domains to reduce
// bandwidth (Bright Data residential proxy is billed per GB).

const BLOCKED_RESOURCE_TYPES = new Set([
  'image', 'stylesheet', 'font', 'media',
])

const BLOCKED_TRACKING_DOMAINS = [
  'google-analytics.com',
  'googletagmanager.com',
  'facebook.net',
  'fbcdn.net',
  'doubleclick.net',
  'hotjar.com',
  'segment.io',
  'mixpanel.com',
  'amplitude.com',
  'heap.io',
]

async function setupPage(page: Page): Promise<void> {
  await page.route('**/*', (route, request) => {
    const type = request.resourceType()
    const url  = request.url()

    if (BLOCKED_RESOURCE_TYPES.has(type)) {
      return route.abort()
    }
    if (BLOCKED_TRACKING_DOMAINS.some(d => url.includes(d))) {
      return route.abort()
    }
    return route.continue()
  })
}

// ── CAPTCHA detection + async offload ─────────────────────────────────────────
// Detection and 2captcha polling live in ./captcha (pure + unit-pinned). The slow
// (~60 s) solve runs on the dedicated captcha-solver worker so a challenge wave
// can't pin this worker's scarce browser slots. Here we only ever (a) inject a
// token the solver already cached, or (b) offload + release the slot.

/** Thin page-bound wrapper over the pure detector. */
async function detectCaptcha(page: Page): Promise<CaptchaType | null> {
  return detectCaptchaInContent(page.url(), await page.content())
}

/** Inject a solved token into the page and submit the challenge form. */
async function injectCaptchaToken(page: Page, type: CaptchaType, token: string): Promise<void> {
  const responseField = responseFieldFor(type)
  if (!responseField) return
  await page.evaluate(`
    (() => {
      const el = document.getElementById(${JSON.stringify(responseField)})
        || document.querySelector('[name="${responseField}"]');
      if (el) {
        el.value = ${JSON.stringify(token)};
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const submit = document.querySelector('[type="submit"], button[type="submit"]');
      if (submit) submit.click();
    })()
  `)
  await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {})
}

type CaptchaOutcome =
  | { kind: 'clear' }                                   // no challenge, or cleared via cached token
  | { kind: 'unsolvable' }                              // cloudflare / no sitekey — let the parse fail
  | { kind: 'offloaded'; retryAfterMs: number; type: CaptchaType }

/**
 * Handle a CAPTCHA without blocking the worker slot. If a token for this exact
 * page is already cached (solved earlier or by a concurrent job), inject it and
 * continue. Otherwise claim the solve (SET NX, so concurrent jobs and the retry
 * of this one don't double-pay), enqueue it to the solver, and tell the caller to
 * release the slot via a delayed retry.
 */
async function handleCaptcha(page: Page, domain: string): Promise<CaptchaOutcome> {
  const type = await detectCaptcha(page)
  if (!type) return { kind: 'clear' }

  // Cloudflare's JS challenge has no token solve (stealth handles it at nav time).
  // Narrowing here also gives `type` the token-solvable union the solve queue needs.
  if (solveMethodFor(type) === null) return { kind: 'unsolvable' }
  const solvable: 'recaptcha' | 'hcaptcha' = type === 'recaptcha' ? 'recaptcha' : 'hcaptcha'

  const pageUrl = page.url()
  const siteKey = extractSiteKey(await page.content())
  if (!siteKey) return { kind: 'unsolvable' }

  // 1. Cached token from an earlier/concurrent solve → inject inline, no offload.
  const cached = await readCachedToken(redis, type, siteKey, pageUrl)
  if (cached) {
    await injectCaptchaToken(page, type, cached)
    if ((await detectCaptcha(page)) === null) return { kind: 'clear' }
    // Token didn't clear it (stale/expired) — fall through to a fresh offload.
  }

  // 2. Claim the solve atomically; only the winner enqueues a (paid) solve job.
  const won = await redis.set(
    captchaPendingKey(type, siteKey, pageUrl), '1', 'EX', CAPTCHA_PENDING_TTL_SECONDS, 'NX',
  )
  if (won === 'OK') {
    await captchaSolveQueue.add(`solve:${domain}`, { type: solvable, siteKey, pageUrl, domain })
  }
  return { kind: 'offloaded', retryAfterMs: CAPTCHA_RETRY_DELAY_MS, type }
}

// ── BullMQ Worker ─────────────────────────────────────────────────────────────

const worker = new Worker<ScrapeJob>(
  'scrape:playwright',
  async (job: Job<ScrapeJob>) => {
    const { url, domain, urlPath, plan } = job.data
    const priority = PLAN_PRIORITY[plan.toUpperCase()] ?? PLAN_PRIORITY.RECON
    const parser   = getParser(domain)

    // Union any trackingIds batched onto this job after creation (atomic SADD set,
    // see batch-set.ts) so one render serves every merchant tracking this URL.
    const competitorTrackingIds = await unionBatchedTrackingIds(
      redis, String(job.id), job.data.competitorTrackingIds,
    )

    // ── 0. Crawl-delay (robots.txt politeness) — minimum spacing per domain ────
    const cd = await enforceCrawlDelay(domain, redis)
    if (!cd.allowed) {
      await job.moveToDelayed(Date.now() + cd.retryAfterMs)
      return { crawlDelayed: true, domain, retryAfterMs: cd.retryAfterMs }
    }

    // ── 1. Acquire browser + context ─────────────────────────────────────────
    const b   = await getBrowser()
    let ctx: BrowserContext | null = null

    try {
      ctx  = await createContext(b)
      const page = await ctx.newPage()
      await setupPage(page)

      // ── 2. Navigate ────────────────────────────────────────────────────────
      const proxyMgr = getProxyManager()
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
        if (proxyMgr && activeProxyUrl) proxyMgr.reportResult(activeProxyUrl, 200)  // nav ok
      } catch (navErr) {
        // Navigation timeout — cool the proxy, then throw so BullMQ retries.
        if (proxyMgr && activeProxyUrl) proxyMgr.reportResult(activeProxyUrl, 0)
        throw navErr
      }

      // ── 3. CAPTCHA handling — offload the slow solve, don't block the slot ─
      const captcha = await handleCaptcha(page, domain)
      if (captcha.kind === 'offloaded') {
        // A challenge means this IP is flagged — cool it so the next launch rotates.
        if (proxyMgr && activeProxyUrl) proxyMgr.reportResult(activeProxyUrl, 0)
        // Release the browser slot: retry once the solver has had time to cache a
        // token. The retry reads the cached token and injects it inline.
        await job.moveToDelayed(Date.now() + captcha.retryAfterMs)
        return { captchaOffloaded: true, domain, type: captcha.type }
      }
      // 'clear' → proceed to parse. 'unsolvable' (cloudflare / no sitekey) →
      // proceed too; the parse will fail and the job retries/dead-letters.

      // ── 4. Parse ──────────────────────────────────────────────────────────
      const parsed = await parser.parse(page)

      if (parsed.price === null) {
        await validationErrorsQueue.add(`parse-null:${domain}`, {
          domain,
          url,
          competitorTrackingIds,
          reason: 'price_null',
        })
        return { parsed: false, domain }
      }

      // ── 5. Validate ───────────────────────────────────────────────────────
      const prevPriceStr = await redis.get(`last-price:${domain}:${urlPath}`)
      const previousPrice = prevPriceStr !== null ? parseFloat(prevPriceStr) : null
      const validation    = validateParseResult(parsed, previousPrice)

      if (!validation.valid) {
        await validationErrorsQueue.add(`validation-fail:${domain}`, {
          domain,
          url,
          competitorTrackingIds,
          errors: validation.errors,
          result: parsed,
        })
        return { validated: false, domain, errors: validation.errors }
      }

      const normCurrency = normaliseCurrency(parsed.currency)

      // ── 6. Write price snapshot via specter-api (HMAC-signed, idempotent) ──
      // Rendered-doc size approximates the residential bandwidth this fetch billed.
      const respBytes = (await page.content()).length
      const body = buildSnapshotBody({
        url,
        domain,
        urlPath,
        competitorTrackingIds,
        price:        parsed.price,
        currency:     normCurrency,
        inStock:      parsed.inStock,
        title:        parsed.title,
        needsReview:  validation.needsReview,
        jobId:        String(job.id),
        merchantCycleIds: (job.data as { merchantCycleIds?: unknown[] }).merchantCycleIds,
        // Cost attribution: residential when a proxy was used, else a direct fetch.
        proxyTier:    activeProxyUrl ? 'residential' : null,
        respBytes,
      })

      const writeResp = await postPriceSnapshot(body)

      if (!writeResp.ok) {
        throw new Error(`price-snapshot POST failed: ${writeResp.status}`)
      }

      // Cache latest price for spike detection on next scrape cycle (TTL = 2× interval).
      await cacheLastPrice(redis, domain, urlPath, parsed.price, plan)

      // Update the unchanged-streak for adaptive change-detection scheduling.
      await recordPriceObservation(redis, domain, urlPath, parsed.price, parsed.inStock, plan)

      return {
        written:     true,
        domain,
        price:       parsed.price,
        currency:    normCurrency,
        needsReview: validation.needsReview,
      }
    } finally {
      // Always close the context — frees all page resources, cookies, and
      // cached DOM for this job regardless of success or failure.
      if (ctx) await ctx.close().catch(() => {})
    }
  },
  {
    connection:  bullmqConnection,
    concurrency: 5,  // Playwright is CPU/memory heavy; keep concurrency low.
    ...WORKER_RELIABILITY,
  },
)

// ── Dead-letter on exhaustion ─────────────────────────────────────────────────

worker.on('failed', (job, err) => {
  if (!job) return
  const maxAttempts = job.opts.attempts ?? 3
  if (job.attemptsMade < maxAttempts) return

  void (async () => {
    await deadLetterQueue
      .add(job.name, job.data, { priority: job.opts.priority })
      .catch(e => console.error('[playwright] dead-letter enqueue failed:', e))

    await postScrapeFailed({
      domain:                  job.data.domain,
      url_path:                job.data.urlPath,
      competitor_tracking_ids: job.data.competitorTrackingIds,
      // Advance the cycle barrier on terminal failure too (replaces close_expired).
      merchant_cycle_ids:      (job.data as { merchantCycleIds?: unknown[] }).merchantCycleIds ?? [],
      error:                   err.message,
    }).catch(() => {})
  })()
})

worker.on('error', err => console.error('[playwright] worker error:', err))

// ── Graceful shutdown ─────────────────────────────────────────────────────────

const shutdown = async (signal: string) => {
  console.log(`[playwright] ${signal} — draining worker…`)
  await worker.close()
  if (browser) await browser.close().catch(() => {})
  await redis.quit()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT',  () => void shutdown('SIGINT'))

console.log(
  `[playwright] worker started — concurrency 5, browser=${BROWSER_MODE}` +
  `${BROWSER_WS_ENDPOINT ? ' (shared farm)' : ' (local launch)'}, listening on scrape:playwright`,
)
