# Shipping Calculator Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the shipping calculator with international shipping (UK/CA/AU/NZ + duties/VAT), bulk shipment mode with LTL crossover analysis, and a packaging optimizer; rebuild the page as a 3-tab UI with full currency/scenario/export parity.

**Architecture:** Three new exported calc functions (`calcShippingInternational`, `calcBulkShipment`, `calcPackagingOptimizer`) added to `lib/tools/shipping.ts` alongside existing `calcShipping`. Page `app/tools/shipping-calculator/page.tsx` is fully rewritten as a tab-switcher (Domestic | International | Bulk Shipment) with Packaging Optimizer pinned below all tabs. Uses existing `useCurrency` hook, `ScenarioPanel`, `ExportBar`, `PrintReport`.

**Tech Stack:** TypeScript strict, Vitest, existing tool-layout primitives (CalcCard, Field, Input, Select, Metric), useCurrency hook, ScenarioPanel/ExportBar/PrintReport components.

---

## File Map

| File | Change |
|------|--------|
| `lib/tools/shipping.ts` | Add types + 3 new calc functions + rate constants |
| `__tests__/tools/shipping.test.ts` | Append ~25 new tests (keep existing) |
| `app/tools/shipping-calculator/page.tsx` | Full rewrite — tabs, currency, scenarios, export |

---

### Task 1: `calcShippingInternational` — types, rate constants, function, 8 tests

**Files:**
- Modify: `lib/tools/shipping.ts` — append types + rate constants + function
- Modify: `__tests__/tools/shipping.test.ts` — append 8 tests

---

- [ ] **Step 1: Append types and rate constants to `lib/tools/shipping.ts`**

Add after the existing `function round2` at the bottom of `lib/tools/shipping.ts`:

```ts
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
  base_rate: number        // raw shipping cost (pre-fuel)
  fuel_surcharge: number   // 20% of base_rate
  estimated_duty: number
  estimated_vat: number
  total_landed_cost: number
  transit_days: number
}

export interface IntlShippingResult {
  billable_weight_lb: number
  rates: IntlCarrierRate[]   // always 4 carriers
  cheapest: IntlCarrierRate
  fastest: IntlCarrierRate
  duty_rate_pct: number
  destination_vat_pct: number
}

// Base rates (USD) — approximate 2024 representative values
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

// Multipliers relative to DHL base rate; transit = max transit days
const INTL_CARRIERS = [
  { carrier: 'DHL',   service: 'DHL Express',                    mul: 1.00, transit: 4 },
  { carrier: 'FedEx', service: 'FedEx International Priority',   mul: 1.10, transit: 3 },
  { carrier: 'FedEx', service: 'FedEx International Economy',    mul: 0.88, transit: 7 },
  { carrier: 'UPS',   service: 'UPS Worldwide Expedited',        mul: 0.88, transit: 5 },
] as const
```

- [ ] **Step 2: Append `calcShippingInternational` function to `lib/tools/shipping.ts`**

```ts
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
```

- [ ] **Step 3: Write 8 failing tests — append to `__tests__/tools/shipping.test.ts`**

```ts
import {
  calcShippingInternational,
  type IntlShippingInput,
} from '@/lib/tools/shipping'

describe('calcShippingInternational', () => {
  // UK electronics: duty=0%, VAT=20% on (declared+duty+shipping)
  // dims 10×10×10 → dim_lb = 1000/139 = 7.19; billable = max(2, 7.19) = 7.19
  // DHL base_rate = 1.00 * (24 + 2.40*7.19) = 41.26; fuel = 8.25
  // shipping_total = 49.51; vat = (100+0+49.51)*0.20 = 29.90; total = 79.41
  const ukElec: IntlShippingInput = {
    weight_lb: 2, length_in: 10, width_in: 10, height_in: 10,
    declared_value_usd: 100, destination: 'uk', product_category: 'electronics',
  }

  it('returns exactly 4 carrier rates', () => {
    expect(calcShippingInternational(ukElec).rates).toHaveLength(4)
  })

  it('UK electronics: duty=0, VAT=20%', () => {
    const r = calcShippingInternational(ukElec)
    expect(r.duty_rate_pct).toBe(0)
    expect(r.destination_vat_pct).toBe(20)
  })

  it('UK electronics: DHL base_rate and total_landed_cost', () => {
    const r = calcShippingInternational(ukElec)
    const dhl = r.rates.find((x) => x.service === 'DHL Express')!
    expect(dhl.base_rate).toBeCloseTo(41.26, 1)
    expect(dhl.estimated_duty).toBe(0)
    expect(dhl.estimated_vat).toBeCloseTo(29.90, 1)
    expect(dhl.total_landed_cost).toBeCloseTo(79.41, 0)
  })

  it('CA apparel: duty_rate_pct=18, vat_pct=5', () => {
    const r = calcShippingInternational({
      weight_lb: 1, length_in: 8, width_in: 8, height_in: 8,
      declared_value_usd: 50, destination: 'ca', product_category: 'apparel',
    })
    expect(r.duty_rate_pct).toBe(18)
    expect(r.destination_vat_pct).toBe(5)
  })

  it('AU general: duty_rate_pct=5, vat_pct=10', () => {
    const r = calcShippingInternational({
      weight_lb: 1, length_in: 5, width_in: 5, height_in: 5,
      declared_value_usd: 30, destination: 'au', product_category: 'general',
    })
    expect(r.duty_rate_pct).toBe(5)
    expect(r.destination_vat_pct).toBe(10)
  })

  it('dim weight triggers when volume/139 > actual weight', () => {
    // 10×10×10 = 1000/139 = 7.19 > actual 2lb
    expect(calcShippingInternational(ukElec).billable_weight_lb).toBeCloseTo(7.19, 1)
  })

  it('actual weight used when heavier than dim weight', () => {
    // 4×4×4 = 64/139 = 0.46 < 5lb actual
    const r = calcShippingInternational({
      weight_lb: 5, length_in: 4, width_in: 4, height_in: 4,
      declared_value_usd: 50, destination: 'uk', product_category: 'general',
    })
    expect(r.billable_weight_lb).toBe(5)
  })

  it('fastest carrier is FedEx International Priority (transit_days=3)', () => {
    const r = calcShippingInternational(ukElec)
    expect(r.fastest.service).toBe('FedEx International Priority')
    expect(r.fastest.transit_days).toBe(3)
  })

  it('cheapest and fastest differ for this package', () => {
    const r = calcShippingInternational(ukElec)
    // FedEx Priority multiplier 1.10 > FedEx Economy/UPS 0.88, so fastest != cheapest
    expect(r.cheapest.service).not.toBe(r.fastest.service)
  })
})
```

- [ ] **Step 4: Run tests — verify all 8 FAIL**

```
npx vitest run __tests__/tools/shipping.test.ts
```
Expected: 8 new tests fail with "calcShippingInternational is not a function" or import errors.

- [ ] **Step 5: Run tests again — verify all pass**

```
npx vitest run __tests__/tools/shipping.test.ts
```
Expected: all existing tests + 8 new tests pass.

- [ ] **Step 6: Commit**

