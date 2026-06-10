import 'dotenv/config'
import { Worker, type Job } from 'bullmq'
import { redis, bullmqConnection } from '../redis'
import { WORKER_RELIABILITY } from '../worker-options'
import { fetchTwoCaptchaToken, cacheToken, solveMethodFor } from './captcha'
import type { CaptchaSolveJob } from '../types'

// Dedicated CAPTCHA-solving worker. The Playwright worker offloads the slow
// (~60 s) 2captcha poll here so its scarce browser slots aren't held hostage by
// a challenge wave. On success the token is cached in state Redis under the
// page's deterministic key; the delay-retried scrape job reads it and injects it
// without paying for or waiting on another solve.
//
// This is pure HTTP polling (no browser), so concurrency is generous — a stuck
// poll costs an HTTP socket, not a Chromium process.

const TWOCAPTCHA_KEY = process.env.TWOCAPTCHA_API_KEY ?? ''

const worker = new Worker<CaptchaSolveJob>(
  'captcha:solve',
  async (job: Job<CaptchaSolveJob>) => {
    const { type, siteKey, pageUrl, domain } = job.data
    const method = solveMethodFor(type)
    if (!method) {
      // Only token-solvable challenges should ever be enqueued; ignore others.
      return { solved: false, reason: 'no_token_method', domain }
    }

    const token = await fetchTwoCaptchaToken(method, siteKey, pageUrl, TWOCAPTCHA_KEY)
    if (!token) {
      // Throw so BullMQ retries (attempts: 2) — a transient 2captcha hiccup may clear.
      throw new Error(`captcha solve failed for ${domain} (${type})`)
    }

    await cacheToken(redis, type, siteKey, pageUrl, token)
    return { solved: true, domain, type }
  },
  {
    connection:  bullmqConnection,
    concurrency: 20,  // HTTP-only; safe to run many solves in parallel.
    ...WORKER_RELIABILITY,
  },
)

worker.on('error', err => console.error('[captcha-solver] worker error:', err))

const shutdown = async (signal: string) => {
  console.log(`[captcha-solver] ${signal} — draining worker…`)
  await worker.close()
  await redis.quit()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT',  () => void shutdown('SIGINT'))

console.log('[captcha-solver] worker started — concurrency 20, listening on captcha:solve')
