import {
  UPS_GROUND,
  FEDEX_GROUND,
  USPS_PRIORITY,
  USPS_GROUND_ADVANTAGE,
  DHL_ECOMMERCE,
  USPS_FLAT_RATE,
  DIM_DIVISOR,
  Zone,
  lookupRate,
  calcDimWeightLb,
} from './shipping-rates'

export type { Zone }

export interface ShippingInput {
  weight_lb: number
  length_in: number
  width_in: number
  height_in: number
  zone: Zone
}

export interface CarrierRate {
  carrier: string
  service: string
  rate: number
  est_days: string
  notes?: string
}

export interface ShippingResult {
  actual_weight_lb: number
  ups_dim_weight_lb: number
  usps_dim_weight_lb: number
  billable_weight_ups_lb: number
  billable_weight_usps_lb: number
  rates: CarrierRate[]
  cheapest: CarrierRate
  recommended: CarrierRate
}

const TRANSIT_DAYS: Record<Zone, { ground: string; priority: string; ground_adv: string }> = {
  2: { ground: '1–2 days', priority: '1–2 days', ground_adv: '2–5 days' },
  3: { ground: '2–3 days', priority: '1–3 days', ground_adv: '2–5 days' },
  4: { ground: '3–4 days', priority: '1–3 days', ground_adv: '2–5 days' },
  5: { ground: '4–5 days', priority: '2–3 days', ground_adv: '2–5 days' },
  6: { ground: '5–6 days', priority: '2–3 days', ground_adv: '3–5 days' },
  7: { ground: '6–7 days', priority: '2–3 days', ground_adv: '4–5 days' },
  8: { ground: '7–8 days', priority: '2–3 days', ground_adv: '4–5 days' },
}

export function calcShipping(input: ShippingInput): ShippingResult {
  const { weight_lb, length_in, width_in, height_in, zone } = input

  const ups_dim_lb = calcDimWeightLb(length_in, width_in, height_in, DIM_DIVISOR.ups_fedex)
  const volume_in3 = length_in * width_in * height_in
  // USPS applies DIM weight only when package exceeds 1 cubic foot
  const usps_dim_lb =
    volume_in3 > 1728
      ? calcDimWeightLb(length_in, width_in, height_in, DIM_DIVISOR.usps)
      : 0

  const billable_ups = Math.max(weight_lb, ups_dim_lb)
  const billable_usps = Math.max(weight_lb, usps_dim_lb)

  const td = TRANSIT_DAYS[zone]

  const rates: CarrierRate[] = [
    {
      carrier: 'UPS',
      service: 'UPS Ground',
      rate: lookupRate(UPS_GROUND, zone, billable_ups),
      est_days: td.ground,
    },
    {
      carrier: 'FedEx',
      service: 'FedEx Ground',
      rate: lookupRate(FEDEX_GROUND, zone, billable_ups),
      est_days: td.ground,
    },
    {
      carrier: 'USPS',
      service: 'Priority Mail',
      rate: lookupRate(USPS_PRIORITY, zone, billable_usps),
      est_days: td.priority,
      notes: zone <= 4 ? 'Includes $100 insurance' : undefined,
    },
    {
      carrier: 'USPS',
      service: 'Ground Advantage',
      rate: lookupRate(USPS_GROUND_ADVANTAGE, zone, billable_usps),
      est_days: td.ground_adv,
    },
    {
      carrier: 'DHL',
      service: 'DHL eCommerce',
      rate: lookupRate(DHL_ECOMMERCE, zone, billable_ups),
      est_days: '2–5 days',
    },
  ]

  // Flat-rate boxes — only show if eligible (≤ 70 lb, fits in box)
  if (weight_lb <= 70) {
    const lrg_flat = USPS_FLAT_RATE.large_box
    const med_flat = USPS_FLAT_RATE.medium_box_top
    if (lrg_flat < lookupRate(USPS_PRIORITY, zone, billable_usps)) {
      rates.push({
        carrier: 'USPS',
        service: 'Priority Mail Large Flat Rate Box',
        rate: lrg_flat,
        est_days: td.priority,
        notes: 'Zone-independent • ≤70 lb • max 12"×12"×5½"',
      })
    }
    if (med_flat < lookupRate(USPS_PRIORITY, zone, billable_usps)) {
      rates.push({
        carrier: 'USPS',
        service: 'Priority Mail Medium Flat Rate Box',
        rate: med_flat,
        est_days: td.priority,
        notes: 'Zone-independent • ≤70 lb • max 14"×12"×3½"',
      })
    }
  }

  rates.sort((a, b) => a.rate - b.rate)
  const cheapest = rates[0]

  // Recommended: cheapest with ≤3 day transit for zones ≤5; otherwise cheapest
  const fast = rates.filter((r) => {
    const days = parseInt(r.est_days.split('–')[1] ?? r.est_days, 10)
    return days <= (zone <= 5 ? 5 : 7)
  })
  const recommended = fast.length > 0 ? fast[0] : cheapest

  return {
    actual_weight_lb: round2(weight_lb),
    ups_dim_weight_lb: round2(ups_dim_lb),
    usps_dim_weight_lb: round2(usps_dim_lb),
    billable_weight_ups_lb: round2(billable_ups),
    billable_weight_usps_lb: round2(billable_usps),
    rates,
    cheapest,
    recommended,
  }
}

