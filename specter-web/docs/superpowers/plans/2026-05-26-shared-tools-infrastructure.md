# Shared Tools Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared currency, scenarios, export, benchmarks, and chart infrastructure that all 6 SPECTER free calculator tools will use.

**Architecture:** localStorage-backed custom hooks — no React Context or Provider. All calc functions stay untouched (always receive/return USD). Currency conversion happens at the hook boundary. Scenario comparison and CSV+PDF export are self-contained components that per-tool sub-projects wire up.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Vitest, Recharts ^2.15.4, Lucide React, Tailwind CSS

---

## File Map

**New files — libraries (pure logic, tested):**
- `lib/tools/currency.ts` — CURRENCIES list, exchange rates, `toUSD`, `fromUSD`, `fmt`, `buildFmtForCurrency`
- `lib/tools/scenarios.ts` — `Scenario` type, `loadScenarios`, `saveScenario`, `deleteScenario`
- `lib/tools/export.ts` — `buildCsvString` (pure, tested), `exportCsv`, `exportPdf`
- `lib/tools/benchmarks.ts` — static benchmark data object

**New files — hooks:**
- `hooks/use-currency.ts` — `useCurrency()` persisted to localStorage
- `hooks/use-scenarios.ts` — `useScenarios(toolId)` with compareIds state
- `hooks/use-export.ts` — `useExport(toolId, inputs, results, currency)`

**New files — components:**
- `components/tools/currency-selector.tsx` — currency dropdown (no tool-specific props)
- `components/tools/scenario-panel.tsx` — save/load/delete/compare UI
- `components/tools/export-bar.tsx` — CSV + PDF buttons
- `components/tools/print-report.tsx` — `<div id="print-report">` hidden except on print
- `components/tools/tool-chart.tsx` — `ToolBarChart`, `ToolLineChart`, `ToolPieChart` wrappers

**New files — styles:**
- `app/tools/print.css` — `@media print` rules

**New test files:**
- `__tests__/tools/currency.test.ts`
- `__tests__/tools/scenarios.test.ts`
- `__tests__/tools/export.test.ts`

**Modified files:**
- `components/tools/tool-layout.tsx` — add `toolId?`, `headerRight?` props; embed `CurrencySelector`
- `app/tools/layout.tsx` — import `./print.css`
- All 6 tool pages — add `toolId` prop to their `ToolLayout` call

---

## Task 1: Currency Library

**Files:**
- Create: `lib/tools/currency.ts`
- Create: `__tests__/tools/currency.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/tools/currency.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toUSD, fromUSD, fmt, EXCHANGE_RATES, CURRENCIES } from '@/lib/tools/currency'

describe('CURRENCIES', () => {
  it('contains 10 currencies', () => {
    expect(CURRENCIES).toHaveLength(10)
  })
  it('every currency has code, symbol, name', () => {
    CURRENCIES.forEach((c) => {
      expect(c.code).toBeTruthy()
      expect(c.symbol).toBeTruthy()
      expect(c.name).toBeTruthy()
    })
  })
})

describe('toUSD', () => {
  it('returns same amount for USD', () => {
    expect(toUSD(100, 'USD')).toBe(100)
  })
  it('converts EUR to USD: 92 EUR / 0.92 = 100 USD', () => {
    expect(toUSD(92, 'EUR')).toBeCloseTo(100, 1)
  })
  it('converts GBP to USD: 79 GBP / 0.79 = 100 USD', () => {
    expect(toUSD(79, 'GBP')).toBeCloseTo(100, 1)
  })
  it('defaults to rate 1 for unknown currency code', () => {
    expect(toUSD(100, 'ZZZ')).toBe(100)
  })
  it('handles zero', () => {
    expect(toUSD(0, 'EUR')).toBe(0)
  })
})

describe('fromUSD', () => {
  it('returns same amount for USD', () => {
    expect(fromUSD(100, 'USD')).toBe(100)
  })
  it('converts USD to EUR: 100 USD × 0.92 = 92 EUR', () => {
    expect(fromUSD(100, 'EUR')).toBeCloseTo(92, 1)
  })
  it('round-trips toUSD → fromUSD with no loss', () => {
    expect(fromUSD(toUSD(50, 'GBP'), 'GBP')).toBeCloseTo(50, 5)
  })
  it('round-trips toUSD → fromUSD for INR', () => {
    expect(fromUSD(toUSD(1000, 'INR'), 'INR')).toBeCloseTo(1000, 3)
  })
})

describe('fmt', () => {
  it('formats USD with $ and 2 decimal places', () => {
    expect(fmt(12.5, 'USD')).toBe('$12.50')
  })
  it('formats negative USD correctly', () => {
    expect(fmt(-5, 'USD')).toContain('5.00')
  })
  it('formats JPY with no decimal places', () => {
    const result = fmt(1234, 'JPY')
    expect(result).toContain('1,234')
    expect(result).not.toContain('.')
  })
  it('formats EUR with € symbol', () => {
    expect(fmt(10, 'EUR')).toContain('€')
  })
})

describe('EXCHANGE_RATES', () => {
  it('USD rate is exactly 1', () => {
    expect(EXCHANGE_RATES['USD']).toBe(1)
  })
  it('all CURRENCIES have a rate', () => {
    CURRENCIES.forEach((c) => {
      expect(EXCHANGE_RATES[c.code]).toBeDefined()
    })
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```
npm test -- --reporter=verbose 2>&1 | head -30
```

Expected: FAIL — `Cannot find module '@/lib/tools/currency'`

- [ ] **Step 3: Implement `lib/tools/currency.ts`**

```ts
export interface Currency {
  code: string
  symbol: string
  name: string
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$',    name: 'US Dollar'         },
  { code: 'EUR', symbol: '€',    name: 'Euro'              },
  { code: 'GBP', symbol: '£',    name: 'British Pound'     },
  { code: 'CAD', symbol: 'C$',   name: 'Canadian Dollar'   },
  { code: 'AUD', symbol: 'A$',   name: 'Australian Dollar' },
  { code: 'INR', symbol: '₹',    name: 'Indian Rupee'      },
  { code: 'JPY', symbol: '¥',    name: 'Japanese Yen'      },
  { code: 'SGD', symbol: 'S$',   name: 'Singapore Dollar'  },
  { code: 'AED', symbol: 'د.إ',  name: 'UAE Dirham'        },
  { code: 'MXN', symbol: 'MX$',  name: 'Mexican Peso'      },
]

