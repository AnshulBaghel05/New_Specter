import { describe, it, expect } from 'vitest'
import { parseProxyConfig } from '../proxy/config'

describe('parseProxyConfig', () => {
  it('returns null when no proxy env is set', () => {
    expect(parseProxyConfig({})).toBeNull()
  })

  it('parses a comma-list of datacenter URLs', () => {
    const cfg = parseProxyConfig({ PROXY_DATACENTER_URLS: 'http://a:1, http://b:2 ,' })
    expect(cfg?.datacenterUrls).toEqual(['http://a:1', 'http://b:2'])
    expect(cfg?.residentialUrls).toEqual([])
  })

  it('falls back to the singular var when the list var is absent', () => {
    const cfg = parseProxyConfig({ PROXY_RESIDENTIAL_URL: 'http://res:9' })
    expect(cfg?.residentialUrls).toEqual(['http://res:9'])
  })

  it('prefers the plural list over the singular when both are set', () => {
    const cfg = parseProxyConfig({
      PROXY_DATACENTER_URLS: 'http://list:1',
      PROXY_DATACENTER_URL: 'http://single:1',
    })
    expect(cfg?.datacenterUrls).toEqual(['http://list:1'])
  })

  it('passes through numeric tunables when present', () => {
    const cfg = parseProxyConfig({ PROXY_DATACENTER_URL: 'http://a:1', PROXY_COOLDOWN_MS: '120000' })
    expect(cfg?.cooldownMs).toBe(120000)
  })
})
