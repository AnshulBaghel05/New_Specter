import { describe, it, expect } from 'vitest'
import { validateBounds } from './bounds-validation'

describe('validateBounds', () => {
  it('both empty → null', () => {
    expect(validateBounds('', '')).toBeNull()
  })
  it('floor < ceiling → null', () => {
    expect(validateBounds('10', '20')).toBeNull()
  })
  it('floor === ceiling → null', () => {
    expect(validateBounds('10', '10')).toBeNull()
  })
  it('only floor set → null', () => {
    expect(validateBounds('10', '')).toBeNull()
  })
  it('only ceiling set → null', () => {
    expect(validateBounds('', '20')).toBeNull()
  })
  it('floor > ceiling → error', () => {
    expect(validateBounds('20', '10')).toBe('Floor cannot exceed ceiling.')
  })
  it('negative floor → error', () => {
    expect(validateBounds('-5', '')).toBe('Prices must be 0 or more.')
  })
  it('negative ceiling → error', () => {
    expect(validateBounds('', '-5')).toBe('Prices must be 0 or more.')
  })
  it('non-numeric → error', () => {
    expect(validateBounds('abc', '')).toBe('Prices must be 0 or more.')
  })
})