function round2(n: number) { return Math.round(n * 100) / 100 }

// ── International shipping ────────────────────────────────────────────────

export type IntlMarket = 'uk' | 'ca' | 'au' | 'nz'
export type ProductCategory = 'apparel' | 'electronics' | 'general' | 'home' | 'beauty'

export interface IntlShippingInput {
  weight_lb: number
  length_in: number
  width_in: number
  height_in: number
  declared_value_usd: number
  destination: IntlMarket
  product_category: ProductCategory
}

export interface IntlCarrierRate {
  carrier: string
  service: string
  base_rate: number
  fuel_surcharge: number
  estimated_duty: number
  estimated_vat: number
  total_landed_cost: number
  transit_days: number
}

export interface IntlShippingResult {
  billable_weight_lb: number
  rates: IntlCarrierRate[]
  cheapest: IntlCarrierRate
  fastest: IntlCarrierRate
  duty_rate_pct: number
  destination_vat_pct: number
}

const INTL_BASE: Record<IntlMarket, number> = { uk: 24, ca: 17, au: 34, nz: 38 }
const INTL_PER_LB: Record<IntlMarket, number> = { uk: 2.40, ca: 1.75, au: 3.40, nz: 3.80 }

const DUTY_RATES: Record<ProductCategory, Record<IntlMarket, number>> = {
  apparel:     { uk: 0.12,  ca: 0.18,  au: 0.10, nz: 0.10 },
  electronics: { uk: 0.00,  ca: 0.00,  au: 0.00, nz: 0.00 },
  general:     { uk: 0.05,  ca: 0.05,  au: 0.05, nz: 0.05 },
  home:        { uk: 0.06,  ca: 0.065, au: 0.05, nz: 0.05 },
  beauty:      { uk: 0.045, ca: 0.065, au: 0.05, nz: 0.05 },
}

const VAT_RATES: Record<IntlMarket, number> = { uk: 0.20, ca: 0.05, au: 0.10, nz: 0.15 }

const INTL_CARRIERS = [
  { carrier: 'DHL',   service: 'DHL Express',                  mul: 1.00, transit: 4 },
  { carrier: 'FedEx', service: 'FedEx International Priority', mul: 1.10, transit: 3 },
  { carrier: 'FedEx', service: 'FedEx International Economy',  mul: 0.88, transit: 7 },
  { carrier: 'UPS',   service: 'UPS Worldwide Expedited',      mul: 0.88, transit: 5 },
] as const

