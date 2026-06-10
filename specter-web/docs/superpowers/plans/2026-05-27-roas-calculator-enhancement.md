# ROAS Calculator Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the ROAS calculator with a full funnel model (`calcFunnel`), platform benchmarks for 6 ad platforms, and a break-even CVR calculator; rebuild the page as a 2-tab UI (Basic ROAS | Funnel Analysis) with a Platform Benchmarks card pinned below both tabs, plus full `useCurrency` / `ScenarioPanel` / `ExportBar` / `PrintReport` parity.

**Architecture:** Two new exported items added to `lib/tools/roas.ts` alongside existing `calcRoas`: the `PLATFORM_BENCHMARKS` constant and `calcFunnel` function (with supporting types). Page `app/tools/roas-calculator/page.tsx` is fully rewritten as a 2-tab switcher. Existing `calcRoas` stays unchanged.

**Tech Stack:** TypeScript strict, Vitest, existing tool-layout primitives (`CalcCard`, `Field`, `Input`, `Select`, `Metric`), `useCurrency` hook, `ScenarioPanel`, `ExportBar`, `PrintReport`.

---

## File Map

| File | Change |
|------|--------|
| `lib/tools/roas.ts` | Append `AdPlatform`, `PlatformBenchmark`, `PLATFORM_BENCHMARKS`, `FunnelInput`, `FunnelResult`, `calcFunnel` |
| `__tests__/tools/roas.test.ts` | Append `describe('calcFunnel', ...)` — 12 tests |
| `app/tools/roas-calculator/page.tsx` | Full rewrite — 2 tabs, currency, scenarios, export, benchmarks card |

---

### Task 1: `calcFunnel` — types, benchmark data, function, tests

**Files:**
- Modify: `lib/tools/roas.ts` — append after existing `round1` function
- Modify: `__tests__/tools/roas.test.ts` — append new `describe` block

---

- [ ] **Step 1: Write 12 failing tests in `__tests__/tools/roas.test.ts`**

Append after the existing `calcRoas` describe block:

```ts
import { describe, it, expect } from 'vitest'
import {
  calcRoas, calcBreakEvenRoas,
  calcFunnel, PLATFORM_BENCHMARKS,
} from '@/lib/tools/roas'
```

Update the import line at the top of the file to include `calcFunnel` and `PLATFORM_BENCHMARKS`, then append:

