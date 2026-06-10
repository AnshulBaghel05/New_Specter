import { describe, it, expect } from 'vitest'
import { shouldShowPqlModal, markPqlModalSeen, PQL_MODAL_KEY } from '@/lib/tools/pql'

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

describe('PQL upgrade-modal gating', () => {
  it('does not show below the save threshold', () => {
    const storage = fakeStorage()
    expect(shouldShowPqlModal(2, 3, storage)).toBe(false)
  })

  it('shows once the save count reaches the threshold', () => {
    const storage = fakeStorage()
    expect(shouldShowPqlModal(3, 3, storage)).toBe(true)
    expect(shouldShowPqlModal(7, 3, storage)).toBe(true)
  })

  it('does not show again after being marked seen', () => {
    const storage = fakeStorage()
    markPqlModalSeen(storage)
    expect(shouldShowPqlModal(5, 3, storage)).toBe(false)
  })

  it('records the seen flag under the namespaced key', () => {
    const storage = fakeStorage()
    markPqlModalSeen(storage)
    expect(storage.getItem(PQL_MODAL_KEY)).toBeTruthy()
  })

  it('is SSR/throwing-storage safe', () => {
    const throwing = {
      getItem: () => {
        throw new Error('no storage')
      },
      setItem: () => {
        throw new Error('no storage')
      },
    } as unknown as Storage
    // No storage → cannot confirm unseen → do not show (avoid nagging).
    expect(shouldShowPqlModal(5, 3, throwing)).toBe(false)
    expect(() => markPqlModalSeen(throwing)).not.toThrow()
  })
})
