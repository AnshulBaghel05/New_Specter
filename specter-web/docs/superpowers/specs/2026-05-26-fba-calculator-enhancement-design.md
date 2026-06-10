# FBA Calculator Enhancement — Design Spec

**Date:** 2026-05-26
**Sub-project:** B — Amazon FBA Calculator
**Status:** Approved

---

## Goal

Fully upgrade the Amazon FBA Calculator with 2025 fee rates, multi-currency input, scenario
save/compare, CSV/PDF export, package optimizer, break-even ACOS, VAT support, fee distribution
charts, and an insights strip — all without touching the core `calcFbaFees` function signature.

---

## Architecture

**Pattern:** Page-level wiring. `lib/tools/fba.ts` gains new pure functions and updated rate
constants. `app/tools/amazon-fba-calculator/page.tsx` wires sub-project A's hooks and components,
adds VAT/ACOS state, and renders new cards.

**Rule preserved:** `calcFbaFees(input: FbaInput): FbaResult` always receives USD values.
Currency conversion (via `toUSD`/`fromUSD`) and VAT adjustment (`effectivePriceAfterVat`) happen
at the page boundary, never inside the calc functions.

---

## Files Changed

**Modified:**
- `lib/tools/fba.ts` — 2025 rates, new functions, VAT table
- `app/tools/amazon-fba-calculator/page.tsx` — full page upgrade

**No new files.** All shared infrastructure already exists from sub-project A.

---

## Section 1: Architecture & Data Flow

```
User inputs (selected currency)
  → toUSD(selling_price, currency)
  → effectivePriceAfterVat(usd_price, vat_rate)   ← only when VAT active
  → calcFbaFees({ ...usdInputs })                  ← unchanged, always USD
  → fromUSD(result_value, currency)                ← before display
  → fmt(value, currency)                           ← correct symbol + decimals
```

VAT adjustment reduces the effective selling price before the calc sees it. The product cost
is not VAT-adjusted (it is a cost, not a sale price).

---

## Section 2: 2025 Fee Model Update

### Constants to update in `lib/tools/fba.ts`

```ts
export const RATES_YEAR = '2025'
```

**`STORAGE_RATES`** — update to 2025 schedule (verify at sellercentral.amazon.com):
```ts
export const STORAGE_RATES = {
  jan_sep: 0.78,   // standard-size, Jan–Sep 2025
  oct_dec: 2.40,   // standard-size, Oct–Dec 2025 (peak unchanged)
}
```

**`calcFulfillmentFee`** — update all per-tier dollar amounts to 2025 rates
(Amazon reduced fees across most standard tiers effective Feb 5, 2025).
Implementer must verify exact rates against the official 2025 fee schedule before writing
constants. Structure (tier breakpoints) is unchanged.

**Referral rates** — mostly unchanged from 2024; verify any category adjustments at
sellercentral.amazon.com/help/hub/reference/GVG2TA4ETKAGY6GG.

**Disclaimer text** on the page changes from `"2024 fee schedule"` to `"2025 fee schedule"`.

### Tests
Existing tests in `__tests__/tools/fba.test.ts` (if present) update their expected dollar
values to match 2025 rates. If no test file exists, create one covering:
- `calcFulfillmentFee` for each size tier at boundary weights
- `calcFbaFees` round-trip for a standard product

---

## Section 3: Currency + Scenario + Export Wiring

### Currency

```ts
const { currency, toUSD, fromUSD, fmt } = useCurrency()
```

- `selling_price` and `product_cost` inputs: user types in selected currency. Prefix changes
  from hardcoded `"$"` to the symbol derived as:
  `currencies.find(c => c.code === currency)?.symbol ?? '$'`
- Before `calcFbaFees`: `toUSD(parseFloat(selling_price))`, `toUSD(parseFloat(product_cost))`
- All money outputs: `fmt(fromUSD(r.net_profit))` etc.
- Storage rate strings replaced:
  - `"$2.40/cu ft"` → `` `${fmt(fromUSD(2.40))}/cu ft` ``
  - `"$0.87"` → `fmt(fromUSD(0.87))`

### Scenarios

```ts
const { scenarios, saveScenario, loadScenario, deleteScenario, compareIds, setCompareIds } =
  useScenarios('fba')
```

