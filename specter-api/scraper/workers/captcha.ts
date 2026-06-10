import { createHash } from 'crypto'

// ── CAPTCHA challenge taxonomy ────────────────────────────────────────────────
// recaptcha / hcaptcha are token-solvable via 2captcha; cloudflare's JS challenge
// is handled by the stealth plugin at navigation time and has no token solve.

export type CaptchaType = 'recaptcha' | 'hcaptcha' | 'cloudflare'

// 2captcha tokens (reCAPTCHA/hCaptcha) are valid for ~120 s after issue. We cache
// a solved token just under that so a retry of the same page reuses it instead of
// paying for and waiting on another solve — but never serves a stale, expired one.
export const CAPTCHA_TOKEN_TTL_SECONDS = 110

// A 2captcha poll runs up to ~60 s. While one is in flight we mark the page
// "pending" so neither a concurrent job nor the delay-retry of this one enqueues a
// second (paid) solve. Covers the poll window with margin; self-expires if a
// solver process dies mid-poll.
export const CAPTCHA_PENDING_TTL_SECONDS = 90

/** Minimal state-Redis surface this module needs (so tests use a tiny fake). */
export interface TokenRedis {
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>
}

// ── Pure helpers (unit-pinned; the worker glue below is thin over these) ───────

/** 2captcha `method` for a challenge type, or null when there is no token solve. */
export function solveMethodFor(type: CaptchaType): 'userrecaptcha' | 'hcaptcha' | null {
  if (type === 'recaptcha') return 'userrecaptcha'
  if (type === 'hcaptcha')  return 'hcaptcha'
  return null  // cloudflare — solved (or not) by stealth at navigation, not by token
}

/** DOM field the solved token is written into before submitting the form. */
export function responseFieldFor(type: CaptchaType): string | null {
  if (type === 'recaptcha') return 'g-recaptcha-response'
  if (type === 'hcaptcha')  return 'h-captcha-response'
  return null
}

/**
 * Redis key for a solved token. Deterministic in (type, siteKey, pageUrl): the
 * solver writes under it and the Playwright worker reads under it, so an
 * offloaded solve and the retry that consumes it always rendezvous. siteKey +
 * pageUrl are hashed to keep the key bounded and free of URL/query characters.
 */
export function captchaTokenKey(type: CaptchaType, siteKey: string, pageUrl: string): string {
  const digest = createHash('sha1').update(`${siteKey}|${pageUrl}`).digest('hex')
  return `captcha:token:${type}:${digest}`
}

/**
 * Redis key for an in-flight solve claim (SET NX'd by the worker that offloads).
 * Same (type, siteKey, pageUrl) identity as the token key so the claim and the
 * eventual token line up on the exact page being solved.
 */
export function captchaPendingKey(type: CaptchaType, siteKey: string, pageUrl: string): string {
  const digest = createHash('sha1').update(`${siteKey}|${pageUrl}`).digest('hex')
  return `captcha:pending:${type}:${digest}`
}

/** Classify a challenge from the page URL + HTML. Pure mirror of detectCaptcha(page). */
export function detectCaptchaInContent(url: string, content: string): CaptchaType | null {
  if (content.includes('g-recaptcha')) return 'recaptcha'
  if (content.includes('h-captcha') || content.includes('hcaptcha.com')) return 'hcaptcha'
  if (
    content.includes('Just a moment') ||
    content.includes('cf-challenge')  ||
    content.includes('cf-turnstile')  ||
    url.includes('/cdn-cgi/challenge')
  ) return 'cloudflare'
  return null
}

/** Extract `data-sitekey` (reCAPTCHA and hCaptcha both expose it). */
export function extractSiteKey(content: string): string | null {
  const m = content.match(/data-sitekey="([^"]+)"/)
  return m ? m[1] : null
}

// ── Token cache (state Redis) ─────────────────────────────────────────────────

/** Read a previously solved token for this page, or null if none cached. */
export async function readCachedToken(
  redis: TokenRedis, type: CaptchaType, siteKey: string, pageUrl: string,
): Promise<string | null> {
  return redis.get(captchaTokenKey(type, siteKey, pageUrl))
}

/** Cache a solved token WITH a TTL under the validity window (never TTL-less). */
export async function cacheToken(
  redis: TokenRedis, type: CaptchaType, siteKey: string, pageUrl: string, token: string,
): Promise<void> {
  await redis.set(captchaTokenKey(type, siteKey, pageUrl), token, 'EX', CAPTCHA_TOKEN_TTL_SECONDS)
}

// ── 2captcha submit + poll (the slow path — runs on the solver worker) ─────────

const TWOCAPTCHA_API = 'https://2captcha.com'

/**
 * Submit a challenge to 2captcha and poll for the solution token. Returns the
 * token or null on failure/timeout. This is the ~60 s blocking call that Task 3.2
 * moves OFF the Playwright worker and onto the dedicated captcha-solver worker.
 */
export async function fetchTwoCaptchaToken(
  method:  string,
  siteKey: string,
  pageUrl: string,
  apiKey:  string,
): Promise<string | null> {
  if (!apiKey) return null

  try {
    const got = (await import('got')).default
    const keyParam = method === 'userrecaptcha' ? 'googlekey' : 'sitekey'
    const submitUrl =
      `${TWOCAPTCHA_API}/in.php` +
      `?key=${encodeURIComponent(apiKey)}` +
      `&method=${method}` +
      `&${keyParam}=${encodeURIComponent(siteKey)}` +
      `&pageurl=${encodeURIComponent(pageUrl)}` +
      `&json=1`

    const submitResp = await got(submitUrl, { responseType: 'json' })
    const submit     = submitResp.body as { status: number; request: string }
    if (!submit.status) {
      console.warn('[captcha] 2captcha submit error:', submit.request)
      return null
    }
    const taskId = submit.request

    // Poll up to 60 s (12 × 5 s).
    for (let i = 0; i < 12; i++) {
      await new Promise<void>(r => setTimeout(r, 5_000))
      const pollResp = await got(
        `${TWOCAPTCHA_API}/res.php?key=${encodeURIComponent(apiKey)}&action=get&id=${taskId}&json=1`,
        { responseType: 'json' },
      )
      const poll = pollResp.body as { status: number; request: string }
      if (poll.status === 1) return poll.request
      if (poll.request !== 'CAPCHA_NOT_READY') {
        console.warn('[captcha] 2captcha poll error:', poll.request)
        return null
      }
    }
  } catch (err) {
    console.warn('[captcha] 2captcha request failed:', err)
  }
  return null
}
