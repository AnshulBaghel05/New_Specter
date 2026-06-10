import 'dotenv/config'
import { Worker, type Job } from 'bullmq'
import { redis, bullmqConnection } from '../redis'
import { playwrightQueue, validationErrorsQueue, deadLetterQueue } from '../queue'
import { PLAN_PRIORITY } from '../plans'
import { checkRateLimit, enforceCrawlDelay } from './rate-limiter'
import { validateParseResult } from './validate'
import { normaliseCurrency } from '../domains/generic'
import { resolvePlatformParse } from '../domains'
import { postPriceSnapshot, postScrapeFailed, buildSnapshotBody } from '../lib/ingest-client'
import { cacheLastPrice, cacheDomainClass, recordPriceObservation } from '../state-ttl'
import { getProxyManager, agentFor, selectProxy, allowDirectFallback, requeueDelayMs } from '../proxy/runtime'
import { WORKER_RELIABILITY } from '../worker-options'
import type { ScrapeJob, ParseResult } from '../types'

const HTTP_FAIL_LIMIT = 3  // consecutive parse failures before reclassifying

// ── HTTP Worker ───────────────────────────────────────────────────────────────

const worker = new Worker<ScrapeJob>(
  'scrape:http',
  async (job: Job<ScrapeJob>) => {
    const { url, domain, urlPath, competitorTrackingIds, plan } = job.data
    const priority = PLAN_PRIORITY[plan.toUpperCase()] ?? PLAN_PRIORITY.RECON

    // Detect Shopify stores for rate-limit tier selection.
    // We rely on the domain pattern; header-based detection happens after GET.
    const isShopify = /myshopify\.com/i.test(domain)

    // ── 1. Rate limit check ────────────────────────────────────────────────────
    const rl = await checkRateLimit(domain, redis, isShopify)
    if (!rl.allowed) {
      // moveToDelayed does not consume a retry attempt.
      await job.moveToDelayed(Date.now() + rl.retryAfterMs)
      return { rateLimited: true, domain, retryAfterMs: rl.retryAfterMs }
    }

    // ── 1b. Crawl-delay (robots.txt politeness) — minimum spacing per domain ────
    const cd = await enforceCrawlDelay(domain, redis)
    if (!cd.allowed) {
      await job.moveToDelayed(Date.now() + cd.retryAfterMs)
      return { crawlDelayed: true, domain, retryAfterMs: cd.retryAfterMs }
    }

    // ── 2. GET via datacenter proxy ────────────────────────────────────────────
    const got = (await import('got')).default

    // Proxy selection (datacenter tier; health-aware, with residential failover).
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

    let html         = ''
    let statusCode   = 0
    let retryAfter   = 60_000  // default 60s for 429
    let responseHeaders: Record<string, unknown> = {}

    try {
      const response = await got(url, getOptions)
      statusCode = response.statusCode
      html       = String(response.body)
      responseHeaders = response.headers as Record<string, unknown>  // for platform fingerprint
      // Feed the proxy outcome back: a ban status cools this IP, a success recovers it.
      if (proxyMgr && proxyUrl) proxyMgr.reportResult(proxyUrl, statusCode)

      // Detect Shopify via response header (covers custom domains).
      const shopifyHeader = response.headers['x-shopify-stage']
        ?? response.headers['x-shopify-request-id']
      if (shopifyHeader && !isShopify) {
        // Re-check rate limit with Shopify tier for this domain going forward.
        const shopifyRl = await checkRateLimit(domain, redis, true)
        if (!shopifyRl.allowed) {
          await job.moveToDelayed(Date.now() + shopifyRl.retryAfterMs)
          return { rateLimited: true, domain, isShopify: true }
        }
      }
    } catch (err) {
      // Network error — cool the proxy and count a parse failure for the http-fail counter.
      if (proxyMgr && proxyUrl) proxyMgr.reportResult(proxyUrl, 0)
      await incrementHttpFailCounter(domain, job.data, priority)
      throw err  // re-throw so BullMQ retries via exponential backoff
    }

    // ── HTTP 429 — Too Many Requests ──────────────────────────────────────────
    if (statusCode === 429) {
      // Honour Retry-After header when present; default to 60s.
      // Does NOT consume a retry attempt.
      const rawRetryAfter = html.match(/Retry-After:\s*(\d+)/i)?.[1]
      if (rawRetryAfter) retryAfter = parseInt(rawRetryAfter, 10) * 1_000
      await job.moveToDelayed(Date.now() + retryAfter)
      return { rateLimited: false, http429: true, domain, retryAfterMs: retryAfter }
    }

    // ── 3. Parse pipeline ──────────────────────────────────────────────────────
    // Structured-first: prefer the platform endpoint (Shopify .json / Woo Store
    // API) over HTML selectors — a contractual schema survives theme changes.
    // Reuses this worker's datacenter proxy dispatcher; null on any failure →
    // generic HTML fallback inside the resolver.
    const fetchText = async (u: string): Promise<string | null> => {
      try {
        const r = await got(u, { ...getOptions, method: 'GET' })
        return r.statusCode >= 200 && r.statusCode < 300 ? String(r.body) : null
      } catch {
        return null
      }
    }
    const resolved = await resolvePlatformParse(url, html, responseHeaders, fetchText)
    const parsed: ParseResult = resolved ?? { price: null, inStock: false, currency: 'USD', title: null }

    if (parsed.price === null) {
      // Parse failed — increment failure counter, possibly reclassify.
      await incrementHttpFailCounter(domain, job.data, priority)
      // Not a job failure — caller logs to validation-errors queue.
      await validationErrorsQueue.add(`parse-null:${domain}`, {
        domain,
        url,
        competitorTrackingIds,
        reason:    'price_null',
        html_head: html.slice(0, 500),
      })
      return { parsed: false, domain }
    }

    // Successful parse — reset the failure counter.
    await redis.del(`domain:http-fail:${domain}`)

    // ── 4. Data validation ─────────────────────────────────────────────────────
    // Fetch previous price for spike detection (Rule 5).
    const prevPriceStr = await redis.get(`last-price:${domain}:${urlPath}`)
    const previousPrice = prevPriceStr !== null ? parseFloat(prevPriceStr) : null

    const validation = validateParseResult(parsed, previousPrice)

    if (!validation.valid) {
      await validationErrorsQueue.add(`validation-fail:${domain}`, {
        domain,
        url,
        competitorTrackingIds,
        errors:  validation.errors,
        result:  parsed,
      })
      return { validated: false, domain, errors: validation.errors }
    }

    // Normalise currency for the write.
    const normCurrency = normaliseCurrency(parsed.currency)

    // ── 5. Write price snapshot via specter-api (HMAC-signed, idempotent) ───────
    const body = buildSnapshotBody({
      url,
      domain,
      urlPath,
      competitorTrackingIds,
      price:       parsed.price,
      currency:    normCurrency,
      inStock:     parsed.inStock,
      title:       parsed.title,
      needsReview: validation.needsReview,
      jobId:       String(job.id),
      merchantCycleIds: (job.data as { merchantCycleIds?: unknown[] }).merchantCycleIds,
      // Cost attribution: datacenter when a proxy was used, else a direct fetch.
      proxyTier:   proxyUrl ? 'datacenter' : null,
      respBytes:   html.length,
    })

    const writeResp = await postPriceSnapshot(body)

    if (!writeResp.ok) {
      // specter-api write failure — propagate so BullMQ retries the job.
      throw new Error(`price-snapshot POST failed: ${writeResp.status}`)
    }

    // Cache latest price for Rule-5 spike detection on next scrape (TTL = 2× interval).
    await cacheLastPrice(redis, domain, urlPath, parsed.price, plan)

    // Update the unchanged-streak so the scheduler can back this URL off toward
    // its plan cap if price + stock keep repeating (adaptive change-detection).
    await recordPriceObservation(redis, domain, urlPath, parsed.price, parsed.inStock, plan)

    return {
      written:     true,
      domain,
      price:       parsed.price,
      currency:    normCurrency,
      needsReview: validation.needsReview,
    }
  },
  {
    connection:  bullmqConnection,
    concurrency: 30,
    ...WORKER_RELIABILITY,
  },
)

