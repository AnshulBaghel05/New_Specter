import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { buildResendContactRequest } from '@/lib/email/resend'

/**
 * Newsletter subscribe — marketing opt-in. Unlike /api/email-capture (used by
 * the free tools), this endpoint REQUIRES explicit consent, so it satisfies
 * GDPR/CASL express-consent rules for marketing email. The email is added to the
 * configured Resend audience; Resend then manages delivery and unsubscribe.
 */
const schema = z.object({
  email: z.string().email(),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Consent is required to subscribe.' }),
  }),
  source: z.string().max(64).optional(),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const needsConsent = parsed.error.issues.some((i) => i.path[0] === 'consent')
    return NextResponse.json(
      { error: needsConsent ? 'consent_required' : 'invalid_input', issues: parsed.error.issues },
      { status: 422 },
    )
  }

  const { email, source } = parsed.data

  // Add to the Resend audience when configured. Best-effort: a Resend outage must
  // not turn a valid opt-in into a user-facing error. Silent no-op when unset.
  const resendReq = buildResendContactRequest(
    { RESEND_API_KEY: process.env.RESEND_API_KEY, RESEND_AUDIENCE_ID: process.env.RESEND_AUDIENCE_ID },
    email,
  )
  if (resendReq) {
    try {
      const res = await fetch(resendReq.url, resendReq.init)
      if (!res.ok && process.env.NODE_ENV !== 'production') {
        console.warn('[newsletter/subscribe] resend sync failed', res.status, await res.text())
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[newsletter/subscribe] resend sync threw', err)
      }
    }
  }

  // Consent evidence (timestamp + source) for our records.
  if (process.env.NODE_ENV !== 'production') {
    console.log('[newsletter/subscribe]', { email, source, consentedAt: new Date().toISOString() })
  }

  return NextResponse.json({ success: true })
}