export const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,    EUR: 0.92,  GBP: 0.79,  CAD: 1.36,
  AUD: 1.53, INR: 83.5,  JPY: 156,   SGD: 1.34,
  AED: 3.67, MXN: 17.2,
}

export const RATES_AS_OF = '2025-05-01'

export function toUSD(amount: number, currency: string): number {
  const rate = EXCHANGE_RATES[currency] ?? 1
  return amount / rate
}

export function fromUSD(amount: number, currency: string): number {
  const rate = EXCHANGE_RATES[currency] ?? 1
  return amount * rate
}

export function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(amount)
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```
npm test -- --reporter=verbose 2>&1 | grep -A 3 "currency"
```

Expected: all currency tests PASS

- [ ] **Step 5: Commit**

```
git add lib/tools/currency.ts __tests__/tools/currency.test.ts
git commit -m "feat: add currency library with exchange rates and conversion utils"
```

---

## Task 2: Scenarios Library

**Files:**
- Create: `lib/tools/scenarios.ts`
- Create: `__tests__/tools/scenarios.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/tools/scenarios.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadScenarios, saveScenario, deleteScenario } from '@/lib/tools/scenarios'

const TOOL_ID = 'test-tool'
const mockStore: Record<string, string> = {}

beforeEach(() => {
  Object.keys(mockStore).forEach((k) => delete mockStore[k])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mockStore[k] ?? null,
    setItem: (k: string, v: string) => { mockStore[k] = v },
    removeItem: (k: string) => { delete mockStore[k] },
  })
  let uuid = 0
  vi.stubGlobal('crypto', {
    randomUUID: () => `uuid-${++uuid}`,
  })
})

describe('loadScenarios', () => {
  it('returns empty array when nothing stored', () => {
    expect(loadScenarios(TOOL_ID)).toEqual([])
  })
  it('returns empty array when stored value is invalid JSON', () => {
    mockStore[`specter_scenarios_${TOOL_ID}`] = 'not-json'
    expect(loadScenarios(TOOL_ID)).toEqual([])
  })
  it('returns parsed scenarios from localStorage', () => {
    const data = [{ id: '1', name: 'A', currency: 'USD', inputs: {}, results: {}, savedAt: 1 }]
    mockStore[`specter_scenarios_${TOOL_ID}`] = JSON.stringify(data)
    expect(loadScenarios(TOOL_ID)).toHaveLength(1)
    expect(loadScenarios(TOOL_ID)[0].name).toBe('A')
  })
})

describe('saveScenario', () => {
  it('returns scenario with generated id and savedAt', () => {
    const s = saveScenario(TOOL_ID, { name: 'Test', currency: 'USD', inputs: {}, results: {} })
    expect(s.id).toBeTruthy()
    expect(s.savedAt).toBeGreaterThan(0)
    expect(s.name).toBe('Test')
  })
  it('prepends new scenario so newest is first', () => {
    saveScenario(TOOL_ID, { name: 'First', currency: 'USD', inputs: {}, results: {} })
    saveScenario(TOOL_ID, { name: 'Second', currency: 'USD', inputs: {}, results: {} })
    const list = loadScenarios(TOOL_ID)
    expect(list[0].name).toBe('Second')
    expect(list[1].name).toBe('First')
  })
  it('trims list to 5 scenarios maximum', () => {
    for (let i = 0; i < 7; i++) {
      saveScenario(TOOL_ID, { name: `S${i}`, currency: 'USD', inputs: {}, results: {} })
    }
    expect(loadScenarios(TOOL_ID)).toHaveLength(5)
  })
  it('persists inputs and results snapshots', () => {
    saveScenario(TOOL_ID, {
      name: 'WithData',
      currency: 'EUR',
      inputs: { price: '99', is_peak: true },
      results: { net_profit: 12.5 },
    })
    const s = loadScenarios(TOOL_ID)[0]
    expect(s.currency).toBe('EUR')
    expect(s.inputs['price']).toBe('99')
    expect(s.results['net_profit']).toBe(12.5)
  })
})

describe('deleteScenario', () => {
  it('removes the scenario with matching id', () => {
    const s = saveScenario(TOOL_ID, { name: 'ToDelete', currency: 'USD', inputs: {}, results: {} })
    deleteScenario(TOOL_ID, s.id)
    expect(loadScenarios(TOOL_ID)).toHaveLength(0)
  })
  it('leaves other scenarios intact', () => {
    saveScenario(TOOL_ID, { name: 'Keep', currency: 'USD', inputs: {}, results: {} })
    const del = saveScenario(TOOL_ID, { name: 'Delete', currency: 'USD', inputs: {}, results: {} })
    deleteScenario(TOOL_ID, del.id)
    expect(loadScenarios(TOOL_ID)).toHaveLength(1)
    expect(loadScenarios(TOOL_ID)[0].name).toBe('Keep')
  })
  it('does nothing if id not found', () => {
    saveScenario(TOOL_ID, { name: 'Keep', currency: 'USD', inputs: {}, results: {} })
    deleteScenario(TOOL_ID, 'nonexistent-id')
    expect(loadScenarios(TOOL_ID)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```
npm test -- --reporter=verbose 2>&1 | head -20
```

Expected: FAIL — `Cannot find module '@/lib/tools/scenarios'`

- [ ] **Step 3: Implement `lib/tools/scenarios.ts`**

```ts
export interface Scenario {
  id: string
  name: string
  currency: string
  inputs: Record<string, string | boolean>
  results: Record<string, number>
  savedAt: number
}

