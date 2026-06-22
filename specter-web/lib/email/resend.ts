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

export interface ResendRequest {
  url: string
  init: {
    method: 'POST' | 'PATCH'
    headers: Record<string, string>
    body: string
  }
}

/** Back-compat alias — the original contact request is just a POST ResendRequest. */
export type ResendContactRequest = ResendRequest

/** Resend is wired only when BOTH the API key and an audience id are present. */
export function isResendConfigured(env: ResendEnv): boolean {
  return Boolean(env.RESEND_API_KEY && env.RESEND_AUDIENCE_ID)
}

function authHeaders(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
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
      headers: authHeaders(env.RESEND_API_KEY!),
      body: JSON.stringify({ email, unsubscribed: false }),
    },
  }
}

/**
 * Build the request that marks a contact as unsubscribed in the configured
 * audience (Resend updates the contact by email). Returns null when Resend is
 * not configured. This is what powers one-click unsubscribe and the unsubscribe
 * page — Resend then suppresses that address from future broadcasts.
 */
export function buildResendUnsubscribeRequest(env: ResendEnv, email: string): ResendRequest | null {
  if (!isResendConfigured(env)) return null
  return {
    url: `https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts/${encodeURIComponent(email)}`,
    init: {
      method: 'PATCH',
      headers: authHeaders(env.RESEND_API_KEY!),
      body: JSON.stringify({ unsubscribed: true }),
    },
  }
}

export interface BroadcastInput {
  from: string
  subject: string
  html: string
  name?: string
}

/**
 * Build the request that creates a Resend Broadcast addressed to the whole
 * audience. The broadcast is created in a draft state; sending is a separate
 * call (buildResendBroadcastSendRequest) so the caller can validate the created
 * id first. Returns null when Resend is not configured.
 */
export function buildResendBroadcastCreateRequest(env: ResendEnv, input: BroadcastInput): ResendRequest | null {
  if (!isResendConfigured(env)) return null
  return {
    url: 'https://api.resend.com/broadcasts',
    init: {
      method: 'POST',
      headers: authHeaders(env.RESEND_API_KEY!),
      body: JSON.stringify({
        audience_id: env.RESEND_AUDIENCE_ID,
        from: input.from,
        subject: input.subject,
        html: input.html,
        name: input.name ?? input.subject,
      }),
    },
  }
}

/** Build the request that sends a previously created broadcast immediately. */
export function buildResendBroadcastSendRequest(env: ResendEnv, broadcastId: string): ResendRequest | null {
  if (!env.RESEND_API_KEY || !broadcastId) return null
  return {
    url: `https://api.resend.com/broadcasts/${encodeURIComponent(broadcastId)}/send`,
    init: {
      method: 'POST',
      headers: authHeaders(env.RESEND_API_KEY),
      body: JSON.stringify({}),
    },
  }
}

/**
 * Wrap a newsletter body in the SPECTER dark-brand shell with a compliant
 * footer. Resend substitutes {{{RESEND_UNSUBSCRIBE_URL}}} per recipient, so
 * every delivered email carries a working one-click unsubscribe link. A plain
 * body (no HTML tags) is converted to simple paragraphs.
 */
export function buildNewsletterHtml(body: string): string {
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(body)
  const content = looksLikeHtml
    ? body
    : body
        .split(/\n{2,}/)
        .map((p) => `<p style="color:#E8EAF0;line-height:1.6;margin:0 0 16px">${p.replace(/\n/g, '<br/>')}</p>`)
        .join('')
  return `<div style="font-family:system-ui,-apple-system,sans-serif;background:#06070D;color:#E8EAF0;padding:32px;border-radius:12px;max-width:560px;margin:0 auto">
  <div style="font-weight:700;font-size:18px;margin-bottom:20px">SPECTER<span style="color:#00E87A">.</span></div>
  ${content}
  <hr style="border:none;border-top:1px solid #1A1D2E;margin:24px 0" />
  <p style="color:#6B7280;font-size:12px">You're receiving this because you subscribed to SPECTER updates.<br/>
  <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#00E87A">Unsubscribe</a> at any time.</p>
</div>`
}
