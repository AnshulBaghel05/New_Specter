# Shared Tools Infrastructure — Design Spec

**Date:** 2026-05-26
**Sub-project:** A — Shared Infrastructure (prerequisite for all per-tool enhancements)
**Status:** Approved

---

## Goal

Build the shared infrastructure layer that all 6 SPECTER free calculator tools will use:
multi-currency full input support, named scenario presets with side-by-side comparison,
CSV + PDF export, static benchmark data, and a Recharts wrapper themed to SPECTER tokens.

---

## Architecture

**Pattern:** localStorage-backed custom hooks. No React Context or Provider needed — tools are
independent pages, and localStorage acts as the shared persistence layer. Each tool page opts in
by calling hooks.

**Rule:** All calculation functions in `lib/tools/*.ts` remain untouched. They always receive and
return USD. Currency conversion happens at the boundary (hook layer), not inside the math.

---

## 1. Multi-Currency System

### Files
- `lib/tools/currency.ts` — rates, conversion utils, currency list
- `hooks/use-currency.ts` — hook returning `{ currency, setCurrency, toUSD, fromUSD, fmt }`
- `components/tools/currency-selector.tsx` — dropdown UI

### Currencies (10)

| Code | Symbol | Name              |
|------|--------|-------------------|
| USD  | $      | US Dollar         |
| EUR  | €      | Euro              |
| GBP  | £      | British Pound     |
| CAD  | C$     | Canadian Dollar   |
| AUD  | A$     | Australian Dollar |
| INR  | ₹      | Indian Rupee      |
| JPY  | ¥      | Japanese Yen      |
| SGD  | S$     | Singapore Dollar  |
| AED  | د.إ    | UAE Dirham        |
| MXN  | MX$    | Mexican Peso      |

### Exchange Rates

Static object in `currency.ts`, USD as base (1.0). Stamped with `RATES_AS_OF = '2025-05-01'`.
Updated manually when rates drift materially (>5%). A disclaimer "Rates as of [date]" appears
below the currency selector.

```ts
export const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,    EUR: 0.92,  GBP: 0.79,  CAD: 1.36,
  AUD: 1.53, INR: 83.5,  JPY: 156,   SGD: 1.34,
  AED: 3.67, MXN: 17.2,
}
```

### Data Flow

```
User input (selected currency)
  → toUSD(value, currency)         ← before passing to calc function
  → calcXxx({ ...usdInputs })      ← unchanged, always USD
  → fromUSD(result, currency)      ← before display
  → fmt(value, currency)           ← correct symbol + decimal places
```

### Formatting Rules

- JPY: 0 decimal places (`¥1,234`)
- All others: 2 decimal places (`$12.34`, `€9.80`)
- `fmt(value, currency)` uses `Intl.NumberFormat` with `style: 'currency'`

### Hook API

```ts
const { currency, setCurrency, toUSD, fromUSD, fmt } = useCurrency()
```

- Persists selected currency to `localStorage('specter_currency')`
- Defaults to `'USD'` on first visit
- Shared across all tools (same localStorage key)

### UI Placement

`CurrencySelector` is a compact dropdown (flag emoji + code + symbol) added to the right side
of the tool header badge row in `ToolLayout`. Shows `RATES_AS_OF` date as a tooltip/subtext.

### Hardcoded USD Constants in Tool Pages

Any hardcoded USD strings (e.g., `"$2.40/cu ft"`, `"$0.87"`) in tool pages must be replaced
with `fmt(fromUSD(2.40, currency))`. This is handled in each per-tool sub-project, not here —
but the `fromUSD` and `fmt` functions must be available from this sub-project.

---

## 2. Scenario & Comparison System

### Files
- `lib/tools/scenarios.ts` — `Scenario` type + localStorage read/write functions
- `hooks/use-scenarios.ts` — hook exposing save/load/delete/compare
- `components/tools/scenario-panel.tsx` — collapsed chip → expanded list → comparison view

### Scenario Type

```ts
export interface Scenario {
  id: string                            // crypto.randomUUID()
  name: string                          // user-defined, e.g. "Q4 Peak"
  currency: string                      // currency code at save-time
  inputs: Record<string, string | boolean>
  results: Record<string, number>       // snapshot of calc output at save-time
  savedAt: number                       // Date.now()
}
```

### Storage

- localStorage key: `specter_scenarios_${toolId}`
- Maximum 5 scenarios per tool. On save, prepend new scenario and trim to 5 (oldest dropped).
- Each tool passes its own `toolId` string (e.g., `'fba'`, `'shopify'`, `'roas'`).