`currentInputs` passed to `ScenarioPanel`:
```ts
{
  selling_price, product_cost, weight_oz, length_in, width_in,
  height_in, category, units_stored, is_peak: String(is_peak),
  vat_code: vatCode,
}
```

`currentResults` passed to `ScenarioPanel` (USD values from `r`):
```ts
{
  net_profit: r.net_profit,
  margin_pct: r.margin_pct,
  roi_pct: r.roi_pct,
  total_fees: r.total_fees,
  fulfillment_fee: r.fulfillment_fee,
  referral_fee: r.referral_fee,
  monthly_storage_fee: r.monthly_storage_fee,
  break_even_price: r.break_even_price,
}
```

`resultLabels`:
```ts
{
  net_profit: 'Net Profit',
  margin_pct: 'Margin %',
  roi_pct: 'ROI %',
  total_fees: 'Total Fees',
  fulfillment_fee: 'Fulfillment Fee',
  referral_fee: 'Referral Fee',
  monthly_storage_fee: 'Storage Fee',
  break_even_price: 'Break-even Price',
}
```

`onLoad` restores all 10 form fields from the saved scenario's `inputs`.

`<ScenarioPanel>` is passed into `ToolLayout`'s `headerRight` prop.

### Export

```ts
const exportInputs: ExportRow[] = [
  { label: 'Selling Price', value: fmt(fromUSD(parseFloat(selling_price) || 0)) },
  { label: 'Product Cost',  value: fmt(fromUSD(parseFloat(product_cost) || 0)) },
  { label: 'Weight',        value: `${weight_oz} oz` },
  { label: 'Dimensions',    value: `${length_in} × ${width_in} × ${height_in} in` },
  { label: 'Category',      value: category },
  { label: 'Units Stored',  value: units_stored },
  { label: 'Peak Season',   value: is_peak ? 'Yes' : 'No' },
  { label: 'VAT',           value: vatCode === 'NONE' ? 'None' : `${vatCode} ${(vatRate * 100).toFixed(0)}%` },
]

const exportResults: ExportRow[] = [
  { label: 'Net Profit',        value: fmt(fromUSD(r.net_profit)) },
  { label: 'Margin',            value: `${r.margin_pct}%` },
  { label: 'ROI',               value: `${r.roi_pct}%` },
  { label: 'Break-even ACOS',   value: `${breakeven_acos}%` },
  { label: 'Total Fees',        value: fmt(fromUSD(r.total_fees)) },
  { label: 'Fulfillment Fee',   value: fmt(fromUSD(r.fulfillment_fee)) },
  { label: 'Referral Fee',      value: fmt(fromUSD(r.referral_fee)) },
  { label: 'Storage Fee',       value: fmt(fromUSD(r.monthly_storage_fee)) },
  { label: 'Break-even Price',  value: fmt(fromUSD(r.break_even_price)) },
  { label: 'Size Tier',         value: TIER_LABELS[r.size_tier] },
]
```

`<ExportBar>` passed into `headerRight` alongside `<ScenarioPanel>`.

`<PrintReport toolName="Amazon FBA Calculator" toolId="fba" currency={currency}
  inputs={exportInputs} results={exportResults} />` rendered as a hidden sibling after the
main content div (visible only on print via `print:block`).

---

## Section 4: VAT

### Data in `lib/tools/fba.ts`

```ts
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
```

### Page behavior

- `vatCode` state: `string`, default `'NONE'`
- `vatRate` derived: `VAT_RATES.find(v => v.code === vatCode)?.rate ?? 0`
- `effectiveSellingPriceUsd`: `effectivePriceAfterVat(toUSD(parseFloat(selling_price) || 0), vatRate)`
- `calcFbaFees` receives `effectiveSellingPriceUsd` as `selling_price`

**UI:** A `<Select>` row inside "Product & Pricing" card labeled "Marketplace VAT":
```tsx
<Field label="Marketplace VAT">
  <Select value={vatCode} onChange={setVatCode}>
    {VAT_RATES.map((v) => (
      <option key={v.code} value={v.code}>
        {v.country}{v.rate > 0 ? ` (${(v.rate * 100).toFixed(0)}%)` : ''}
      </option>
    ))}
  </Select>
</Field>
```

When `vatCode !== 'NONE'`, a note renders below the headline profit metric:
```tsx
<p className="font-body text-xs text-muted mt-1">
  VAT-adjusted: effective revenue {fmt(fromUSD(effectiveSellingPriceUsd))} of{' '}
  {fmt(fromUSD(toUSD(parseFloat(selling_price) || 0)))}
</p>
```

