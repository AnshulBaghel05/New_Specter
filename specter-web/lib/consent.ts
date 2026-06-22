'use client'

/**
 * Cookie / analytics consent state.
 *
 * Non-essential analytics (PostHog) must NOT initialise — and therefore must set
 * no cookies/local storage — until the visitor has explicitly opted in. This
 * module is the single source of truth for that decision: the banner writes it,
 * the PostHog provider reads it and listens for changes.
 *
 * Stored in localStorage so the choice persists; broadcast via a window event so
 * the provider can react the moment the user clicks Accept without a reload.
 */

export type ConsentStatus = 'granted' | 'denied'

const STORAGE_KEY = 'specter_analytics_consent'
export const CONSENT_EVENT = 'specter-consent-change'

export function getConsent(): ConsentStatus | null {
  if (typeof window === 'undefined') return null
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'granted' || v === 'denied' ? v : null
  } catch {
    return null
  }
}

export function setConsent(status: ConsentStatus): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, status)
  } catch {
    /* storage unavailable — still broadcast so the session reflects the choice */
  }
  window.dispatchEvent(new CustomEvent<ConsentStatus>(CONSENT_EVENT, { detail: status }))
}

/** Subscribe to consent changes. Returns an unsubscribe function. */
export function onConsentChange(cb: (status: ConsentStatus) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => cb((e as CustomEvent<ConsentStatus>).detail)
  window.addEventListener(CONSENT_EVENT, handler)
  return () => window.removeEventListener(CONSENT_EVENT, handler)
}