### Hook API

```ts
const {
  scenarios,
  saveScenario,      // (name, inputs, results) → void
  loadScenario,      // (id) → Scenario | undefined
  deleteScenario,    // (id) → void
  compareIds,        // [id, id] | null
  setCompareIds,     // ([id, id] | null) → void
} = useScenarios(toolId)
```

### Save Flow

1. "Save scenario" button lives in the results area of each tool page (after user sees value).
2. Clicking opens a small inline name input defaulting to `"Scenario N"` (N = scenarios.length + 1).
3. Pressing Enter or clicking Save calls `saveScenario(name, currentInputs, currentResults)`.
4. Scenario chip in header updates to show new count.

### Comparison Mode

- `ScenarioPanel` is a collapsible panel triggered by a "Scenarios (N)" chip in the tool header.
- Expanded state: list of up to 5 saved scenarios with Load / Delete / checkbox per row.
- When exactly 2 scenarios are checked, a "Compare" button appears.
- Compare view: replaces the results column with a two-column diff table.
  - Columns: Metric | Scenario A | Scenario B | Δ
  - Δ column: positive difference = `text-emerald-400`, negative = `text-rose-400`
  - Comparison is read-only (inputs are locked while comparing)
- Exiting comparison: "Exit comparison" button restores normal view.

---

## 3. Export System

### Files
- `lib/tools/export.ts` — `exportCsv()` and `exportPdf()` functions
- `hooks/use-export.ts` — hook wrapping both, providing tool context
- `components/tools/export-bar.tsx` — CSV + PDF icon buttons
- `app/tools/layout.tsx` — imports `print.css`
- `styles/print.css` — `@media print` rules

### CSV Export

```ts
export function exportCsv(
  toolId: string,
  inputs: { label: string; value: string }[],
  results: { label: string; value: string }[],
  currency: string,
): void
```

Output format:
```
SPECTER Tool Export,{toolId},{ISO date},Currency: {currency}
(blank row)
--- INPUTS ---
{label},{value}
...
(blank row)
--- RESULTS ---
{label},{value}
...
```

Filename: `specter-{toolId}-{YYYY-MM-DD}.csv`

Uses `Blob` + `URL.createObjectURL` + programmatic `<a>` click. No dependencies.

### PDF Export

Uses `window.print()` — zero bundle weight.

Each tool page renders:
```tsx
<div id="print-report" className="hidden print:block">
  {/* Formatted report: header, inputs table, results table, disclaimer */}
</div>
```

All other page elements have `className="print:hidden"` added via a wrapper or the layout.

`exportPdf()` simply calls `window.print()`. The browser print dialog handles save-as-PDF.

Print CSS (`styles/print.css`):
```css
@media print {
  body { background: white !important; color: black !important; }
  nav, footer, .no-print { display: none !important; }
  #print-report { display: block !important; font-family: system-ui; }
}
```

The print report template (`components/tools/print-report.tsx`) renders:
- SPECTER logo text + tool name + date generated + currency
- Inputs table (two columns: Label | Value)
- Results table (two columns: Metric | Value)
- Footer: "Generated by SPECTER · specter.app · Rates as of [date]"

### Hook API

```ts
const { exportCsv, exportPdf } = useExport(toolId, inputs, results, currency)
```

### Export Bar UI

`ExportBar` renders two small buttons (CSV icon, Printer icon) using Lucide icons (`Download`, `Printer`).
Placed in the tool header alongside the `ScenarioPanel` chip.
Only rendered when `inputs` has at least one non-default value (controlled by each tool page).

---

## 4. Benchmark Data

### File
- `lib/tools/benchmarks.ts`

### Data

