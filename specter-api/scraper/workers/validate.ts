import { normaliseCurrency } from '../domains/generic'
import type { ParseResult } from '../types'

export interface ValidationResult {
  valid:       boolean
  needsReview: boolean
  errors:      string[]
}

/**
 * Validate a ParseResult against the 5 data-quality rules.
 *
 * Does not throw — returns a structured result so the caller decides whether
 * to write with `needs_review = true` or skip the write entirely.
 *
 * @param result        - The parsed price data to validate.
 * @param previousPrice - Previous snapshot price for spike detection (Rule 5).
 *                        Pass null when there is no prior snapshot.
 */
export function validateParseResult(
  result:        ParseResult,
  previousPrice: number | null,
): ValidationResult {
  const errors: string[] = []
  let   needsReview      = false

  // Rule 1 — price must be a positive finite number.
  if (result.price === null || !isFinite(result.price) || result.price <= 0) {
    errors.push(`price invalid: ${String(result.price)}`)
  }

  // Rule 2 — sanity ceiling: anything at or above $1 million is almost certainly
  // a scraper bug (stray characters parsed as a price, or an exponent mishap).
  if (result.price !== null && result.price >= 1_000_000) {
    errors.push(`price exceeds sanity ceiling: ${result.price}`)
  }

  // Rule 3 — currency must resolve to a recognised 3-letter ISO 4217 code.
  const normCurrency = normaliseCurrency(result.currency)
  if (!/^[A-Z]{3}$/.test(normCurrency)) {
    errors.push(`currency not ISO 4217: "${result.currency}"`)
  }

  // Rule 4 — inStock must be a strict boolean value, not a string or null.
  if (typeof result.inStock !== 'boolean') {
    errors.push(`inStock is not boolean: ${String(result.inStock)}`)
  }

  // Rule 5 — price change >90% vs previous snapshot → flag for review.
  // The data is still written; ops can inspect flagged rows.
  if (
    result.price !== null &&
    result.price > 0 &&
    previousPrice !== null &&
    previousPrice > 0
  ) {
    const changePct = Math.abs(result.price - previousPrice) / previousPrice
    if (changePct > 0.9) {
      needsReview = true
    }
  }

  return { valid: errors.length === 0, needsReview, errors }
}
