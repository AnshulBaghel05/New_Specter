import type { Redis } from 'ioredis'
import robotsParser from 'robots-parser'

const TTL_SECONDS = 86_400 // 24 hours

export interface RobotsChecker {
  isAllowed: (urlPath: string) => boolean
  /** robots.txt Crawl-delay for our UA, in seconds (null when unspecified). */
  crawlDelaySeconds: () => number | null
}

/**
 * Returns a RobotsChecker for the given domain.
 *
 * Caches the raw robots.txt content in Redis at `robots:{domain}` with a
 * 24-hour TTL. On a cache miss the file is fetched over HTTPS; a network
 * failure or non-200 status is treated as an empty robots.txt (allow all),
 * which is the industry-standard behaviour when the file is unreachable.
 *
 * `isAllowed(urlPath)` checks the "Specterbot" user-agent string. SPECTER's
 * compliance identity is **Specterbot** — robots evaluation and Crawl-delay are
 * read under it, and robots.txt is fetched with the Specterbot UA. Fetch workers
 * deliberately present a browser User-Agent on the *product* requests (anti-bot
 * necessity: many storefronts 403 non-browser agents), but we still honor the
 * site's robots disallow rules and Crawl-delay under our bot identity — a
 * documented browser-emulation policy, not an attempt to evade robots. Returning
 * false means the domain has explicitly disallowed our crawler for that path.
 */
export async function getRobotsChecker(
  domain: string,
  redisClient: Redis,
): Promise<RobotsChecker> {
  const cacheKey = `robots:${domain}`
  const robotsUrl = `https://${domain}/robots.txt`

  let robotsTxt = await redisClient.get(cacheKey)

  if (robotsTxt === null) {
    try {
      // Dynamic import: got v15 is ESM-only; dynamic import bridges CJS ↔ ESM.
      const got = (await import('got')).default
      const response = await got(robotsUrl, {
        timeout:         { request: 5_000 },
        throwHttpErrors: false,
        headers:         { 'User-Agent': 'Specterbot/1.0 (+https://specterapp.io/bot)' },
      })
      robotsTxt = response.statusCode === 200 ? String(response.body) : ''
    } catch {
      // Network failure → treat as empty robots.txt (allow all).
      robotsTxt = ''
    }
    await redisClient.setex(cacheKey, TTL_SECONDS, robotsTxt)
  }

  const parser = robotsParser(robotsUrl, robotsTxt)

  // Cache the Crawl-delay (seconds) so fetch workers can honor it as min-spacing
  // (rate-limiter.enforceCrawlDelay) without re-fetching robots.txt per request.
  const crawlDelay = parser.getCrawlDelay ? parser.getCrawlDelay('Specterbot') : undefined
  if (typeof crawlDelay === 'number' && crawlDelay > 0) {
    await redisClient.setex(`crawl-delay:config:${domain}`, TTL_SECONDS, String(crawlDelay))
  }

  return {
    isAllowed(urlPath: string): boolean {
      const normalised = urlPath.startsWith('/') ? urlPath : `/${urlPath}`
      const fullUrl    = `https://${domain}${normalised}`
      // null means unknown (path not mentioned in robots.txt) → allow.
      return parser.isAllowed(fullUrl, 'Specterbot') !== false
    },
    crawlDelaySeconds(): number | null {
      return typeof crawlDelay === 'number' ? crawlDelay : null
    },
  }
}