```ts
describe('calcFunnel', () => {
  const base = {
    platform: 'meta' as const,
    impressions: 100_000,
    ctr_pct: 1.0,
    cpc_usd: 1.20,
    cvr_pct: 2.0,
    aov_usd: 80,
    cogs_pct: 40,
    fulfillment_pct: 15,
  }
  // clicks = round(100000 × 1.0 / 100) = 1000
  // ad_spend = 1000 × 1.20 = 1200
  // conversions = round(1000 × 2.0 / 100) = 20
  // revenue = 20 × 80 = 1600
  // gross_margin = 1 - 0.40 - 0.15 = 0.45
  // gross_profit = 1600 × 0.45 = 720
  // roas = 1600 / 1200 = 1.33
  // cpa = 1200 / 20 = 60
  // break_even_cvr_pct = 1.20 / (80 × 0.45) × 100 = 3.33

  it('clicks = round(impressions × ctr/100)', () => {
    expect(calcFunnel(base).clicks).toBe(1000)
  })

  it('ad_spend = clicks × cpc', () => {
    expect(calcFunnel(base).ad_spend).toBe(1200)
  })

  it('conversions = round(clicks × cvr/100)', () => {
    expect(calcFunnel(base).conversions).toBe(20)
  })

  it('revenue = conversions × aov', () => {
    expect(calcFunnel(base).revenue).toBe(1600)
  })

  it('roas = revenue / ad_spend', () => {
    expect(calcFunnel(base).roas).toBeCloseTo(1.33, 1)
  })

  it('gross_profit = revenue × gross_margin (cogs=40%, fulfillment=15%)', () => {
    expect(calcFunnel(base).gross_profit).toBe(720)
  })

  it('cpa = ad_spend / conversions', () => {
    expect(calcFunnel(base).cpa).toBe(60)
  })

  it('break_even_cvr_pct = cpc / (aov × gross_margin) × 100', () => {
    // 1.20 / (80 × 0.45) × 100 = 3.33
    expect(calcFunnel(base).break_even_cvr_pct).toBeCloseTo(3.33, 1)
  })

  it('roas_vs_benchmark = "below" for Meta when roas < 2.0', () => {
    // base roas = 1.33 < meta avg_roas_low 2.0
    expect(calcFunnel(base).roas_vs_benchmark).toBe('below')
  })

  it('ctr_vs_benchmark = "in_range" for Meta when ctr = 1.1%', () => {
    const r = calcFunnel({ ...base, ctr_pct: 1.1 })
    // meta avg_ctr_pct = 1.1 — exactly at low, still "in_range"
    expect(r.ctr_vs_benchmark).toBe('in_range')
  })

  it('roas_vs_benchmark = "above" for Email when roas = 50', () => {
    // email avg_roas_high = 40.0; roas=50 → above
    const r = calcFunnel({
      ...base,
      platform: 'email',
      impressions: 10_000,
      ctr_pct: 3.0,
      cpc_usd: 0.05,
      cvr_pct: 5.0,
      aov_usd: 500,
    })
    expect(r.roas_vs_benchmark).toBe('above')
  })

  it('ad_spend=0 edge case: roas=0, troas=0, cpa=0', () => {
    const r = calcFunnel({ ...base, cpc_usd: 0 })
    expect(r.roas).toBe(0)
    expect(r.troas).toBe(0)
    expect(r.cpa).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run __tests__/tools/roas.test.ts
```

Expected: `calcFunnel` and `PLATFORM_BENCHMARKS` not found — import errors or failures on the new tests.

- [ ] **Step 3: Append types, benchmark data, and `calcFunnel` to `lib/tools/roas.ts`**

Append after the existing `function round1` line at the bottom of `lib/tools/roas.ts`:

```ts
// ── Funnel model ─────────────────────────────────────────────────────────────

export type AdPlatform = 'meta' | 'google_shopping' | 'google_search' | 'tiktok' | 'amazon' | 'email'

export interface PlatformBenchmark {
  platform: AdPlatform
  label: string
  avg_roas_low: number
  avg_roas_high: number
  avg_ctr_pct: number
  avg_cvr_pct: number
  avg_cpc_usd: number
}

export const PLATFORM_BENCHMARKS: PlatformBenchmark[] = [
  { platform: 'meta',            label: 'Meta (Facebook/Instagram)', avg_roas_low: 2.0,  avg_roas_high: 5.0,  avg_ctr_pct: 1.1, avg_cvr_pct: 1.5,  avg_cpc_usd: 1.20 },
  { platform: 'google_shopping', label: 'Google Shopping',           avg_roas_low: 3.0,  avg_roas_high: 8.0,  avg_ctr_pct: 0.6, avg_cvr_pct: 3.0,  avg_cpc_usd: 0.85 },
  { platform: 'google_search',   label: 'Google Search',             avg_roas_low: 2.0,  avg_roas_high: 4.0,  avg_ctr_pct: 1.5, avg_cvr_pct: 3.5,  avg_cpc_usd: 1.75 },
  { platform: 'tiktok',          label: 'TikTok Ads',                avg_roas_low: 1.5,  avg_roas_high: 3.0,  avg_ctr_pct: 1.5, avg_cvr_pct: 1.0,  avg_cpc_usd: 0.60 },
  { platform: 'amazon',          label: 'Amazon Ads (PPC)',          avg_roas_low: 3.0,  avg_roas_high: 8.0,  avg_ctr_pct: 0.4, avg_cvr_pct: 10.0, avg_cpc_usd: 1.20 },
  { platform: 'email',           label: 'Email Marketing',           avg_roas_low: 15.0, avg_roas_high: 40.0, avg_ctr_pct: 3.0, avg_cvr_pct: 5.0,  avg_cpc_usd: 0.05 },
]

export interface FunnelInput {
  platform: AdPlatform
  impressions: number
  ctr_pct: number
  cpc_usd: number
  cvr_pct: number
  aov_usd: number
  cogs_pct: number
  fulfillment_pct: number
}

export interface FunnelResult {
  clicks: number
  ad_spend: number
  conversions: number
  revenue: number
  roas: number
  troas: number
  cpa: number
  gross_profit: number
  net_profit: number
  break_even_roas: number
  break_even_cvr_pct: number
  gross_margin_pct: number
  benchmark: PlatformBenchmark
  roas_vs_benchmark: 'below' | 'in_range' | 'above'
  ctr_vs_benchmark: 'below' | 'in_range' | 'above'
  cvr_vs_benchmark: 'below' | 'in_range' | 'above'
}

export function calcFunnel(input: FunnelInput): FunnelResult {
  const { platform, impressions, ctr_pct, cpc_usd, cvr_pct, aov_usd, cogs_pct, fulfillment_pct } = input

  const clicks = Math.round(impressions * ctr_pct / 100)
  const ad_spend = round2(clicks * cpc_usd)
  const conversions = Math.round(clicks * cvr_pct / 100)
  const revenue = round2(conversions * aov_usd)
  const gross_margin = 1 - cogs_pct / 100 - fulfillment_pct / 100
  const gross_profit = round2(revenue * gross_margin)
  const net_profit = round2(gross_profit - ad_spend)
  const roas = ad_spend > 0 ? round2(revenue / ad_spend) : 0
  const troas = ad_spend > 0 ? round2(gross_profit / ad_spend) : 0
  const cpa = conversions > 0 ? round2(ad_spend / conversions) : 0
  const break_even_roas = gross_margin > 0 ? round2(1 / gross_margin) : 0
  const break_even_cvr_pct =
    aov_usd > 0 && gross_margin > 0
      ? round2(cpc_usd / (aov_usd * gross_margin) * 100)
      : 0
  const gross_margin_pct = round1(gross_margin * 100)

  const benchmark = PLATFORM_BENCHMARKS.find(p => p.platform === platform)!

  function vsRange(val: number, low: number, high: number): 'below' | 'in_range' | 'above' {
    if (val < low) return 'below'
    if (val > high) return 'above'
    return 'in_range'
  }

  return {
    clicks,
    ad_spend,
    conversions,
    revenue,
    roas,
    troas,
    cpa,
    gross_profit,
    net_profit,
    break_even_roas,
    break_even_cvr_pct,
    gross_margin_pct,
    benchmark,
    roas_vs_benchmark: vsRange(roas, benchmark.avg_roas_low, benchmark.avg_roas_high),
    ctr_vs_benchmark:  vsRange(ctr_pct, benchmark.avg_ctr_pct * 0.8, benchmark.avg_ctr_pct * 1.2),
    cvr_vs_benchmark:  vsRange(cvr_pct, benchmark.avg_cvr_pct * 0.8, benchmark.avg_cvr_pct * 1.2),
  }
}
```

> **Note on benchmark ranges for CTR/CVR:** The spec says "same pattern" as ROAS but PLATFORM_BENCHMARKS has single values (not low/high) for CTR and CVR. Use ±20% of the benchmark value as the in-range band (e.g., avg_ctr_pct × 0.8 to avg_ctr_pct × 1.2).

- [ ] **Step 4: Run tests — all 12 new tests must pass**

```bash
npx vitest run __tests__/tools/roas.test.ts
```

Expected: All tests pass (existing 10 + new 12 = 22 total).

- [ ] **Step 5: Commit**

```bash
git add lib/tools/roas.ts __tests__/tools/roas.test.ts
git commit -m "feat(roas): add calcFunnel, PLATFORM_BENCHMARKS, FunnelInput/Result types"
```