export function calcShippingInternational(input: IntlShippingInput): IntlShippingResult {
  const { weight_lb, length_in, width_in, height_in, declared_value_usd, destination, product_category } = input

  const dim_lb = calcDimWeightLb(length_in, width_in, height_in, DIM_DIVISOR.ups_fedex)
  const billable_lb = round2(Math.max(weight_lb, dim_lb))

  const duty_rate = DUTY_RATES[product_category][destination]
  const vat_rate = VAT_RATES[destination]

  const rates: IntlCarrierRate[] = INTL_CARRIERS.map(({ carrier, service, mul, transit }) => {
    const base_rate = round2(mul * (INTL_BASE[destination] + INTL_PER_LB[destination] * billable_lb))
    const fuel_surcharge = round2(0.20 * base_rate)
    const shipping_total = base_rate + fuel_surcharge
    const estimated_duty = round2(declared_value_usd * duty_rate)
    const estimated_vat = round2((declared_value_usd + estimated_duty + shipping_total) * vat_rate)
    const total_landed_cost = round2(shipping_total + estimated_duty + estimated_vat)
    return { carrier, service, base_rate, fuel_surcharge, estimated_duty, estimated_vat, total_landed_cost, transit_days: transit }
  })

  const cheapest = rates.reduce((a, b) => a.total_landed_cost <= b.total_landed_cost ? a : b)
  const fastest  = rates.reduce((a, b) => a.transit_days <= b.transit_days ? a : b)

  return {
    billable_weight_lb: billable_lb,
    rates,
    cheapest,
    fastest,
    duty_rate_pct: duty_rate * 100,
    destination_vat_pct: vat_rate * 100,
  }
}

// ── Bulk shipment ─────────────────────────────────────────────────────────

export interface BulkShippingInput {
  weight_lb_per_unit: number
  length_in: number
  width_in: number
  height_in: number
  unit_count: number
  zone: Zone
}

export interface BulkShippingResult {
  total_weight_lb: number
  billable_weight_lb: number
  parcel_rates: {
    carrier: string
    total_cost: number
    cost_per_unit: number
  }[]
  ltl_rate: number | null
  ltl_cost_per_unit: number | null
  ltl_crossover_units: number
  recommended_mode: 'parcel' | 'ltl'
}

const BULK_CARRIERS = [
  { carrier: 'UPS Ground',            table: UPS_GROUND },
  { carrier: 'FedEx Ground',          table: FEDEX_GROUND },
  { carrier: 'USPS Ground Advantage', table: USPS_GROUND_ADVANTAGE },
  { carrier: 'DHL eCommerce',         table: DHL_ECOMMERCE },
] as const

function calcLtlCost(billable_lb: number): number {
  const rate = billable_lb < 500 ? 0.08 : billable_lb < 1000 ? 0.06 : 0.04
  return round2(50 + billable_lb * rate)
}

