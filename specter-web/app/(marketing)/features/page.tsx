'use client'

import Link from 'next/link'
import Nav from '@/components/marketing/nav'
import Footer from '@/components/marketing/footer'
import { useScrollReveal } from '@/hooks/use-scroll-reveal'
import {
  Zap, Eye, Bell, BarChart2, Webhook, Shield, RefreshCw,
  TrendingUp, TrendingDown, Minus, Check, ArrowRight, Database,
  Globe, Layers, Lock, Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─── Data ─────────────────────────────────────────────────────── */

const CORE_FEATURES = [
  {
    icon: Eye,
    title: 'Real-time price monitoring',
    badge: 'All plans',
    badgeColor: 'text-primary bg-primary/10 border-primary/20',
    description:
      'SPECTER scrapes every competitor URL you add on a plan-defined cadence — from 6 hours on RECON down to 5 minutes on ECLIPSE. Each scrape run uses domain batching to collect up to 200 SKUs per domain visit, keeping costs near-zero as you scale.',
    details: [
      'HTTP worker for SSR/static sites (got v14, datacenter proxy)',
      'Playwright worker for JS-rendered sites (stealth browser, ISP residential proxy)',
      'Automatic domain classification — probe once, route forever',
      'Robots.txt compliance auto-detected and cached 24 hrs',
      'IP rotation + adaptive rate limiting per domain',
    ],
  },
  {
    icon: Bell,
    title: 'OOS intelligence',
    badge: 'All plans',
    badgeColor: 'text-primary bg-primary/10 border-primary/20',
    description:
      'The moment a tracked competitor URL flips out of stock, SPECTER fires an OOS alert within 2 minutes. You see it in dashboard, Slack, and email before anyone else. PHANTOM+ plans auto-reprice to capture the demand spike immediately.',
    details: [
      'Email + Slack OOS alerts in < 2 minutes',
      'Per-SKU alert silencing to reduce noise',
      'Auto-resolve when competitor restocks',
      'OOS history log for trend analysis',
      'Auto-RAISE signal on CIPHER+ plans',
    ],
  },
  {
    icon: Zap,
    title: 'AI pricing signals',
    badge: 'CIPHER+',
    badgeColor: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    description:
      'CIPHER and above get Gemini 1.5 Pro AI signals instead of pure rule logic. The AI considers competitor positions, stock levels, demand patterns, and your floor/ceiling guardrails to issue a RAISE, LOWER, or HOLD recommendation with a price suggestion and reasoning text.',
    details: [
      'Gemini 1.5 Pro mini-batch processing (≤ 50 SKUs per call)',
      'Confidence score 0–1 per signal (capped at 0.6 with < 2 competitors)',
      'Plain-language reasoning for every recommendation',
      'Transparent AI fallback: rule-based fires if Gemini is unavailable',
      'SHA-256 response caching — same data never calls AI twice',
    ],
  },
  {
    icon: RefreshCw,
    title: 'Auto-repricing',
    badge: 'CIPHER+',
    badgeColor: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    description:
      'Set a floor and ceiling per SKU and let SPECTER write prices back to Shopify automatically within 5 minutes of a signal. The RAISE formula undercuts the cheapest in-stock competitor by $0.01; LOWER matches the median minus $0.01 — always within your guardrails.',
    details: [
      'Floor + ceiling guardrails per SKU — SPECTER never breaches them',
      'RAISE: undercut cheapest in-stock competitor by $0.01',
      'LOWER: match median competitor price minus $0.01',
      'Price applied via Shopify Admin API (3× retry on failure)',
      'Full price change log with old price, new price, signal source',
    ],
  },
  {
    icon: BarChart2,
    title: 'Revenue attribution',
    badge: 'PHANTOM+',
    badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    description:
      "Every auto-repriced change is tracked end-to-end. SPECTER queries your Shopify Orders API 24 hours after each price change and calculates revenue delta = (new − old) × units sold. Your dashboard shows exactly how much SPECTER earned you — not a projection, an attributable number.",
    details: [
      'Revenue delta = (new_price − old_price) × units sold in 24 hr',
      'MTD total with trend vs. prior month',
      'Per-SKU revenue breakdown',
      'CSV export with date, SKU, old price, new price, revenue delta',
      'PHANTOM+ plan gated — CIPHER shows upgrade prompt',
    ],
  },
  {
    icon: Webhook,
    title: 'Webhooks & API',
    badge: 'PHANTOM+',
    badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    description:
      'Push any signal, OOS alert, or price change to your own systems via HMAC-SHA256-signed JSON webhooks. PREDATOR and ECLIPSE merchants get direct REST API access for custom integrations, BI pipelines, and headless repricing workflows.',
    details: [
      'Any signal or OOS event → your endpoint as signed JSON',
      'HMAC-SHA256 signature on every payload for security',
      'Webhook delivery log with retry status',
      'REST API access on PREDATOR/ECLIPSE',
      'Custom event filters — receive only what you need',
    ],
  },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Add competitor URLs',
    body: 'Paste the exact product URLs your competitors use. SPECTER probes each domain once to classify it — static, JS-rendered, or blocked — then routes all future scrapes to the right worker automatically.',
    accent: 'text-primary',
  },
  {
    step: '02',
    title: 'Scraper runs on cadence',
    body: 'Based on your plan, the scheduler fires domain-batched scrape jobs every 1–6 hours. One domain visit collects all your tracked SKUs in a single crawl — 100× more efficient than one-SKU-per-visit competitors.',
    accent: 'text-amber-400',
  },
  {
    step: '03',
    title: 'Signal engine fires',
    body: 'Every new price snapshot triggers the signal engine. RECON merchants get rule-based signals instantly. CIPHER+ merchants get Gemini AI analysis with price suggestions and reasoning. Duplicate suppression ensures you only see actionable changes.',
    accent: 'text-emerald-400',
  },
  {
    step: '04',
    title: 'You act (or SPECTER does)',
    body: 'Review signals in your dashboard, act on them manually, or let SPECTER auto-reprice within your guardrails. Every change is logged with full attribution so you always know what moved the needle.',
    accent: 'text-rose-400',
  },
]

