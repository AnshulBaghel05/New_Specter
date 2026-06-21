import { describe, it, expect } from 'vitest'
import { typeLabel, severityTone } from './notification-meta'

describe('typeLabel', () => {
  it('maps known notification types to human labels', () => {
    expect(typeLabel('signal')).toBe('Signals')
    expect(typeLabel('oos')).toBe('Out of stock')
    expect(typeLabel('billing')).toBe('Billing')
  })
  it('falls back to the raw type for unknown values', () => {
    expect(typeLabel('mystery')).toBe('mystery')
  })
})

describe('severityTone', () => {
  it('maps each severity to its design-system colour token', () => {
    expect(severityTone('success')).toBe('text-primary')
    expect(severityTone('warning')).toBe('text-amber-400')
    expect(severityTone('critical')).toBe('text-rose-400')
    expect(severityTone('info')).toBe('text-sky-400')
  })
  it('falls back to muted for an unknown severity', () => {
    expect(severityTone('weird')).toBe('text-muted')
  })
})
