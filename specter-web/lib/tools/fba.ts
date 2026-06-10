// Amazon FBA 2025 fee schedule (effective Feb 5, 2025)

export const RATES_YEAR = '2025'

export type FbaSizeTier =
  | 'small_standard'
  | 'large_standard'
  | 'large_bulky'
  | 'extra_large_0_50'
  | 'extra_large_50_70'
  | 'extra_large_70_150'
  | 'extra_large_150_plus'

export type FbaCategory =
  | 'most_products'
  | 'electronics'
  | 'clothing_accessories'
  | 'shoes_handbags'
  | 'computers'
  | 'camera_photo'
  | 'cell_phones'
  | 'books_media'
  | 'baby_products'
  | 'beauty'
  | 'health_personal_care'
  | 'home_garden'
  | 'sports_outdoors'
  | 'toys_games'
  | 'automotive'
  | 'furniture'
  | 'grocery_gourmet'
  | 'jewelry_watches'
  | 'musical_instruments'
  | 'office_products'

// Referral fee rates (2025 — unchanged from 2024). Amazon minimum referral fee = $0.30
export const REFERRAL_RATES: Record<FbaCategory, number> = {
  most_products: 0.15,
  electronics: 0.08,
  clothing_accessories: 0.17,
  shoes_handbags: 0.15,
  computers: 0.08,
  camera_photo: 0.08,
  cell_phones: 0.08,
  books_media: 0.15,
  baby_products: 0.08,
  beauty: 0.08,
  health_personal_care: 0.08,
  home_garden: 0.15,
  sports_outdoors: 0.15,
  toys_games: 0.15,
  automotive: 0.12,
  furniture: 0.15,
  grocery_gourmet: 0.08,
  jewelry_watches: 0.20,
  musical_instruments: 0.15,
  office_products: 0.15,
}

export const REFERRAL_MINIMUM = 0.30

export interface VatEntry {
  country: string
  code: string
  rate: number
}

export const VAT_RATES: VatEntry[] = [
  { country: 'None (No VAT)',  code: 'NONE', rate: 0    },
  { country: 'UK',             code: 'GB',   rate: 0.20 },
  { country: 'Germany',        code: 'DE',   rate: 0.19 },
  { country: 'France',         code: 'FR',   rate: 0.20 },
  { country: 'Italy',          code: 'IT',   rate: 0.22 },
  { country: 'Spain',          code: 'ES',   rate: 0.21 },
  { country: 'Netherlands',    code: 'NL',   rate: 0.21 },
  { country: 'Poland',         code: 'PL',   rate: 0.23 },
  { country: 'Sweden',         code: 'SE',   rate: 0.25 },
]

export function effectivePriceAfterVat(price: number, rate: number): number {
  return rate === 0 ? price : price / (1 + rate)
}

export const SIZE_TIERS: FbaSizeTier[] = [
  'small_standard', 'large_standard', 'large_bulky',
  'extra_large_0_50', 'extra_large_50_70', 'extra_large_70_150', 'extra_large_150_plus',
]

// Monthly storage rates per cubic foot (FBA standard-size)
export const STORAGE_RATES = {
  jan_sep: 0.78,   // standard-size, Jan–Sep 2025
  oct_dec: 2.40,   // standard-size, Oct–Dec 2025 (peak unchanged)
}

export interface FbaInput {
  selling_price: number
  product_cost: number
  weight_oz: number
  length_in: number
  width_in: number
  height_in: number
  category: FbaCategory
  avg_monthly_units_stored: number
  is_peak_season: boolean
}

export interface FbaResult {
  dim_weight_oz: number
  billable_weight_oz: number
  size_tier: FbaSizeTier
  cubic_feet: number
  fulfillment_fee: number
  referral_fee: number
  monthly_storage_fee: number
  total_fees: number
  net_profit: number
  margin_pct: number
  roi_pct: number
  break_even_price: number
}

