'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import ToolLayout, {
  CalcCard, Field, Input, Metric, SignalBadge,
} from '@/components/tools/tool-layout'
import ScenarioPanel from '@/components/tools/scenario-panel'
import ExportBar from '@/components/tools/export-bar'
import PrintReport from '@/components/tools/print-report'
import ToolDisclaimer from '@/components/tools/tool-disclaimer'
import ToolFAQ from '@/components/tools/tool-faq'
import { useCurrency } from '@/hooks/use-currency'
import { calcPricePosition, type Competitor } from '@/lib/tools/price-position'
import type { Scenario } from '@/lib/tools/scenarios'
import { cn } from '@/lib/utils'
import AdvancedAccordion from '@/components/tools/advanced-accordion'
import LockedSection from '@/components/tools/locked-section'
import EmailCaptureGate from '@/components/tools/email-capture-gate'
import LiveCompetitorCount from '@/components/tools/live-competitor-count'
import DemoModePanel from '@/components/tools/demo-mode-panel'
import ShareResult from '@/components/tools/share-result'
import QuickAnswer from '@/components/tools/quick-answer'
import EmbedCode from '@/components/tools/embed-code'
import { trackToolCalculated } from '@/lib/analytics'
import { buildShareUrl, encodeShareState, decodeShareState, type PricePositionShareState } from '@/lib/tools/share'
import { PRICE_POSITION_SCHEMA } from '@/lib/tools/schema'

type PageMode = 'manual' | 'demo'

const FAQ_ITEMS = [
  { q: 'What does a RAISE / LOWER / HOLD signal mean?', a: 'RAISE means your price is more than 5% below the market average — you may be underpricing and leaving margin on the table. LOWER means your price is more than 5% above market average — you risk losing price-sensitive shoppers to competitors. HOLD means your price is within 5% of market average — a competitive position that balances conversion and margin. Use the signal as a starting point; your brand positioning and conversion data should inform the final decision.' },
  { q: 'How do I find my competitors\' prices?', a: 'Reliable methods: (1) Manual spot-checking on competitor websites or Amazon listings; (2) Google Shopping searches to see current listings for your keywords; (3) Real-time price monitoring tools like SPECTER that scrape competitor prices automatically on a set cadence; (4) Checking marketplaces like Amazon, Walmart, and eBay for comparable products. For competitive categories, prices can change 1–3× per week, so monitoring cadence matters.' },
  { q: 'What is a good price gap vs. the market average?', a: 'For value positioning, pricing 5–15% below market average drives volume but compresses margin. For premium positioning, 10–20% above market average is sustainable if your brand, reviews, and product quality justify it. Avoid being more than 20% above or below market average without a clear strategic reason — extreme price gaps signal low quality (too low) or drive shoppers away (too high). Always monitor conversion rate changes when adjusting prices.' },
  { q: 'How often should I monitor and adjust my prices?', a: 'For competitive categories on Amazon or large marketplaces, daily monitoring is ideal — some sellers reprice hourly. For Shopify and DTC stores, weekly checks are a reasonable minimum. The key driver is category velocity: commodity products change prices constantly; niche or branded products may be stable for weeks. Setting alerts when competitors move more than 5% lets you stay competitive without constant manual checking.' },
  { q: 'Should I always match the lowest competitor price?', a: 'No — matching the lowest price is a race to the bottom that destroys category margins. Instead, target a position relative to your value. If you have better reviews, faster shipping, or a stronger brand, you can sustain a price premium. Always check your break-even price first to ensure profitability, then position competitively within a range that fits your brand. Price is one factor alongside reviews, trust signals, and perceived quality.' },
]