const TECH_SPECS = [
  { label: 'Scrape workers', value: 'HTTP (concurrency 30) + Playwright (concurrency 5)', icon: Layers },
  { label: 'Proxy network', value: 'Datacenter (HTTP) + Bright Data ISP Residential (JS)', icon: Globe },
  { label: 'Queue system', value: 'BullMQ on Upstash Redis — 6 queues, 3 retry/exponential backoff', icon: Database },
  { label: 'Bot detection evasion', value: 'Random Chrome UA, viewport, WebGL fingerprint, canvas noise', icon: Shield },
  { label: 'CAPTCHA solving', value: '2captcha integration — screenshot → solve → inject → retry', icon: Lock },
  { label: 'Parse pipeline', value: 'JSON-LD → Open Graph → CSS selectors (in order)', icon: Activity },
]

const PLAN_FEATURES = [
  { feature: 'SKU limit', recon: '100', cipher: '500', phantom: '1,000', predator: '2,000', eclipse: 'Unlimited' },
  { feature: 'Scrape cadence', recon: '6 hr', cipher: '3 hr', phantom: '2 hr', predator: '1 hr', eclipse: '5–15 min' },
  { feature: 'Rule-based signals', recon: true, cipher: true, phantom: true, predator: true, eclipse: true },
  { feature: 'AI signals (Gemini)', recon: false, cipher: true, phantom: true, predator: true, eclipse: true },
  { feature: 'Auto-reprice', recon: false, cipher: true, phantom: true, predator: true, eclipse: true },
  { feature: 'Floor + ceiling guardrails', recon: false, cipher: true, phantom: true, predator: true, eclipse: true },
  { feature: 'Revenue attribution', recon: false, cipher: false, phantom: true, predator: true, eclipse: true },
  { feature: 'Custom webhooks', recon: false, cipher: false, phantom: true, predator: true, eclipse: true },
  { feature: 'Price history', recon: '30 days', cipher: '30 days', phantom: '90 days', predator: '90 days + picker', eclipse: 'Custom' },
  { feature: 'OOS alerts (Email + Slack)', recon: true, cipher: true, phantom: true, predator: true, eclipse: true },
  { feature: 'Shopify + WooCommerce sync', recon: true, cipher: true, phantom: true, predator: true, eclipse: true },
  { feature: 'Priority scrape queue', recon: false, cipher: false, phantom: false, predator: true, eclipse: true },
  { feature: 'Dedicated scraper workers', recon: false, cipher: false, phantom: false, predator: false, eclipse: true },
  { feature: 'REST API access', recon: false, cipher: false, phantom: false, predator: true, eclipse: true },
  { feature: 'Custom SLA', recon: false, cipher: false, phantom: false, predator: false, eclipse: true },
  { feature: 'Invoice billing', recon: false, cipher: false, phantom: false, predator: false, eclipse: true },
  { feature: '6 free calculator tools', recon: true, cipher: true, phantom: true, predator: true, eclipse: true },
]

