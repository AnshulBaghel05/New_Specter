import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { buildResendContactRequest } from '@/lib/email/resend'

const schema = z.object({
  email:           z.string().email(),
  tool:            z.string().optional(),
  result_snapshot: z.record(z.unknown()).optional(),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 422 })
  }

  const { email, tool, result_snapshot } = parsed.data

  // Sync the lead to Resend when configured (RESEND_API_KEY + RESEND_AUDIENCE_ID).
  // Best-effort and non-blocking: a Resend outage or a misconfig must never turn
  // a captured email into a user-facing error. When unset, this is a silent no-op
  // and the route behaves exactly as before.
  const resendReq = buildResendContactRequest(
    { RESEND_API_KEY: process.env.RESEND_API_KEY, RESEND_AUDIENCE_ID: process.env.RESEND_AUDIENCE_ID },
    email,
  )
  if (resendReq) {
    try {
      const res = await fetch(resendReq.url, resendReq.init)
      if (!res.ok && process.env.NODE_ENV !== 'production') {
        console.warn('[email-capture] resend sync failed', res.status, await res.text())
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[email-capture] resend sync threw', err)
      }
    }
  }

  // Log in non-production for debugging
  if (process.env.NODE_ENV !== 'production') {
    console.log('[email-capture]', { email, tool, result_snapshot })
  }

  return NextResponse.json({ success: true })
}
