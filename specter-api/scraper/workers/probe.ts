import 'dotenv/config'
import { Worker, type Job } from 'bullmq'
import { load as cheerioLoad } from 'cheerio'
import { redis, bullmqConnection } from '../redis'
import { httpQueue, playwrightQueue, deadLetterQueue } from '../queue'
import { PLAN_PRIORITY } from '../plans'
import { cacheDomainClass } from '../state-ttl'
import { postScrapeFailed, postDomainBlocked } from '../lib/ingest-client'
import { getProxyManager, agentFor, selectProxy, allowDirectFallback } from '../proxy/runtime'
import { WORKER_RELIABILITY } from '../worker-options'
import { getRobotsChecker } from './robots'
import { detectPlatform } from '../domains/platform'
import { unionBatchedTrackingIds } from '../batch-set'
import type { ScrapeJob } from '../types'

// Cloudflare JS-challenge body markers (heuristic 2)
const CF_BODY_MARKERS = [
  'cf-challenge-error',
  'Just a moment...',
  '<title>Just a moment</title>',
  'Checking your browser',
]

// ── Classification result ─────────────────────────────────────────────────────

type ClassifyVia = 'bot_wall' | 'robots' | 'heuristic'

interface ClassifyResult {
  classification: 'http_ok' | 'js_required' | 'blocked'
  via: ClassifyVia
}

// ── Core classification logic ─────────────────────────────────────────────────

