import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveIntent, readIntent, clearIntent, isFresh, type BillingIntent } from './intent'

const store: Record<string, string> = {}
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k]
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
  })
})

describe('billing intent', () => {
  it('round-trips a saved intent', () => {
    saveIntent({ action: 'buy', plan: 'cipher', cadence: 'monthly' })
    const got = readIntent()
    expect(got?.action).toBe('buy')
    expect(got?.plan).toBe('cipher')
    expect(got?.cadence).toBe('monthly')
    expect(typeof got?.ts).toBe('number')
  })

  it('returns null when nothing is stored', () => {
    expect(readIntent()).toBeNull()
  })

  it('returns null for corrupt JSON', () => {
    store['specter.billing_intent'] = '{not json'
    expect(readIntent()).toBeNull()
  })

  it('clearIntent removes the stored value', () => {
    saveIntent({ action: 'trial', plan: 'recon', cadence: 'monthly' })
    clearIntent()
    expect(readIntent()).toBeNull()
  })

  it('isFresh is true within the TTL and false beyond it', () => {
    const recent: BillingIntent = { action: 'buy', plan: 'recon', cadence: 'monthly', ts: Date.now() }
    const stale: BillingIntent = { action: 'buy', plan: 'recon', cadence: 'monthly', ts: Date.now() - 2 * 60 * 60 * 1000 }
    expect(isFresh(recent)).toBe(true)
    expect(isFresh(stale)).toBe(false)
  })
})