---

## Section 5: Package Optimizer

### New function in `lib/tools/fba.ts`

```ts
export interface OptimizerSuggestion {
  target_tier: FbaSizeTier
  suggested_length_in: number
  suggested_width_in: number
  suggested_height_in: number
  fee_saving: number        // USD delta (positive = saving)
  description: string       // e.g. "Reduce length 10.0in → 8.0in"
}

export function findCheaperTierDimensions(
  weight_oz: number,
  length_in: number,
  width_in: number,
  height_in: number,
  current_fulfillment_fee: number,
  category: FbaCategory,
  selling_price: number,
): OptimizerSuggestion | null
```

**Logic:**
1. If current tier is `small_standard`, return `null` (already cheapest).
2. Try fitting into the next cheaper tier by scaling the longest dimension down to that
   tier's max threshold (keeping width, height, weight unchanged).
3. If the scaled dimensions qualify for the cheaper tier, compute the fee delta and return
   the suggestion. Otherwise return `null`.
4. Only scales down one dimension (the longest). Does not try multi-dimension reductions.

### Tier-crossing callout (Part A)

Rendered below "Package Analysis" card when `r.size_tier !== 'small_standard'`:
- Computes how many inches the longest dimension is from the next cheaper tier's threshold.
- If within 15% of threshold: shows amber callout — `"Within X in of cheaper tier (saves $Y)"`
- Uses `findCheaperTierDimensions` result for the saving amount.

### Tier reference table (Part C)

Always visible in the optimizer card. 7 rows, one per tier:

| Tier | Max L | Max W | Max H | Max Billable Weight | Fee at current weight |
|------|-------|-------|-------|---------------------|----------------------|
| Small Standard     | 15 in | 12 in | 0.75 in | 1 lb   | computed |
| Large Standard     | 18 in | 14 in | 8 in    | 20 lb  | computed |
| Large Bulky        | 59 in | 33 in | 33 in   | 50 lb  | computed |
| Extra-Large 0–50   | —     | —     | —       | 50 lb  | computed |
| Extra-Large 50–70  | —     | —     | —       | 70 lb  | computed |
| Extra-Large 70–150 | —     | —     | —       | 150 lb | computed |
| Extra-Large 150+   | —     | —     | —       | —      | computed |

"Fee at current weight" column = `calcFulfillmentFee(tier, r.billable_weight_oz)` for each tier,
displayed in selected currency via `fmt(fromUSD(...))`. This makes the comparison meaningful
regardless of tier threshold differences.

Current tier row: `bg-primary/10 border-l-2 border-primary` highlight.
Fee column shows approximate fee for the current product's billable weight in that tier.

### "Apply suggestion" button (Part B)

When `findCheaperTierDimensions` returns a non-null suggestion:
```tsx
<button onClick={() => {
  setLength(String(suggestion.suggested_length_in))
  setWidth(String(suggestion.suggested_width_in))
  setHeight(String(suggestion.suggested_height_in))
}}>
  Apply suggestion — save {fmt(fromUSD(suggestion.fee_saving))}/unit
</button>
```

---

## Section 6: Break-even ACOS

### New function in `lib/tools/fba.ts`

```ts
export function calcBreakevenAcos(net_profit: number, selling_price: number): number {
  if (selling_price <= 0) return 0
  return Math.round((net_profit / selling_price) * 1000) / 10
}
```

### Page behavior

```ts
const breakeven_acos = calcBreakevenAcos(r.net_profit, effectiveSellingPriceUsd)
```

Added as a third metric row in the headline results card, below Margin % and ROI %:

```tsx
<span className="font-mono text-sm text-muted">
  Break-even ACOS:{' '}
  <span className={
    r.net_profit <= 0
      ? 'text-rose-400'
      : breakeven_acos >= 15
        ? 'text-primary'
        : breakeven_acos >= 8
          ? 'text-amber-400'
          : 'text-rose-400'
  }>
    {r.net_profit <= 0 ? 'N/A' : `${breakeven_acos}%`}
  </span>
</span>
```

Thresholds: ≥15% → healthy (primary), 8–14.9% → tight (amber), <8% or negative profit → danger (rose).

---

## Section 7: Charts & Insights

### Layout

