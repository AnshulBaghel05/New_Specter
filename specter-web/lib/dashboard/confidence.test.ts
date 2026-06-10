import { describe, it, expect } from 'vitest'
import { confidenceTier } from './confidence'

describe('confidenceTier', () => {
  it('classifies high at and above 0.80', () => {
    expect(confidenceTier(0.8)).toBe('high')
    expect(confidenceTier(0.95)).toBe('high')
    expect(confidenceTier(1)).toBe('high')
  })

  it('classifies medium from 0.50 up to but not including 0.80', () => {
    expect(confidenceTier(0.5)).toBe('medium')
    expect(confidenceTier(0.79)).toBe('medium')
  })

  it('classifies low below 0.50', () => {
    expect(confidenceTier(0.49)).toBe('low')
    expect(confidenceTier(0)).toBe('low')
  })
})
