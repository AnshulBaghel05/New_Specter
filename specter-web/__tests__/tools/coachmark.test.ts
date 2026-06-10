import { describe, it, expect } from 'vitest'
import { shouldShowCoachmark, dismissCoachmark, COACHMARK_HERO } from '@/lib/tools/coachmark'

/** Minimal in-memory Storage stand-in. */
function fakeStorage(entries: Record<string, string> = {}): Storage {
  const store: Record<string, string> = { ...entries }
  return {
    get length() {
      return Object.keys(store).length
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k]
    },
  } as Storage
}

describe('coachmark suppression', () => {
  it('shows a coachmark that has never been dismissed', () => {
    const storage = fakeStorage()
    expect(shouldShowCoachmark(COACHMARK_HERO, storage)).toBe(true)
  })

  it('does not show a coachmark once dismissed', () => {
    const storage = fakeStorage()
    dismissCoachmark(COACHMARK_HERO, storage)
    expect(shouldShowCoachmark(COACHMARK_HERO, storage)).toBe(false)
  })

  it('persists the dismissal under a namespaced key', () => {
    const storage = fakeStorage()
    dismissCoachmark(COACHMARK_HERO, storage)
    expect(storage.getItem(`specter_coachmark_${COACHMARK_HERO}`)).toBeTruthy()
  })

  it('keys are independent across coachmark ids', () => {
    const storage = fakeStorage()
    dismissCoachmark('other', storage)
    expect(shouldShowCoachmark(COACHMARK_HERO, storage)).toBe(true)
  })

  it('treats a missing/throwing storage as "do not show" (SSR-safe)', () => {
    const throwing = {
      getItem: () => {
        throw new Error('no storage')
      },
      setItem: () => {
        throw new Error('no storage')
      },
    } as unknown as Storage
    // Never crashes; defaults to not showing when storage is unavailable.
    expect(shouldShowCoachmark(COACHMARK_HERO, throwing)).toBe(false)
    expect(() => dismissCoachmark(COACHMARK_HERO, throwing)).not.toThrow()
  })
})