const MAX_SCENARIOS = 5

function storageKey(toolId: string): string {
  return `specter_scenarios_${toolId}`
}

export function loadScenarios(toolId: string): Scenario[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(storageKey(toolId))
    return raw ? (JSON.parse(raw) as Scenario[]) : []
  } catch {
    return []
  }
}

export function saveScenario(
  toolId: string,
  scenario: Omit<Scenario, 'id' | 'savedAt'>,
): Scenario {
  const newScenario: Scenario = {
    ...scenario,
    id: crypto.randomUUID(),
    savedAt: Date.now(),
  }
  const existing = loadScenarios(toolId)
  const updated = [newScenario, ...existing].slice(0, MAX_SCENARIOS)
  localStorage.setItem(storageKey(toolId), JSON.stringify(updated))
  return newScenario
}

export function deleteScenario(toolId: string, id: string): void {
  const existing = loadScenarios(toolId)
  const updated = existing.filter((s) => s.id !== id)
  localStorage.setItem(storageKey(toolId), JSON.stringify(updated))
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```
npm test -- --reporter=verbose 2>&1 | grep -A 3 "scenarios"
```

Expected: all scenarios tests PASS

- [ ] **Step 5: Commit**

```
git add lib/tools/scenarios.ts __tests__/tools/scenarios.test.ts
git commit -m "feat: add scenarios library with localStorage save/load/delete"
```

---

## Task 3: Export Library

**Files:**
- Create: `lib/tools/export.ts`
- Create: `__tests__/tools/export.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/tools/export.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildCsvString } from '@/lib/tools/export'

const inputs = [
  { label: 'Selling Price', value: '$29.99' },
  { label: 'Product Cost', value: '$8.00' },
]
const results = [
  { label: 'Net Profit', value: '$12.50' },
  { label: 'Margin', value: '41.8%' },
]

describe('buildCsvString', () => {
  it('includes the tool id in the header row', () => {
    const csv = buildCsvString('fba', inputs, results, 'USD')
    expect(csv).toContain('fba')
  })
  it('includes the currency in the header row', () => {
    const csv = buildCsvString('fba', inputs, results, 'EUR')
    expect(csv).toContain('Currency: EUR')
  })
  it('includes INPUTS section header', () => {
    const csv = buildCsvString('fba', inputs, results, 'USD')
    expect(csv).toContain('--- INPUTS ---')
  })
  it('includes RESULTS section header', () => {
    const csv = buildCsvString('fba', inputs, results, 'USD')
    expect(csv).toContain('--- RESULTS ---')
  })
  it('includes all input labels and values', () => {
    const csv = buildCsvString('fba', inputs, results, 'USD')
    expect(csv).toContain('Selling Price')
    expect(csv).toContain('$29.99')
    expect(csv).toContain('Product Cost')
    expect(csv).toContain('$8.00')
  })
  it('includes all result labels and values', () => {
    const csv = buildCsvString('fba', inputs, results, 'USD')
    expect(csv).toContain('Net Profit')
    expect(csv).toContain('$12.50')
    expect(csv).toContain('Margin')
    expect(csv).toContain('41.8%')
  })
  it('returns a non-empty string', () => {
    const csv = buildCsvString('roas', [], [], 'USD')
    expect(csv.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```
npm test -- --reporter=verbose 2>&1 | head -20
```

Expected: FAIL — `Cannot find module '@/lib/tools/export'`

- [ ] **Step 3: Implement `lib/tools/export.ts`**

```ts
export interface ExportRow {
  label: string
  value: string
}

export function buildCsvString(
  toolId: string,
  inputs: ExportRow[],
  results: ExportRow[],
  currency: string,
): string {
  const date = new Date().toISOString().split('T')[0]
  const rows: (string | undefined)[][] = [
    ['SPECTER Tool Export', toolId, date, `Currency: ${currency}`],
    [],
    ['--- INPUTS ---'],
    ...inputs.map(({ label, value }) => [label, value]),
    [],
    ['--- RESULTS ---'],
    ...results.map(({ label, value }) => [label, value]),
  ]
  return rows.map((r) => r.filter(Boolean).join(',')).join('\n')
}

export function exportCsv(
  toolId: string,
  inputs: ExportRow[],
  results: ExportRow[],
  currency: string,
): void {
  const csv = buildCsvString(toolId, inputs, results, currency)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `specter-${toolId}-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportPdf(): void {
  window.print()
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```
npm test -- --reporter=verbose 2>&1 | grep -A 3 "export"
```

Expected: all export tests PASS

- [ ] **Step 5: Run full test suite — confirm no regressions**

```
npm test
```

Expected: all existing + new tests PASS

- [ ] **Step 6: Commit**

```
git add lib/tools/export.ts __tests__/tools/export.test.ts
git commit -m "feat: add export library with CSV generation and print-to-PDF"
```

---

## Task 4: Benchmarks Data

**Files:**
- Create: `lib/tools/benchmarks.ts`

No tests — this is static lookup data with no logic to verify.

- [ ] **Step 1: Create `lib/tools/benchmarks.ts`**

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
    healthy: 3.0,
    warning: 1.5,
  },
} as const

export type BenchmarkCategory = keyof typeof BENCHMARKS.profit_margins
export type RoasPlatform = keyof typeof BENCHMARKS.roas
```

- [ ] **Step 2: Confirm TypeScript compiles cleanly**

```
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```
git add lib/tools/benchmarks.ts
git commit -m "feat: add static benchmark data for ROAS, margins, FBA, and shipping"
```

---

## Task 5: useCurrency Hook

**Files:**
- Create: `hooks/use-currency.ts`

- [ ] **Step 1: Create `hooks/use-currency.ts`**

```ts
'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  CURRENCIES,
  EXCHANGE_RATES,
  toUSD as toUSDFn,
  fromUSD as fromUSDFn,
  fmt as fmtFn,
} from '@/lib/tools/currency'

const STORAGE_KEY = 'specter_currency'

export function useCurrency() {
  const [currency, setCurrencyState] = useState('USD')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && EXCHANGE_RATES[stored]) {
      setCurrencyState(stored)
    }
  }, [])

  const setCurrency = useCallback((code: string) => {
    setCurrencyState(code)
    localStorage.setItem(STORAGE_KEY, code)
  }, [])

  const toUSD = useCallback(
    (amount: number) => toUSDFn(amount, currency),
    [currency],
  )

  const fromUSD = useCallback(
    (amount: number) => fromUSDFn(amount, currency),
    [currency],
  )

  const fmt = useCallback(
    (amount: number) => fmtFn(amount, currency),
    [currency],
  )

  return { currency, setCurrency, toUSD, fromUSD, fmt, currencies: CURRENCIES }
}
```

- [ ] **Step 2: Confirm TypeScript compiles cleanly**

```
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```
git add hooks/use-currency.ts
git commit -m "feat: add useCurrency hook with localStorage persistence"
```

