// Inline validation for the floor/ceiling text inputs. Empty string = unset (valid).
// Mirrors the server guard (PATCH /repricing/sku/{id} → 422 invalid_bounds).

export function validateBounds(floor: string, ceiling: string): string | null {
  const hasFloor = floor.trim() !== ''
  const hasCeiling = ceiling.trim() !== ''
  const f = Number(floor)
  const c = Number(ceiling)
  if (hasFloor && (Number.isNaN(f) || f < 0)) return 'Prices must be 0 or more.'
  if (hasCeiling && (Number.isNaN(c) || c < 0)) return 'Prices must be 0 or more.'
  if (hasFloor && hasCeiling && f > c) return 'Floor cannot exceed ceiling.'
  return null
}