```
git add lib/tools/shipping.ts __tests__/tools/shipping.test.ts
git commit -m "feat: add calcShippingInternational with international carrier rates and duties/VAT"
```

---

### Task 2: `calcBulkShipment` — types, function, 8 tests

**Files:**
- Modify: `lib/tools/shipping.ts` — append types + function
- Modify: `__tests__/tools/shipping.test.ts` — append 8 tests

---

- [ ] **Step 1: Append bulk shipment types to `lib/tools/shipping.ts`**

Add after the `calcShippingInternational` block:

```ts
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
  ltl_rate: number | null            // null if total billable < 150 lb
  ltl_cost_per_unit: number | null
  ltl_crossover_units: number        // Infinity if LTL never cheaper in 1–10000 range
  recommended_mode: 'parcel' | 'ltl'
}
```

- [ ] **Step 2: Append `calcBulkShipment` function to `lib/tools/shipping.ts`**

```ts
const BULK_CARRIERS = [
  { carrier: 'UPS Ground',          table: UPS_GROUND },
  { carrier: 'FedEx Ground',        table: FEDEX_GROUND },
  { carrier: 'USPS Ground Advantage', table: USPS_GROUND_ADVANTAGE },
  { carrier: 'DHL eCommerce',       table: DHL_ECOMMERCE },
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

  // Find smallest n where LTL is available and cheaper than cheapest parcel
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
```

- [ ] **Step 3: Append 8 tests to `__tests__/tools/shipping.test.ts`**

```ts
import { calcBulkShipment } from '@/lib/tools/shipping'

describe('calcBulkShipment', () => {
  // 10 units × 5lb, 12×10×6: dim=720/139=5.18, billable/unit=5.18
  // total_billable=51.8 < 150 → ltl_rate=null
  const small = { weight_lb_per_unit: 5, length_in: 12, width_in: 10, height_in: 6, unit_count: 10, zone: 4 as const }

  // 200 units × 1lb, 6×6×6: dim=216/139=1.55, billable/unit=1.55
  // total_billable=310 ≥ 150 → ltl_rate=50+310*0.08=74.8
  const large = { weight_lb_per_unit: 1, length_in: 6, width_in: 6, height_in: 6, unit_count: 200, zone: 4 as const }

  it('returns 4 parcel_rates', () => {
    expect(calcBulkShipment(small).parcel_rates).toHaveLength(4)
  })

  it('ltl_rate is null when total_billable < 150', () => {
    const r = calcBulkShipment(small)
    expect(r.ltl_rate).toBeNull()
    expect(r.recommended_mode).toBe('parcel')
  })

  it('dim weight applied per unit then multiplied for total', () => {
    const r = calcBulkShipment(small)
    // dim_per_unit = round2(720/139) = 5.18; billable = max(5, 5.18) = 5.18
    expect(r.billable_weight_lb).toBeCloseTo(51.8, 0)
  })

  it('cost_per_unit = total_cost / unit_count for each carrier', () => {
    const r = calcBulkShipment(large)
    r.parcel_rates.forEach(({ total_cost, cost_per_unit }) => {
      expect(cost_per_unit).toBeCloseTo(total_cost / 200, 1)
    })
  })

  it('ltl_rate computed when total_billable ≥ 150', () => {
    const r = calcBulkShipment(large)
    // total_billable = 200 * 1.55 = 310; ltl = 50 + 310*0.08 = 74.8
    expect(r.ltl_rate).toBeCloseTo(74.8, 1)
    expect(r.ltl_cost_per_unit).toBeCloseTo(74.8 / 200, 1)
  })

  it('recommended_mode = ltl when LTL is cheaper than cheapest parcel', () => {
    expect(calcBulkShipment(large).recommended_mode).toBe('ltl')
  })

  it('ltl_crossover_units: LTL is cheaper at the crossover boundary', () => {
    const n = calcBulkShipment({ weight_lb_per_unit: 1, length_in: 6, width_in: 6, height_in: 6, unit_count: 200, zone: 4 }).ltl_crossover_units
    // n should be a finite positive integer
    expect(Number.isFinite(n)).toBe(true)
    expect(n).toBeGreaterThan(0)
  })

  it('unit_count=0 returns empty parcel_rates without divide-by-zero', () => {
    const r = calcBulkShipment({ weight_lb_per_unit: 2, length_in: 10, width_in: 8, height_in: 6, unit_count: 0, zone: 4 })
    expect(r.parcel_rates).toHaveLength(0)
    expect(r.ltl_rate).toBeNull()
  })
})
```

- [ ] **Step 4: Run tests — verify new tests FAIL**

```
npx vitest run __tests__/tools/shipping.test.ts
```

- [ ] **Step 5: Run tests — verify all pass after implementation**

```
npx vitest run __tests__/tools/shipping.test.ts
```

- [ ] **Step 6: Commit**

```
git add lib/tools/shipping.ts __tests__/tools/shipping.test.ts
git commit -m "feat: add calcBulkShipment with LTL crossover analysis"
```

---

### Task 3: `calcPackagingOptimizer` — types, function, 9 tests

**Files:**
- Modify: `lib/tools/shipping.ts` — append types + function
- Modify: `__tests__/tools/shipping.test.ts` — append 9 tests

---

- [ ] **Step 1: Append packaging optimizer types to `lib/tools/shipping.ts`**

```ts
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
  catalog_matches: CatalogMatch[]   // sorted by cheapest_rate_usd ascending
}
```

- [ ] **Step 2: Append `calcPackagingOptimizer` function to `lib/tools/shipping.ts`**

```ts
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
```

- [ ] **Step 3: Append 9 tests to `__tests__/tools/shipping.test.ts`**