---

## Task 6: useScenarios Hook

**Files:**
- Create: `hooks/use-scenarios.ts`

- [ ] **Step 1: Create `hooks/use-scenarios.ts`**

```ts
'use client'

import { useState, useCallback } from 'react'
import {
  loadScenarios,
  saveScenario as saveFn,
  deleteScenario as deleteFn,
  Scenario,
} from '@/lib/tools/scenarios'

export function useScenarios(toolId: string) {
  const [scenarios, setScenarios] = useState<Scenario[]>(() => loadScenarios(toolId))
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null)

  const saveScenario = useCallback(
    (
      name: string,
      inputs: Record<string, string | boolean>,
      results: Record<string, number>,
      currency: string,
    ) => {
      const saved = saveFn(toolId, { name, currency, inputs, results })
      setScenarios(loadScenarios(toolId))
      return saved
    },
    [toolId],
  )

  const loadScenario = useCallback(
    (id: string): Scenario | undefined =>
      scenarios.find((s) => s.id === id),
    [scenarios],
  )

  const deleteScenario = useCallback(
    (id: string) => {
      deleteFn(toolId, id)
      setScenarios(loadScenarios(toolId))
      setCompareIds((prev) => {
        if (!prev) return null
        return prev.includes(id) ? null : prev
      })
    },
    [toolId],
  )

  return {
    scenarios,
    saveScenario,
    loadScenario,
    deleteScenario,
    compareIds,
    setCompareIds,
  }
}
```

- [ ] **Step 2: Confirm TypeScript compiles cleanly**

```
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```
git add hooks/use-scenarios.ts
git commit -m "feat: add useScenarios hook with compare mode state"
```

---

## Task 7: useExport Hook

**Files:**
- Create: `hooks/use-export.ts`

- [ ] **Step 1: Create `hooks/use-export.ts`**

```ts
'use client'

import { useCallback } from 'react'
import { exportCsv as exportCsvFn, exportPdf as exportPdfFn, ExportRow } from '@/lib/tools/export'

export function useExport(
  toolId: string,
  inputs: ExportRow[],
  results: ExportRow[],
  currency: string,
) {
  const exportCsv = useCallback(() => {
    exportCsvFn(toolId, inputs, results, currency)
  }, [toolId, inputs, results, currency])

  const exportPdf = useCallback(() => {
    exportPdfFn()
  }, [])

  return { exportCsv, exportPdf }
}
```

- [ ] **Step 2: Confirm TypeScript compiles cleanly**

```
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```
git add hooks/use-export.ts
git commit -m "feat: add useExport hook wrapping CSV and PDF export functions"
```

---

## Task 8: CurrencySelector Component

**Files:**
- Create: `components/tools/currency-selector.tsx`

- [ ] **Step 1: Create `components/tools/currency-selector.tsx`**

```tsx
'use client'

import { Globe } from 'lucide-react'
import { CURRENCIES, RATES_AS_OF } from '@/lib/tools/currency'
import { useCurrency } from '@/hooks/use-currency'

export default function CurrencySelector() {
  const { currency, setCurrency } = useCurrency()

  return (
    <div
      className="flex items-center gap-1.5"
      title={`Exchange rates as of ${RATES_AS_OF}`}
    >
      <Globe size={12} className="text-muted" aria-hidden="true" />
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className="bg-transparent border border-border rounded-lg px-2 py-1 font-mono text-xs text-muted hover:text-text focus:outline-none focus:border-primary/50 cursor-pointer transition-colors appearance-none"
        aria-label="Select display currency"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} {c.symbol}
          </option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 2: Confirm TypeScript compiles cleanly**

```
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```
git add components/tools/currency-selector.tsx
git commit -m "feat: add CurrencySelector component with globe icon"
```

---

## Task 9: ScenarioPanel Component

**Files:**
- Create: `components/tools/scenario-panel.tsx`