const PLANS = ['RECON', 'CIPHER', 'PHANTOM', 'PREDATOR', 'ECLIPSE'] as const
type Plan = typeof PLANS[number]

function PlanCell({ value, plan }: { value: boolean | string; plan: Plan }) {
  const isSpecter = plan === 'PHANTOM' // highlight column
  if (value === true) return <Check size={15} className={cn('mx-auto', isSpecter ? 'text-primary' : 'text-muted')} />
  if (value === false) return <span className="text-border text-lg mx-auto block text-center">—</span>
  return <span className={cn('font-mono text-xs', isSpecter ? 'text-primary font-bold' : 'text-muted')}>{value}</span>
}

/* ─── Page ─────────────────────────────────────────────────────── */

function CoreFeaturesSection() {
  const ref = useScrollReveal<HTMLDivElement>({ stagger: 0.07, childSelector: '.feature-card' })
  return (
    <div ref={ref} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {CORE_FEATURES.map(({ icon: Icon, title, badge, badgeColor, description, details }) => (
        <div key={title} className="feature-card bg-surface border border-border rounded-2xl p-7 flex flex-col card-hover">
          <div className="flex items-start justify-between mb-5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Icon size={18} className="text-primary" />
            </div>
            <span className={cn('font-mono text-xs border px-2.5 py-1 rounded-full', badgeColor)}>{badge}</span>
          </div>
          <h3 className="font-display font-bold text-text mb-3" style={{ fontSize: '1.1rem', letterSpacing: '-0.015em' }}>{title}</h3>
          <p className="font-body text-sm text-muted leading-relaxed mb-5 flex-1">{description}</p>
          <ul className="flex flex-col gap-1.5">
            {details.map((d) => (
              <li key={d} className="flex items-start gap-2">
                <Check size={12} className="text-primary mt-0.5 shrink-0 animate-checkmark-pop" />
                <span className="font-body text-xs text-muted leading-relaxed">{d}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function HowItWorksSection() {
  const ref = useScrollReveal<HTMLDivElement>({ stagger: 0.1, childSelector: '.step-card' })
  return (
    <div ref={ref} className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      {HOW_IT_WORKS.map(({ step, title, body, accent }) => (
        <div key={step} className="step-card relative bg-surface border border-border rounded-2xl p-7">
          <div className={cn('font-display text-4xl font-bold mb-4 opacity-20', accent)}>{step}</div>
          <h3 className="font-display font-bold text-text mb-3" style={{ fontSize: '1rem', letterSpacing: '-0.015em' }}>{title}</h3>
          <p className="font-body text-xs text-muted leading-relaxed">{body}</p>
        </div>
      ))}
    </div>
  )
}

function TechSpecsSection() {
  const ref = useScrollReveal<HTMLDivElement>({ stagger: 0.06, childSelector: '.spec-row' })
  return (
    <div ref={ref} className="bg-surface border border-border rounded-2xl overflow-hidden divide-y divide-border">
      {TECH_SPECS.map(({ label, value, icon: Icon }) => (
        <div key={label} className="spec-row flex items-center gap-5 px-7 py-4 hover:bg-primary/3 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Icon size={14} className="text-primary" />
          </div>
          <span className="font-body text-sm text-muted w-52 shrink-0">{label}</span>
          <span className="font-mono text-xs text-text">{value}</span>
        </div>
      ))}
    </div>
  )
}

function PlanMatrixSection() {
  const ref = useScrollReveal<HTMLDivElement>({ y: 20 })
  return (
    <div ref={ref} className="overflow-x-auto">
      <table className="w-full min-w-[700px] border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="text-left font-body text-muted text-xs font-normal pb-4 w-[40%]" />
            {PLANS.map((p) => (
              <th
                key={p}
                className={cn(
                  'text-center pb-4 font-display font-bold text-xs',
                  p === 'PHANTOM'
                    ? 'text-primary border-x border-t border-primary/40 bg-primary/5 rounded-t-xl px-3 pt-4'
                    : 'text-muted px-3'
                )}
              >
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PLAN_FEATURES.map((row, fi) => (
            <tr key={row.feature} className="group">
              <td className="font-body text-xs text-muted py-3 pr-4 border-b border-border group-hover:text-text transition-colors">
                {row.feature}
              </td>
              {PLANS.map((p) => {
                const lp = p.toLowerCase() as 'recon' | 'cipher' | 'phantom' | 'predator' | 'eclipse'
                return (
                  <td
                    key={p}
                    className={cn(
                      'text-center py-3 border-b',
                      p === 'PHANTOM'
                        ? cn('border-x border-primary/40 bg-primary/5 px-3', fi === PLAN_FEATURES.length - 1 ? 'border-b border-primary/40 rounded-b-xl' : 'border-b border-primary/10')
                        : 'border-border px-3'
                    )}
                  >
                    <PlanCell value={row[lp]} plan={p} />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function FeaturesPage() {
  const heroRef = useScrollReveal<HTMLDivElement>({ y: 24 })
  const signalRef = useScrollReveal<HTMLDivElement>({ y: 20 })

  return (
    <>
      <Nav />
      <main className="bg-bg">
        {/* Hero */}
        <section className="pt-32 pb-20 px-6 bg-bg relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(0,232,122,0.07),transparent)] pointer-events-none" />
          <div ref={heroRef} className="max-w-4xl mx-auto text-center relative">
            <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 text-primary text-xs font-mono uppercase tracking-widest px-4 py-1.5 rounded-full mb-8 animate-border-glow">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Full feature breakdown
            </div>
            <h1
              className="font-display font-bold text-text mb-6"
              style={{ fontSize: 'clamp(2.4rem, 5vw, 3.8rem)', letterSpacing: '-0.03em', lineHeight: 1.05 }}
            >
              Every edge you need.{' '}
              <span className="text-primary">Built in.</span>
            </h1>
            <p className="font-body text-lg text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
              From real-time competitor scraping to AI pricing signals and full revenue attribution — SPECTER is the complete intelligence layer for Shopify merchants who compete on price.
            </p>
            <div className="flex flex-wrap justify-center gap-8 font-mono text-sm">
              {[
                { label: 'SKU plans', value: '100 → ∞' },
                { label: 'Min cadence', value: '5 min' },
                { label: 'Signal latency', value: '< 15 min' },
                { label: 'Scrape uptime', value: '99.3%' },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <div className="text-2xl font-bold text-primary">{value}</div>
                  <div className="text-xs text-muted mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Core Features */}
        <section className="py-20 bg-surface/30 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <p className="font-mono text-primary text-xs uppercase tracking-widest mb-3">Core capabilities</p>
              <h2 className="font-display font-bold text-text" style={{ fontSize: 'clamp(1.9rem, 3.5vw, 2.8rem)', letterSpacing: '-0.025em' }}>
                Six features that change how you price
              </h2>
            </div>
            <CoreFeaturesSection />
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 bg-bg px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <p className="font-mono text-primary text-xs uppercase tracking-widest mb-3">How it works</p>
              <h2 className="font-display font-bold text-text" style={{ fontSize: 'clamp(1.9rem, 3.5vw, 2.8rem)', letterSpacing: '-0.025em' }}>
                From URL to signal in{' '}
                <span className="text-primary">under 15 minutes</span>
              </h2>
            </div>
            <HowItWorksSection />
          </div>
        </section>

        {/* Signal Engine deep-dive */}
        <section className="py-20 bg-surface/30 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div ref={signalRef}>
                <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">Signal engine</p>
                <h2 className="font-display font-bold text-text mb-6" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', letterSpacing: '-0.025em' }}>
                  Three signals. Zero ambiguity.
                </h2>
                <p className="font-body text-muted leading-relaxed mb-8">
                  Every scrape run produces one of three outputs per SKU. RECON merchants get rule-based logic applied in under a second. CIPHER+ merchants get Gemini AI analysis with a price suggestion, confidence score, and plain-language reasoning.
                </p>
                <div className="flex flex-col gap-4">
                  {[
                    { type: 'RAISE', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', desc: 'A competitor went OOS or raised their price — your current price is leaving margin on the table.' },
                    { type: 'LOWER', icon: TrendingDown, color: 'text-rose-400', bg: 'bg-rose-400/10 border-rose-400/20', desc: 'Your price is more than 5% above the median competitor — you\'re likely losing conversions.' },
                    { type: 'HOLD', icon: Minus, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', desc: 'You\'re within ±2% of median competitor price. Competitive position is solid.' },
                  ].map(({ type, icon: Icon, color, bg, desc }) => (
                    <div key={type} className={cn('flex items-start gap-4 border rounded-xl p-4', bg)}>
                      <div className="flex items-center gap-2 min-w-[90px]">
                        <Icon size={15} className={color} />
                        <span className={cn('font-mono text-sm font-bold', color)}>{type}</span>
                      </div>
                      <p className="font-body text-xs text-muted leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-7">
                <p className="font-mono text-xs text-muted uppercase tracking-widest mb-5">Duplicate suppression</p>
                <div className="space-y-4">
                  <p className="font-body text-sm text-muted leading-relaxed">
                    The same signal is never emitted twice within 1 hour for the same SKU. SPECTER uses a Redis TTL key <code className="font-mono text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">signal:dedup:{'{sku_id}:{type}'}</code> to suppress duplicates — so your Slack channel only shows changes that matter.
                  </p>
                  <div className="border-t border-border pt-4">
                    <p className="font-mono text-xs text-muted uppercase tracking-widest mb-3">AI signal format (CIPHER+)</p>
                    <div className="bg-bg rounded-xl p-4 font-mono text-xs space-y-1.5">
                      <p><span className="text-muted">signal:</span> <span className="text-emerald-400">&quot;RAISE&quot;</span></p>
                      <p><span className="text-muted">confidence:</span> <span className="text-primary">0.87</span></p>
                      <p><span className="text-muted">price_suggestion:</span> <span className="text-primary">$124.99</span></p>
                      <p><span className="text-muted">reasoning:</span> <span className="text-text/70">&quot;Nike.com OOS on this colorway. 3 remaining in-stock competitors avg $128. Raise to $124.99 captures demand while staying competitive.&quot;</span></p>
                      <p><span className="text-muted">source:</span> <span className="text-amber-400">&quot;ai&quot;</span></p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Scraping Technology */}
        <section className="py-20 bg-bg px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <p className="font-mono text-primary text-xs uppercase tracking-widest mb-3">Under the hood</p>
              <h2 className="font-display font-bold text-text" style={{ fontSize: 'clamp(1.9rem, 3.5vw, 2.8rem)', letterSpacing: '-0.025em' }}>
                Infrastructure built to{' '}
                <span className="text-primary">never get blocked</span>
              </h2>
              <p className="font-body text-muted max-w-2xl mx-auto mt-4">
                SPECTER runs two parallel scraping tracks — a fast HTTP worker for most sites, and a full stealth Playwright worker for JS-heavy storefronts. Domain classification happens once; routing is automatic forever.
              </p>
            </div>
            <TechSpecsSection />
          </div>
        </section>

        {/* Plan Feature Matrix */}
        <section className="py-20 bg-surface/30 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <p className="font-mono text-primary text-xs uppercase tracking-widest mb-3">Plan comparison</p>
              <h2 className="font-display font-bold text-text" style={{ fontSize: 'clamp(1.9rem, 3.5vw, 2.8rem)', letterSpacing: '-0.025em' }}>
                What&apos;s included at every tier
              </h2>
            </div>
            <PlanMatrixSection />
            <div className="text-center mt-10">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 gradient-primary-cta btn-ripple font-semibold px-8 py-3.5 rounded-lg transition-all duration-300"
              >
                See pricing details
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 bg-bg px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 text-primary text-xs font-mono uppercase tracking-widest px-4 py-1.5 rounded-full mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              14-day free trial · no credit card
            </div>
            <h2 className="font-display font-bold text-text mb-6" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '-0.025em' }}>
              Ready to know before they move?
            </h2>
            <p className="font-body text-muted mb-10 leading-relaxed">
              Start with RECON — 100 SKUs, rule-based signals, 6-hour cadence. Upgrade any time as your catalog grows.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/sign-up" className="gradient-primary-cta btn-ripple inline-flex items-center justify-center gap-2 font-semibold px-8 py-3.5 rounded-lg text-base transition-all duration-300">
                Start free trial
                <ArrowRight size={16} />
              </Link>
              <Link href="/pricing" className="inline-flex items-center justify-center gap-2 border border-border text-muted hover:text-text hover:border-primary/40 hover:bg-primary/5 px-8 py-3.5 rounded-lg transition-all duration-300 text-base">
                View pricing →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