```ts
import { calcPackagingOptimizer } from '@/lib/tools/shipping'
import type { BoxSpec } from '@/lib/tools/shipping'

describe('calcPackagingOptimizer', () => {
  const prod = { product_length_in: 10, product_width_in: 8, product_height_in: 5, product_weight_lb: 2, zone: 4 as const }

  it('ideal_box = product dims + 4 per axis', () => {
    const r = calcPackagingOptimizer({ ...prod, custom_boxes: [] })
    expect(r.ideal_box.length_in).toBe(14)
    expect(r.ideal_box.width_in).toBe(12)
    expect(r.ideal_box.height_in).toBe(9)
  })

  it('ideal_dim_weight_lb = ideal box volume / 139', () => {
    // 14*12*9 = 1512; /139 = 10.878 → 10.88
    const r = calcPackagingOptimizer({ ...prod, custom_boxes: [] })
    expect(r.ideal_dim_weight_lb).toBeCloseTo(10.88, 1)
  })

  it('empty custom_boxes → catalog_matches is empty', () => {
    expect(calcPackagingOptimizer({ ...prod, custom_boxes: [] }).catalog_matches).toHaveLength(0)
  })

  it('fits=true when box dims each ≥ product dim + 1"', () => {
    const box: BoxSpec = { name: 'A', length_in: 11, width_in: 9, height_in: 6 }
    const r = calcPackagingOptimizer({ ...prod, custom_boxes: [box] })
    expect(r.catalog_matches[0].fits).toBe(true)
  })

  it('fits=false when any box dim < product dim + 1"', () => {
    const box: BoxSpec = { name: 'B', length_in: 10, width_in: 9, height_in: 6 }  // length too small
    const r = calcPackagingOptimizer({ ...prod, custom_boxes: [box] })
    expect(r.catalog_matches[0].fits).toBe(false)
  })

  it('non-fitting box still has a valid cheapest_rate_usd', () => {
    const box: BoxSpec = { name: 'C', length_in: 5, width_in: 5, height_in: 5 }
    const r = calcPackagingOptimizer({ ...prod, custom_boxes: [box] })
    expect(r.catalog_matches[0].cheapest_rate_usd).toBeGreaterThan(0)
  })

  it('void_fill_in3 = box volume − product volume', () => {
    const box: BoxSpec = { name: 'D', length_in: 14, width_in: 12, height_in: 9 }
    // box volume = 1512, product volume = 400; void = 1112
    const r = calcPackagingOptimizer({ ...prod, custom_boxes: [box] })
    expect(r.catalog_matches[0].void_fill_in3).toBe(1512 - 400)
  })

  it('dim weight wins for large light box', () => {
    // 20×20×20 with 1lb product: dim = 8000/139 = 57.55 > 1lb
    const box: BoxSpec = { name: 'E', length_in: 20, width_in: 20, height_in: 20 }
    const r = calcPackagingOptimizer({ ...prod, product_weight_lb: 1, custom_boxes: [box] })
    expect(r.catalog_matches[0].billable_weight_lb).toBeCloseTo(57.55, 0)
  })

  it('catalog_matches sorted by cheapest_rate_usd ascending', () => {
    const small: BoxSpec = { name: 'S', length_in: 11, width_in: 9, height_in: 6 }
    const large: BoxSpec = { name: 'L', length_in: 20, width_in: 20, height_in: 20 }
    const r = calcPackagingOptimizer({ ...prod, product_weight_lb: 1, custom_boxes: [large, small] })
    // small box has lower dim weight → cheaper rate → should be first after sort
    expect(r.catalog_matches[0].cheapest_rate_usd).toBeLessThanOrEqual(r.catalog_matches[1].cheapest_rate_usd)
  })
})
```

- [ ] **Step 4: Run tests — verify new tests FAIL**

```
npx vitest run __tests__/tools/shipping.test.ts
```

- [ ] **Step 5: Run all tests — verify all pass**

```
npx vitest run __tests__/tools/shipping.test.ts
```
Expected: original 6 + 8 intl + 8 bulk + 9 packaging = 31 tests all pass.

- [ ] **Step 6: Commit**

```
git add lib/tools/shipping.ts __tests__/tools/shipping.test.ts
git commit -m "feat: add calcPackagingOptimizer with ideal box and catalog scoring"
```

---

### Task 4: Page rewrite — tab skeleton, domestic tab, full infrastructure

**Files:**
- Modify: `app/tools/shipping-calculator/page.tsx` — full rewrite

This task rewrites the page with the 3-tab shell (Domestic | International | Bulk Shipment), wires up `useCurrency`, `ScenarioPanel`, `ExportBar`, `PrintReport`, and implements the complete Domestic tab (migration of existing UI + currency conversion).

---

- [ ] **Step 1: Rewrite `app/tools/shipping-calculator/page.tsx`**

Replace the entire file with:

```tsx
'use client'

import { useState, useMemo } from 'react'
import ToolLayout, { CalcCard, Field, Input, Select, Metric } from '@/components/tools/tool-layout'
import ScenarioPanel from '@/components/tools/scenario-panel'
import ExportBar from '@/components/tools/export-bar'
import PrintReport from '@/components/tools/print-report'
import { useCurrency } from '@/hooks/use-currency'
import {
  calcShipping,
  calcShippingInternational,
  calcBulkShipment,
  calcPackagingOptimizer,
  type Zone,
  type CarrierRate,
  type IntlMarket,
  type ProductCategory,
  type BoxSpec,
} from '@/lib/tools/shipping'
import type { Scenario } from '@/lib/tools/scenarios'
import { cn } from '@/lib/utils'

// ── Constants ──────────────────────────────────────────────────────────────

const ZONE_OPTIONS: { value: Zone; label: string }[] = [
  { value: 2, label: 'Zone 2 — Local (≤150 miles)' },
  { value: 3, label: 'Zone 3 — ≤300 miles' },
  { value: 4, label: 'Zone 4 — ≤600 miles' },
  { value: 5, label: 'Zone 5 — ≤1000 miles' },
  { value: 6, label: 'Zone 6 — ≤1400 miles' },
  { value: 7, label: 'Zone 7 — ≤1800 miles' },
  { value: 8, label: 'Zone 8 — Cross-country (1800+ miles)' },
]

const MARKET_OPTIONS: { value: IntlMarket; label: string }[] = [
  { value: 'uk', label: 'United Kingdom' },
  { value: 'ca', label: 'Canada' },
  { value: 'au', label: 'Australia' },
  { value: 'nz', label: 'New Zealand' },
]

const CATEGORY_OPTIONS: { value: ProductCategory; label: string }[] = [
  { value: 'general',     label: 'General merchandise' },
  { value: 'apparel',     label: 'Apparel / Clothing' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'home',        label: 'Home & Garden' },
  { value: 'beauty',      label: 'Beauty / Personal care' },
]

const CARRIER_COLORS: Record<string, string> = {
  UPS:   'text-amber-400',
  FedEx: 'text-purple-400',
  USPS:  'text-blue-400',
  DHL:   'text-yellow-400',
}

type Tab = 'domestic' | 'intl' | 'bulk'

// ── Main page ──────────────────────────────────────────────────────────────

export default function ShippingCalculatorPage() {
  const [tab, setTab] = useState<Tab>('domestic')
  const { currency, fmt, fromUSD } = useCurrency()

  // ── Domestic state ────────────────────────────────────────────────────
  const [domWeight,  setDomWeight]  = useState('2')
  const [domLength,  setDomLength]  = useState('12')
  const [domWidth,   setDomWidth]   = useState('10')
  const [domHeight,  setDomHeight]  = useState('6')
  const [domZone,    setDomZone]    = useState<Zone>(4)

  const domResult = useMemo(() => calcShipping({
    weight_lb: parseFloat(domWeight)  || 0.1,
    length_in: parseFloat(domLength)  || 1,
    width_in:  parseFloat(domWidth)   || 1,
    height_in: parseFloat(domHeight)  || 1,
    zone: domZone,
  }), [domWeight, domLength, domWidth, domHeight, domZone])

  // ── International state ───────────────────────────────────────────────
  const [intlWeight,   setIntlWeight]   = useState('2')
  const [intlLength,   setIntlLength]   = useState('12')
  const [intlWidth,    setIntlWidth]    = useState('10')
  const [intlHeight,   setIntlHeight]   = useState('6')
  const [intlDeclared, setIntlDeclared] = useState('100')
  const [intlDest,     setIntlDest]     = useState<IntlMarket>('uk')
  const [intlCat,      setIntlCat]      = useState<ProductCategory>('general')

  const intlResult = useMemo(() => calcShippingInternational({
    weight_lb:         parseFloat(intlWeight)   || 0.1,
    length_in:         parseFloat(intlLength)   || 1,
    width_in:          parseFloat(intlWidth)    || 1,
    height_in:         parseFloat(intlHeight)   || 1,
    declared_value_usd: parseFloat(intlDeclared) || 0,
    destination:       intlDest,
    product_category:  intlCat,
  }), [intlWeight, intlLength, intlWidth, intlHeight, intlDeclared, intlDest, intlCat])

  // ── Bulk state ────────────────────────────────────────────────────────
  const [bulkWeight,  setBulkWeight]  = useState('2')
  const [bulkLength,  setBulkLength]  = useState('12')
  const [bulkWidth,   setBulkWidth]   = useState('10')
  const [bulkHeight,  setBulkHeight]  = useState('6')
  const [bulkUnits,   setBulkUnits]   = useState('50')
  const [bulkZone,    setBulkZone]    = useState<Zone>(4)

  const bulkResult = useMemo(() => calcBulkShipment({
    weight_lb_per_unit: parseFloat(bulkWeight) || 0.1,
    length_in:          parseFloat(bulkLength) || 1,
    width_in:           parseFloat(bulkWidth)  || 1,
    height_in:          parseFloat(bulkHeight) || 1,
    unit_count:         parseInt(bulkUnits)    || 0,
    zone:               bulkZone,
  }), [bulkWeight, bulkLength, bulkWidth, bulkHeight, bulkUnits, bulkZone])

  // ── Packaging optimizer state ─────────────────────────────────────────
  const [pkgProdLength, setPkgProdLength] = useState('10')
  const [pkgProdWidth,  setPkgProdWidth]  = useState('8')
  const [pkgProdHeight, setPkgProdHeight] = useState('5')
  const [pkgProdWeight, setPkgProdWeight] = useState('2')
  const [pkgZone,       setPkgZone]       = useState<Zone>(4)
  const [customBoxes,   setCustomBoxes]   = useState<BoxSpec[]>([])
  const [newBoxName,    setNewBoxName]    = useState('')
  const [newBoxL,       setNewBoxL]       = useState('')
  const [newBoxW,       setNewBoxW]       = useState('')
  const [newBoxH,       setNewBoxH]       = useState('')

  const pkgResult = useMemo(() => calcPackagingOptimizer({
    product_length_in: parseFloat(pkgProdLength) || 1,
    product_width_in:  parseFloat(pkgProdWidth)  || 1,
    product_height_in: parseFloat(pkgProdHeight) || 1,
    product_weight_lb: parseFloat(pkgProdWeight) || 0.1,
    custom_boxes: customBoxes,
    zone: pkgZone,
  }), [pkgProdLength, pkgProdWidth, pkgProdHeight, pkgProdWeight, customBoxes, pkgZone])

  function addBox() {
    const l = parseFloat(newBoxL), w = parseFloat(newBoxW), h = parseFloat(newBoxH)
    if (!l || !w || !h || customBoxes.length >= 5) return
    const name = newBoxName.trim() || `Box ${customBoxes.length + 1}`
    setCustomBoxes([...customBoxes, { name, length_in: l, width_in: w, height_in: h }])
    setNewBoxName(''); setNewBoxL(''); setNewBoxW(''); setNewBoxH('')
  }

  // ── Scenario wiring ───────────────────────────────────────────────────
  const domInputsForScenario: Record<string, string> = {
    weight_lb: domWeight, length_in: domLength, width_in: domWidth,
    height_in: domHeight, zone: String(domZone),
  }
  const domResultsForScenario: Record<string, number> = {
    cheapest_rate: domResult.cheapest.rate,
    billable_weight: domResult.billable_weight_ups_lb,
  }
  function onLoadDomScenario(s: Scenario) {
    const i = s.inputs as Record<string, string>
    if (i.weight_lb)  setDomWeight(i.weight_lb)
    if (i.length_in)  setDomLength(i.length_in)
    if (i.width_in)   setDomWidth(i.width_in)
    if (i.height_in)  setDomHeight(i.height_in)
    if (i.zone)       setDomZone(parseInt(i.zone) as Zone)
  }

  const intlInputsForScenario: Record<string, string> = {
    weight_lb: intlWeight, length_in: intlLength, width_in: intlWidth,
    height_in: intlHeight, declared_value: intlDeclared,
    destination: intlDest, category: intlCat,
  }
  const intlResultsForScenario: Record<string, number> = {
    cheapest_landed: intlResult.cheapest.total_landed_cost,
    fastest_landed:  intlResult.fastest.total_landed_cost,
  }
  function onLoadIntlScenario(s: Scenario) {
    const i = s.inputs as Record<string, string>
    if (i.weight_lb)     setIntlWeight(i.weight_lb)
    if (i.length_in)     setIntlLength(i.length_in)
    if (i.width_in)      setIntlWidth(i.width_in)
    if (i.height_in)     setIntlHeight(i.height_in)
    if (i.declared_value) setIntlDeclared(i.declared_value)
    if (i.destination)   setIntlDest(i.destination as IntlMarket)
    if (i.category)      setIntlCat(i.category as ProductCategory)
  }

  const bulkInputsForScenario: Record<string, string> = {
    weight_per_unit: bulkWeight, length_in: bulkLength, width_in: bulkWidth,
    height_in: bulkHeight, unit_count: bulkUnits, zone: String(bulkZone),
  }
  const bulkResultsForScenario: Record<string, number> = {
    cheapest_per_unit: bulkResult.parcel_rates[0]?.cost_per_unit ?? 0,
    ltl_per_unit:      bulkResult.ltl_cost_per_unit ?? 0,
  }
  function onLoadBulkScenario(s: Scenario) {
    const i = s.inputs as Record<string, string>
    if (i.weight_per_unit) setBulkWeight(i.weight_per_unit)
    if (i.length_in)       setBulkLength(i.length_in)
    if (i.width_in)        setBulkWidth(i.width_in)
    if (i.height_in)       setBulkHeight(i.height_in)
    if (i.unit_count)      setBulkUnits(i.unit_count)
    if (i.zone)            setBulkZone(parseInt(i.zone) as Zone)
  }

  // ── Active tab wiring for ScenarioPanel / ExportBar ───────────────────
  const scenarioProps = tab === 'domestic'
    ? { currentInputs: domInputsForScenario, currentResults: domResultsForScenario, resultLabels: { cheapest_rate: 'Cheapest Rate', billable_weight: 'Billable Weight (lb)' }, onLoad: onLoadDomScenario }
    : tab === 'intl'
    ? { currentInputs: intlInputsForScenario, currentResults: intlResultsForScenario, resultLabels: { cheapest_landed: 'Cheapest Landed Cost', fastest_landed: 'Fastest Landed Cost' }, onLoad: onLoadIntlScenario }
    : { currentInputs: bulkInputsForScenario, currentResults: bulkResultsForScenario, resultLabels: { cheapest_per_unit: 'Cheapest / Unit', ltl_per_unit: 'LTL / Unit' }, onLoad: onLoadBulkScenario }

  const exportInputs = tab === 'domestic'
    ? [
        { label: 'Weight (lbs)',       value: domWeight },
        { label: 'Dimensions (L×W×H)', value: `${domLength}×${domWidth}×${domHeight} in` },
        { label: 'Zone',               value: String(domZone) },
      ]
    : tab === 'intl'
    ? [
        { label: 'Weight (lbs)',       value: intlWeight },
        { label: 'Dimensions (L×W×H)', value: `${intlLength}×${intlWidth}×${intlHeight} in` },
        { label: 'Declared Value',     value: `$${intlDeclared}` },
        { label: 'Destination',        value: intlDest.toUpperCase() },
        { label: 'Category',           value: intlCat },
      ]
    : [
        { label: 'Weight / Unit (lbs)',value: bulkWeight },
        { label: 'Dimensions (L×W×H)', value: `${bulkLength}×${bulkWidth}×${bulkHeight} in` },
        { label: 'Unit Count',         value: bulkUnits },
        { label: 'Zone',               value: String(bulkZone) },
      ]

  const exportResults = tab === 'domestic'
    ? [
        { label: 'Cheapest Carrier',  value: `${domResult.cheapest.carrier} ${domResult.cheapest.service}` },
        { label: 'Cheapest Rate',     value: fmt(fromUSD(domResult.cheapest.rate)) },
        { label: 'Billable Weight',   value: `${domResult.billable_weight_ups_lb} lbs` },
      ]
    : tab === 'intl'
    ? [
        { label: 'Cheapest Landed',   value: fmt(fromUSD(intlResult.cheapest.total_landed_cost)) },
        { label: 'Fastest Landed',    value: fmt(fromUSD(intlResult.fastest.total_landed_cost)) },
        { label: 'Duty Rate',         value: `${intlResult.duty_rate_pct}%` },
        { label: 'VAT Rate',          value: `${intlResult.destination_vat_pct}%` },
      ]
    : [
        { label: 'Cheapest Carrier',  value: bulkResult.parcel_rates[0]?.carrier ?? '—' },
        { label: 'Total Cost',        value: fmt(fromUSD(bulkResult.parcel_rates[0]?.total_cost ?? 0)) },
        { label: 'Cost / Unit',       value: fmt(fromUSD(bulkResult.parcel_rates[0]?.cost_per_unit ?? 0)) },
        { label: 'LTL Rate',          value: bulkResult.ltl_rate != null ? fmt(fromUSD(bulkResult.ltl_rate)) : 'N/A' },
      ]

  const domDimApplies = domResult.billable_weight_ups_lb > domResult.actual_weight_lb

  return (
    <ToolLayout
      toolId="shipping"
      badge="Free Shipping Tool"
      title="Multi-Carrier Shipping Rate Estimator"
      description="Compare 2024 retail rates from UPS, FedEx, USPS, and DHL side-by-side. Includes international landed costs, bulk LTL analysis, and packaging optimizer."
      headerRight={
        <div className="flex items-center gap-3">
          <ScenarioPanel
            toolId={`shipping-${tab}`}
            {...scenarioProps}
            currency={currency}
          />
          <ExportBar toolId="shipping" inputs={exportInputs} results={exportResults} currency={currency} />
        </div>
      }
    >
      <PrintReport
        toolName="Multi-Carrier Shipping Rate Estimator"
        toolId="shipping"
        currency={currency}
        inputs={exportInputs}
        results={exportResults}
      />

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-surface border border-border rounded-xl mb-6 w-fit mx-auto">
        {(['domestic', 'intl', 'bulk'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 rounded-lg font-mono text-xs font-semibold transition-colors',
              tab === t ? 'bg-primary text-bg' : 'text-muted hover:text-text',
            )}
          >
            {t === 'domestic' ? 'Domestic' : t === 'intl' ? 'International' : 'Bulk Shipment'}
          </button>
        ))}
      </div>

      {/* ── Domestic tab ── */}
      {tab === 'domestic' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-5">
            <CalcCard title="Package Details">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <Field label="Length (in)"><Input value={domLength} onChange={setDomLength} step={0.1} min={1} /></Field>
                <Field label="Width (in)"><Input value={domWidth}  onChange={setDomWidth}  step={0.1} min={1} /></Field>
                <Field label="Height (in)"><Input value={domHeight} onChange={setDomHeight} step={0.1} min={1} /></Field>
              </div>
              <Field label="Actual Weight (lbs)">
                <Input value={domWeight} onChange={setDomWeight} suffix="lbs" step={0.1} min={0.1} />
              </Field>
            </CalcCard>

            <CalcCard title="Destination Zone">
              <Field label="Shipping Zone" hint="Based on distance from origin warehouse">
                <Select value={String(domZone)} onChange={(v) => setDomZone(parseInt(v) as Zone)}>
                  {ZONE_OPTIONS.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
                </Select>
              </Field>
            </CalcCard>

            <CalcCard title="Weight Analysis">
              <div className="grid grid-cols-2 gap-4">
                <Metric label="Actual Weight"     value={`${domResult.actual_weight_lb} lbs`} />
                <Metric label="UPS/FedEx Dim Weight" value={`${domResult.ups_dim_weight_lb.toFixed(2)} lbs`} sub="Volume ÷ 139" variant={domDimApplies ? 'warning' : 'default'} />
                <Metric label="USPS Dim Weight"   value={domResult.usps_dim_weight_lb > 0 ? `${domResult.usps_dim_weight_lb.toFixed(2)} lbs` : 'N/A'} sub={domResult.usps_dim_weight_lb > 0 ? 'Volume ÷ 166' : 'Applies >1 cu ft only'} />
                <Metric label="Billable Weight"   value={`${domResult.billable_weight_ups_lb.toFixed(2)} lbs`} variant={domDimApplies ? 'warning' : 'positive'} sub={domDimApplies ? 'Dim weight charged' : 'Actual weight'} />
              </div>
              {domDimApplies && (
                <div className="mt-4 p-3 rounded-lg bg-amber-400/5 border border-amber-400/20">
                  <p className="font-body text-xs text-amber-400">
                    ⚠ Dimensional weight ({domResult.ups_dim_weight_lb.toFixed(1)} lbs) exceeds actual weight. Carriers will charge for the higher weight.
                  </p>
                </div>
              )}
            </CalcCard>
          </div>

          <div className="flex flex-col gap-5">
            <CalcCard>
              <div className="text-center py-2">
                <p className="font-body text-xs text-muted uppercase tracking-widest mb-2">Cheapest Option</p>
                <p className="font-display text-5xl font-bold text-primary mb-1">
                  {fmt(fromUSD(domResult.cheapest.rate))}
                </p>
                <p className="font-mono text-sm text-muted">{domResult.cheapest.carrier} · {domResult.cheapest.service}</p>
                <p className="font-body text-xs text-muted mt-1">{domResult.cheapest.est_days}</p>
              </div>
            </CalcCard>

            {(domResult.recommended.carrier !== domResult.cheapest.carrier || domResult.recommended.service !== domResult.cheapest.service) && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-body text-xs text-primary uppercase tracking-wide mb-0.5">Recommended</p>
                  <p className="font-body text-sm text-text font-semibold">{domResult.recommended.carrier} · {domResult.recommended.service}</p>
                  <p className="font-body text-xs text-muted">{domResult.recommended.est_days}</p>
                </div>
                <p className="font-mono text-xl font-bold text-primary shrink-0">{fmt(fromUSD(domResult.recommended.rate))}</p>
              </div>
            )}

            <CalcCard title="All Carrier Rates">
              <div className="space-y-1">
                {domResult.rates.map((rate: CarrierRate, i) => (
                  <div key={`${rate.carrier}-${rate.service}-${i}`}
                    className={cn('flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg',
                      i === 0 ? 'bg-primary/5 border border-primary/20' : 'hover:bg-surface/60 transition-colors'
                    )}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('font-mono text-xs font-bold', CARRIER_COLORS[rate.carrier] || 'text-text')}>{rate.carrier}</span>
                        <span className="font-body text-xs text-text truncate">{rate.service}</span>
                        {i === 0 && <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">CHEAPEST</span>}
                      </div>
                      <p className="font-body text-xs text-muted mt-0.5">{rate.est_days}{rate.notes ? ` · ${rate.notes}` : ''}</p>
                    </div>
                    <span className="font-mono text-sm font-bold text-text shrink-0">{fmt(fromUSD(rate.rate))}</span>
                  </div>
                ))}
              </div>
            </CalcCard>
          </div>
        </div>
      )}

      {/* ── International tab (placeholder — implemented in Task 5) ── */}
      {tab === 'intl' && (
        <div className="flex items-center justify-center h-40 text-muted font-mono text-sm">
          International tab — coming in Task 5
        </div>
      )}

      {/* ── Bulk tab (placeholder — implemented in Task 6) ── */}
      {tab === 'bulk' && (
        <div className="flex items-center justify-center h-40 text-muted font-mono text-sm">
          Bulk Shipment tab — coming in Task 6
        </div>
      )}

      {/* ── Packaging Optimizer (placeholder — implemented in Task 7) ── */}
      <div className="mt-8 flex items-center justify-center h-40 bg-surface border border-border rounded-2xl text-muted font-mono text-sm">
        Packaging Optimizer — coming in Task 7
      </div>

      <p className="font-body text-xs text-muted text-center mt-8">
        Rates are approximate 2024 retail/commercial rates. Negotiated contract rates are typically 40–70% lower.
        Always confirm at carrier websites before shipping.
      </p>
    </ToolLayout>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Run the app and verify**

```
npm run dev
```
Open `http://localhost:3000/tools/shipping-calculator`. Verify:
- Tab switcher renders (Domestic | International | Bulk Shipment)
- Domestic tab shows rates with currency-converted prices
- ScenarioPanel and ExportBar appear in header
- International and Bulk tabs show placeholder text
- Packaging Optimizer section shows placeholder text

