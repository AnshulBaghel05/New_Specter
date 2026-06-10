import { describe, it, expect } from 'vitest'
import { isResendConfigured, buildResendContactRequest } from '@/lib/email/resend'

describe('isResendConfigured', () => {
  it('is true only when both key and audience id are present', () => {
    expect(isResendConfigured({ RESEND_API_KEY: 'k', RESEND_AUDIENCE_ID: 'a' })).toBe(true)
    expect(isResendConfigured({ RESEND_API_KEY: 'k' })).toBe(false)
    expect(isResendConfigured({ RESEND_AUDIENCE_ID: 'a' })).toBe(false)
    expect(isResendConfigured({})).toBe(false)
  })
})

describe('buildResendContactRequest', () => {
  it('returns null when Resend is not configured (so the caller no-ops)', () => {
    expect(buildResendContactRequest({}, 'a@b.com')).toBeNull()
    expect(buildResendContactRequest({ RESEND_API_KEY: 'k' }, 'a@b.com')).toBeNull()
  })

  it('targets the configured audience contacts endpoint', () => {
    const req = buildResendContactRequest(
      { RESEND_API_KEY: 'key_123', RESEND_AUDIENCE_ID: 'aud_456' },
      'lead@store.com',
    )
    expect(req).not.toBeNull()
    expect(req!.url).toBe('https://api.resend.com/audiences/aud_456/contacts')
  })

  it('authenticates with a bearer token and sends a subscribed contact', () => {
    const req = buildResendContactRequest(
      { RESEND_API_KEY: 'key_123', RESEND_AUDIENCE_ID: 'aud_456' },
      'lead@store.com',
    )!
    expect(req.init.method).toBe('POST')
    expect(req.init.headers.Authorization).toBe('Bearer key_123')
    expect(req.init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(req.init.body)).toEqual({ email: 'lead@store.com', unsubscribed: false })
  })
})
