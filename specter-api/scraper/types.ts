// Plan values in ScrapeJob are always lowercase.
// Priority lookups use PLAN_PRIORITY[job.plan.toUpperCase()].
export type Plan = 'recon' | 'cipher' | 'phantom' | 'predator' | 'eclipse'

// Domain classification stored in Redis at domain:class:{domain}.
// Key absent = UNKNOWN (never probed). BLOCKED means no job created.
export type DomainClass = 'http_ok' | 'js_required' | 'blocked'

export type ScrapeJob = {
  url: string
  domain: string
  urlPath: string
  // IDs from competitor_trackings table — the billing unit (own_product × competitor_url).
  // Multiple merchants may track the same URL; batching merges their tracking IDs into one job.
  // Posted to specter-api as competitor_tracking_ids so signal/OOS logic can fan out per tracking.
  competitorTrackingIds: string[]
  plan: Plan
}

// Enqueued by the Playwright worker when it meets a CAPTCHA it can't serve from
// cache. The captcha-solver worker does the slow 2captcha poll off the critical
// path and caches the token; the original scrape job is delay-retried and reads it.
export type CaptchaSolveJob = {
  type:    'recaptcha' | 'hcaptcha'
  siteKey: string
  pageUrl: string
  domain:  string
}

// Produced by all workers (HTTP and Playwright) and validated before writing.
export type ParseResult = {
  price: number | null
  inStock: boolean
  currency: string
  title: string | null
}
