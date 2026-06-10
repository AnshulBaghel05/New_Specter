import { describe, it, expect } from 'vitest'
import {
  solveMethodFor,
  responseFieldFor,
  captchaTokenKey,
  captchaPendingKey,
  detectCaptchaInContent,
  extractSiteKey,
  cacheToken,
  readCachedToken,
  CAPTCHA_TOKEN_TTL_SECONDS,
  CAPTCHA_PENDING_TTL_SECONDS,
  type TokenRedis,
} from '../workers/captcha'

// Tiny fake recording set() calls and serving get() from a map.
function fakeRedis(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed))
  const calls: Array<[string, string, string, number]> = []
  const redis: TokenRedis = {
    async get(key) {
      return store.has(key) ? store.get(key)! : null
    },
    async set(key, value, mode, seconds) {
      calls.push([key, value, mode, seconds])
      store.set(key, value)
      return 'OK'
    },
  }
  return { redis, calls, store }
}

describe('solveMethodFor', () => {
  it('maps reCAPTCHA → userrecaptcha and hCaptcha → hcaptcha', () => {
    expect(solveMethodFor('recaptcha')).toBe('userrecaptcha')
    expect(solveMethodFor('hcaptcha')).toBe('hcaptcha')
  })

  it('returns null for cloudflare (no programmatic token solve)', () => {
    expect(solveMethodFor('cloudflare')).toBeNull()
  })
})

describe('responseFieldFor', () => {
  it('maps each token type to its DOM response field', () => {
    expect(responseFieldFor('recaptcha')).toBe('g-recaptcha-response')
    expect(responseFieldFor('hcaptcha')).toBe('h-captcha-response')
    expect(responseFieldFor('cloudflare')).toBeNull()
  })
})

describe('captchaTokenKey', () => {
  it('is deterministic and namespaced under captcha:token:', () => {
    const k1 = captchaTokenKey('recaptcha', 'SITE_KEY', 'https://shop.example.com/p/1')
    const k2 = captchaTokenKey('recaptcha', 'SITE_KEY', 'https://shop.example.com/p/1')
    expect(k1).toBe(k2)
    expect(k1.startsWith('captcha:token:recaptcha:')).toBe(true)
  })

  it('varies with page URL so two pages never share a token slot', () => {
    const a = captchaTokenKey('recaptcha', 'SITE_KEY', 'https://shop.example.com/p/1')
    const b = captchaTokenKey('recaptcha', 'SITE_KEY', 'https://shop.example.com/p/2')
    expect(a).not.toBe(b)
  })
})

describe('captchaPendingKey', () => {
  it('is namespaced separately from the token key but shares page identity', () => {
    const pending = captchaPendingKey('recaptcha', 'SITE', 'https://x/p')
    const token   = captchaTokenKey('recaptcha', 'SITE', 'https://x/p')
    expect(pending.startsWith('captcha:pending:recaptcha:')).toBe(true)
    expect(pending).not.toBe(token)
    // Same page → same pending slot (so concurrent jobs collapse to one claim).
    expect(pending).toBe(captchaPendingKey('recaptcha', 'SITE', 'https://x/p'))
  })

  it('CAPTCHA_PENDING_TTL_SECONDS covers the ~60s poll window', () => {
    expect(CAPTCHA_PENDING_TTL_SECONDS).toBeGreaterThanOrEqual(60)
  })
})

describe('detectCaptchaInContent', () => {
  it('detects reCAPTCHA, hCaptcha, and Cloudflare from page markers', () => {
    expect(detectCaptchaInContent('https://x/p', '<div class="g-recaptcha"></div>')).toBe('recaptcha')
    expect(detectCaptchaInContent('https://x/p', '<div class="h-captcha"></div>')).toBe('hcaptcha')
    expect(detectCaptchaInContent('https://x/p', '<title>Just a moment...</title>')).toBe('cloudflare')
    expect(detectCaptchaInContent('https://x/cdn-cgi/challenge-platform', '<html></html>')).toBe('cloudflare')
  })

  it('returns null for an ordinary product page', () => {
    expect(detectCaptchaInContent('https://x/p', '<div class="price">$19.99</div>')).toBeNull()
  })
})

describe('extractSiteKey', () => {
  it('pulls data-sitekey out of the page HTML', () => {
    expect(extractSiteKey('<div data-sitekey="6Lc-ABC123"></div>')).toBe('6Lc-ABC123')
  })

  it('returns null when no sitekey is present', () => {
    expect(extractSiteKey('<div class="g-recaptcha"></div>')).toBeNull()
  })
})

describe('token cache (state Redis)', () => {
  it('CAPTCHA_TOKEN_TTL_SECONDS stays under the ~120s token validity window', () => {
    expect(CAPTCHA_TOKEN_TTL_SECONDS).toBeGreaterThan(0)
    expect(CAPTCHA_TOKEN_TTL_SECONDS).toBeLessThan(120)
  })

  it('cacheToken writes WITH an EX TTL (never a TTL-less SET)', async () => {
    const { redis, calls } = fakeRedis()
    await cacheToken(redis, 'recaptcha', 'SITE', 'https://x/p', 'TOKEN-123')
    expect(calls).toHaveLength(1)
    const [key, value, mode, ttl] = calls[0]
    expect(key).toBe(captchaTokenKey('recaptcha', 'SITE', 'https://x/p'))
    expect(value).toBe('TOKEN-123')
    expect(mode).toBe('EX')
    expect(ttl).toBe(CAPTCHA_TOKEN_TTL_SECONDS)
  })

  it('readCachedToken returns a previously cached token and null when absent', async () => {
    const { redis } = fakeRedis()
    expect(await readCachedToken(redis, 'recaptcha', 'SITE', 'https://x/p')).toBeNull()
    await cacheToken(redis, 'recaptcha', 'SITE', 'https://x/p', 'TOKEN-123')
    expect(await readCachedToken(redis, 'recaptcha', 'SITE', 'https://x/p')).toBe('TOKEN-123')
  })
})