/** Dimensional weight in oz; Amazon divisor = 139 (yields pounds) × 16 */
export function calcDimWeight(length: number, width: number, height: number): number {
  return ((length * width * height) / 139) * 16
}

/** Determine Amazon size tier from unit dimensions and weight */
export function calcSizeTier(
  weight_oz: number,
  length: number,
  width: number,
  height: number,
): FbaSizeTier {
  const dims = [length, width, height].sort((a, b) => b - a)
  const [L, M, S] = dims
  const girth = 2 * (M + S)
  const unit_lb = weight_oz / 16
  const dim_lb = (length * width * height) / 139
  const billable_lb = Math.max(unit_lb, dim_lb)

  if (L <= 15 && M <= 12 && S <= 0.75 && weight_oz <= 16) return 'small_standard'
  if (L <= 18 && M <= 14 && S <= 8 && billable_lb <= 20) return 'large_standard'
  if (L <= 59 && M <= 33 && S <= 33 && billable_lb <= 50 && L + girth <= 130)
    return 'large_bulky'
  if (billable_lb <= 50) return 'extra_large_0_50'
  if (billable_lb <= 70) return 'extra_large_50_70'
  if (billable_lb <= 150) return 'extra_large_70_150'
  return 'extra_large_150_plus'
}

/** FBA fulfillment fees (2025 rates, non-apparel; effective Feb 5, 2025) */
export function calcFulfillmentFee(tier: FbaSizeTier, billable_oz: number): number {
  const lb = billable_oz / 16

  switch (tier) {
    case 'small_standard': {
      if (billable_oz <= 4)  return 3.06
      if (billable_oz <= 8)  return 3.24
      if (billable_oz <= 12) return 3.42
      return 3.60
    }
    case 'large_standard': {
      if (billable_oz <= 4)  return 3.68
      if (billable_oz <= 8)  return 3.90
      if (billable_oz <= 12) return 4.06
      if (billable_oz <= 16) return 4.56
      if (lb <= 1.5) return 5.19
      if (lb <= 2)   return 5.46
      if (lb <= 2.5) return 5.83
      if (lb <= 3)   return 6.08
      return 6.08 + Math.ceil((lb - 3) / 0.5) * 0.16
    }
    case 'large_bulky': {
      return 9.16 + Math.max(0, lb - 1) * 0.38
    }
    case 'extra_large_0_50': {
      return 26.33 + Math.max(0, lb - 1) * 0.38
    }
    case 'extra_large_50_70': {
      return 40.12 + Math.max(0, lb - 51) * 0.75
    }
    case 'extra_large_70_150': {
      return 54.81 + Math.max(0, lb - 71) * 0.75
    }
    case 'extra_large_150_plus': {
      return 194.95 + Math.max(0, lb - 151) * 0.19
    }
  }
}

export interface OptimizerSuggestion {
  target_tier: FbaSizeTier
  suggested_length_in: number
  suggested_width_in: number
  suggested_height_in: number
  fee_saving: number       // USD delta (positive = saving)
  description: string      // e.g. "Reduce length 16in → 15in"
  threshold_in: number     // max L dimension of the target tier (for callout distance calc)
}

