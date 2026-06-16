import { Queue } from 'bullmq'
import { bullmqConnection } from './redis'
import type { ScrapeJob, CaptchaSolveJob } from './types'

// Shared options applied to all active scrape queues.
// Ops/dead-letter queues are intentionally excluded — they have no workers
// and must not auto-remove failed jobs so ops can inspect them.
const defaultJobOptions = {
  attempts: 3,
  // Custom retry ladder (1m → 5m → 30m) — see backoff.ts; the strategy is
  // registered on every worker via WORKER_RELIABILITY.settings.backoffStrategy.
  backoff: { type: 'custom' },
  removeOnComplete: 100,
  removeOnFail: 500,
}

// ── Active scrape queues (have workers) ───────────────────────────────────────

export const probeQueue = new Queue<ScrapeJob>('scrape:probe', {
  connection: bullmqConnection,
  defaultJobOptions,
})

export const httpQueue = new Queue<ScrapeJob>('scrape:http', {
  connection: bullmqConnection,
  defaultJobOptions,
})

export const playwrightQueue = new Queue<ScrapeJob>('scrape:playwright', {
  connection: bullmqConnection,
  defaultJobOptions,
})

// CAPTCHA solves offloaded by the Playwright worker. Worked by captcha-solver.ts,
// which does the slow 2captcha poll and caches the token for the delay-retried scrape.
// Few attempts: a solve that fails twice is unlikely to succeed on a third poll.
export const captchaSolveQueue = new Queue<CaptchaSolveJob>('captcha:solve', {
  connection: bullmqConnection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
})

// ── Ops / dead-letter queues (no workers — inspection only) ───────────────────

// Receives jobs after 3 consecutive failures across all active queues.
export const deadLetterQueue = new Queue<ScrapeJob>('scrape:dead-letter', {
  connection: bullmqConnection,
})

// Receives validation failure records written by HTTP and Playwright workers.
// Not a job failure — parse succeeded but data did not pass validation rules.
export const validationErrorsQueue = new Queue('scrape:validation-errors', {
  connection: bullmqConnection,
})

// Receives AI pricing engine errors (hallucinations, quota exceeded, etc.).
// No worker — ops inspection only. Must be instantiated so BullMQ registers
// the queue in Redis and the Bull Board dashboard can display it.
export const aiErrorsQueue = new Queue('scrape:ai-errors', {
  connection: bullmqConnection,
})

// Convenience array used by scheduler main() to verify queue health on startup.
export const ALL_QUEUES = [
  probeQueue,
  httpQueue,
  playwrightQueue,
  captchaSolveQueue,
  deadLetterQueue,
  validationErrorsQueue,
  aiErrorsQueue,
] as const