Full-width `<CalcCard title="Analysis">` below the 2-column grid:
```tsx
<div className="grid md:grid-cols-2 gap-6 mt-6">
  <CalcCard title="Analysis">
    <div className="grid md:grid-cols-2 gap-6">
      {/* Chart 1 */}
      {/* Chart 2 */}
    </div>
    {/* Insights strip */}
  </CalcCard>
</div>
```

Only rendered when `selling_price > 0`.

### Chart 1 — Fee Distribution (ToolPieChart)

`input_usd` refers to the USD-valued inputs object passed to `calcFbaFees`
(i.e. `{ selling_price: effectiveSellingPriceUsd, product_cost: toUSD(parseFloat(product_cost) || 0), ... }`).

```ts
const pieData = [
  { name: 'Product Cost',    value: fromUSD(input_usd.product_cost) },
  { name: 'Fulfillment Fee', value: fromUSD(r.fulfillment_fee) },
  { name: 'Referral Fee',    value: fromUSD(r.referral_fee) },
  { name: 'Storage Fee',     value: fromUSD(r.monthly_storage_fee) },
  { name: 'Net Profit',      value: Math.max(0, fromUSD(r.net_profit)) },
]
```

Uses `ToolPieChart` with `formatter={(v) => fmt(v)}`.

### Chart 2 — Tier Fee Comparison (ToolBarChart)

```ts
const tierData = SIZE_TIERS.map((tier) => ({
  tier: TIER_LABELS_SHORT[tier],
  fee: round2(calcFulfillmentFee(tier, r.billable_weight_oz)),
  current: tier === r.size_tier,
}))
```

Bar color: current tier → `CHART_THEME.primary`, others → `CHART_THEME.blue`.
Uses `ToolBarChart` with `yFormatter={(v) => fmt(fromUSD(v))}`.

`SIZE_TIERS` is the ordered array of all 7 `FbaSizeTier` values — export it from `fba.ts`:
```ts
export const SIZE_TIERS: FbaSizeTier[] = [
  'small_standard', 'large_standard', 'large_bulky',
  'extra_large_0_50', 'extra_large_50_70', 'extra_large_70_150', 'extra_large_150_plus',
]
```

`TIER_LABELS_SHORT` is a compact label map defined in the page:
```ts
const TIER_LABELS_SHORT: Record<FbaSizeTier, string> = {
  small_standard:      'Small Std',
  large_standard:      'Large Std',
  large_bulky:         'Bulky',
  extra_large_0_50:    'XL 0–50',
  extra_large_50_70:   'XL 50–70',
  extra_large_70_150:  'XL 70–150',
  extra_large_150_plus:'XL 150+',
}
```

### Insights Strip

Three callout boxes in a row below the charts:

**1. Margin Health**
```ts
const marginHealth =
  r.margin_pct >= BENCHMARKS.fba_margins.healthy * 100 ? 'Healthy'
  : r.margin_pct >= BENCHMARKS.fba_margins.tight * 100  ? 'Tight'
  : 'Danger'
```
Color: Healthy → primary, Tight → amber, Danger → rose.

**2. Fee Burden**
```ts
// inline helper — fba.ts private round1 is not exported; use this on the page
const r1 = (n: number) => Math.round(n * 10) / 10
const feeBurdenPct = effectiveSellingPriceUsd > 0
  ? r1((r.total_fees / effectiveSellingPriceUsd) * 100)
  : 0
```
Flag if `feeBurdenPct > 40`: `"Fees consume {feeBurdenPct}% of sale price"` in rose.
Otherwise show in primary/muted.

**3. Storage Efficiency**
```ts
const storageVsProfit = r.net_profit > 0
  ? r1((r.monthly_storage_fee / r.net_profit) * 100)
  : null
```
Flag if `storageVsProfit !== null && storageVsProfit > 15`:
`"Storage is {storageVsProfit}% of net profit — consider reducing inventory"` in amber.

---

## What This Sub-Project Does NOT Include

- Changes to other tool pages (C–G handled in their own sub-projects)
- SEO/FAQ schema
- Any changes to shared infrastructure already built in sub-project A
- Server-side fee verification (all client-side)

---

## Constraints

- `calcFbaFees` signature unchanged
- TypeScript strict throughout
- No new dependencies
- All new functions in `lib/tools/fba.ts` are pure and testable
- 2025 rates must be verified against Amazon Seller Central before committing