const fmtPct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`

function PricePositionPageInner() {
  const searchParams = useSearchParams()
  const { currency, setCurrency, fmt, fromUSD, toUSD, currencies } = useCurrency()
  const currSymbol = currencies.find(c => c.code === currency)?.symbol ?? '$'

  const [mode, setMode] = useState<PageMode>('manual')

  const [my_price, setMyPrice] = useState('89.99')
  const [competitors, setCompetitors] = useState<{ name: string; price: string }[]>([
    { name: 'Competitor A', price: '79.99' },
    { name: 'Competitor B', price: '94.99' },
    { name: 'Competitor C', price: '84.99' },
  ])

  // Load pre-filled state from ?s= URL param (shared result)
  useEffect(() => {
    const s = searchParams.get('s')
    if (!s) return
    const state = decodeShareState<PricePositionShareState>(s)
    if (!state) return
    if (typeof state.p === 'number') setMyPrice(String(state.p))
    if (Array.isArray(state.c)) {
      setCompetitors(state.c.slice(0, 3).map(c => ({ name: c.n, price: String(c.p) })))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const parsedCompetitors: Competitor[] = competitors
    .map(c => ({ name: c.name, price: toUSD(parseFloat(c.price) || 0) }))
    .filter(c => c.price > 0)

  const r = useMemo(
    () => calcPricePosition({
      my_price: toUSD(parseFloat(my_price) || 0),
      competitors: parsedCompetitors,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [my_price, JSON.stringify(parsedCompetitors), toUSD],
  )

  function addCompetitor() {
    if (competitors.length >= 3) return
    setCompetitors(prev => [...prev, { name: `Competitor ${prev.length + 1}`, price: '' }])
  }

  const hasResult = parsedCompetitors.length > 0

  const shareState = encodeShareState({
    p: parseFloat(my_price) || 0,
    c: competitors.filter(c => parseFloat(c.price) > 0).map(c => ({ n: c.name, p: parseFloat(c.price) })),
  })
  const shareUrl = buildShareUrl('/tools/price-position-analyzer', {
    p: parseFloat(my_price) || 0,
    c: competitors.filter(c => parseFloat(c.price) > 0).map(c => ({ n: c.name, p: parseFloat(c.price) })),
  })

  useEffect(() => {
    if (!hasResult) return
    trackToolCalculated('price-position', { signal: r.signal, has_result: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.signal, hasResult])

  function removeCompetitor(i: number) {
    setCompetitors(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateCompetitor(i: number, field: 'name' | 'price', value: string) {
    setCompetitors(prev => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)))
  }

  const barMax = r.market_high || 1

  const scenarioInputs: Record<string, string | boolean> = {
    my_price,
    ...Object.fromEntries(
      competitors.flatMap((c, i) => [
        [`comp_${i}_name`, c.name],
        [`comp_${i}_price`, c.price],
      ])
    ),
  }
  const scenarioResults: Record<string, number> = {
    market_avg: r.market_avg, market_low: r.market_low,
    market_high: r.market_high, gap_pct_vs_avg: r.gap_pct_vs_avg, my_rank: r.my_rank,
  }
  const scenarioLabels: Record<string, string> = {
    market_avg: 'Market Average', market_low: 'Market Low', market_high: 'Market High',
    gap_pct_vs_avg: 'Gap vs Avg (%)', my_rank: 'Your Rank',
  }

  function loadScenario(s: Scenario) {
    const v = s.inputs as Record<string, string>
    if (v.my_price) setMyPrice(v.my_price)
    const restored: { name: string; price: string }[] = []
    for (let i = 0; i < 8; i++) {
      const name = v[`comp_${i}_name`]
      const price = v[`comp_${i}_price`]
      if (price !== undefined) restored.push({ name: name ?? `Competitor ${i + 1}`, price })
    }
    if (restored.length > 0) setCompetitors(restored)
  }

  const exportInputs = [
    { label: 'My Price', value: String(my_price) },
    ...competitors.map((c, i) => ({ label: `Competitor ${i + 1} (${c.name})`, value: c.price || '—' })),
  ]
  const exportResults = [
    { label: 'Signal',      value: r.signal },
    { label: 'Market Low',  value: fmt(fromUSD(r.market_low)) },
    { label: 'Market High', value: fmt(fromUSD(r.market_high)) },
    { label: 'Market Avg',  value: fmt(fromUSD(r.market_avg)) },
    { label: 'Your Rank',   value: `#${r.my_rank} of ${r.total_competitors + 1}` },
    { label: 'vs Avg',      value: fmtPct(r.gap_pct_vs_avg) },
  ]

  return (
    <ToolLayout
      toolId="price-position"
      toolHref="/tools/price-position-analyzer"
      badge="Free Pricing Tool"
      title="Competitor Price Position Analyzer"
      description="Enter your price and up to 3 competitor prices to see your market rank instantly — with RAISE / LOWER / HOLD signals. Or preview what SPECTER live data looks like."
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
            toolId="price-position"
            currentInputs={scenarioInputs}
            currentResults={scenarioResults}
            currency={currency}
            resultLabels={scenarioLabels}
            onLoad={loadScenario}
          />
          <ExportBar toolId="price-position" inputs={exportInputs} results={exportResults} currency={currency} />
          {hasResult && (
            <ShareResult
              shareUrl={shareUrl}
              signal={r.signal}
              toolName="the Price Position Analyzer"
              resultSummary={`Signal: ${r.signal} · Market avg: $${r.market_avg.toFixed(2)} · Your rank: #${r.my_rank} of ${r.total_competitors + 1}`}
            />
          )}
        </div>
      }
    >
      <PrintReport toolName="Price Position Analyzer" toolId="price-position" currency={currency} inputs={exportInputs} results={exportResults} />

      <QuickAnswer text={PRICE_POSITION_SCHEMA.quickAnswer} />

      {/* ── Mode switcher ───────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-surface rounded-xl border border-border w-fit mb-6">
        {([
          { id: 'manual' as PageMode, label: 'Manual Entry' },
          { id: 'demo'   as PageMode, label: '⚡ Preview: SPECTER Live Data' },
        ]).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={cn(
              'px-4 py-1.5 rounded-lg font-body text-sm transition-all',
              mode === id
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-muted hover:text-text',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Demo mode ──────────────────────────────────────────────── */}
      {mode === 'demo' && <DemoModePanel />}

      {/* ── Manual mode ────────────────────────────────────────────── */}
      {mode === 'manual' && (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Inputs */}
            <div className="flex flex-col gap-5">
              <CalcCard title="Your Price">
                <Field label="My Current Price">
                  <Input value={my_price} onChange={setMyPrice} prefix={currSymbol} step={0.01} min={0} />
                </Field>
              </CalcCard>

              <CalcCard title="Competitor Prices" headerRight={
                <span className="font-mono text-xs text-muted">{competitors.length}/3</span>
              }>
                <div className="flex flex-col gap-3">
                  {competitors.map((c, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        value={c.name}
                        onChange={e => updateCompetitor(i, 'name', e.target.value)}
                        placeholder={`Competitor ${i + 1}`}
                        className="flex-1 min-w-0 bg-bg border border-border rounded-lg px-3 py-2.5 font-body text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/50 transition-colors"
                      />
                      <div className="relative w-28 shrink-0">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted pointer-events-none">
                          {currSymbol}
                        </span>
                        <input
                          type="number"
                          value={c.price}
                          onChange={e => updateCompetitor(i, 'price', e.target.value)}
                          placeholder="0.00"
                          step={0.01}
                          min={0}
                          className="w-full bg-bg border border-border rounded-lg pl-7 pr-3 py-2.5 font-mono text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/50 transition-colors"
                        />
                      </div>
                      <button
                        onClick={() => removeCompetitor(i)}
                        className="w-8 h-9 flex items-center justify-center text-muted hover:text-rose-400 transition-colors shrink-0"
                        aria-label="Remove competitor"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {competitors.length < 3 && (
                    <button
                      onClick={addCompetitor}
                      className="flex items-center gap-2 text-xs font-mono text-primary hover:text-primary/80 transition-colors py-1"
                    >
                      <Plus size={12} aria-hidden="true" /> Add competitor
                    </button>
                  )}
                </div>
              </CalcCard>

              {parsedCompetitors.length > 0 && (
                <CalcCard title="Competitor Breakdown">
                  <div className="space-y-2">
                    {[...parsedCompetitors].sort((a, b) => a.price - b.price).map((c, i, arr) => {
                      const isCheapest = i === 0
                      const isPriciest = i === arr.length - 1
                      const myUSD = toUSD(parseFloat(my_price) || 0)
                      const isBelow = c.price < myUSD
                      return (
                        <div key={c.name} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', isCheapest ? 'bg-rose-400' : isPriciest ? 'bg-amber-400' : 'bg-muted')} />
                            <span className="font-body text-xs text-text">{c.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={cn('font-mono text-xs', isBelow ? 'text-rose-400' : 'text-primary')}>{fmt(fromUSD(c.price))}</span>
                            <span className="font-mono text-xs text-muted w-14 text-right">{fmtPct(((c.price - myUSD) / myUSD) * 100)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="font-body text-xs text-muted mt-2">% shown relative to your price</p>
                </CalcCard>
              )}
            </div>

            {/* Results */}
            <div className="flex flex-col gap-5">
              <CalcCard>
                <div className="text-center py-2">
                  <p className="font-body text-xs text-muted uppercase tracking-widest mb-3">Your Signal</p>
                  <div className="flex justify-center mb-3">
                    <SignalBadge signal={r.signal} />
                  </div>
                  <p className="font-body text-sm text-muted max-w-xs mx-auto">{r.signal_reason}</p>
                  {r.signal !== 'HOLD' && (
                    <div className="mt-4 flex flex-col items-center gap-1">
                      <p className="font-body text-xs text-muted">Suggested price</p>
                      <p className="font-mono text-2xl font-bold text-primary">{fmt(fromUSD(r.suggested_price))}</p>
                      {r.potential_revenue_lift_pct > 0 && (
                        <p className="font-body text-xs text-emerald-400">+{r.potential_revenue_lift_pct}% potential revenue lift</p>
                      )}
                    </div>
                  )}
                </div>
              </CalcCard>

              <CalcCard title="Market Overview">
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <Metric label="Market Low"     value={fmt(fromUSD(r.market_low))}    variant="positive" />
                  <Metric label="Market High"    value={fmt(fromUSD(r.market_high))}   variant="negative" />
                  <Metric label="Market Average" value={fmt(fromUSD(r.market_avg))}    variant="highlight" />
                  <Metric label="Market Median"  value={fmt(fromUSD(r.market_median))} />
                </div>
                {r.market_high > 0 && (
                  <div className="mt-2">
                    <p className="font-body text-xs text-muted mb-2 uppercase tracking-wide">Price Range Visualizer</p>
                    <div className="relative h-2 bg-border rounded-full mt-4 mb-1">
                      <div className="absolute h-full bg-primary/20 rounded-full" style={{ left: `${(r.market_low / barMax) * 100}%`, width: `${((r.market_high - r.market_low) / barMax) * 100}%` }} />
                      <div className="absolute w-0.5 h-4 bg-primary/50 -top-1" style={{ left: `${(r.market_avg / barMax) * 100}%` }} title="Market average" />
                      <div
                        className={cn('absolute w-3 h-3 rounded-full border-2 -top-1.5 -translate-x-1/2', r.signal === 'RAISE' ? 'bg-emerald-400 border-emerald-400' : r.signal === 'LOWER' ? 'bg-rose-400 border-rose-400' : 'bg-primary border-primary')}
                        style={{ left: `${Math.min(98, Math.max(2, (toUSD(parseFloat(my_price) || 0) / barMax) * 100))}%` }}
                        title="Your price"
                      />
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="font-mono text-xs text-muted">{fmt(fromUSD(r.market_low))}</span>
                      <span className="font-mono text-xs text-muted/60 text-center">↑ your position</span>
                      <span className="font-mono text-xs text-muted">{fmt(fromUSD(r.market_high))}</span>
                    </div>
                  </div>
                )}
              </CalcCard>

              <CalcCard title="Your Position">
                <div className="grid grid-cols-2 gap-4">
                  <Metric label="vs. Market Avg" value={fmtPct(r.gap_pct_vs_avg)} variant={r.gap_pct_vs_avg > 5 ? 'negative' : r.gap_pct_vs_avg < -5 ? 'positive' : 'default'} sub={r.gap_pct_vs_avg > 0 ? 'Above average' : r.gap_pct_vs_avg < 0 ? 'Below average' : 'At average'} />
                  <Metric label="vs. Lowest Price" value={fmtPct(r.gap_pct_vs_low)} sub="Gap to cheapest competitor" />
                  <Metric label="Your Rank" value={`#${r.my_rank} of ${r.total_competitors + 1}`} sub={`${r.competitors_below} cheaper · ${r.competitors_above} pricier`} />
                  <Metric label="Position" value={r.my_position === 'above_market' ? 'Above Market' : r.my_position === 'below_market' ? 'Below Market' : 'At Market'} variant={r.my_position === 'at_market' ? 'positive' : 'warning'} />
                </div>
              </CalcCard>

              <div className="bg-surface/50 border border-border rounded-xl p-4">
                <p className="font-body text-xs font-semibold text-text/70 uppercase tracking-wide mb-2">How signals work</p>
                <div className="space-y-1.5">
                  {[
                    { sig: 'RAISE', desc: 'Your price is >5% below market average — room to raise without losing competitiveness' },
                    { sig: 'HOLD',  desc: 'Your price is within ±5% of the market average — you\'re well positioned' },
                    { sig: 'LOWER', desc: 'Your price is >5% above market average — at risk of losing price-sensitive buyers' },
                  ].map(({ sig, desc }) => (
                    <div key={sig} className="flex items-start gap-2">
                      <span className={cn('font-mono text-xs font-bold shrink-0 mt-0.5', sig === 'RAISE' ? 'text-emerald-400' : sig === 'LOWER' ? 'text-rose-400' : 'text-amber-400')}>{sig}</span>
                      <p className="font-body text-xs text-muted">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Live competitor count lookup */}
          <LiveCompetitorCount className="mt-6" />

          {/* Locked intelligence */}
          {hasResult && (
            <div className="mt-6">
              {r.signal === 'RAISE' && (
                <div className="mb-3 bg-emerald-400/10 border border-emerald-400/20 rounded-xl px-5 py-4">
                  <p className="font-mono text-xs font-bold text-emerald-400 mb-1">RAISE SIGNAL DETECTED</p>
                  <p className="font-body text-sm text-muted">
                    3 competitors changed prices since yesterday. SPECTER RECON would have alerted you at 09:14 AM. You found out now, manually.
                  </p>
                </div>
              )}
              <LockedSection
                level="recon"
                intelligenceTitle="MARKET INTELLIGENCE"
                intelligenceCta="Start monitoring — see live competitors"
                automateCta="Start 14-day free trial →"
                automateHref="/sign-up"
                automateSubtext="SPECTER monitors competitor prices in real time. First signal in under 12 minutes."
              >
                <div className="space-y-2 py-2">
                  <p className="font-mono text-[10px] text-primary uppercase tracking-widest mb-3">SPECTER found 5 more competitors</p>
                  {['shopify-rival.com', 'bestprice-store.co', 'priceking.io', 'valueshop.net', 'dealmaster.com'].map((domain) => (
                    <div key={domain} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <span className="font-body text-xs text-text">{domain}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-muted bg-border/50 rounded px-2 py-0.5">$██.██</span>
                        <span className="font-mono text-xs text-muted">████%</span>
                      </div>
                    </div>
                  ))}
                  <p className="font-body text-xs text-muted mt-2 pt-2 border-t border-border/50">
                    Live signal with full market: <span className="font-mono text-primary">████</span> — gap to optimal: <span className="font-mono text-primary">██.█%</span>
                  </p>
                </div>
              </LockedSection>
            </div>
          )}

          <AdvancedAccordion label="Advanced options" className="mt-6">
            <p className="font-body text-xs text-muted">
              Need more than 3 competitors or multi-market comparison?{' '}
              <a href="/sign-up" className="text-primary hover:underline">SPECTER monitors all of them automatically.</a>
            </p>
          </AdvancedAccordion>

          <EmbedCode toolPath="price-position" toolName="Price Position Analyzer" shareState={shareState} className="mt-4" />
        </>
      )}

      <EmailCaptureGate
        isResultReady={hasResult && mode === 'manual'}
        toolId="price-position"
        toolName="your competitor price analysis"
      />

      <ToolDisclaimer toolSpecific="Signals are based on a simple ±5% threshold from market average. Optimal pricing also depends on your margins, brand positioning, conversion rates, and customer segment. Manually entered competitor prices may not reflect real-time market conditions." />
      <ToolFAQ items={FAQ_ITEMS} />
    </ToolLayout>
  )
}

export default function PricePositionPage() {
  return (
    <Suspense fallback={<div className="p-4 font-mono text-sm text-muted">Loading…</div>}>
      <PricePositionPageInner />
    </Suspense>
  )
}