// ── http-fail counter helpers ─────────────────────────────────────────────────

async function incrementHttpFailCounter(
  domain:   string,
  jobData:  ScrapeJob,
  priority: number,
): Promise<void> {
  const key   = `domain:http-fail:${domain}`
  const count = await redis.incr(key)

  if (count >= HTTP_FAIL_LIMIT) {
    // Reclassify to JS_REQUIRED and re-enqueue to Playwright queue (7-day TTL → self-heals).
    await cacheDomainClass(redis, domain, 'js_required')
    await redis.del(key)  // reset counter after reclassification

    await playwrightQueue.add(
      `${domain}:${jobData.urlPath}`,
      jobData,
      { priority },
    )
  }
}

// ── Dead-letter on exhaustion ─────────────────────────────────────────────────

worker.on('failed', (job, err) => {
  if (!job) return
  const maxAttempts = job.opts.attempts ?? 3
  if (job.attemptsMade < maxAttempts) return

  void (async () => {
    await deadLetterQueue
      .add(job.name, job.data, { priority: job.opts.priority })
      .catch(e => console.error('[http] dead-letter enqueue failed:', e))

    await postScrapeFailed({
      domain:                  job.data.domain,
      url_path:                job.data.urlPath,
      competitor_tracking_ids: job.data.competitorTrackingIds,
      // Advance the cycle barrier on terminal failure too, so a never-landing URL
      // can't stall a merchant's signals (replaces the close_expired sweep).
      merchant_cycle_ids:      (job.data as { merchantCycleIds?: unknown[] }).merchantCycleIds ?? [],
      error:                   err.message,
    }).catch(() => {})
  })()
})

worker.on('error', err => {
  console.error('[http] worker error:', err)
})

// ── Graceful shutdown ─────────────────────────────────────────────────────────

const shutdown = async (signal: string) => {
  console.log(`[http] ${signal} — draining worker…`)
  await worker.close()
  await redis.quit()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT',  () => void shutdown('SIGINT'))

console.log('[http] worker started — concurrency 30, listening on scrape:http')
