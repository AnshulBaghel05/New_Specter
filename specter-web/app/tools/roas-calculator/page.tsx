'use client'

import { useState, useMemo, useEffect } from 'react'
import ToolLayout, {
  CalcCard, Field, Input, Select, Metric,
  ResultVerdict, SupportingMetrics, ToolInsightCard, ToolSection, FullBreakdown,
} from '@/components/tools/tool-layout'
import ShareResult from '@/components/tools/share-result'
import { buildShareUrl, decodeShareState, type RoasShareState } from '@/lib/tools/share'
import ScenarioPanel from '@/components/tools/scenario-panel'
import ExportBar from '@/components/tools/export-bar'
import PrintReport from '@/components/tools/print-report'
import QuickAnswer from '@/components/tools/quick-answer'
import ToolFAQ from '@/components/tools/tool-faq'
import { useCurrency } from '@/hooks/use-currency'
import {
  calcRoas,
  calcFunnel,
  PLATFORM_BENCHMARKS,
  type AdPlatform,
} from '@/lib/tools/roas'
import { roasInsights } from '@/lib/tools/insights'
import { ROAS_SCHEMA } from '@/lib/tools/schema'
import ToolDisclaimer from '@/components/tools/tool-disclaimer'
import type { Scenario } from '@/lib/tools/scenarios'
import { cn } from '@/lib/utils'

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
  const { currency, fmt, fromUSD, toUSD, currencies } = useCurrency()

  // ── Basic ROAS state (the public hero) ────────────────────────────────────
  const [bSpend,       setBSpend]       = useState('1000')
  const [bRevenue,     setBRevenue]     = useState('5000')
  const [bCogs,        setBCogs]        = useState('2500')
  const [bFulfillment, setBFulfillment] = useState('250')

  const bResult = useMemo(() => calcRoas({
    ad_spend:                 toUSD(parseFloat(bSpend)       || 0),
    revenue:                  toUSD(parseFloat(bRevenue)     || 0),
    cogs:                     toUSD(parseFloat(bCogs)        || 0),
    fulfillment_and_shipping: toUSD(parseFloat(bFulfillment) || 0),
  }), [bSpend, bRevenue, bCogs, bFulfillment, toUSD])

  const insight = useMemo(() => roasInsights(bResult), [bResult])

  // Rehydrate from a shared ?s= link so recipients see the exact result.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('s')
    if (!raw) return
    const s = decodeShareState<RoasShareState>(raw)
    if (!s) return
    if (s.sp != null) setBSpend(String(s.sp))
    if (s.rv != null) setBRevenue(String(s.rv))
    if (s.cg != null) setBCogs(String(s.cg))
    if (s.fl != null) setBFulfillment(String(s.fl))
  }, [])

  const shareUrl = buildShareUrl('/tools/roas-calculator', {
    sp: parseFloat(bSpend) || 0,
    rv: parseFloat(bRevenue) || 0,
    cg: parseFloat(bCogs) || 0,
    fl: parseFloat(bFulfillment) || 0,
  } satisfies RoasShareState)
  const shareChallenge = `My ads run at a ${bResult.roas}× ROAS (${bResult.troas}× after costs). Beat it?`

  // ── Funnel state ──────────────────────────────────────────────────────────
  const [platform,    setPlatform]    = useState<AdPlatform>('meta')
  const [impressions, setImpressions] = useState('100000')
  const [ctr,         setCtr]         = useState('1.0')
  const [cpc,         setCpc]         = useState('1.20')
  const [cvr,         setCvr]         = useState('2.0')
  const [aov,         setAov]         = useState('80')
  const [cogsPct,     setCogsPct]     = useState('40')
  const [fulfillPct,  setFulfillPct]  = useState('15')

  const fResult = useMemo(() => calcFunnel({
    platform,
    impressions:     parseFloat(impressions) || 0,
    ctr_pct:         parseFloat(ctr)         || 0,
    cpc_usd:         toUSD(parseFloat(cpc)   || 0),
    cvr_pct:         parseFloat(cvr)         || 0,
    aov_usd:         toUSD(parseFloat(aov)   || 0),
    cogs_pct:        parseFloat(cogsPct)     || 0,
    fulfillment_pct: parseFloat(fulfillPct)  || 0,
  }), [platform, impressions, ctr, cpc, cvr, aov, cogsPct, fulfillPct, toUSD])

  // ── Local-first save/compare (basic ROAS) ─────────────────────────────────
  const basicInputs  = { bSpend, bRevenue, bCogs, bFulfillment }
  const basicResults = { roas: bResult.roas, troas: bResult.troas, net_profit: bResult.net_profit, break_even_roas: bResult.break_even_roas }
  const basicLabels  = { roas: 'ROAS', troas: 'True ROAS', net_profit: 'Net Profit', break_even_roas: 'Break-even ROAS' }

  function loadScenario(s: Scenario) {
    const v = s.inputs as Record<string, string>
    if (v.bSpend       != null) setBSpend(v.bSpend)
    if (v.bRevenue     != null) setBRevenue(v.bRevenue)
    if (v.bCogs        != null) setBCogs(v.bCogs)
    if (v.bFulfillment != null) setBFulfillment(v.bFulfillment)
  }

  const currSymbol = currencies.find(c => c.code === currency)?.symbol ?? '$'

  const exportInputs = [
    { label: 'Ad Spend', value: bSpend }, { label: 'Revenue', value: bRevenue },
    { label: 'COGS', value: bCogs }, { label: 'Fulfillment', value: bFulfillment },
  ]
  const exportResults = [
    { label: 'ROAS', value: String(bResult.roas) }, { label: 'True ROAS', value: String(bResult.troas) },
    { label: 'Net Profit', value: String(bResult.net_profit) }, { label: 'Break-even ROAS', value: String(bResult.break_even_roas) },
  ]

  return (
    <ToolLayout
      toolId="roas"
      toolHref="/tools/roas-calculator"
      badge="Free ROAS Tool"
      title="ROAS & Ad Profitability Calculator"
      description="See instantly whether your ad spend is actually profitable — true ROAS after COGS, break-even point, and net profit — then go deeper with full-funnel analysis."
      headerRight={
        <div className="flex items-center gap-3">
          <ScenarioPanel
            toolId="roas-basic"
            currentInputs={basicInputs}
            currentResults={basicResults}
            currency={currency}
            resultLabels={basicLabels}
            onLoad={loadScenario}
          />
          <ExportBar toolId="roas" inputs={exportInputs} results={exportResults} currency={currency} />
          <ShareResult
            shareUrl={shareUrl}
            toolName="the ROAS Calculator"
            resultSummary={`${bResult.roas}× ROAS · ${fmt(fromUSD(bResult.net_profit))} net profit`}
            challenge={shareChallenge}
          />
        </div>
      }
    >
      <PrintReport
        toolName="ROAS & Ad Profitability Calculator"
        toolId="roas"
        currency={currency}
        inputs={exportInputs}
        results={exportResults}
      />

      <QuickAnswer text={ROAS_SCHEMA.quickAnswer} />

      {/* ── Inputs (compact) ── */}
      <CalcCard title="Campaign spend & revenue">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Ad spend" hint="Total spend for the period">
            <Input value={bSpend} onChange={setBSpend} prefix={currSymbol} min={0} step={0.01} />
          </Field>
          <Field label="Revenue" hint="Total attributed revenue">
            <Input value={bRevenue} onChange={setBRevenue} prefix={currSymbol} min={0} step={0.01} />
          </Field>
          <Field label="COGS" hint="Cost of goods sold">
            <Input value={bCogs} onChange={setBCogs} prefix={currSymbol} min={0} step={0.01} />
          </Field>
          <Field label="Fulfillment & shipping" hint="Variable costs beyond COGS">
            <Input value={bFulfillment} onChange={setBFulfillment} prefix={currSymbol} min={0} step={0.01} />
          </Field>
        </div>
      </CalcCard>

      {/* ── THE ANSWER ── */}
      <div className="mt-6 space-y-6">
        <ResultVerdict
          heroLabel={bResult.is_profitable ? 'Profitable campaign' : 'Unprofitable campaign'}
          hero={`${bResult.roas}×`}
          variant={bResult.is_profitable ? 'positive' : 'negative'}
          whatThisMeans={
            bResult.is_profitable
              ? `Your ${bResult.roas}× ROAS clears the ${bResult.break_even_roas}× you need to break even, so the campaign makes money (${bResult.efficiency_score.toLowerCase()}).`
              : `Your ${bResult.roas}× ROAS is below the ${bResult.break_even_roas}× break-even point, so this campaign is losing money after costs.`
          }
          doThisNext={
            bResult.is_profitable
              ? `Net profit is ${fmt(fromUSD(bResult.net_profit))}. You have room to scale spend while staying above break-even.`
              : `You'd need a ${bResult.break_even_roas}× ROAS to break even — improve conversion/AOV or cut spend.`
          }
        />

        <SupportingMetrics>
          <Metric label="True ROAS" value={`${bResult.troas}×`} sub="gross profit / ad spend" variant={bResult.troas >= 1 ? 'positive' : 'negative'} />
          <Metric label="Break-even ROAS" value={`${bResult.break_even_roas}×`} sub="1 / gross margin" />
          <Metric label="Net profit" value={fmt(fromUSD(bResult.net_profit))} variant={bResult.net_profit >= 0 ? 'positive' : 'negative'} sub="gross profit − ad spend" />
        </SupportingMetrics>

        <ToolInsightCard insight={insight} />

        {/* ── Full breakdown (collapsed, still in DOM) ── */}
        <FullBreakdown label="See the profit breakdown">
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
              <span className="text-muted">= Gross profit</span>
              <span className="text-primary">{fmt(fromUSD(bResult.gross_profit))}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-muted">− Ad spend</span>
              <span className="text-rose-400">−{fmt(fromUSD(parseFloat(bSpend) || 0))}</span>
            </div>
            <div className="flex justify-between pt-2 font-bold">
              <span className="text-text">Net profit</span>
              <span className={bResult.net_profit >= 0 ? 'text-primary' : 'text-rose-400'}>{fmt(fromUSD(bResult.net_profit))}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
            <Metric label="Gross margin" value={`${bResult.gross_margin_pct}%`} sub="after COGS + fulfillment" />
            <Metric label="Efficiency" value={bResult.efficiency_score} />
          </div>
        </FullBreakdown>
      </div>

      {/* ── Deeper analyses (collapsed; promoted to the Workspace later) ── */}
      <div className="mt-6 space-y-4">
        {/* Funnel analysis */}
        <ToolSection title="Full-funnel analysis" subtitle="Model impressions → clicks → conversions and benchmark against your ad platform">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-5">
              <CalcCard title="Platform & traffic">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Field label="Ad platform">
                      <Select value={platform} onChange={v => setPlatform(v as AdPlatform)}>
                        {PLATFORM_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </Select>
                    </Field>
                  </div>
                  <Field label="Impressions">
                    <Input value={impressions} onChange={setImpressions} min={0} step={1000} />
                  </Field>
                  <Field label="CTR %" hint="Click-through rate">
                    <Input value={ctr} onChange={setCtr} suffix="%" min={0} max={100} step={0.1} />
                  </Field>
                  <Field label="CPC" hint="Cost per click">
                    <Input value={cpc} onChange={setCpc} prefix={currSymbol} min={0} step={0.01} />
                  </Field>
                  <Field label="CVR %" hint="Conversion rate (% of clicks)">
                    <Input value={cvr} onChange={setCvr} suffix="%" min={0} max={100} step={0.1} />
                  </Field>
                </div>
              </CalcCard>
              <CalcCard title="Economics">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Avg order value">
                    <Input value={aov} onChange={setAov} prefix={currSymbol} min={0} step={0.01} />
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
              <CalcCard title="Funnel">
                <div className="space-y-1">
                  {[
                    { label: 'Impressions', value: (parseFloat(impressions) || 0).toLocaleString(), sub: 'ad views' },
                    { label: 'Clicks', value: fResult.clicks.toLocaleString(), sub: `CTR ${ctr}%` },
                    { label: 'Conversions', value: fResult.conversions.toLocaleString(), sub: `CVR ${cvr}%` },
                    { label: 'Revenue', value: fmt(fromUSD(fResult.revenue)), sub: `AOV ${fmt(fromUSD(parseFloat(aov) || 0))}` },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={cn('w-1.5 rounded-full', i === 3 ? 'bg-primary h-10' : 'bg-border h-8')} />
                      <div className="flex-1 flex justify-between items-center py-1.5 border-b border-border last:border-0">
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
                <Metric label="Ad spend" value={fmt(fromUSD(fResult.ad_spend))} sub={`${fResult.clicks.toLocaleString()} clicks`} />
                <Metric label="CPA" value={fmt(fromUSD(fResult.cpa))} sub="cost per conversion" />
                <Metric label="Net profit" value={fmt(fromUSD(fResult.net_profit))} variant={fResult.net_profit >= 0 ? 'positive' : 'negative'} sub="gross profit − spend" />
                <Metric label="Break-even CVR" value={`${fResult.break_even_cvr_pct}%`} sub="min CVR to profit" />
              </div>

              <CalcCard title={`vs ${fResult.benchmark.label} benchmarks`}>
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
        </ToolSection>

        {/* Platform benchmarks table */}
        <ToolSection title="Platform benchmarks — industry averages" subtitle="Typical ROAS, CTR, CVR and CPC by ad channel">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-border text-muted text-left">
                  <th className="pb-2 font-body font-medium">Platform</th>
                  <th className="pb-2 font-body font-medium text-right">ROAS range</th>
                  <th className="pb-2 font-body font-medium text-right">Avg CTR</th>
                  <th className="pb-2 font-body font-medium text-right">Avg CVR</th>
                  <th className="pb-2 font-body font-medium text-right">Avg CPC</th>
                </tr>
              </thead>
              <tbody>
                {PLATFORM_BENCHMARKS.map(b => (
                  <tr key={b.platform} className={cn('border-b border-border/50 last:border-0', b.platform === platform ? 'bg-primary/5' : '')}>
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
        </ToolSection>
      </div>

      {/* ── Educational content (collapsed, in DOM for AEO) ── */}
      <div className="mt-6">
        <ToolSection title="How ROAS and break-even ROAS work" subtitle="The difference between ROAS, true ROAS and the number that actually matters">
          <div className="space-y-5 font-body text-sm text-muted leading-relaxed">
            <div>
              <h3 className="font-display text-base font-semibold text-text mb-1.5">ROAS vs true ROAS</h3>
              <p>
                <span className="text-text font-medium">ROAS = revenue ÷ ad spend.</span> It ignores what the product
                actually cost you. <span className="text-text font-medium">True ROAS = gross profit ÷ ad spend</span> —
                this is the number that tells you whether the campaign made money. A 5× ROAS on a 20% margin product is
                only a 1.0× true ROAS, i.e. break-even.
              </p>
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-text mb-1.5">Break-even ROAS</h3>
              <p className="font-mono text-xs text-text bg-bg border border-border rounded-lg px-3 py-2 inline-block">
                Break-even ROAS = 1 ÷ gross margin
              </p>
              <p className="mt-2">
                <span className="text-text">Worked example:</span> a product sold at $100 that costs $35 to make and ship
                has a 65% gross margin, so break-even ROAS = 1 ÷ 0.65 ≈ <span className="text-text font-medium">1.54×</span>.
                Any campaign above 1.54× is profitable; below it loses money.
              </p>
            </div>
          </div>
        </ToolSection>
      </div>

      <ToolFAQ items={ROAS_SCHEMA.faqItems} />

      <ToolDisclaimer toolSpecific="Platform benchmark data (ROAS, CTR, CVR, CPC) is based on published industry averages and may differ significantly from your actual campaign performance. Ad platform algorithms, audience targeting, creative quality, and market conditions all affect real results." />
    </ToolLayout>
  )
}