- [ ] **Step 4: Commit**

```
git add app/tools/shipping-calculator/page.tsx
git commit -m "feat: rewrite shipping calculator page with tab skeleton and domestic tab"
```

---

### Task 5: International tab UI

**Files:**
- Modify: `app/tools/shipping-calculator/page.tsx` — replace International placeholder with full UI

---

- [ ] **Step 1: Replace the International tab placeholder with the full UI**

Find the international tab block:
```tsx
{/* ── International tab (placeholder — implemented in Task 5) ── */}
{tab === 'intl' && (
  <div className="flex items-center justify-center h-40 text-muted font-mono text-sm">
    International tab — coming in Task 5
  </div>
)}
```

Replace with:
```tsx
{/* ── International tab ── */}
{tab === 'intl' && (
  <div className="grid md:grid-cols-2 gap-6">
    <div className="flex flex-col gap-5">
      <CalcCard title="Package Details">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Field label="Length (in)"><Input value={intlLength} onChange={setIntlLength} step={0.1} min={1} /></Field>
          <Field label="Width (in)"><Input value={intlWidth}  onChange={setIntlWidth}  step={0.1} min={1} /></Field>
          <Field label="Height (in)"><Input value={intlHeight} onChange={setIntlHeight} step={0.1} min={1} /></Field>
        </div>
        <Field label="Actual Weight (lbs)">
          <Input value={intlWeight} onChange={setIntlWeight} suffix="lbs" step={0.1} min={0.1} />
        </Field>
      </CalcCard>

      <CalcCard title="Shipment Details">
        <div className="flex flex-col gap-4">
          <Field label="Declared Value (USD)" hint="Used to calculate duties and VAT">
            <Input value={intlDeclared} onChange={setIntlDeclared} prefix="$" step={1} min={0} />
          </Field>
          <Field label="Destination">
            <Select value={intlDest} onChange={(v) => setIntlDest(v as IntlMarket)}>
              {MARKET_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </Field>
          <Field label="Product Category" hint="Determines applicable duty rate">
            <Select value={intlCat} onChange={(v) => setIntlCat(v as ProductCategory)}>
              {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
        </div>
      </CalcCard>

      <CalcCard title="Duties & Tax Summary">
        <div className="grid grid-cols-2 gap-4">
          <Metric label="Duty Rate"     value={`${intlResult.duty_rate_pct}%`}       sub="Applied to declared value" />
          <Metric label="VAT / GST"     value={`${intlResult.destination_vat_pct}%`} sub="Applied to total (value+duty+shipping)" />
          <Metric label="Billable Weight" value={`${intlResult.billable_weight_lb} lbs`} sub="max(actual, dim weight)" />
          <Metric label="Duty on Order" value={fmt(fromUSD(intlResult.cheapest.estimated_duty))} variant="warning" sub="Cheapest carrier" />
        </div>
      </CalcCard>
    </div>

    <div className="flex flex-col gap-5">
      <CalcCard>
        <div className="text-center py-2">
          <p className="font-body text-xs text-muted uppercase tracking-widest mb-2">Cheapest Landed Cost</p>
          <p className="font-display text-5xl font-bold text-primary mb-1">
            {fmt(fromUSD(intlResult.cheapest.total_landed_cost))}
          </p>
          <p className="font-mono text-sm text-muted">{intlResult.cheapest.carrier} · {intlResult.cheapest.service}</p>
          <p className="font-body text-xs text-muted mt-1">{intlResult.cheapest.transit_days}–{intlResult.cheapest.transit_days + 1} business days</p>
        </div>
      </CalcCard>

      {intlResult.fastest.service !== intlResult.cheapest.service && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-body text-xs text-primary uppercase tracking-wide mb-0.5">Fastest</p>
            <p className="font-body text-sm text-text font-semibold">{intlResult.fastest.carrier} · {intlResult.fastest.service}</p>
            <p className="font-body text-xs text-muted">{intlResult.fastest.transit_days}–{intlResult.fastest.transit_days + 1} business days</p>
          </div>
          <p className="font-mono text-xl font-bold text-primary shrink-0">{fmt(fromUSD(intlResult.fastest.total_landed_cost))}</p>
        </div>
      )}

      <CalcCard title="All Carrier Landed Costs">
        <div className="space-y-1">
          {intlResult.rates.map((rate, i) => (
            <div key={`${rate.carrier}-${rate.service}`}
              className={cn('flex items-start justify-between gap-3 py-2.5 px-3 rounded-lg',
                i === 0 ? 'bg-primary/5 border border-primary/20' : 'hover:bg-surface/60 transition-colors'
              )}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('font-mono text-xs font-bold', CARRIER_COLORS[rate.carrier] || 'text-text')}>{rate.carrier}</span>
                  <span className="font-body text-xs text-text">{rate.service}</span>
                  {i === 0 && <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">CHEAPEST</span>}
                </div>
                <p className="font-body text-xs text-muted mt-0.5">{rate.transit_days}–{rate.transit_days + 1} days</p>
                <div className="flex gap-3 mt-1">
                  <span className="font-body text-xs text-muted">Ship: {fmt(fromUSD(rate.base_rate + rate.fuel_surcharge))}</span>
                  {rate.estimated_duty > 0 && <span className="font-body text-xs text-amber-400">Duty: {fmt(fromUSD(rate.estimated_duty))}</span>}
                  <span className="font-body text-xs text-blue-400">VAT: {fmt(fromUSD(rate.estimated_vat))}</span>
                </div>
              </div>
              <span className="font-mono text-sm font-bold text-text shrink-0">{fmt(fromUSD(rate.total_landed_cost))}</span>
            </div>
          ))}
        </div>
        <p className="font-body text-xs text-muted mt-3 pt-3 border-t border-border">
          Landed cost = shipping + duties + VAT/GST. Actual duties may vary by customs classification.
        </p>
      </CalcCard>
    </div>
  </div>
)}
```

