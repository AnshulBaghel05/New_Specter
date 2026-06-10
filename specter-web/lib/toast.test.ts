import { describe, it, expect } from 'vitest'
import { formatApiError } from './toast'
import { ApiError } from '@/lib/api'

describe('formatApiError', () => {
  it('prefers ApiError body.message', () => {
    expect(formatApiError(new ApiError(400, { error: 'invalid_bounds', message: 'Floor exceeds ceiling' })))
      .toBe('Floor exceeds ceiling')
  })

  it('falls back to ApiError body.error when no message', () => {
    expect(formatApiError(new ApiError(403, { error: 'plan_required' }))).toBe('plan_required')
  })

  it('uses a plain Error message', () => {
    expect(formatApiError(new Error('network down'))).toBe('network down')
  })

  it('returns a generic message for unknown values', () => {
    const generic = 'Something went wrong. Please try again.'
    expect(formatApiError('weird')).toBe(generic)
    expect(formatApiError(null)).toBe(generic)
    expect(formatApiError({})).toBe(generic)
  })
})
