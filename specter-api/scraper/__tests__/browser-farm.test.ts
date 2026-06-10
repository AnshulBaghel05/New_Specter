import { describe, it, expect } from 'vitest'
import {
  resolveBrowserEndpoint,
  browserMode,
  needsNewBrowser,
} from '../workers/browser-farm'

describe('resolveBrowserEndpoint', () => {
  it('returns a trimmed endpoint when BROWSER_WS_ENDPOINT is set', () => {
    expect(resolveBrowserEndpoint({ BROWSER_WS_ENDPOINT: '  ws://farm:9222  ' })).toBe('ws://farm:9222')
  })

  it('returns null when unset or blank', () => {
    expect(resolveBrowserEndpoint({})).toBeNull()
    expect(resolveBrowserEndpoint({ BROWSER_WS_ENDPOINT: '   ' })).toBeNull()
  })
})

describe('browserMode', () => {
  it('is cdp when an endpoint is configured, local otherwise', () => {
    expect(browserMode({ BROWSER_WS_ENDPOINT: 'ws://farm:9222' })).toBe('cdp')
    expect(browserMode({})).toBe('local')
  })
})

describe('needsNewBrowser', () => {
  it('always (re)acquires when there is no live connection', () => {
    expect(needsNewBrowser('local', false, 0, 50)).toBe(true)
    expect(needsNewBrowser('cdp', false, 0, 50)).toBe(true)
  })

  it('local: recycles the process browser after refreshEvery jobs (memory-leak guard)', () => {
    expect(needsNewBrowser('local', true, 49, 50)).toBe(false)
    expect(needsNewBrowser('local', true, 50, 50)).toBe(true)
  })

  it('cdp: never force-recycles a shared browser by job count', () => {
    // A connected farm session is reused indefinitely; only a dropped link reacquires.
    expect(needsNewBrowser('cdp', true, 9999, 50)).toBe(false)
  })
})
