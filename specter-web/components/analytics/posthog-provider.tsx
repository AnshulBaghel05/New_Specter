'use client'

import { useEffect, useState, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { initPostHog, trackPageView } from '@/lib/analytics'
import { getConsent, onConsentChange } from '@/lib/consent'

function PostHogPageTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Analytics stays dormant until the visitor has opted in — no PostHog init,
  // and therefore no analytics cookies/storage, before consent.
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (getConsent() === 'granted') {
      initPostHog()
      setReady(true)
    }
    // React the moment consent is granted later in the session (banner click),
    // without requiring a page reload.
    return onConsentChange((status) => {
      if (status === 'granted') {
        initPostHog()
        setReady(true)
      }
    })
  }, [])

  useEffect(() => {
    if (!ready || !pathname) return
    const url = searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname
    trackPageView(url)
  }, [ready, pathname, searchParams])

  return null
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageTracker />
      </Suspense>
      {children}
    </>
  )
}