- [ ] **Step 2: TypeScript check**

```
npx tsc --noEmit
```

- [ ] **Step 3: Verify in browser**

Navigate to International tab. Verify:
- Inputs render (dims, weight, declared value, destination, category)
- Changing destination updates duty rate and VAT
- Electronics shows 0% duty
- Apparel to CA shows 18% duty
- All 4 carrier landed costs shown with breakdown (shipping / duty / VAT)

- [ ] **Step 4: Commit**

```
git add app/tools/shipping-calculator/page.tsx
git commit -m "feat: add international shipping tab with duties and VAT breakdown"
```

---

### Task 6: Bulk Shipment tab UI

**Files:**
- Modify: `app/tools/shipping-calculator/page.tsx` — replace Bulk placeholder with full UI

---

- [ ] **Step 1: Replace the Bulk tab placeholder**

Find:
```tsx
{/* ── Bulk tab (placeholder — implemented in Task 6) ── */}
{tab === 'bulk' && (
  <div className="flex items-center justify-center h-40 text-muted font-mono text-sm">
    Bulk Shipment tab — coming in Task 6
  </div>
)}
```

Replace with:
```tsx
{/* ── Bulk Shipment tab ── */}
{tab === 'bulk' && (
  <div className="grid md:grid-cols-2 gap-6">
    <div className="flex flex-col gap-5">
      <CalcCard title="Unit Details">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Field label="Length (in)"><Input value={bulkLength} onChange={setBulkLength} step={0.1} min={1} /></Field>
          <Field label="Width (in)"><Input value={bulkWidth}  onChange={setBulkWidth}  step={0.1} min={1} /></Field>
          <Field label="Height (in)"><Input value={bulkHeight} onChange={setBulkHeight} step={0.1} min={1} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Weight / Unit (lbs)">
            <Input value={bulkWeight} onChange={setBulkWeight} suffix="lbs" step={0.1} min={0.1} />
          </Field>
          <Field label="Unit Count">
            <Input value={bulkUnits} onChange={setBulkUnits} step={1} min={1} />
          </Field>
        </div>
      </CalcCard>

      <CalcCard title="Destination Zone">
        <Field label="Shipping Zone">
          <Select value={String(bulkZone)} onChange={(v) => setBulkZone(parseInt(v) as Zone)}>
            {ZONE_OPTIONS.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
          </Select>
        </Field>
      </CalcCard>

      <CalcCard title="Shipment Summary">
        <div className="grid grid-cols-2 gap-4">
          <Metric label="Total Actual Weight"   value={`${bulkResult.total_weight_lb} lbs`} />
          <Metric label="Total Billable Weight" value={`${bulkResult.billable_weight_lb} lbs`} sub="After dim weight" variant={bulkResult.billable_weight_lb > bulkResult.total_weight_lb ? 'warning' : 'default'} />
          <Metric label="LTL Threshold"         value="150 lbs billable" sub={bulkResult.ltl_rate != null ? 'LTL available' : 'Below threshold'} variant={bulkResult.ltl_rate != null ? 'positive' : 'default'} />
          {Number.isFinite(bulkResult.ltl_crossover_units) && (
            <Metric label="LTL Crossover"       value={`${bulkResult.ltl_crossover_units} units`} sub="LTL beats parcel above this" variant="highlight" />
          )}
        </div>
      </CalcCard>
    </div>

    <div className="flex flex-col gap-5">
      {/* LTL comparison highlight */}
      {bulkResult.ltl_rate != null && (
        <div className={cn('rounded-xl p-4 flex items-center justify-between gap-3 border',
          bulkResult.recommended_mode === 'ltl'
            ? 'bg-primary/5 border-primary/20'
            : 'bg-surface border-border'
        )}>
          <div>
            <p className="font-body text-xs uppercase tracking-wide mb-0.5 font-semibold"
              style={{ color: bulkResult.recommended_mode === 'ltl' ? 'var(--color-primary)' : 'var(--color-muted)' }}>
              {bulkResult.recommended_mode === 'ltl' ? 'Recommended — LTL Freight' : 'LTL Freight'}
            </p>
            <p className="font-body text-xs text-muted">Total shipment · {bulkResult.total_weight_lb} lbs actual</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono text-xl font-bold text-primary">{fmt(fromUSD(bulkResult.ltl_rate))}</p>
            <p className="font-body text-xs text-muted">{fmt(fromUSD(bulkResult.ltl_cost_per_unit ?? 0))} / unit</p>
          </div>
        </div>
      )}

      {/* Parcel rates per-unit table */}
      <CalcCard title="Parcel Rates — Cost per Unit">
        {bulkResult.parcel_rates.length === 0 ? (
          <p className="font-body text-xs text-muted">Enter unit count to see rates.</p>
        ) : (
          <div className="space-y-1">
            {bulkResult.parcel_rates.map((r, i) => (
              <div key={r.carrier}
                className={cn('flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg',
                  i === 0 && bulkResult.recommended_mode === 'parcel'
                    ? 'bg-primary/5 border border-primary/20'
                    : 'hover:bg-surface/60 transition-colors'
                )}>
                <div>
                  <p className={cn('font-mono text-xs font-bold', CARRIER_COLORS[r.carrier.split(' ')[0]] || 'text-text')}>{r.carrier}</p>
                  <p className="font-body text-xs text-muted">Total: {fmt(fromUSD(r.total_cost))}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold text-text">{fmt(fromUSD(r.cost_per_unit))} / unit</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CalcCard>

      {!bulkResult.ltl_rate && bulkResult.total_weight_lb > 0 && (
        <div className="p-3 rounded-lg bg-surface border border-border">
          <p className="font-body text-xs text-muted">
            LTL freight becomes available at 150+ lbs billable weight. Current: {bulkResult.billable_weight_lb} lbs.
            {Number.isFinite(bulkResult.ltl_crossover_units) && (
              <> LTL crossover at <span className="text-text font-semibold">{bulkResult.ltl_crossover_units} units</span>.</>
            )}
          </p>
        </div>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 2: TypeScript check**

```
npx tsc --noEmit
```

- [ ] **Step 3: Verify in browser**

Navigate to Bulk Shipment tab. Verify:
- At 50 units × 2lb: total = 100lb < 150 → LTL section hidden, shows crossover unit count
- At 200 units × 1lb × 6×6×6: LTL available, shows LTL cost cheaper than parcel, recommended=LTL
- Per-unit table shows 4 carriers sorted cheapest first

- [ ] **Step 4: Commit**

```
git add app/tools/shipping-calculator/page.tsx
git commit -m "feat: add bulk shipment tab with LTL crossover analysis and per-unit cost breakdown"
```

---

### Task 7: Packaging Optimizer card

**Files:**
- Modify: `app/tools/shipping-calculator/page.tsx` — replace Packaging Optimizer placeholder with full UI

---

- [ ] **Step 1: Replace the Packaging Optimizer placeholder**

Find:
```tsx
{/* ── Packaging Optimizer (placeholder — implemented in Task 7) ── */}
<div className="mt-8 flex items-center justify-center h-40 bg-surface border border-border rounded-2xl text-muted font-mono text-sm">
  Packaging Optimizer — coming in Task 7
