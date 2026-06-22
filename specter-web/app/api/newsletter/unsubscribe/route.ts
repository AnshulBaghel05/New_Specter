import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { buildResendUnsubscribeRequest } from '@/lib/email/resend'

/**
 * Newsletter unsubscribe. Marks the contact as unsubscribed in the Resend
 * audience so they receive no further broadcasts. Supports:
 *   - POST { email }                  — from the branded /unsubscribe page
 *   - GET  /api/newsletter/unsubscribe?email=…  — one-click (List-Unsubscribe)
 * Unlike subscribe, this reports failure so the user knows it worked.
 */
const schema = z.object({ email: z.string().email() })

async function unsubscribe(email: string): Promise<NextResponse> {
  const req = buildResendUnsubscribeRequest(
    { RESEND_API_KEY: process.env.RESEND_API_KEY, RESEND_AUDIENCE_ID: process.env.RESEND_AUDIENCE_ID },
    email,
  )
  // Not configured → treat as success so the user always sees confirmation.
  if (!req) return NextResponse.json({ success: true })

  try {
    const res = await fetch(req.url, req.init)
    if (!res.ok) {
      // A 404 means the contact isn't in the audience — already effectively
      // unsubscribed from our perspective; treat as success.
      if (res.status === 404) return NextResponse.json({ success: true })
      return NextResponse.json({ error: 'unsubscribe_failed' }, { status: 502 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'unsubscribe_failed' }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 422 })
  }
  return unsubscribe(parsed.data.email)
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email') ?? ''
  const parsed = schema.safeParse({ email })
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 422 })
  }
  return unsubscribe(parsed.data.email)
}
