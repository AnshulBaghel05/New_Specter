/**
 * Resend ESP wiring for the email-capture route — pure builders, no SDK.
 *
 * We deliberately wrap Resend's REST API with `fetch` (the same no-SDK
 * convention specter-api uses for third-party HTTP) so there is nothing to
 * install and the sync is trivially unit-testable. The route stays a thin
 * caller; all the decision logic lives in these pure functions.
 */

export interface ResendEnv {
  RESEND_API_KEY?: string
  RESEND_AUDIENCE_ID?: string
}

export interface ResendContactRequest {
  url: string
  init: {
    method: 'POST'
    headers: Record<string, string>
    body: string
  }
}

/** Resend is wired only when BOTH the API key and an audience id are present. */
export function isResendConfigured(env: ResendEnv): boolean {
  return Boolean(env.RESEND_API_KEY && env.RESEND_AUDIENCE_ID)
}

/**
 * Build the `fetch` request that adds `email` to the configured Resend
 * audience. Returns `null` when Resend isn't configured so the caller can
 * silently no-op (keeping the route's "always succeed" behaviour when unset).
 *
 * Pure: takes env + email, returns a plain request descriptor. No I/O.
 */
export function buildResendContactRequest(env: ResendEnv, email: string): ResendContactRequest | null {
  if (!isResendConfigured(env)) return null

  return {
    url: `https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, unsubscribed: false }),
    },
  }
}