export function calcBulkShipment(input: BulkShippingInput): BulkShippingResult {
  const { weight_lb_per_unit, length_in, width_in, height_in, unit_count, zone } = input

  if (unit_count === 0) {
    return {
      total_weight_lb: 0, billable_weight_lb: 0, parcel_rates: [],
      ltl_rate: null, ltl_cost_per_unit: null,
      ltl_crossover_units: Infinity, recommended_mode: 'parcel',
    }
  }

  const dim_per_unit = round2(calcDimWeightLb(length_in, width_in, height_in, DIM_DIVISOR.ups_fedex))
  const billable_per_unit = round2(Math.max(weight_lb_per_unit, dim_per_unit))
  const total_weight = round2(weight_lb_per_unit * unit_count)
  const total_billable = round2(billable_per_unit * unit_count)

  const parcel_rates = BULK_CARRIERS.map(({ carrier, table }) => {
    const total_cost = lookupRate(table, zone, total_billable)
    return { carrier, total_cost, cost_per_unit: round2(total_cost / unit_count) }
  })
  parcel_rates.sort((a, b) => a.total_cost - b.total_cost)

  const ltl_available = total_billable >= 150
  const ltl_rate = ltl_available ? calcLtlCost(total_billable) : null
  const ltl_cost_per_unit = ltl_rate != null ? round2(ltl_rate / unit_count) : null

  let ltl_crossover_units = Infinity
  for (let n = 1; n <= 10000; n++) {
    const tb = round2(billable_per_unit * n)
    if (tb >= 150) {
      const ltl = calcLtlCost(tb)
      const cheapestParcel = Math.min(
        ...BULK_CARRIERS.map(({ table }) => lookupRate(table, zone, tb))
      )
      if (ltl < cheapestParcel) {
        ltl_crossover_units = n
        break
      }
    }
  }

  const recommended_mode =
    ltl_rate != null && ltl_rate < parcel_rates[0].total_cost ? 'ltl' : 'parcel'

  return {
    total_weight_lb: total_weight,
    billable_weight_lb: total_billable,
    parcel_rates,
    ltl_rate,
    ltl_cost_per_unit,
    ltl_crossover_units,
    recommended_mode,
  }
}

// ── Packaging optimizer ───────────────────────────────────────────────────

export interface BoxSpec {
  name: string
  length_in: number
  width_in: number
  height_in: number
}

export interface PackagingInput {
  product_length_in: number
  product_width_in: number
  product_height_in: number
  product_weight_lb: number
  custom_boxes: BoxSpec[]
  zone: Zone
}

export interface CatalogMatch {
  box: BoxSpec
  fits: boolean
  dim_weight_lb: number
  billable_weight_lb: number
  cheapest_rate_usd: number
  void_fill_in3: number
}

export interface PackagingResult {
  ideal_box: BoxSpec
  ideal_dim_weight_lb: number
  catalog_matches: CatalogMatch[]
}

const ALL_RATE_TABLES = [UPS_GROUND, FEDEX_GROUND, USPS_PRIORITY, USPS_GROUND_ADVANTAGE, DHL_ECOMMERCE] as const

export function calcPackagingOptimizer(input: PackagingInput): PackagingResult {
  const { product_length_in, product_width_in, product_height_in, product_weight_lb, custom_boxes, zone } = input

  const ideal_box: BoxSpec = {
    name: 'Ideal',
    length_in: product_length_in + 4,
    width_in: product_width_in + 4,
    height_in: product_height_in + 4,
  }

  const ideal_dim_weight_lb = round2(
    calcDimWeightLb(ideal_box.length_in, ideal_box.width_in, ideal_box.height_in, DIM_DIVISOR.ups_fedex)
  )

  const product_volume = product_length_in * product_width_in * product_height_in

  const catalog_matches: CatalogMatch[] = custom_boxes.map((box) => {
    const fits =
      box.length_in >= product_length_in + 1 &&
      box.width_in  >= product_width_in  + 1 &&
      box.height_in >= product_height_in + 1

    const dim_weight_lb = round2(calcDimWeightLb(box.length_in, box.width_in, box.height_in, DIM_DIVISOR.ups_fedex))
    const billable_weight_lb = round2(Math.max(product_weight_lb, dim_weight_lb))
    const cheapest_rate_usd = Math.min(
      ...ALL_RATE_TABLES.map((table) => lookupRate(table, zone, billable_weight_lb))
    )
    const void_fill_in3 = box.length_in * box.width_in * box.height_in - product_volume

    return { box, fits, dim_weight_lb, billable_weight_lb, cheapest_rate_usd, void_fill_in3 }
  })

  catalog_matches.sort((a, b) => a.cheapest_rate_usd - b.cheapest_rate_usd)

  return { ideal_box, ideal_dim_weight_lb, catalog_matches }
}