async function classifyUrl(
  url:     string,
  domain:  string,
  urlPath: string,
): Promise<ClassifyResult> {
  const got = (await import('got')).default

  // ── HEAD request — no proxy ────────────────────────────────────────────────
  // Used cheaply to detect bot walls before committing to a full GET.
  let headStatus = 0
  let cfMitigatedHead = ''

  try {
    const headResp = await got.head(url, {
      timeout:         { request: 10_000 },
      throwHttpErrors: false,
      followRedirect:  true,
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    headStatus      = headResp.statusCode
    cfMitigatedHead = String(headResp.headers['cf-mitigated'] ?? '')
  } catch {
    // HEAD not supported or timed out — fall through to GET.
  }

  // Cloudflare JS challenge detected at HEAD stage → JS_REQUIRED, not BLOCKED.
  // Playwright can solve the JS challenge; marking BLOCKED would lose the merchant.
  if (cfMitigatedHead === 'challenge') {
    return { classification: 'js_required', via: 'heuristic' }
  }

  // Hard 403 with no CF challenge header → bot wall, cannot scrape.
  if (headStatus === 403 && cfMitigatedHead !== 'challenge') {
    return { classification: 'blocked', via: 'bot_wall' }
  }

  // ── GET request — datacenter proxy ────────────────────────────────────────
  // Use a plain Record so we can optionally append `dispatcher` without fighting
  // the got Options type (which marks dispatcher as a Dispatcher | undefined but
  // ProxyAgent is a subtype that TypeScript won't accept without the cast).
  const getOptions: Record<string, unknown> = {
    timeout:         { request: 10_000 },
    throwHttpErrors: false,
    followRedirect:  true,
    decompress:      true,
    headers: {
      'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  }

  // Proxy selection (datacenter tier; health-aware, with residential failover).
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
  // got v15+ supports an undici Dispatcher via the `dispatcher` option; one
  // ProxyAgent per URL is reused across jobs (no per-job allocation).
  if (proxyUrl) getOptions.dispatcher = agentFor(proxyUrl)

  let html = ''
  let cfMitigatedGet = ''
  let getHeaders: Record<string, unknown> = {}

  try {
    const getResp = await got(url, getOptions)
    html             = String(getResp.body)
    cfMitigatedGet   = String(getResp.headers['cf-mitigated'] ?? '')
    getHeaders       = getResp.headers as Record<string, unknown>  // for platform fingerprint
    if (proxyMgr && proxyUrl) proxyMgr.reportResult(proxyUrl, getResp.statusCode)
  } catch {
    // GET failed — cool the proxy; safe default is JS_REQUIRED (heuristic 7).
    if (proxyMgr && proxyUrl) proxyMgr.reportResult(proxyUrl, 0)
    return { classification: 'js_required', via: 'heuristic' }
  }

  // ── Heuristic 1 — robots.txt ───────────────────────────────────────────────
  // Must run BEFORE body heuristics so the robots.txt TTL is set on first probe.
  const robotsChecker = await getRobotsChecker(domain, redis)
  if (!robotsChecker.isAllowed(urlPath)) {
    return { classification: 'blocked', via: 'robots' }
  }

  // ── Heuristic 2 — Cloudflare JS challenge in GET body ─────────────────────
  if (
    cfMitigatedGet === 'challenge' ||
    CF_BODY_MARKERS.some(m => html.includes(m))
  ) {
    return { classification: 'js_required', via: 'heuristic' }
  }

  // ── Heuristic 2b — known storefront platform → http path ──────────────────
  // Shopify (.json) and WooCommerce (Store API) expose cheap structured
  // endpoints the http worker can parse, so a JS-rendered price must NOT send
  // these to Playwright. This reroute is the core cost win of Audit #5.
  if (detectPlatform(getHeaders, html)) {
    return { classification: 'http_ok', via: 'heuristic' }
  }

  // ── Heuristic 3 — Next.js SSR (__NEXT_DATA__) ─────────────────────────────
  if (html.includes('<script id="__NEXT_DATA__"')) {
    return { classification: 'http_ok', via: 'heuristic' }
  }

  // ── Heuristic 4 — JSON-LD schema.org/Product with offers.price ───────────
  const jsonLdBlocks = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )
  if (jsonLdBlocks) {
    for (const block of jsonLdBlocks) {
      const raw = block
        .replace(/<script[^>]*>/i, '')
        .replace(/<\/script>/i, '')
        .trim()
      try {
        const data    = JSON.parse(raw) as unknown
        const entries = Array.isArray(data) ? data : [data]
        for (const entry of entries) {
          if (
            entry !== null &&
            typeof entry === 'object' &&
            (entry as Record<string, unknown>)['@type'] === 'Product'
          ) {
            const offers = (entry as Record<string, unknown>).offers
            if (
              offers !== null &&
              typeof offers === 'object' &&
              (
                (offers as Record<string, unknown>).price != null ||
                (offers as Record<string, unknown>).priceSpecification != null
              )
            ) {
              return { classification: 'http_ok', via: 'heuristic' }
            }
          }
        }
      } catch {
        // Malformed JSON-LD — skip block, continue.
      }
    }
  }

  // ── Heuristic 5 — JS framework fingerprints ────────────────────────────────
  if (
    html.includes('window.__INITIAL_STATE__') ||
    html.includes('ng-version')               ||
    html.includes('id="__nuxt__"')
  ) {
    return { classification: 'js_required', via: 'heuristic' }
  }

  // ── Heuristic 6 — CSS price selectors ─────────────────────────────────────
  // Use cheerio to accurately evaluate CSS selector presence.
  const $ = cheerioLoad(html)
  if (
    $('[data-price]').length > 0 ||
    $('.price').length          > 0 ||
    $('#price').length          > 0 ||
    $('span.a-price').length    > 0
  ) {
    return { classification: 'http_ok', via: 'heuristic' }
  }

  // ── Heuristic 7 — safe default ─────────────────────────────────────────────
  return { classification: 'js_required', via: 'heuristic' }
}

// ── BullMQ Worker ─────────────────────────────────────────────────────────────

const worker = new Worker<ScrapeJob>(
  'scrape:probe',
  async (job: Job<ScrapeJob>) => {
    const { url, domain, urlPath, plan } = job.data
    const priority = PLAN_PRIORITY[plan.toUpperCase()] ?? PLAN_PRIORITY.RECON

    // Union any trackingIds batched onto this probe job (atomic SADD set, see
    // batch-set.ts) and carry them forward to the follow-up scrape job below, so
    // merchants that piled onto this URL aren't dropped at the probe→fetch handoff.
    const competitorTrackingIds = await unionBatchedTrackingIds(
      redis, String(job.id), job.data.competitorTrackingIds,
    )
    const batchedData: ScrapeJob = { ...job.data, competitorTrackingIds }

    const { classification, via } = await classifyUrl(url, domain, urlPath)

    // Persist classification with a 7-day TTL so it self-heals: a site that
    // changes its JS requirements is re-probed within a week, not pinned forever.
    await cacheDomainClass(redis, domain, classification)

    // ── BLOCKED path ───────────────────────────────────────────────────────────
    if (classification === 'blocked') {
      // robotsBlocked === true only when the URL was blocked by robots.txt.
      // Bot-wall blocks set robotsBlocked = false (do NOT mark robots_blocked
      // on the competitor_url record — those blocks are infra-level, not policy).
      const robotsBlocked = via === 'robots'

      // HMAC-signed — the /internal router rejects unsigned posts with 401, which
      // would leave the domain un-marked and silently re-scraped every cycle.
      await postDomainBlocked({
        domain,
        competitor_tracking_ids: competitorTrackingIds,
        robots_blocked:          robotsBlocked,
      }).catch(err => {
        // Log but do not fail the job — the domain classification is already
        // written to Redis. specter-api notification is best-effort here.
        console.error(`[probe] failed to notify specter-api for ${domain}:`, err)
      })

      return { classification, domain, via }
    }

    // ── Enqueue follow-up scrape job ──────────────────────────────────────────
    // Pass batchedData (own ids ∪ batched) so the fetch worker serves every
    // merchant tracking this URL, not just those present when the probe was created.
    const followUpQueue = classification === 'http_ok' ? httpQueue : playwrightQueue
    await followUpQueue.add(
      `${domain}:${urlPath}`,
      batchedData,
      { priority },
    )

    return { classification, domain, via }
  },
  {
    connection:  bullmqConnection,
    concurrency: 50,  // I/O-bound — no browser, safe at high concurrency.
    ...WORKER_RELIABILITY,
  },
)

// ── Dead-letter on exhaustion ─────────────────────────────────────────────────
// BullMQ does not automatically move jobs to a dead-letter queue. We do it
// manually on the `failed` event once all retry attempts are exhausted.

worker.on('failed', (job, err) => {
  if (!job) return

  const maxAttempts = job.opts.attempts ?? 3
  if (job.attemptsMade < maxAttempts) return  // still has retries left

  void (async () => {
    await deadLetterQueue
      .add(job.name, job.data, { priority: job.opts.priority })
      .catch(e => console.error('[probe] dead-letter enqueue failed:', e))

    await postScrapeFailed({
      domain:                  job.data.domain,
      url_path:                job.data.urlPath,
      competitor_tracking_ids: job.data.competitorTrackingIds,
      // Advance the cycle barrier on terminal failure too (replaces close_expired).
      merchant_cycle_ids:      (job.data as { merchantCycleIds?: unknown[] }).merchantCycleIds ?? [],
      error:                   err.message,
    }).catch(() => {})  // fire-and-forget (HMAC-signed)
  })()
})

worker.on('error', err => {
  console.error('[probe] worker error:', err)
})

// ── Graceful shutdown ─────────────────────────────────────────────────────────

const shutdown = async (signal: string) => {
  console.log(`[probe] ${signal} — draining worker…`)
  await worker.close()
  await redis.quit()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT',  () => void shutdown('SIGINT'))

console.log('[probe] worker started — concurrency 50, listening on scrape:probe')