---

### Task 2: Page rewrite — 2-tab UI with benchmarks card

**Files:**
- Modify: `app/tools/roas-calculator/page.tsx` — full rewrite

---

- [ ] **Step 1: Rewrite `app/tools/roas-calculator/page.tsx`**

Replace the entire file with:

```tsx
'use client'

import { useState, useMemo } from 'react'
import ToolLayout, { CalcCard, Field, Input, Select, Metric } from '@/components/tools/tool-layout'
import ScenarioPanel from '@/components/tools/scenario-panel'
import ExportBar from '@/components/tools/export-bar'
import { useCurrency } from '@/hooks/use-currency'
import {
  calcRoas,
  calcFunnel,
  PLATFORM_BENCHMARKS,
  type AdPlatform,
} from '@/lib/tools/roas'
import type { Scenario } from '@/lib/tools/scenarios'
import { cn } from '@/lib/utils'

type Tab = 'basic' | 'funnel'

const PLATFORM_OPTIONS: { value: AdPlatform; label: string }[] = [
  { value: 'meta',            label: 'Meta (Facebook/Instagram)' },
  { value: 'google_shopping', label: 'Google Shopping' },
  { value: 'google_search',   label: 'Google Search' },
  { value: 'tiktok',          label: 'TikTok Ads' },
  { value: 'amazon',          label: 'Amazon Ads (PPC)' },
  { value: 'email',           label: 'Email Marketing' },
]

const BADGE_CLASS: Record<'below' | 'in_range' | 'above', string> = {
  below:    'bg-rose-400/10 text-rose-400 border border-rose-400/20',
  in_range: 'bg-primary/10 text-primary border border-primary/20',
  above:    'bg-amber-400/10 text-amber-400 border border-amber-400/20',
}
const BADGE_LABEL: Record<'below' | 'in_range' | 'above', string> = {
  below: 'Below avg', in_range: 'On target', above: 'Above avg',
}

export default function RoasCalculatorPage() {
  const [tab, setTab] = useState<Tab>('basic')
  const { currency, setCurrency, fmt, fromUSD, toUSD, currencies } = useCurrency()

  // ── Basic ROAS state ──────────────────────────────────────────────────────
  const [bSpend,       setBSpend]       = useState('1000')
  const [bRevenue,     setBRevenue]     = useState('5000')
  const [bCogs,        setBCogs]        = useState('2500')
  const [bFulfillment, setBFulfillment] = useState('250')

  const bResult = useMemo(() => calcRoas({
    ad_spend:              toUSD(parseFloat(bSpend)       || 0),
    revenue:               toUSD(parseFloat(bRevenue)     || 0),
    cogs:                  toUSD(parseFloat(bCogs)        || 0),
    fulfillment_and_shipping: toUSD(parseFloat(bFulfillment) || 0),
  }), [bSpend, bRevenue, bCogs, bFulfillment, toUSD])

  // ── Funnel state ──────────────────────────────────────────────────────────
  const [platform,     setPlatform]    = useState<AdPlatform>('meta')
  const [impressions,  setImpressions] = useState('100000')
  const [ctr,          setCtr]         = useState('1.0')
  const [cpc,          setCpc]         = useState('1.20')
  const [cvr,          setCvr]         = useState('2.0')
  const [aov,          setAov]         = useState('80')
  const [cogsPct,      setCogsPct]     = useState('40')
  const [fulfillPct,   setFulfillPct]  = useState('15')

  const fResult = useMemo(() => calcFunnel({
    platform,
    impressions:     parseFloat(impressions)  || 0,
    ctr_pct:         parseFloat(ctr)          || 0,
    cpc_usd:         toUSD(parseFloat(cpc)    || 0),
    cvr_pct:         parseFloat(cvr)          || 0,
    aov_usd:         toUSD(parseFloat(aov)    || 0),
    cogs_pct:        parseFloat(cogsPct)      || 0,
    fulfillment_pct: parseFloat(fulfillPct)   || 0,
  }), [platform, impressions, ctr, cpc, cvr, aov, cogsPct, fulfillPct, toUSD])

  // ── Scenario wiring ───────────────────────────────────────────────────────
  const basicInputs  = { bSpend, bRevenue, bCogs, bFulfillment }
  const basicResults = { roas: bResult.roas, troas: bResult.troas, net_profit: bResult.net_profit, break_even_roas: bResult.break_even_roas }
  const basicLabels  = { roas: 'ROAS', troas: 'True ROAS', net_profit: 'Net Profit', break_even_roas: 'Break-even ROAS' }

  const funnelInputs  = { platform, impressions, ctr, cpc, cvr, aov, cogsPct, fulfillPct }
  const funnelResults = { roas: fResult.roas, troas: fResult.troas, cpa: fResult.cpa, net_profit: fResult.net_profit, break_even_cvr_pct: fResult.break_even_cvr_pct }
  const funnelLabels  = { roas: 'ROAS', troas: 'True ROAS', cpa: 'CPA', net_profit: 'Net Profit', break_even_cvr_pct: 'Break-even CVR %' }

  function loadScenario(s: Scenario) {
    const v = s.inputs as Record<string, string>
    if (tab === 'basic') {
      if (v.bSpend       != null) setBSpend(v.bSpend)
      if (v.bRevenue     != null) setBRevenue(v.bRevenue)
      if (v.bCogs        != null) setBCogs(v.bCogs)
      if (v.bFulfillment != null) setBFulfillment(v.bFulfillment)
    } else {
      if (v.platform     != null) setPlatform(v.platform as AdPlatform)
      if (v.impressions  != null) setImpressions(v.impressions)
      if (v.ctr          != null) setCtr(v.ctr)
      if (v.cpc          != null) setCpc(v.cpc)
      if (v.cvr          != null) setCvr(v.cvr)
      if (v.aov          != null) setAov(v.aov)
      if (v.cogsPct      != null) setCogsPct(v.cogsPct)
      if (v.fulfillPct   != null) setFulfillPct(v.fulfillPct)
    }
  }

  const exportInputs = tab === 'basic'
    ? [{ label: 'Ad Spend', value: bSpend }, { label: 'Revenue', value: bRevenue }, { label: 'COGS', value: bCogs }, { label: 'Fulfillment', value: bFulfillment }]
    : [{ label: 'Platform', value: platform }, { label: 'Impressions', value: impressions }, { label: 'CTR %', value: ctr }, { label: 'CPC', value: cpc }, { label: 'CVR %', value: cvr }, { label: 'AOV', value: aov }, { label: 'COGS %', value: cogsPct }, { label: 'Fulfillment %', value: fulfillPct }]

  const exportResults = tab === 'basic'
    ? [{ label: 'ROAS', value: String(bResult.roas) }, { label: 'True ROAS', value: String(bResult.troas) }, { label: 'Net Profit', value: String(bResult.net_profit) }, { label: 'Break-even ROAS', value: String(bResult.break_even_roas) }]
    : [{ label: 'ROAS', value: String(fResult.roas) }, { label: 'True ROAS', value: String(fResult.troas) }, { label: 'CPA', value: String(fResult.cpa) }, { label: 'Net Profit', value: String(fResult.net_profit) }, { label: 'Break-even CVR %', value: String(fResult.break_even_cvr_pct) }]

  return (
    <ToolLayout
      toolId={`roas-${tab}`}
      badge="Free ROAS Tool"
      title="ROAS & Ad Profitability Calculator"
      description="Calculate your Return on Ad Spend, true ROAS after COGS, break-even points, and full funnel performance benchmarked against industry averages."
      headerRight={
        <div className="flex items-center gap-3">
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className="font-mono text-xs bg-surface border border-border rounded-lg px-2 py-1 text-muted"
          >
            {currencies.map(c => <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>)}
          </select>
          <ScenarioPanel
            toolId={`roas-${tab}`}
            currentInputs={tab === 'basic' ? basicInputs : funnelInputs}
            currentResults={tab === 'basic' ? basicResults : funnelResults}
            currency={currency}
            resultLabels={tab === 'basic' ? basicLabels : funnelLabels}
            onLoad={loadScenario}
          />
          <ExportBar toolId={`roas-${tab}`} inputs={exportInputs} results={exportResults} currency={currency} />
        </div>
      }
    >
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-surface rounded-xl border border-border w-fit mb-6">
        {(['basic', 'funnel'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-lg font-body text-sm transition-all',
              tab === t ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted hover:text-text',
            )}
          >
            {t === 'basic' ? 'Basic ROAS' : 'Funnel Analysis'}
          </button>
        ))}
      </div>

      {/* ── Basic ROAS tab ─────────────────────────────────────────────────── */}
      {tab === 'basic' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-5">
            <CalcCard title="Campaign Spend & Revenue">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Ad Spend" hint="Total spend for the period">
                  <Input value={bSpend} onChange={setBSpend} prefix={currencies.find(c => c.code === currency)?.symbol ?? '$'} min={0} step={0.01} />
                </Field>
                <Field label="Revenue" hint="Total attributed revenue">
                  <Input value={bRevenue} onChange={setBRevenue} prefix={currencies.find(c => c.code === currency)?.symbol ?? '$'} min={0} step={0.01} />
                </Field>
                <Field label="COGS" hint="Cost of goods sold">
                  <Input value={bCogs} onChange={setBCogs} prefix={currencies.find(c => c.code === currency)?.symbol ?? '$'} min={0} step={0.01} />
                </Field>
                <Field label="Fulfillment & Shipping" hint="Variable costs beyond COGS">
                  <Input value={bFulfillment} onChange={setBFulfillment} prefix={currencies.find(c => c.code === currency)?.symbol ?? '$'} min={0} step={0.01} />
                </Field>
              </div>
            </CalcCard>
          </div>

          <div className="flex flex-col gap-5">
            <CalcCard>
              <div className="text-center py-2">
                <p className="font-body text-xs text-muted uppercase tracking-widest mb-2">ROAS</p>
                <p className={cn('font-display text-5xl font-bold mb-1', bResult.is_profitable ? 'text-primary' : 'text-rose-400')}>
                  {bResult.roas}×
                </p>
                <p className="font-mono text-sm text-muted">{bResult.efficiency_score}</p>
              </div>
            </CalcCard>
            <div className="grid grid-cols-2 gap-4">
              <Metric label="True ROAS" value={`${bResult.troas}×`} sub="gross profit / ad spend" variant={bResult.troas >= 1 ? 'positive' : 'negative'} />
              <Metric label="Break-even ROAS" value={`${bResult.break_even_roas}×`} sub="1 / gross margin" />
              <Metric label="Net Profit" value={fmt(fromUSD(bResult.net_profit))} variant={bResult.net_profit >= 0 ? 'positive' : 'negative'} sub="gross profit − ad spend" />
              <Metric label="Gross Margin" value={`${bResult.gross_margin_pct}%`} sub="after COGS + fulfillment" />
            </div>
            <CalcCard title="Profit Breakdown">
              <div className="space-y-2 text-sm font-mono">
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted">Revenue</span>
                  <span className="text-text">{fmt(fromUSD(parseFloat(bRevenue) || 0))}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted">− COGS</span>
                  <span className="text-rose-400">−{fmt(fromUSD(parseFloat(bCogs) || 0))}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted">− Fulfillment</span>
                  <span className="text-rose-400">−{fmt(fromUSD(parseFloat(bFulfillment) || 0))}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted">= Gross Profit</span>
                  <span className="text-primary">{fmt(fromUSD(bResult.gross_profit))}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted">− Ad Spend</span>
                  <span className="text-rose-400">−{fmt(fromUSD(parseFloat(bSpend) || 0))}</span>
                </div>
                <div className="flex justify-between pt-2 font-bold">
                  <span className="text-text">Net Profit</span>
                  <span className={bResult.net_profit >= 0 ? 'text-primary' : 'text-rose-400'}>{fmt(fromUSD(bResult.net_profit))}</span>
                </div>
              </div>
            </CalcCard>
          </div>
        </div>
      )}

      {/* ── Funnel Analysis tab ────────────────────────────────────────────── */}
      {tab === 'funnel' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-5">
            <CalcCard title="Platform & Traffic">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Ad Platform" className="col-span-2">
                  <Select value={platform} onChange={v => setPlatform(v as AdPlatform)}>
                    {PLATFORM_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </Select>
                </Field>
                <Field label="Impressions">
                  <Input value={impressions} onChange={setImpressions} min={0} step={1000} />
                </Field>
                <Field label="CTR %" hint="Click-through rate">
                  <Input value={ctr} onChange={setCtr} suffix="%" min={0} max={100} step={0.1} />
                </Field>
                <Field label="CPC" hint="Cost per click">
                  <Input value={cpc} onChange={setCpc} prefix={currencies.find(c => c.code === currency)?.symbol ?? '$'} min={0} step={0.01} />
                </Field>
                <Field label="CVR %" hint="Conversion rate (% of clicks)">
                  <Input value={cvr} onChange={setCvr} suffix="%" min={0} max={100} step={0.1} />
                </Field>
              </div>
            </CalcCard>
            <CalcCard title="Economics">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Avg Order Value">
                  <Input value={aov} onChange={setAov} prefix={currencies.find(c => c.code === currency)?.symbol ?? '$'} min={0} step={0.01} />
                </Field>
                <Field label="COGS %" hint="% of revenue">
                  <Input value={cogsPct} onChange={setCogsPct} suffix="%" min={0} max={100} step={1} />
                </Field>
                <Field label="Fulfillment %" hint="Shipping + fees as % of revenue">
                  <Input value={fulfillPct} onChange={setFulfillPct} suffix="%" min={0} max={100} step={1} />
                </Field>
              </div>
            </CalcCard>
          </div>

          <div className="flex flex-col gap-5">
            {/* Funnel flow */}
            <CalcCard title="Funnel">
              <div className="space-y-1">
                {[
                  { label: 'Impressions', value: fResult.clicks > 0 ? parseInt(impressions).toLocaleString() : '0', sub: 'ad views' },
                  { label: 'Clicks', value: fResult.clicks.toLocaleString(), sub: `CTR ${ctr}%` },
                  { label: 'Conversions', value: fResult.conversions.toLocaleString(), sub: `CVR ${cvr}%` },
                  { label: 'Revenue', value: fmt(fromUSD(fResult.revenue)), sub: `AOV ${fmt(fromUSD(parseFloat(aov) || 0))}` },
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={cn('w-1.5 rounded-full', i === 3 ? 'bg-primary h-10' : 'bg-border h-8')} />
                    <div className="flex-1 flex justify-between items-center py-1.5 border-b border-border">
                      <div>
                        <p className="font-body text-sm text-text">{row.label}</p>
                        <p className="font-body text-xs text-muted">{row.sub}</p>
                      </div>
                      <span className="font-mono text-sm text-text">{row.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CalcCard>

            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                <p className="font-body text-xs text-muted uppercase tracking-wide mb-1">ROAS</p>
                <p className="font-mono text-3xl font-bold text-primary">{fResult.roas}×</p>
                <span className={cn('font-mono text-xs px-2 py-0.5 rounded-full mt-1 inline-block', BADGE_CLASS[fResult.roas_vs_benchmark])}>
                  {BADGE_LABEL[fResult.roas_vs_benchmark]}
                </span>
              </div>
              <div className="bg-surface border border-border rounded-xl p-4 text-center">
                <p className="font-body text-xs text-muted uppercase tracking-wide mb-1">True ROAS</p>
                <p className={cn('font-mono text-3xl font-bold', fResult.troas >= 1 ? 'text-primary' : 'text-rose-400')}>{fResult.troas}×</p>
                <p className="font-body text-xs text-muted mt-1">gross profit / spend</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Metric label="Ad Spend" value={fmt(fromUSD(fResult.ad_spend))} sub={`${fResult.clicks.toLocaleString()} clicks`} />
              <Metric label="CPA" value={fmt(fromUSD(fResult.cpa))} sub="cost per conversion" />
              <Metric label="Net Profit" value={fmt(fromUSD(fResult.net_profit))} variant={fResult.net_profit >= 0 ? 'positive' : 'negative'} sub="gross profit − spend" />
              <Metric label="Break-even CVR" value={`${fResult.break_even_cvr_pct}%`} sub="min CVR to profit" />
            </div>

            {/* Benchmark comparison */}
            <CalcCard title={`vs ${fResult.benchmark.label} Benchmarks`}>
              <div className="space-y-3">
                {[
                  { label: 'ROAS', yours: `${fResult.roas}×`, avg: `${fResult.benchmark.avg_roas_low}–${fResult.benchmark.avg_roas_high}×`, status: fResult.roas_vs_benchmark },
                  { label: 'CTR', yours: `${ctr}%`, avg: `${fResult.benchmark.avg_ctr_pct}%`, status: fResult.ctr_vs_benchmark },
                  { label: 'CVR', yours: `${cvr}%`, avg: `${fResult.benchmark.avg_cvr_pct}%`, status: fResult.cvr_vs_benchmark },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <div>
                      <p className="font-body text-sm text-text">{row.label}</p>
                      <p className="font-body text-xs text-muted">Avg: {row.avg}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-text">{row.yours}</p>
                      <span className={cn('font-mono text-xs px-2 py-0.5 rounded-full', BADGE_CLASS[row.status])}>
                        {BADGE_LABEL[row.status]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CalcCard>
          </div>
        </div>
      )}

      {/* ── Platform Benchmarks card (always visible) ─────────────────────── */}
      <div className="mt-8">
        <CalcCard title="Platform Benchmarks — Industry Averages">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-border text-muted text-left">
                  <th className="pb-2 font-body font-medium">Platform</th>
                  <th className="pb-2 font-body font-medium text-right">ROAS Range</th>
                  <th className="pb-2 font-body font-medium text-right">Avg CTR</th>
                  <th className="pb-2 font-body font-medium text-right">Avg CVR</th>
                  <th className="pb-2 font-body font-medium text-right">Avg CPC</th>
                </tr>
              </thead>
              <tbody>
                {PLATFORM_BENCHMARKS.map(b => (
                  <tr key={b.platform} className={cn(
                    'border-b border-border/50 last:border-0',
                    tab === 'funnel' && b.platform === platform ? 'bg-primary/5' : '',
                  )}>
                    <td className="py-2 font-body text-text">{b.label}</td>
                    <td className="py-2 text-right text-text">{b.avg_roas_low}–{b.avg_roas_high}×</td>
                    <td className="py-2 text-right text-muted">{b.avg_ctr_pct}%</td>
                    <td className="py-2 text-right text-muted">{b.avg_cvr_pct}%</td>
                    <td className="py-2 text-right text-muted">${b.avg_cpc_usd.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CalcCard>
      </div>
    </ToolLayout>
  )
}
```

- [ ] **Step 2: Check TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors. If `ToolLayout` doesn't accept `headerRight` prop, check `components/tools/tool-layout.tsx` — previous shipping calculator used it, so it exists. If there are type issues with `currencies.find()` returning undefined, add a fallback: `currencies.find(c => c.code === currency)?.symbol ?? '$'` (already included above).

- [ ] **Step 3: Run all tests**

```bash
npx vitest run __tests__/tools/roas.test.ts
```

Expected: 22 tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/tools/roas-calculator/page.tsx
git commit -m "feat(roas): rewrite page as 2-tab UI — Basic ROAS, Funnel Analysis, Platform Benchmarks"
```