export function findCheaperTierDimensions(
  weight_oz: number,
  length_in: number,
  width_in: number,
  height_in: number,
  current_fulfillment_fee: number,
  _category: FbaCategory,
  _selling_price: number,
): OptimizerSuggestion | null {
  const currentTier = calcSizeTier(weight_oz, length_in, width_in, height_in)
  if (currentTier === 'small_standard') return null

  const NEXT_CHEAPER: Partial<Record<FbaSizeTier, { tier: FbaSizeTier; maxL: number }>> = {
    large_standard:   { tier: 'small_standard', maxL: 15 },
    large_bulky:      { tier: 'large_standard', maxL: 18 },
    extra_large_0_50: { tier: 'large_bulky',    maxL: 59 },
  }

  const next = NEXT_CHEAPER[currentTier]
  if (!next) return null  // weight-dominated extra-large tier — dimension reduction won't help

  // Find the longest dimension
  const dims = [
    { key: 'length_in' as const, val: length_in },
    { key: 'width_in'  as const, val: width_in  },
    { key: 'height_in' as const, val: height_in },
  ].sort((a, b) => b.val - a.val)
  const longest = dims[0]

  if (longest.val <= next.maxL) return null  // already within threshold for that dimension

  const suggested = {
    length_in: longest.key === 'length_in' ? next.maxL : length_in,
    width_in:  longest.key === 'width_in'  ? next.maxL : width_in,
    height_in: longest.key === 'height_in' ? next.maxL : height_in,
  }

  const newTier = calcSizeTier(weight_oz, suggested.length_in, suggested.width_in, suggested.height_in)
  if (newTier !== next.tier) return null  // other constraints (weight, other dims) prevent the tier

  const newDimWeight = calcDimWeight(suggested.length_in, suggested.width_in, suggested.height_in)
  const newBillable = Math.max(weight_oz, newDimWeight)
  const newFee = calcFulfillmentFee(next.tier, newBillable)
  const saving = round2(current_fulfillment_fee - newFee)
  if (saving <= 0) return null

  const dimName = longest.key.replace('_in', '')
  return {
    target_tier: next.tier,
    suggested_length_in: suggested.length_in,
    suggested_width_in: suggested.width_in,
    suggested_height_in: suggested.height_in,
    fee_saving: saving,
    description: `Reduce ${dimName} ${longest.val}in → ${next.maxL}in`,
    threshold_in: next.maxL,
  }
}

export function calcBreakevenAcos(net_profit: number, selling_price: number): number {
  if (selling_price <= 0) return 0
  return Math.round((net_profit / selling_price) * 1000) / 10
}

export function calcFbaFees(input: FbaInput): FbaResult {
  const dim_weight_oz = calcDimWeight(input.length_in, input.width_in, input.height_in)
  const billable_weight_oz = Math.max(input.weight_oz, dim_weight_oz)

  const size_tier = calcSizeTier(
    input.weight_oz,
    input.length_in,
    input.width_in,
    input.height_in,
  )

  const fulfillment_fee = round2(calcFulfillmentFee(size_tier, billable_weight_oz))
  const referral_fee = round2(
    Math.max(REFERRAL_MINIMUM, input.selling_price * REFERRAL_RATES[input.category]),
  )

  // Storage: L×W×H / 1728 = cubic feet per unit
  const cubic_feet = (input.length_in * input.width_in * input.height_in) / 1728
  const storage_rate = input.is_peak_season ? STORAGE_RATES.oct_dec : STORAGE_RATES.jan_sep
  // Per-unit monthly storage allocated from total warehouse cost
  const monthly_storage_fee = round2(cubic_feet * storage_rate * input.avg_monthly_units_stored)

  const total_fees = round2(fulfillment_fee + referral_fee + monthly_storage_fee)
  const net_profit = round2(input.selling_price - input.product_cost - total_fees)
  const margin_pct = input.selling_price > 0
    ? round1((net_profit / input.selling_price) * 100)
    : 0
  const roi_pct = input.product_cost > 0
    ? round1((net_profit / input.product_cost) * 100)
    : 0
  const break_even_price = round2(input.product_cost + total_fees)

  return {
    dim_weight_oz: round2(dim_weight_oz),
    billable_weight_oz: round2(billable_weight_oz),
    size_tier,
    cubic_feet: round4(cubic_feet),
    fulfillment_fee,
    referral_fee,
    monthly_storage_fee,
    total_fees,
    net_profit,
    margin_pct,
    roi_pct,
    break_even_price,
  }
}

function round2(n: number) { return Math.round(n * 100) / 100 }
function round1(n: number) { return Math.round(n * 10) / 10 }
function round4(n: number) { return Math.round(n * 10000) / 10000 }