</div>
```

Replace with:
```tsx
{/* ── Packaging Optimizer — always visible below tabs ── */}
<div className="mt-8">
  <CalcCard title="Packaging Optimizer" headerRight={
    <span className="font-body text-xs text-muted">Finds ideal box size · Scores your box catalog</span>
  }>
    <div className="grid md:grid-cols-3 gap-6">
      {/* Product dims + zone */}
      <div className="flex flex-col gap-4">
        <p className="font-body text-xs font-semibold text-text/70 uppercase tracking-wide">Product Dimensions</p>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Length (in)"><Input value={pkgProdLength} onChange={setPkgProdLength} step={0.1} min={0.1} /></Field>
          <Field label="Width (in)"><Input value={pkgProdWidth}  onChange={setPkgProdWidth}  step={0.1} min={0.1} /></Field>
          <Field label="Height (in)"><Input value={pkgProdHeight} onChange={setPkgProdHeight} step={0.1} min={0.1} /></Field>
        </div>
        <Field label="Product Weight (lbs)">
          <Input value={pkgProdWeight} onChange={setPkgProdWeight} suffix="lbs" step={0.1} min={0.1} />
        </Field>
        <Field label="Shipping Zone">
          <Select value={String(pkgZone)} onChange={(v) => setPkgZone(parseInt(v) as Zone)}>
            {ZONE_OPTIONS.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
          </Select>
        </Field>

        {/* Ideal box result */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="font-body text-xs text-primary uppercase tracking-wide mb-2 font-semibold">Ideal Box</p>
          <p className="font-mono text-sm text-text font-bold">
            {pkgResult.ideal_box.length_in}″ × {pkgResult.ideal_box.width_in}″ × {pkgResult.ideal_box.height_in}″
          </p>
          <p className="font-body text-xs text-muted mt-1">Dim weight: {pkgResult.ideal_dim_weight_lb} lbs</p>
          <p className="font-body text-xs text-muted">2″ padding per side</p>
        </div>
      </div>

      {/* Add box form */}
      <div className="flex flex-col gap-4">
        <p className="font-body text-xs font-semibold text-text/70 uppercase tracking-wide">
          Add Box to Catalog <span className="text-muted normal-case">({customBoxes.length}/5)</span>
        </p>
        <Field label="Box Name (optional)">
          <Input value={newBoxName} onChange={setNewBoxName} type="text" placeholder="e.g. Medium Brown Box" />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="L (in)"><Input value={newBoxL} onChange={setNewBoxL} step={0.1} min={1} placeholder="12" /></Field>
          <Field label="W (in)"><Input value={newBoxW} onChange={setNewBoxW} step={0.1} min={1} placeholder="10" /></Field>
          <Field label="H (in)"><Input value={newBoxH} onChange={setNewBoxH} step={0.1} min={1} placeholder="6" /></Field>
        </div>
        <button
          onClick={addBox}
          disabled={customBoxes.length >= 5 || !newBoxL || !newBoxW || !newBoxH}
          className="w-full py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary font-mono text-xs font-semibold hover:bg-primary/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Add Box
        </button>
        {customBoxes.length > 0 && (
          <div className="space-y-1">
            {customBoxes.map((b, i) => (
              <div key={i} className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-lg border border-border">
                <span className="font-body text-xs text-text">{b.name}</span>
                <span className="font-mono text-xs text-muted">{b.length_in}×{b.width_in}×{b.height_in}</span>
                <button onClick={() => setCustomBoxes(customBoxes.filter((_, j) => j !== i))} className="text-muted hover:text-rose-400 transition-colors font-mono text-xs">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Catalog match results */}
      <div className="flex flex-col gap-3">
        <p className="font-body text-xs font-semibold text-text/70 uppercase tracking-wide">Catalog Scoring</p>
        {pkgResult.catalog_matches.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6 border border-dashed border-border rounded-xl">
            <p className="font-body text-xs text-muted text-center">Add boxes to score them against your product</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pkgResult.catalog_matches.map((m, i) => (
              <div key={m.box.name}
                className={cn('p-3 rounded-xl border transition-colors',
                  i === 0 && m.fits ? 'bg-primary/5 border-primary/20' : 'border-border'
                )}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-mono font-bold px-1.5 py-0.5 rounded',
                      m.fits ? 'bg-emerald-400/10 text-emerald-400' : 'bg-rose-400/10 text-rose-400'
                    )}>
                      {m.fits ? 'FITS' : 'NO FIT'}
                    </span>
                    <span className="font-body text-xs text-text font-medium">{m.box.name}</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-primary">{fmt(fromUSD(m.cheapest_rate_usd))}</span>
                </div>
                <div className="flex gap-3">
                  <span className="font-body text-xs text-muted">{m.box.length_in}×{m.box.width_in}×{m.box.height_in}″</span>
                  <span className="font-body text-xs text-muted">Billable: {m.billable_weight_lb} lbs</span>
                  <span className="font-body text-xs text-muted">Void: {m.void_fill_in3} in³</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </CalcCard>
</div>
```

- [ ] **Step 2: TypeScript check**

```
npx tsc --noEmit
```

- [ ] **Step 3: Run all tests — ensure nothing broken**

```
npx vitest run __tests__/tools/shipping.test.ts
```
Expected: all 31 tests pass.

- [ ] **Step 4: Verify in browser**

With the dev server running, test the Packaging Optimizer:
- Enter product dims 10×8×5, weight 2, zone 4 → Ideal box shows 14×12×9
- Add box 11×9×6 → shows FITS, cheapest rate populated
- Add box 10×8×5 → shows NO FIT, cheapest rate still shown
- Add box 20×20×20 → shows high dim weight (57.55 lbs) driving up rate
- Results sorted cheapest rate first
- Remove box with ✕ button works

- [ ] **Step 5: Final commit**

```
git add app/tools/shipping-calculator/page.tsx
git commit -m "feat: add packaging optimizer card with ideal box calculation and catalog scoring"
```
