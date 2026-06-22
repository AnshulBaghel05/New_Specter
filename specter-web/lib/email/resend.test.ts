import { describe, it, expect } from 'vitest'
import {
  isResendConfigured,
  buildResendContactRequest,
  buildResendUnsubscribeRequest,
  buildResendBroadcastCreateRequest,
  buildResendBroadcastSendRequest,
  buildNewsletterHtml,
} from '@/lib/email/resend'

const ENV = { RESEND_API_KEY: 'key_123', RESEND_AUDIENCE_ID: 'aud_456' }

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

describe('buildResendUnsubscribeRequest', () => {
  it('returns null when not configured', () => {
    expect(buildResendUnsubscribeRequest({}, 'a@b.com')).toBeNull()
  })

  it('PATCHes the contact (by encoded email) to unsubscribed', () => {
    const req = buildResendUnsubscribeRequest(ENV, 'a+tag@store.com')!
    expect(req.init.method).toBe('PATCH')
    expect(req.url).toBe('https://api.resend.com/audiences/aud_456/contacts/a%2Btag%40store.com')
    expect(JSON.parse(req.init.body)).toEqual({ unsubscribed: true })
    expect(req.init.headers.Authorization).toBe('Bearer key_123')
  })
})

describe('buildResendBroadcastCreateRequest', () => {
  it('returns null when not configured', () => {
    expect(buildResendBroadcastCreateRequest({}, { from: 'a', subject: 's', html: 'h' })).toBeNull()
  })

  it('creates a broadcast against the audience with the given content', () => {
    const req = buildResendBroadcastCreateRequest(ENV, { from: 'SPECTER <news@x.io>', subject: 'Hi', html: '<p>Hi</p>' })!
    expect(req.url).toBe('https://api.resend.com/broadcasts')
    expect(req.init.method).toBe('POST')
    const parsed = JSON.parse(req.init.body)
    expect(parsed.audience_id).toBe('aud_456')
    expect(parsed.from).toBe('SPECTER <news@x.io>')
    expect(parsed.subject).toBe('Hi')
    expect(parsed.name).toBe('Hi') // defaults to subject
  })
})

describe('buildResendBroadcastSendRequest', () => {
  it('returns null without a key or id', () => {
    expect(buildResendBroadcastSendRequest({}, 'b_1')).toBeNull()
    expect(buildResendBroadcastSendRequest(ENV, '')).toBeNull()
  })

  it('targets the broadcast send endpoint', () => {
    const req = buildResendBroadcastSendRequest(ENV, 'b_123')!
    expect(req.url).toBe('https://api.resend.com/broadcasts/b_123/send')
    expect(req.init.method).toBe('POST')
  })
})

describe('buildNewsletterHtml', () => {
  it('always includes the per-recipient unsubscribe token', () => {
    expect(buildNewsletterHtml('Hello world')).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}')
  })

  it('wraps plain text in paragraphs but passes HTML through', () => {
    expect(buildNewsletterHtml('one\n\ntwo')).toContain('<p')
    expect(buildNewsletterHtml('<h1>Custom</h1>')).toContain('<h1>Custom</h1>')
  })
})