- [ ] **Step 1: Create `components/tools/scenario-panel.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { BookmarkPlus, ChevronDown, ChevronUp, Trash2, Play, GitCompare, X } from 'lucide-react'
import { useScenarios } from '@/hooks/use-scenarios'
import { fromUSD, fmt as fmtFn } from '@/lib/tools/currency'
import { cn } from '@/lib/utils'
import type { Scenario } from '@/lib/tools/scenarios'

interface ScenarioPanelProps {
  toolId: string
  currentInputs: Record<string, string | boolean>
  currentResults: Record<string, number>
  currency: string
  resultLabels: Record<string, string>
  onLoad: (scenario: Scenario) => void
}

export default function ScenarioPanel({
  toolId,
  currentInputs,
  currentResults,
  currency,
  resultLabels,
  onLoad,
}: ScenarioPanelProps) {
  const { scenarios, saveScenario, deleteScenario, compareIds, setCompareIds } =
    useScenarios(toolId)
  const [expanded, setExpanded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  function handleSave() {
    const name = nameInput.trim() || `Scenario ${scenarios.length + 1}`
    saveScenario(name, currentInputs, currentResults, currency)
    setIsSaving(false)
    setNameInput('')
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : prev.length < 2
          ? [...prev, id]
          : prev,
    )
  }

  function startCompare() {
    if (selectedIds.length === 2) {
      setCompareIds([selectedIds[0], selectedIds[1]])
      setExpanded(true)
    }
  }

  function exitCompare() {
    setCompareIds(null)
    setSelectedIds([])
  }

  const scenA = compareIds ? scenarios.find((s) => s.id === compareIds[0]) : null
  const scenB = compareIds ? scenarios.find((s) => s.id === compareIds[1]) : null

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 text-xs font-mono text-muted hover:text-text transition-colors"
        aria-label="Open scenarios panel"
      >
        <BookmarkPlus size={12} aria-hidden="true" />
        Scenarios{scenarios.length > 0 ? ` (${scenarios.length})` : ''}
        <ChevronDown size={11} aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 mt-2 w-full max-w-md mx-auto text-left">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-xs text-text font-semibold">Saved Scenarios</span>
        <button
          onClick={() => setExpanded(false)}
          className="text-muted hover:text-text transition-colors"
          aria-label="Close scenarios panel"
        >
          <ChevronUp size={14} aria-hidden="true" />
        </button>
      </div>

      {scenarios.length === 0 ? (
        <p className="font-body text-xs text-muted mb-3">No scenarios saved yet.</p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {scenarios.map((s) => (
            <div
              key={s.id}
              className={cn(
                'flex items-center gap-2 p-2 rounded-lg border transition-colors',
                selectedIds.includes(s.id)
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border',
              )}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(s.id)}
                onChange={() => toggleSelect(s.id)}
                className="accent-primary shrink-0"
                aria-label={`Select ${s.name} for comparison`}
              />
              <div className="flex-1 min-w-0">
                <p className="font-body text-xs text-text font-medium truncate">{s.name}</p>
                <p className="font-mono text-xs text-muted">
                  {s.currency} · {new Date(s.savedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => { onLoad(s); setExpanded(false) }}
                className="text-muted hover:text-primary transition-colors p-1"
                title={`Load ${s.name}`}
                aria-label={`Load ${s.name}`}
              >
                <Play size={12} aria-hidden="true" />
              </button>
              <button
                onClick={() => deleteScenario(s.id)}
                className="text-muted hover:text-rose-400 transition-colors p-1"
                title={`Delete ${s.name}`}
                aria-label={`Delete ${s.name}`}
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedIds.length === 2 && !compareIds && (
        <button
          onClick={startCompare}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary font-mono text-xs font-semibold mb-2 hover:bg-primary/15 transition-colors"
        >
          <GitCompare size={12} aria-hidden="true" />
          Compare selected
        </button>
      )}

      {isSaving ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') setIsSaving(false)
            }}
            placeholder={`Scenario ${scenarios.length + 1}`}
            className="flex-1 bg-bg border border-border rounded-lg px-3 py-1.5 font-body text-xs text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/50 transition-colors"
          />
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded-lg bg-primary text-bg font-mono text-xs font-bold hover:bg-primary/90 transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => setIsSaving(false)}
            className="px-2 py-1.5 text-muted hover:text-text transition-colors"
            aria-label="Cancel"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsSaving(true)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-border text-muted hover:text-text hover:border-border/80 font-mono text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={scenarios.length >= 5}
        >
          <BookmarkPlus size={12} aria-hidden="true" />
          {scenarios.length >= 5 ? 'Max 5 scenarios reached' : 'Save current scenario'}
        </button>
      )}

      {compareIds && scenA && scenB && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs text-text font-semibold">Comparison</span>
            <button
              onClick={exitCompare}
              className="font-mono text-xs text-muted hover:text-text transition-colors"
            >
              Exit
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left font-mono text-xs text-muted pb-2 pr-2">Metric</th>
                  <th className="text-right font-mono text-xs text-primary pb-2 pr-2 max-w-20 truncate">
                    {scenA.name}
                  </th>
                  <th className="text-right font-mono text-xs text-blue-400 pb-2 pr-2 max-w-20 truncate">
                    {scenB.name}
                  </th>
                  <th className="text-right font-mono text-xs text-muted pb-2">Δ</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(resultLabels).map((key) => {
                  const valA = fromUSD(scenA.results[key] ?? 0, scenA.currency)
                  const valB = fromUSD(scenB.results[key] ?? 0, scenB.currency)
                  const diff = valB - valA
                  return (
                    <tr key={key} className="border-t border-border/50">
                      <td className="py-1.5 font-body text-xs text-muted pr-2">
                        {resultLabels[key]}
                      </td>
                      <td className="py-1.5 font-mono text-xs text-right text-text pr-2">
                        {fmtFn(valA, scenA.currency)}
                      </td>
                      <td className="py-1.5 font-mono text-xs text-right text-text pr-2">
                        {fmtFn(valB, scenB.currency)}
                      </td>
                      <td
                        className={cn(
                          'py-1.5 font-mono text-xs text-right',
                          diff > 0.005
                            ? 'text-emerald-400'
                            : diff < -0.005
                              ? 'text-rose-400'
                              : 'text-muted',
                        )}
                      >
                        {diff > 0.005 ? '+' : ''}
                        {diff.toFixed(2)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Confirm TypeScript compiles cleanly**

```
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```
git add components/tools/scenario-panel.tsx
git commit -m "feat: add ScenarioPanel component with save/load/delete/compare"
```

---

## Task 10: ExportBar and PrintReport Components

**Files:**
- Create: `components/tools/export-bar.tsx`
- Create: `components/tools/print-report.tsx`

- [ ] **Step 1: Create `components/tools/export-bar.tsx`**

