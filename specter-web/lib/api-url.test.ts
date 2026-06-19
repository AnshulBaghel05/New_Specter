import { afterEach, describe, expect, it, vi } from 'vitest'

// Proves the double-slash fix: whatever trailing-slash shape the env var has,
// `${API_URL}${path}` (path starts with "/") must join with exactly one slash.
// api-url.ts resolves NEXT_PUBLIC_API_URL at module load, so each case resets the
// module registry and re-imports with a fresh env value.

const ORIGINAL = process.env.NEXT_PUBLIC_API_URL

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_API_URL
  else process.env.NEXT_PUBLIC_API_URL = ORIGINAL
  vi.resetModules()
})

async function loadApiUrl(envValue: string): Promise<string> {
  vi.resetModules()
  process.env.NEXT_PUBLIC_API_URL = envValue
  const mod = await import('./api-url')
  return mod.API_URL
}

describe('API_URL slash normalization', () => {
  it('strips a single trailing slash (the production bug)', async () => {
    const API_URL = await loadApiUrl('https://newspecter-production-046d.up.railway.app/')
    expect(API_URL).toBe('https://newspecter-production-046d.up.railway.app')
    expect(`${API_URL}/merchants/me`).toBe(
      'https://newspecter-production-046d.up.railway.app/merchants/me',
    )
  })

  it('strips multiple trailing slashes', async () => {
    const API_URL = await loadApiUrl('https://api.example.com///')
    expect(API_URL).toBe('https://api.example.com')
    expect(`${API_URL}/signals/summary`).toBe('https://api.example.com/signals/summary')
  })

  it('leaves an already-clean URL unchanged', async () => {
    const API_URL = await loadApiUrl('https://api.example.com')
    expect(API_URL).toBe('https://api.example.com')
  })
})
