'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Cookie } from 'lucide-react'
import { getConsent, setConsent } from '@/lib/consent'

/**
 * Cookie-consent banner. Shows once, until the visitor accepts or declines.
 * Until "Accept" is clicked, analytics (PostHog) never initialises, so no
 * non-essential cookies are set — satisfying the ePrivacy/GDPR consent-first
 * requirement for EEA/UK visitors. Strictly necessary and payment cookies are
 * unaffected (they are essential to deliver a requested service).
 */
export default function CookieConsentBanner() {
  // Start hidden; reveal only after mount confirms no prior choice exists
  // (avoids a hydration flash and SSR/client mismatch).
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (getConsent() === null) setVisible(true)
  }, [])

  if (!visible) return null

  function choose(status: 'granted' | 'denied') {
    setConsent(status)
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[60] p-4 sm:p-6"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-surface/95 backdrop-blur shadow-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="grid place-items-center w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
            <Cookie size={18} className="text-primary" aria-hidden="true" />
          </div>
          <p className="font-body text-sm text-muted leading-relaxed">
            We use essential cookies to run SPECTER and, with your consent, analytics cookies to improve
            the product. We don&rsquo;t use advertising cookies or sell your data. See our{' '}
            <Link href="/cookies" className="text-primary hover:underline">Cookie Policy</Link>.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
          <button
            type="button"
            onClick={() => choose('denied')}
            className="px-4 py-2 rounded-xl border border-border text-muted hover:text-text hover:border-primary/40 font-body text-sm transition-colors"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => choose('granted')}
            className="gradient-primary-cta btn-ripple px-5 py-2 rounded-xl font-semibold text-sm transition-all duration-200"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