```tsx
'use client'

import { Download, Printer } from 'lucide-react'
import { useExport } from '@/hooks/use-export'
import type { ExportRow } from '@/lib/tools/export'

interface ExportBarProps {
  toolId: string
  inputs: ExportRow[]
  results: ExportRow[]
  currency: string
}

export default function ExportBar({ toolId, inputs, results, currency }: ExportBarProps) {
  const { exportCsv, exportPdf } = useExport(toolId, inputs, results, currency)

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={exportCsv}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-muted hover:text-text hover:border-border/80 transition-colors font-mono text-xs"
        title="Download CSV"
        aria-label="Download CSV export"
      >
        <Download size={11} aria-hidden="true" />
        CSV
      </button>
      <button
        onClick={exportPdf}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-muted hover:text-text hover:border-border/80 transition-colors font-mono text-xs"
        title="Print / Save as PDF"
        aria-label="Print PDF report"
      >
        <Printer size={11} aria-hidden="true" />
        PDF
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/tools/print-report.tsx`**

```tsx
import { RATES_AS_OF } from '@/lib/tools/currency'
import type { ExportRow } from '@/lib/tools/export'

interface PrintReportProps {
  toolName: string
  toolId: string
  currency: string
  inputs: ExportRow[]
  results: ExportRow[]
}

export default function PrintReport({
  toolName,
  toolId,
  currency,
  inputs,
  results,
}: PrintReportProps) {
  return (
    <div id="print-report" className="hidden print:block p-8 text-black bg-white">
      <div className="border-b-2 border-black pb-4 mb-6">
        <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">SPECTER</p>
        <h1 className="text-2xl font-bold">{toolName}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generated: {new Date().toLocaleDateString()} · Currency: {currency} · Rates
          as of {RATES_AS_OF}
        </p>
      </div>

      <div className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-wide mb-3">Inputs</h2>
        <table className="w-full text-sm border-collapse">
          <tbody>
            {inputs.map(({ label, value }) => (
              <tr key={label} className="border-b border-gray-200">
                <td className="py-1.5 pr-4 text-gray-600 w-1/2">{label}</td>
                <td className="py-1.5 font-mono font-medium">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-bold uppercase tracking-wide mb-3">Results</h2>
        <table className="w-full text-sm border-collapse">
          <tbody>
            {results.map(({ label, value }) => (
              <tr key={label} className="border-b border-gray-200">
                <td className="py-1.5 pr-4 text-gray-600 w-1/2">{label}</td>
                <td className="py-1.5 font-mono font-bold">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 border-t border-gray-200 pt-4">
        Generated by SPECTER · specter.app · Free ecommerce tools · {toolId}
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Confirm TypeScript compiles cleanly**

```
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 4: Commit**

```
git add components/tools/export-bar.tsx components/tools/print-report.tsx
git commit -m "feat: add ExportBar and PrintReport components"
```

---

## Task 11: Print CSS and Tools Layout

**Files:**
- Create: `app/tools/print.css`
- Modify: `app/tools/layout.tsx`

- [ ] **Step 1: Create `app/tools/print.css`**

```css
@media print {
  body {
    background: white !important;
    color: black !important;
  }

  nav,
  footer,
  .no-print {
    display: none !important;
  }

  #print-report {
    display: block !important;
  }

  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
```

- [ ] **Step 2: Modify `app/tools/layout.tsx`** — add the CSS import

Current file content:
```tsx
import Nav from '@/components/marketing/nav'
import Footer from '@/components/marketing/footer'

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      {children}
      <Footer />
    </>
  )
}
```

Updated file:
```tsx
import Nav from '@/components/marketing/nav'
import Footer from '@/components/marketing/footer'
import './print.css'

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      {children}
      <Footer />
    </>
  )
}
```

- [ ] **Step 3: Confirm TypeScript compiles cleanly**

```
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 4: Commit**

```
git add app/tools/print.css app/tools/layout.tsx
git commit -m "feat: add print CSS for PDF export via window.print()"
```

---

## Task 12: Recharts Wrapper Components

**Files:**
- Create: `components/tools/tool-chart.tsx`

Recharts `^2.15.4` is already in `package.json` — no install needed.

- [ ] **Step 1: Create `components/tools/tool-chart.tsx`**

```tsx
'use client'

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const CHART_THEME = {
  grid:     '#1A1D2E',
  text:     '#6B7280',
  primary:  '#00E87A',
  surface:  '#0D0F1A',
  positive: '#34D399',
  negative: '#F87171',
  warning:  '#FBBF24',
  blue:     '#60A5FA',
  purple:   '#C084FC',
} as const

export const CHART_COLORS = [
  CHART_THEME.primary,
  CHART_THEME.blue,
  CHART_THEME.purple,
  CHART_THEME.warning,
  CHART_THEME.positive,
  CHART_THEME.negative,
]

const tooltipStyle = {
  background: CHART_THEME.surface,
  border: `1px solid ${CHART_THEME.grid}`,
  borderRadius: '12px',
  fontFamily: 'DM Sans, sans-serif',
  fontSize: '12px',
  color: '#E8EAF0',
}

const axisStyle = {
  fill: CHART_THEME.text,
  fontSize: 11,
  fontFamily: "'JetBrains Mono', monospace",
}

// ── ToolBarChart ──────────────────────────────────────────────────────────────

interface BarDef {
  key: string
  label: string
  color?: string
}

interface ToolBarChartProps {
  data: Record<string, string | number>[]
  xKey: string
  bars: BarDef[]
  height?: number
  yFormatter?: (v: number) => string
}

