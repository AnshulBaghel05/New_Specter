import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { timingSafeEqual } from 'crypto'
import {
  isResendConfigured,
  buildResendBroadcastCreateRequest,
  buildResendBroadcastSendRequest,
  buildNewsletterHtml,
} from '@/lib/email/resend'

/**
 * Send a newsletter to the whole audience. Operator-only: requires the
 * NEWSLETTER_ADMIN_KEY in the `x-newsletter-key` header (constant-time compared).
 *
 * Flow: create a Resend Broadcast addressed to the configured audience, then
 * send it. Resend handles per-recipient delivery and injects a working
 * unsubscribe link via the {{{RESEND_UNSUBSCRIBE_URL}}} token in the HTML shell.
 *
 * "Connect an email": the sender address comes from RESEND_NEWSLETTER_FROM
 * (falling back to RESEND_FROM), which must be a verified domain in Resend.
 */
const schema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(100_000),
  from: z.string().min(3).max(200).optional(),
  name: z.string().max(200).optional(),
})

function keyValid(provided: string): boolean {
  const expected = process.env.NEWSLETTER_ADMIN_KEY ?? ''
  if (!expected) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  // Fail closed when no key is configured.
  if (!process.env.NEWSLETTER_ADMIN_KEY) {
    return NextResponse.json({ error: 'newsletter_admin_key_not_configured' }, { status: 500 })
  }
  if (!keyValid(req.headers.get('x-newsletter-key') ?? '')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const env = { RESEND_API_KEY: process.env.RESEND_API_KEY, RESEND_AUDIENCE_ID: process.env.RESEND_AUDIENCE_ID }
  if (!isResendConfigured(env)) {
    return NextResponse.json({ error: 'resend_not_configured' }, { status: 500 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 422 })
  }

  const from =
    parsed.data.from ||
    process.env.RESEND_NEWSLETTER_FROM ||
    process.env.RESEND_FROM ||
    'SPECTER <news@specterapp.io>'

  const createReq = buildResendBroadcastCreateRequest(env, {
    from,
    subject: parsed.data.subject,
    html: buildNewsletterHtml(parsed.data.body),
    name: parsed.data.name ?? parsed.data.subject,
  })!

  // 1) Create the broadcast.
  let broadcastId: string
  try {
    const res = await fetch(createReq.url, createReq.init)
    const json = (await res.json().catch(() => ({}))) as { id?: string; data?: { id?: string }; message?: string }
    if (!res.ok) {
      return NextResponse.json({ error: 'broadcast_create_failed', detail: json.message }, { status: 502 })
    }
    broadcastId = json.id ?? json.data?.id ?? ''
    if (!broadcastId) {
      return NextResponse.json({ error: 'broadcast_no_id' }, { status: 502 })
    }
  } catch {
    return NextResponse.json({ error: 'broadcast_create_failed' }, { status: 502 })
  }

  // 2) Send it.
  const sendReq = buildResendBroadcastSendRequest(env, broadcastId)!
  try {
    const res = await fetch(sendReq.url, sendReq.init)
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { message?: string }
      return NextResponse.json({ error: 'broadcast_send_failed', broadcastId, detail: json.message }, { status: 502 })
    }
  } catch {
    return NextResponse.json({ error: 'broadcast_send_failed', broadcastId }, { status: 502 })
  }

  return NextResponse.json({ success: true, broadcastId })
}