```ts
export const BENCHMARKS = {
  roas: {
    google_search:   { low: 2.0, mid: 4.0,  high: 8.0,  label: 'Google Search'   },
    meta_ads:        { low: 1.5, mid: 2.5,  high: 5.0,  label: 'Meta Ads'        },
    tiktok_ads:      { low: 1.2, mid: 2.0,  high: 4.0,  label: 'TikTok Ads'      },
    google_shopping: { low: 3.0, mid: 5.0,  high: 10.0, label: 'Google Shopping' },
    pinterest_ads:   { low: 1.0, mid: 2.0,  high: 3.5,  label: 'Pinterest Ads'   },
  },
  profit_margins: {
    electronics:     { low: 0.10, mid: 0.18, high: 0.30 },
    apparel:         { low: 0.35, mid: 0.50, high: 0.65 },
    beauty:          { low: 0.40, mid: 0.60, high: 0.75 },
    home_garden:     { low: 0.25, mid: 0.40, high: 0.55 },
    sports_outdoors: { low: 0.20, mid: 0.35, high: 0.50 },
    toys_games:      { low: 0.25, mid: 0.40, high: 0.55 },
    grocery_gourmet: { low: 0.15, mid: 0.25, high: 0.40 },
    books_media:     { low: 0.30, mid: 0.45, high: 0.60 },
  },
  fba_margins: {
    healthy: 0.25,
    tight:   0.15,
    danger:  0.08,
  },
  shipping_cost_pct_of_revenue: {
    target:  0.08,
    warning: 0.12,
    danger:  0.18,
  },
  cac_ltv_ratio: {
    healthy: 3.0,   // LTV:CAC ≥ 3 = healthy
    warning: 1.5,   // LTV:CAC < 1.5 = unsustainable
  },
} as const

export type BenchmarkCategory = keyof typeof BENCHMARKS.profit_margins
export type RoasPlatform = keyof typeof BENCHMARKS.roas
```

Consumed by per-tool sub-projects for the Insights Engine panels. Not used directly in this sub-project.

---

## 5. Recharts Wrapper

### File
- `components/tools/tool-chart.tsx`

### Theme Constants

```ts
const CHART_THEME = {
  grid:     '#1A1D2E',   // --border
  text:     '#6B7280',   // --muted
  primary:  '#00E87A',   // --primary
  surface:  '#0D0F1A',   // --surface
  positive: '#34D399',   // emerald-400
  negative: '#F87171',   // rose-400
  warning:  '#FBBF24',   // amber-400
  blue:     '#60A5FA',   // blue-400
  purple:   '#C084FC',   // purple-400
}
```

### Exported Components

| Component | Recharts base | Primary use |
|---|---|---|
| `<ToolBarChart>` | `BarChart` | Fee breakdowns, comparisons |
| `<ToolLineChart>` | `LineChart` | Elasticity curves, trends |
| `<ToolPieChart>` | `PieChart` | Cost distribution |

All three:
- Wrapped in `<ResponsiveContainer width="100%" height={height}>` (height prop, default 220)
- `CartesianGrid` uses `CHART_THEME.grid`, `strokeDasharray="3 3"`
- `XAxis` / `YAxis` use `CHART_THEME.text`, `fontSize={11}`, `fontFamily="'JetBrains Mono', monospace"`
- `Tooltip` uses `contentStyle={{ background: CHART_THEME.surface, border: '1px solid #1A1D2E', borderRadius: '12px', fontFamily: 'DM Sans' }}`
- `Legend` text uses `CHART_THEME.text`, `fontSize={11}`
- Per-tool sub-projects pass `data`, `dataKey`, and optional `color` props — they never import Recharts directly

### Recharts Dependency

Recharts is listed in CLAUDE.md tech stack. Verify it is installed before implementation;
if not, `npm install recharts` is the first step.

---

## Modified Existing Files

### `components/tools/tool-layout.tsx`

The `ToolLayout` component's hero section gains three new elements in its header area:
1. `<CurrencySelector />` — right-aligned in the badge row
2. `<ScenarioPanel toolId={toolId} />` — below the description, collapsed by default
3. `<ExportBar />` — alongside ScenarioPanel, conditionally rendered

`ToolLayout` props gain:
```ts
toolId: string           // required — passed to useScenarios and useExport
hasInteracted?: boolean  // controls ExportBar visibility
```

Each tool page gains a `toolId` constant and passes it to `ToolLayout`.

---

## What This Sub-Project Does NOT Include

- Per-tool chart implementations (each per-tool sub-project adds its own charts)
- Insights engine text panels (per-tool sub-projects)
- Package optimizer, LTV, plan optimizer, elasticity simulator (per-tool sub-projects)
- Any changes to `lib/tools/fba.ts`, `shopify-profit.ts`, etc. (calc functions stay untouched)
- FAQ schema / SEO enhancements (separate concern)

---

## Constraints

- No external API calls — exchange rates are static
- No new dependencies except verifying Recharts is present
- TypeScript strict throughout
- All localStorage keys namespaced with `specter_` prefix
- `crypto.randomUUID()` used for scenario IDs (available in all modern browsers + Next.js edge runtime)
