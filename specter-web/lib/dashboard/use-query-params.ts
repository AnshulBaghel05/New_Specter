'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Read/merge-write URL search params — the single source of cross-page view-state.
 *
 * `set` always builds from the CURRENT params and mutates only the keys passed,
 * so unrelated params are preserved (e.g. set({ sort }) keeps an existing ?q).
 * Pass a key's value as null/'' to remove it (used for default-omission).
 * Uses router.replace (no history spam, no scroll jump).
 */
export function useQueryParams() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const get = useCallback((key: string) => searchParams.get(key), [searchParams])

  const set = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === '') params.delete(k)
        else params.set(k, v)
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  return { get, set }
}