export function ToolBarChart({
  data,
  xKey,
  bars,
  height = 220,
  yFormatter,
}: ToolBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
        <XAxis dataKey={xKey} tick={axisStyle} />
        <YAxis tick={axisStyle} tickFormatter={yFormatter} width={60} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={yFormatter ? (v: number) => [yFormatter(v)] : undefined}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: CHART_THEME.text }} />
        {bars.map((b, i) => (
          <Bar
            key={b.key}
            dataKey={b.key}
            name={b.label}
            fill={b.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── ToolLineChart ─────────────────────────────────────────────────────────────

interface LineDef {
  key: string
  label: string
  color?: string
}

interface ToolLineChartProps {
  data: Record<string, string | number>[]
  xKey: string
  lines: LineDef[]
  height?: number
  yFormatter?: (v: number) => string
}

export function ToolLineChart({
  data,
  xKey,
  lines,
  height = 220,
  yFormatter,
}: ToolLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
        <XAxis dataKey={xKey} tick={axisStyle} />
        <YAxis tick={axisStyle} tickFormatter={yFormatter} width={60} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={yFormatter ? (v: number) => [yFormatter(v)] : undefined}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: CHART_THEME.text }} />
        {lines.map((l, i) => (
          <Line
            key={l.key}
            dataKey={l.key}
            name={l.label}
            stroke={l.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── ToolPieChart ──────────────────────────────────────────────────────────────

interface PieEntry {
  name: string
  value: number
}

interface ToolPieChartProps {
  data: PieEntry[]
  height?: number
  formatter?: (v: number) => string
}

export function ToolPieChart({ data, height = 220, formatter }: ToolPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={({ name, percent }: { name: string; percent: number }) =>
            `${name} ${(percent * 100).toFixed(0)}%`
          }
          labelLine={{ stroke: CHART_THEME.text }}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={formatter ? (v: number) => [formatter(v)] : undefined}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Confirm TypeScript compiles cleanly**

```
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```
git add components/tools/tool-chart.tsx
git commit -m "feat: add ToolBarChart, ToolLineChart, ToolPieChart Recharts wrappers"
```

---

## Task 13: Update ToolLayout

**Files:**
- Modify: `components/tools/tool-layout.tsx`

Add `toolId?` and `headerRight?` props. Embed `CurrencySelector` next to the badge. Render `headerRight` slot below the description.

- [ ] **Step 1: Read the current file to confirm line numbers before editing**

Read `components/tools/tool-layout.tsx` lines 1–50.

- [ ] **Step 2: Update `components/tools/tool-layout.tsx`**

Replace the entire file with:

```tsx
'use client'

import Link from 'next/link'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import CurrencySelector from '@/components/tools/currency-selector'

interface ToolLayoutProps {
  badge: string
  title: string
  description: string
  children: React.ReactNode
  className?: string
  toolId?: string
  headerRight?: React.ReactNode
}

export default function ToolLayout({
  badge,
  title,
  description,
  children,
  className,
  toolId: _toolId,
  headerRight,
}: ToolLayoutProps) {
  return (
    <div className="min-h-screen bg-bg">
      {/* Hero */}
      <section className="pt-28 pb-10 text-center px-6">
        <div className="flex items-center justify-center gap-3 mb-6 flex-wrap">
          <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 text-primary text-xs font-mono uppercase tracking-widest px-4 py-1.5 rounded-full animate-border-glow">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
            {badge}
          </div>
          <CurrencySelector />
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-text mb-4 max-w-3xl mx-auto leading-tight tracking-tight">
          {title}
        </h1>
        <p className="font-body text-lg text-muted max-w-2xl mx-auto leading-relaxed">
          {description}
        </p>
        <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-muted hover:text-text text-xs font-mono transition-colors"
          >
            <ArrowLeft size={12} aria-hidden="true" />
            Back to SPECTER
          </Link>
          <span className="text-border" aria-hidden="true">·</span>
          <span className="text-xs font-mono text-muted">Free · No sign-up · Client-side only</span>
        </div>
        {headerRight && (
          <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
            {headerRight}
          </div>
        )}
      </section>

      {/* Calculator content */}
      <div className={cn('max-w-5xl mx-auto px-6 pb-20', className)}>
        {children}
      </div>

      {/* SPECTER CTA */}
      <section className="py-20 bg-surface/40 border-t border-border">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 border border-primary/20 bg-primary/5 text-primary text-xs font-mono uppercase tracking-widest px-3 py-1 rounded-full mb-6">
            <span className="w-1 h-1 rounded-full bg-primary animate-pulse" aria-hidden="true" />
            Want this automated?
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-text mb-4 tracking-tight">
            Stop calculating manually.{' '}
            <span className="text-primary">Start winning.</span>
          </h2>
          <p className="font-body text-muted mb-8 leading-relaxed max-w-xl mx-auto">
            SPECTER monitors competitor prices in real time and sends AI-powered{' '}
            <span className="text-text font-semibold">RAISE / LOWER / HOLD</span> signals
            directly to your Shopify dashboard — no spreadsheets required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/sign-up"
              className="gradient-primary-cta btn-ripple inline-flex items-center justify-center gap-2 font-semibold px-8 py-3.5 rounded-lg text-base transition-all duration-300"
            >
              Start free trial — 14 days
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href="/pricing"
              className="border border-border text-muted hover:text-text hover:border-border/80 px-8 py-3.5 rounded-lg transition-colors text-base text-center"
            >
              See pricing →
            </Link>
          </div>
          <p className="font-body text-xs text-muted mt-6">
            No credit card required · Set up in 10 minutes · Cancel any time
          </p>
        </div>
      </section>
    </div>
  )
}

// ── Shared input/result card shells ────────────────────────────────────────

export function CalcCard({
  title,
  children,
  className,
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('bg-surface border border-border rounded-2xl p-6', className)}>
      {title && (
        <h2 className="font-display text-base font-semibold text-text mb-5 pb-4 border-b border-border">
          {title}
        </h2>
      )}
      {children}
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block font-body text-xs font-medium text-text/70 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="font-body text-xs text-muted mt-1">{hint}</p>}
    </div>
  )
}

export function Input({
  value,
  onChange,
  type = 'number',
  prefix,
  suffix,
  min,
  max,
  step,
  placeholder,
}: {
  value: string | number
  onChange: (v: string) => void
  type?: string
  prefix?: string
  suffix?: string
  min?: number
  max?: number
  step?: number
  placeholder?: string
}) {
  return (
    <div className="relative flex items-center">
      {prefix && (
        <span className="absolute left-3 font-mono text-sm text-muted pointer-events-none select-none">
          {prefix}
        </span>
      )}
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full bg-bg border border-border rounded-lg py-2.5 font-mono text-sm text-text',
          'focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20',
          'transition-colors placeholder:text-muted/50',
          prefix ? 'pl-8 pr-3' : 'px-3',
          suffix ? 'pr-10' : '',
        )}
      />
      {suffix && (
        <span className="absolute right-3 font-mono text-sm text-muted pointer-events-none select-none">
          {suffix}
        </span>
      )}
    </div>
  )
}

export function Select({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 font-body text-sm text-text focus:outline-none focus:border-primary/50 transition-colors appearance-none cursor-pointer"
    >
      {children}
    </select>
  )
}

export function Metric({
  label,
  value,
  variant = 'default',
  sub,
}: {
  label: string
  value: string
  variant?: 'default' | 'positive' | 'negative' | 'warning' | 'highlight'
  sub?: string
}) {
  const colors = {
    default:   'text-text',
    positive:  'text-emerald-400',
    negative:  'text-rose-400',
    warning:   'text-amber-400',
    highlight: 'text-primary',
  }
  return (
    <div className="flex flex-col gap-0.5">
      <p className="font-body text-xs text-muted uppercase tracking-wide">{label}</p>
      <p className={cn('font-mono text-xl font-bold', colors[variant])}>{value}</p>
      {sub && <p className="font-body text-xs text-muted">{sub}</p>}
    </div>
  )
}

export function SignalBadge({ signal }: { signal: 'RAISE' | 'LOWER' | 'HOLD' }) {
  const styles = {
    RAISE: 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400',
    LOWER: 'bg-rose-400/10 border-rose-400/30 text-rose-400',
    HOLD:  'bg-amber-400/10 border-amber-400/30 text-amber-400',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border rounded-lg px-3 py-1.5 font-mono text-sm font-bold',
        styles[signal],
      )}
    >
      <span className="w-2 h-2 rounded-full bg-current animate-pulse" aria-hidden="true" />
      {signal}
    </span>
  )
}
```

- [ ] **Step 3: Confirm TypeScript compiles cleanly**

```
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 4: Run full test suite**

```
npm test
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```
git add components/tools/tool-layout.tsx
git commit -m "feat: embed CurrencySelector in ToolLayout, add toolId and headerRight slots"
```

---

## Task 14: Add toolId to All 6 Tool Pages

**Files:**
- Modify: `app/tools/amazon-fba-calculator/page.tsx`
- Modify: `app/tools/shopify-profit-calculator/page.tsx`
- Modify: `app/tools/shipping-calculator/page.tsx`
- Modify: `app/tools/price-position-analyzer/page.tsx`
- Modify: `app/tools/roas-calculator/page.tsx`
- Modify: `app/tools/inventory-reorder-calculator/page.tsx`

Each change is identical in shape: find the `<ToolLayout` opening tag and add `toolId="..."`.

- [ ] **Step 1: Update `app/tools/amazon-fba-calculator/page.tsx`**

Find:
```tsx
    <ToolLayout
      badge="Free FBA Tool"
```

Replace with:
```tsx
    <ToolLayout
      toolId="fba"
      badge="Free FBA Tool"
```

- [ ] **Step 2: Update `app/tools/shopify-profit-calculator/page.tsx`**

Find:
```tsx
    <ToolLayout
      badge="Free Shopify Tool"
```

Replace with:
```tsx
    <ToolLayout
      toolId="shopify"
      badge="Free Shopify Tool"
```

- [ ] **Step 3: Update `app/tools/shipping-calculator/page.tsx`**

Find:
```tsx
    <ToolLayout
      badge="Free Shipping Tool"
```

Replace with:
```tsx
    <ToolLayout
      toolId="shipping"
      badge="Free Shipping Tool"
```

- [ ] **Step 4: Update `app/tools/price-position-analyzer/page.tsx`**

Find:
```tsx
    <ToolLayout
      badge="Free Pricing Tool"
```

Replace with:
```tsx
    <ToolLayout
      toolId="price-position"
      badge="Free Pricing Tool"
```

- [ ] **Step 5: Update `app/tools/roas-calculator/page.tsx`**

Find:
```tsx
    <ToolLayout
      badge="Free Ad Tool"
```

Replace with:
```tsx
    <ToolLayout
      toolId="roas"
      badge="Free Ad Tool"
```

- [ ] **Step 6: Update `app/tools/inventory-reorder-calculator/page.tsx`**

Find:
```tsx
    <ToolLayout
      badge="Free Inventory Tool"
```

Replace with:
```tsx
    <ToolLayout
      toolId="inventory"
      badge="Free Inventory Tool"
```

- [ ] **Step 7: Confirm TypeScript compiles cleanly**

```
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 8: Run full test suite**

```
npm test
```

Expected: all tests PASS

- [ ] **Step 9: Start dev server and verify all 6 tool pages load**

```
npm run dev
```

Open each URL and confirm the currency selector appears and the page loads without console errors:
- http://localhost:3000/tools/amazon-fba-calculator
- http://localhost:3000/tools/shopify-profit-calculator
- http://localhost:3000/tools/shipping-calculator
- http://localhost:3000/tools/price-position-analyzer
- http://localhost:3000/tools/roas-calculator
- http://localhost:3000/tools/inventory-reorder-calculator

- [ ] **Step 10: Commit**

```
git add app/tools/amazon-fba-calculator/page.tsx app/tools/shopify-profit-calculator/page.tsx app/tools/shipping-calculator/page.tsx app/tools/price-position-analyzer/page.tsx app/tools/roas-calculator/page.tsx app/tools/inventory-reorder-calculator/page.tsx
git commit -m "feat: add toolId prop to all 6 tool pages"
```
