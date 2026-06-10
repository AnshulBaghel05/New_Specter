# Shipping Calculator Enhancement — Design Spec

**Date:** 2026-05-26
**Sub-project:** D — International + duties, bulk shipment mode, packaging optimizer

---

## Goal

Extend the existing domestic-only shipping calculator with international shipping (UK/CA/AU/NZ) including duties and VAT, a bulk shipment mode with per-unit cost breakdown and LTL crossover analysis, and a packaging optimizer that finds the ideal box size and scores a user-defined box catalog.

## Architecture

Three new exported calc functions added to `lib/tools/shipping.ts` alongside the existing `calcShipping`, following the exact pattern of `shopify-profit.ts`. The page becomes a three-tab UI (Domestic | International | Bulk Shipment) with a Packaging Optimizer card pinned below all tabs. Full infrastructure parity with the Shopify calculator: `useCurrency`, `ScenarioPanel`, `ExportBar`, `PrintReport`.

**Tech Stack:** TypeScript, Vitest (tests), Recharts (existing), existing tool-layout components (`CalcCard`, `ScenarioPanel`, `ExportBar`, `PrintReport`), `useCurrency` hook.

---

## File Map

| File | Change |
|------|--------|
| `lib/tools/shipping.ts` | Add `calcShippingInternational`, `calcBulkShipment`, `calcPackagingOptimizer` + supporting types/data |
| `__tests__/tools/shipping.test.ts` | New — ~25 tests across all four calc functions |
| `app/tools/shipping-calculator/page.tsx` | Major rewrite — tabs, currency, scenarios, export, print |

---

## Page Layout

```
┌─ Currency picker ──────────────────────────────── ScenarioPanel ┐
│  [Domestic] [International] [Bulk Shipment]                      │
│  ┌─── Inputs ───────────┐  ┌─── Results ──────────────────────┐ │
│  │  (tab-specific)      │  │  (tab-specific)                  │ │
│  └──────────────────────┘  └──────────────────────────────────┘ │
│  ┌─── Packaging Optimizer ────────────────────────────────────┐  │
│  │  Product dims → Ideal box + Catalog match scoring         │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ExportBar / PrintReport                                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### International Shipping

```ts
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
  rates: IntlCarrierRate[]          // always 4: DHL Express, FedEx Intl Priority, FedEx Intl Economy, UPS Worldwide Expedited
  cheapest: IntlCarrierRate
  fastest: IntlCarrierRate
  duty_rate_pct: number
  destination_vat_pct: number
}
```

### Bulk Shipment

```ts
export interface BulkShippingInput {
  weight_lb_per_unit: number
  length_in: number
  width_in: number
  height_in: number
  unit_count: number
  zone: number                      // 2–8 domestic
}

export interface BulkShippingResult {
  total_weight_lb: number
  billable_weight_lb: number
  parcel_rates: {
    carrier: string
    total_cost: number
    cost_per_unit: number
  }[]
  ltl_rate: number | null           // null if total_weight_lb < 150
  ltl_cost_per_unit: number | null
  ltl_crossover_units: number       // units at which LTL becomes cheaper than cheapest parcel
  recommended_mode: 'parcel' | 'ltl'
}
```

### Packaging Optimizer

```ts
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
  custom_boxes: BoxSpec[]           // up to 5 user-defined boxes
  zone: number
}

export interface CatalogMatch {
  box: BoxSpec
  fits: boolean
  dim_weight_lb: number
  billable_weight_lb: number
  cheapest_rate_usd: number         // cheapest carrier rate for that zone and billable weight
  void_fill_in3: number
}

