import { describe, it, expect } from 'vitest'
import { selectProxy, allowDirectFallback, requeueDelayMs } from '../proxy/runtime'
import { ProxyManager } from '../proxy/manager'

function mgrWith(urls: string[]) {
  return new ProxyManager({ datacenterUrls: urls, residentialUrls: [] })
}

describe('selectProxy', () => {
  it('returns a url when a healthy proxy exists', () => {
    const sel = selectProxy(mgrWith(['http://a:1']), 'datacenter', 'shop.com')
    expect(sel).toEqual({ exhausted: false, url: 'http://a:1' })
  })

  it('returns the exhausted sentinel when the manager throws (all cooling)', () => {
    const mgr = mgrWith(['http://a:1'])
    mgr.reportResult('http://a:1', 403)   // cool the only proxy
    const sel = selectProxy(mgr, 'datacenter', 'shop.com')
    expect(sel).toEqual({ exhausted: true })
  })
})

describe('fallback policy env', () => {
  it('allowDirectFallback defaults to false (production-safe)', () => {
    expect(allowDirectFallback({})).toBe(false)
    expect(allowDirectFallback({ ALLOW_DIRECT_FALLBACK: 'true' })).toBe(true)
    expect(allowDirectFallback({ ALLOW_DIRECT_FALLBACK: '1' })).toBe(true)
  })

  it('requeueDelayMs defaults to 60s and honours the env override', () => {
    expect(requeueDelayMs({})).toBe(60_000)
    expect(requeueDelayMs({ PROXY_REQUEUE_DELAY_MS: '30000' })).toBe(30_000)
  })
})