export interface PackagingResult {
  ideal_box: BoxSpec                // product dims + 4" per axis (2" padding each side)
  ideal_dim_weight_lb: number
  catalog_matches: CatalogMatch[]   // sorted by cheapest_rate_usd ascending
}
```

---

## Rate Data & Business Logic

### International Carrier Rates (2024 representative, hardcoded — no live API)

Base rates (USD) by destination:
| Market | DHL Express base | DHL Express per-lb |
|--------|------------------|--------------------|
| UK     | $24              | $2.40/lb           |
| CA     | $17              | $1.75/lb           |
| AU     | $34              | $3.40/lb           |
| NZ     | $38              | $3.80/lb           |

- FedEx International Priority: DHL base × 1.10, DHL per-lb × 1.10, transit 1–3 days
- FedEx International Economy: FedEx Priority × 0.80, transit 4–7 days
- UPS Worldwide Expedited: same as FedEx Economy, transit 3–5 days
- DHL Express transit: 2–4 days
- Fuel surcharge: 20% on (base + per-lb portion) for all carriers

### Duty Rates by Destination + Category

| Category    | UK    | CA    | AU    | NZ    |
|-------------|-------|-------|-------|-------|
| Apparel     | 12%   | 18%   | 10%   | 10%   |
| Electronics | 0%    | 0%    | 0%    | 0%    |
| General     | 5%    | 5%    | 5%    | 5%    |
| Home        | 6%    | 6.5%  | 5%    | 5%    |
| Beauty      | 4.5%  | 6.5%  | 5%    | 5%    |

Duty applied to `declared_value_usd`.

### VAT/GST Rates

| Market | Rate | Applied to |
|--------|------|------------|
| UK     | 20%  | declared_value + duty + shipping |
| CA     | 5%   | declared_value + duty + shipping |
| AU     | 10%  | declared_value + duty + shipping |
| NZ     | 15%  | declared_value + duty + shipping |

### Dim Weight

`dim_weight_lb = (length_in × width_in × height_in) / 139`
`billable_weight_lb = max(actual_weight_lb, dim_weight_lb)`

### Bulk / LTL Logic

- LTL available only when `total_weight_lb ≥ 150`
- LTL cost = `$50 pickup fee + total_weight_lb × tier_rate`
  - < 500 lb: $0.08/lb
  - 500–1000 lb: $0.06/lb
  - ≥ 1000 lb: $0.04/lb
- `ltl_crossover_units`: binary search for smallest `n` where `ltl_cost(n) < cheapest_parcel_total_cost(n)`; returns `Infinity` if LTL is never cheaper within reasonable range

### Packaging Optimizer Logic

- `ideal_box`: `{ name: 'Ideal', length_in: product_l + 4, width_in: product_w + 4, height_in: product_h + 4 }`
- `fits`: all three box dims ≥ corresponding product dim + 1" (minimum clearance)
- `void_fill_in3`: `(box_l × box_w × box_h) − (product_l × product_w × product_h)`
- `cheapest_rate_usd`: run `billable_weight_lb` through existing domestic rate table for given zone, take minimum rate across all carriers
- Catalog sorted by `cheapest_rate_usd` ascending

---

## Testing Plan (~25 tests in `__tests__/tools/shipping.test.ts`)

### `calcShippingInternational` (~8 tests)
- UK electronics: duty = 0%, VAT = 20%, `total_landed_cost` = base_rate + fuel_surcharge + 0 duty + VAT on (value + shipping)
- CA apparel: duty = 18%, GST = 5% on (value + duty + shipping)
- Large light package: `billable_weight_lb` = `dim_weight_lb` (dim weight triggers)
- Heavy package: `billable_weight_lb` = `weight_lb` (actual triggers)
- `fastest` carrier = FedEx International Priority (1–3 days)
- `cheapest` ≠ `fastest` for a representative heavy package
- `rates.length` = 4 always
- AU general: duty = 5%, GST = 10%

### `calcBulkShipment` (~8 tests)
- 10 units × 5 lb (50 lb total): `ltl_rate = null`, `recommended_mode = 'parcel'`
- 200 units × 1 lb (200 lb total): LTL available, `ltl_rate` not null
- `cost_per_unit` = `total_cost / unit_count` for each carrier
- `parcel_rates.length` = 4
- `ltl_crossover_units` verified by computing both sides at the crossover boundary
- `recommended_mode = 'ltl'` when LTL is cheaper at given unit_count
- Dim weight applied per-unit then multiplied by unit_count for total billable weight
- Zero unit_count edge case handled (no divide-by-zero)

### `calcPackagingOptimizer` (~9 tests)
- `ideal_box` dims = product dims + 4 per axis
- Box that doesn't fit (`fits = false`) still appears in `catalog_matches`
- `void_fill_in3` = box volume − product volume
- `catalog_matches` sorted by `cheapest_rate_usd` ascending
- `billable_weight_lb = max(actual, dim_weight)` — verified with a light/large box
- `custom_boxes: []` → `catalog_matches` is empty, `ideal_box` still computed
- `fits` requires each box dim ≥ product dim + 1"
- `ideal_dim_weight_lb` = ideal box volume / 139
- Non-fitting box has a valid `cheapest_rate_usd` still computed (for reference)

---

## Implementation Tasks

1. **`calcShippingInternational`** — function + tests
2. **`calcBulkShipment`** — function + tests
3. **`calcPackagingOptimizer`** — function + tests
4. **Page infrastructure** — `useCurrency`, `ScenarioPanel`, `ExportBar`, `PrintReport` wiring
5. **Domestic tab** — refactor existing domestic UI into first tab, add currency conversion
6. **International tab** — inputs + `IntlShippingResult` display
7. **Bulk tab** — inputs + `BulkShippingResult` display (per-unit table + LTL comparison)
8. **Packaging Optimizer card** — box catalog inputs + `PackagingResult` display
