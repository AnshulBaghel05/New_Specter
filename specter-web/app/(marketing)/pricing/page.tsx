'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Nav from '@/components/marketing/nav'
import Footer from '@/components/marketing/footer'
import { useScrollReveal } from '@/hooks/use-scroll-reveal'
import { Check, X, Zap, ArrowRight, HelpCircle, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import PlanContactModal from '@/components/marketing/plan-contact-modal'
import { CONTACT_PLANS } from '@/lib/marketing/contact-plans'
import { priceDisplay, PROMO_BADGE, ANNUAL_DISCOUNT_PCT, isPromoActive } from '@/lib/pricing'
import { createClient } from '@/lib/supabase/client'
import { saveIntent } from '@/lib/billing/intent'
import { useStartTrial, useSubscribe, type SelfServePlan } from '@/lib/api'
import { openCheckout } from '@/lib/billing/checkout'
import { toast, formatApiError } from '@/lib/toast'

/* ─── Data ─────────────────────────────────────────────────────── */

interface Tier {
  name: string
  monthly: number | null
  skus: string
  cadence: string
  highlight?: boolean
  badge?: string
  color: string
  cta: string
  ctaHref?: string
  /** When set, the CTA opens the plan-contact modal instead of navigating. */
  contact?: 'PREDATOR' | 'ECLIPSE'
  description: string
  features: string[]
  notIncluded?: string[]
}

const TIERS: Tier[] = [
  {
    name: 'RECON',
    monthly: 79,
    skus: '100 SKUs',
    cadence: '6-hour',
    color: 'text-muted',
    cta: 'Start free trial',
    ctaHref: '/sign-up',
    description: 'For merchants just starting to track competitors. Rule-based signals, email + Slack alerts, and Shopify sync included.',
    features: [
      'Up to 100 SKUs monitored',
      '6-hour scrape cadence',
      'Rule-based RAISE / LOWER / HOLD signals',
      'Email + Slack OOS alerts (< 2 min)',
      'Shopify & WooCommerce price sync',
      '30-day price history',
      'Per-SKU alert silencing',
      '6 free calculator tools',
    ],
    notIncluded: ['AI signals', 'Auto-reprice', 'Revenue attribution', 'Webhooks'],
  },
  {
    name: 'CIPHER',
    monthly: 249,
    skus: '500 SKUs',
    cadence: '3-hour',
    color: 'text-amber-400',
    cta: 'Start free trial',
    ctaHref: '/sign-up',
    description: 'For growing stores ready for AI. Gemini-powered signals tell you exactly what to charge and why.',
    features: [
      'Up to 500 SKUs monitored',
      '3-hour scrape cadence',
      'Everything in RECON',
      'AI signals via Gemini 1.5 Pro',
      'Price suggestion + confidence score',
      'Plain-language reasoning per signal',
      'Auto-reprice with guardrails',
      'Floor + ceiling per SKU',
      'Revenue attribution dashboard',
    ],
    notIncluded: ['Custom webhooks', '90-day history', 'Priority queue'],
  },
  {
    name: 'PHANTOM',
    monthly: 699,
    skus: '1,000 SKUs',
    cadence: '2-hour',
    highlight: true,
    badge: 'Most popular',
    color: 'text-primary',
    cta: 'Start free trial',
    ctaHref: '/sign-up',
    description: 'The sweet spot for serious e-commerce operators. Webhooks, 90-day history, and priority processing.',
    features: [
      'Up to 1,000 SKUs monitored',
      '2-hour scrape cadence',
      'Everything in CIPHER',
      'Custom outbound webhooks',
      'HMAC-SHA256 signed payloads',
      'Webhook delivery log',
      '90-day price history',
      'Priority job queue',
      'CSV attribution export',
    ],
    notIncluded: ['Dedicated workers', 'REST API', 'Custom SLA'],
  },
  {
    name: 'PREDATOR',
    monthly: 1799,
    skus: '2,000 SKUs',
    cadence: '1-hour',
    color: 'text-rose-400',
    cta: 'Contact us',
    contact: 'PREDATOR',
    description: 'For high-volume merchants who need the fastest signals and 90-day historical data with date picker.',
    features: [
      'Up to 2,000 SKUs monitored',
      '1-hour scrape cadence',
      'Everything in PHANTOM',
      '90-day history + date picker',
      'Priority BullMQ queue (priority 10)',
      'Dedicated scraper worker pool',
      'REST API access',
      'PREDATOR badge in dashboard',
      'SKU add-on packs available',
    ],
    notIncluded: ['Custom SLA', 'Dedicated infrastructure', 'Invoice billing'],
  },
  {
    name: 'ECLIPSE',
    monthly: null,
    skus: 'Unlimited SKUs',
    cadence: '5–15 min',
    color: 'text-violet-400',
    cta: 'Contact sales',
    contact: 'ECLIPSE',
    description: 'Dedicated infrastructure, custom SLA, and a sub-15-minute scrape cadence for enterprise operations.',
    features: [
      'Unlimited SKUs monitored',
      '5–15 min custom cadence',
      'Everything in PREDATOR',
      'Dedicated scraper infrastructure',
      'Custom SLA agreement',
      'Onboarding Slack channel',
      'Invoice billing',
      'Quarterly business review',
      'Priority engineering support',
    ],
  },
]

const COMPARISON_ROWS = [
  { category: 'Monitoring', rows: [
    { feature: 'SKU limit', recon: '100', cipher: '500', phantom: '1,000', predator: '2,000', eclipse: 'Unlimited' },
    { feature: 'Scrape cadence', recon: '6 hr', cipher: '3 hr', phantom: '2 hr', predator: '1 hr', eclipse: '5–15 min' },
    { feature: 'Price history', recon: '30 days', cipher: '30 days', phantom: '90 days', predator: '90 days + picker', eclipse: 'Custom' },
    { feature: 'Shopify + WooCommerce sync', recon: true, cipher: true, phantom: true, predator: true, eclipse: true },
    { feature: 'OOS detection', recon: true, cipher: true, phantom: true, predator: true, eclipse: true },
    { feature: 'Email + Slack OOS alerts', recon: true, cipher: true, phantom: true, predator: true, eclipse: true },
  ]},
  { category: 'Signals', rows: [
    { feature: 'Rule-based signals', recon: true, cipher: true, phantom: true, predator: true, eclipse: true },
    { feature: 'AI signals (Gemini 1.5 Pro)', recon: false, cipher: true, phantom: true, predator: true, eclipse: true },
    { feature: 'Price suggestion', recon: false, cipher: true, phantom: true, predator: true, eclipse: true },
    { feature: 'Confidence score', recon: false, cipher: true, phantom: true, predator: true, eclipse: true },
    { feature: 'Plain-language reasoning', recon: false, cipher: true, phantom: true, predator: true, eclipse: true },
    { feature: 'Duplicate suppression (1 hr)', recon: true, cipher: true, phantom: true, predator: true, eclipse: true },
  ]},
  { category: 'Automation', rows: [
    { feature: 'Auto-reprice', recon: false, cipher: true, phantom: true, predator: true, eclipse: true },
    { feature: 'Floor + ceiling guardrails', recon: false, cipher: true, phantom: true, predator: true, eclipse: true },
    { feature: 'Per-SKU reprice on/off', recon: false, cipher: true, phantom: true, predator: true, eclipse: true },
    { feature: 'Revenue attribution', recon: false, cipher: false, phantom: true, predator: true, eclipse: true },
    { feature: 'CSV attribution export', recon: false, cipher: false, phantom: true, predator: true, eclipse: true },
  ]},
  { category: 'Integrations', rows: [
    { feature: 'Custom webhooks', recon: false, cipher: false, phantom: true, predator: true, eclipse: true },
    { feature: 'HMAC-SHA256 signed payloads', recon: false, cipher: false, phantom: true, predator: true, eclipse: true },
    { feature: 'Webhook delivery log', recon: false, cipher: false, phantom: true, predator: true, eclipse: true },
    { feature: 'REST API access', recon: false, cipher: false, phantom: false, predator: true, eclipse: true },
    { feature: 'Klaviyo / Slack / Stripe', recon: true, cipher: true, phantom: true, predator: true, eclipse: true },
  ]},
  { category: 'Infrastructure', rows: [
    { feature: 'Shared scraper pool', recon: true, cipher: true, phantom: true, predator: false, eclipse: false },
    { feature: 'Priority BullMQ queue', recon: false, cipher: false, phantom: false, predator: true, eclipse: true },
    { feature: 'Dedicated scraper workers', recon: false, cipher: false, phantom: false, predator: false, eclipse: true },
    { feature: 'Custom SLA', recon: false, cipher: false, phantom: false, predator: false, eclipse: true },
    { feature: 'Invoice billing', recon: false, cipher: false, phantom: false, predator: false, eclipse: true },
    { feature: 'Onboarding Slack channel', recon: false, cipher: false, phantom: false, predator: false, eclipse: true },
  ]},
  { category: 'Free tools', rows: [
    { feature: '6 calculator tools (no login)', recon: true, cipher: true, phantom: true, predator: true, eclipse: true },
    { feature: 'Add-on SKU packs ($49/50 SKUs)', recon: false, cipher: true, phantom: true, predator: true, eclipse: false },
  ]},
]

const FAQS = [
  {
    q: 'What counts as one SKU?',
    a: 'A SKU is one of your products tracked against one competitor — one (your product → competitor) link, which is one competitor-page scrape per refresh cycle. Your SKU count equals the number of those links you set up: 100 products against 1 competitor each = 100 SKUs; 33 products against 3 competitors each = 99 SKUs. Tracking one product against 4 competitors uses 4 SKUs, not 1. The scrape happens on the competitor\'s page — your own store syncs via API and is never scraped. Add-on packs ($49 per 50 SKUs) let you exceed your tier cap without upgrading.',
  },
  {
    q: 'How does the annual discount work?',
    a: 'Switch to annual billing and save 15% on RECON, CIPHER, and PHANTOM. PREDATOR is billed at the same rate whether you choose monthly or annual — there is no annual discount on PREDATOR. ECLIPSE is invoice-only with custom pricing — contact sales for enterprise terms.',
  },
  {
    q: 'What happens at the end of my 14-day trial?',
    a: 'Your account enters read-only mode on day 15. You can still view historical signals and data, but scraping pauses until you add a payment method. No data is ever deleted during this period.',
  },
  {
    q: 'Can I upgrade or downgrade at any time?',
    a: 'Yes. Upgrades take effect immediately. Downgrades take effect at the end of your current billing period. On downgrade, SKUs above the new plan limit are paused (not deleted) — you choose which to keep.',
  },
  {
    q: 'What is auto-reprice and how do guardrails work?',
    a: 'CIPHER+ plans can have SPECTER write price changes directly to Shopify via the Admin API. You set a floor (minimum price) and ceiling (maximum price) per SKU. SPECTER\'s RAISE formula sets the new price to the cheapest in-stock competitor minus $0.01, capped at your ceiling. LOWER sets it to the median competitor minus $0.01, floored at your minimum. SPECTER never breaches your guardrails.',
  },
  {
    q: 'How is revenue attribution calculated?',
    a: 'When SPECTER auto-reprices a SKU, it records the old price and new price. 24 hours later it queries your Shopify Orders API and computes: revenue delta = (new_price − old_price) × units sold in that 24-hour window. This is a conservative, attributable figure — not a projection. It appears as "$0" for any SKU where you haven\'t enabled auto-reprice.',
  },
  {
    q: 'What integrations does SPECTER support?',
    a: 'Out of the box: Shopify (1-click install, Admin API price writes) and WooCommerce (REST API key). PHANTOM and above add custom outbound webhooks — every signal and OOS event is pushed to your endpoint as an HMAC-signed JSON payload, so you can route alerts into Slack, Klaviyo, or any internal system through your own automation. PREDATOR and ECLIPSE can also call our REST API directly.',
  },
  {
    q: 'Does SPECTER work with Amazon or other marketplaces?',
    a: 'Yes. We track competitor product detail pages on Amazon, eBay, Walmart, and other marketplaces. Amazon has strict rate limits (6 req/min) which we respect. Our scrapers target product pages, not search results. Rate limits and robots.txt compliance are handled automatically.',
  },
]

/* ─── Components ────────────────────────────────────────────────── */

function TierCard({
  tier,
  annual,
  onContact,
  onTrial,
  onBuy,
}: {
  tier: Tier
  annual: boolean
  onContact: (plan: 'PREDATOR' | 'ECLIPSE') => void
  onTrial: (plan: SelfServePlan) => void
  onBuy: (plan: SelfServePlan) => void
}) {
  const price = priceDisplay(tier.name, tier.monthly, annual)
  const ctaClasses = cn(
    'btn-ripple block w-full text-center py-3 rounded-lg text-sm font-semibold transition-all duration-250',
    tier.highlight
      ? 'gradient-primary-cta'
      : 'border border-border text-muted hover:text-text hover:border-primary/40 hover:bg-primary/5',
  )
  return (
    <div
      className={cn(
        'pricing-card gradient-border-primary relative rounded-2xl border p-7 flex flex-col',
        tier.highlight
          ? 'pricing-card-featured bg-primary/5 border-primary/40'
          : 'bg-surface border-border'
      )}
    >
      {tier.badge && (
        <div className="badge-shimmer absolute -top-3 left-1/2 -translate-x-1/2 text-bg font-mono text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
          {tier.badge}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          {tier.highlight && <Zap size={13} className="text-primary" />}
          <p className={cn('font-display font-bold text-xs tracking-widest uppercase', tier.color)}>{tier.name}</p>
        </div>
        <p className="font-body text-xs text-muted leading-relaxed mb-4">{tier.description}</p>

        {price.now !== null ? (
          <div>
            {price.promoFree && (
              <span className="inline-block mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/30 rounded-full px-2.5 py-0.5">
                {PROMO_BADGE}
              </span>
            )}
            <div className="flex items-end gap-1">
              <span className="font-display text-4xl font-bold text-text">${price.now}</span>
              <span className="font-body text-muted text-sm mb-1">/mo</span>
            </div>
            {price.was !== null && (
              <p className="font-mono text-xs text-muted line-through">${price.was}/mo</p>
            )}
            <p className="font-mono text-xs text-muted mt-1">{tier.skus} · {tier.cadence} cadence</p>
          </div>
        ) : (
          <div>
            <p className="font-display text-2xl font-bold text-text">Custom</p>
            <p className="font-mono text-xs text-muted mt-1">{tier.skus} · {tier.cadence} cadence</p>
          </div>
        )}
      </div>

      {/* Features */}
      <ul className="flex flex-col gap-2 mb-6 flex-1">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <Check size={12} className="text-primary mt-0.5 shrink-0 animate-checkmark-pop" />
            <span className="font-body text-xs text-muted leading-relaxed">{f}</span>
          </li>
        ))}
        {tier.notIncluded?.map((f) => (
          <li key={f} className="flex items-start gap-2.5 opacity-40">
            <X size={12} className="text-muted mt-0.5 shrink-0" />
            <span className="font-body text-xs text-muted leading-relaxed line-through">{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA — contact tiers open the lead modal; self-serve get dual actions. */}
      {tier.contact ? (
        <button type="button" onClick={() => onContact(tier.contact!)} className={ctaClasses}>
          {tier.cta}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onTrial(tier.name.toLowerCase() as SelfServePlan)}
            className={ctaClasses}
          >
            Start 14-day trial
          </button>
          <button
            type="button"
            onClick={() => onBuy(tier.name.toLowerCase() as SelfServePlan)}
            className="btn-ripple block w-full text-center py-2.5 rounded-lg text-sm font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition-all duration-250"
          >
            Buy {tier.name}
          </button>
        </div>
      )}
    </div>
  )
}

function ComparisonTableSection() {
  const ref = useScrollReveal<HTMLDivElement>({ y: 20 })
  const COLS = ['RECON', 'CIPHER', 'PHANTOM', 'PREDATOR', 'ECLIPSE'] as const

  return (
    <div ref={ref} className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="text-left font-body text-muted text-xs font-normal pb-4 w-[35%]" />
            {COLS.map((col) => (
              <th
                key={col}
                className={cn(
                  'text-center pb-4 font-display font-bold text-xs',
                  col === 'PHANTOM'
                    ? 'text-primary border-x border-t border-primary/40 bg-primary/5 rounded-t-xl px-3 pt-4'
                    : 'text-muted px-3'
                )}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map(({ category, rows }, ci) => (
            <>
              <tr key={`cat-${ci}`}>
                <td
                  colSpan={6}
                  className="pt-5 pb-2 font-mono text-xs text-primary uppercase tracking-widest border-b border-border"
                >
                  {category}
                </td>
              </tr>
              {rows.map((row, ri) => {
                const isLast = ri === rows.length - 1 && ci === COMPARISON_ROWS.length - 1
                return (
                  <tr key={row.feature} className="group table-row-hover">
                    <td className="font-body text-xs text-muted py-3 pr-4 border-b border-border group-hover:text-text transition-colors">
                      {row.feature}
                    </td>
                    {COLS.map((col) => {
                      const lc = col.toLowerCase() as keyof typeof row
                      const val = row[lc]
                      return (
                        <td
                          key={col}
                          className={cn(
                            'text-center py-3 border-b',
                            col === 'PHANTOM'
                              ? cn('border-x border-primary/40 bg-primary/5 px-3', isLast ? 'border-b border-primary/40 rounded-b-xl' : 'border-b border-primary/10')
                              : 'border-border px-3'
                          )}
                        >
                          {val === true ? (
                            <Check size={13} className={cn('mx-auto', col === 'PHANTOM' ? 'text-primary' : 'text-muted')} />
                          ) : val === false ? (
                            <span className="text-border text-base block text-center">—</span>
                          ) : (
                            <span className={cn('font-mono text-xs', col === 'PHANTOM' ? 'text-primary font-bold' : 'text-muted')}>{val as string}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-6 py-5 text-left group"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="font-display font-bold text-text text-sm group-hover:text-primary transition-colors pr-4">{q}</span>
        <ChevronDown
          size={16}
          className={cn('text-muted shrink-0 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="px-6 pb-5 border-t border-border">
          <p className="font-body text-sm text-muted leading-relaxed pt-3">{a}</p>
        </div>
      )}
    </div>
  )
}

/* ─── Page ─────────────────────────────────────────────────────── */

export default function PricingPage() {
  const [annual, setAnnual] = useState(false)
  const [contactPlan, setContactPlan] = useState<'PREDATOR' | 'ECLIPSE' | null>(null)
  const heroRef = useScrollReveal<HTMLDivElement>({ y: 24 })
  const cardsRef = useScrollReveal<HTMLDivElement>({ y: 20 })
  const faqRef = useScrollReveal<HTMLDivElement>({ stagger: 0.05, childSelector: '.faq-item' })

  const router = useRouter()
  const startTrial = useStartTrial()
  const subscribe = useSubscribe()

  async function isLoggedIn(): Promise<boolean> {
    const { data } = await createClient().auth.getSession()
    return !!data.session
  }

  async function handleTrial(plan: SelfServePlan) {
    if (!(await isLoggedIn())) {
      saveIntent({ action: 'trial', plan, cadence: annual ? 'annual' : 'monthly' })
      router.push('/sign-up')
      return
    }
    try {
      await startTrial.mutateAsync()
      toast.success('Your 14-day RECON trial is active.')
      router.push('/dashboard')
    } catch (err) {
      toast.error(formatApiError(err))
    }
  }

  async function handleBuy(plan: SelfServePlan) {
    const cadence = annual ? 'annual' : 'monthly'
    if (!(await isLoggedIn())) {
      saveIntent({ action: 'buy', plan, cadence })
      router.push('/sign-up')
      return
    }
    try {
      const sub = await subscribe.mutateAsync({ plan, cadence })
      await openCheckout({ subscriptionId: sub.subscription_id, shortUrl: sub.short_url })
    } catch (err) {
      toast.error(formatApiError(err))
    }
  }

  return (
    <>
      <Nav />
      <main className="bg-bg">
        {/* Hero */}
        <section className="pt-32 pb-16 px-6 bg-bg relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(0,232,122,0.06),transparent)] pointer-events-none" />
          <div ref={heroRef} className="max-w-3xl mx-auto text-center relative">
            {isPromoActive() && (
              <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 text-primary text-xs font-mono uppercase tracking-widest px-4 py-1.5 rounded-full mb-8 animate-border-glow">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Limited time — RECON, CIPHER &amp; PHANTOM 100% off
              </div>
            )}
            <h1
              className="font-display font-bold text-text mb-5"
              style={{ fontSize: 'clamp(2.4rem, 5vw, 3.8rem)', letterSpacing: '-0.03em', lineHeight: 1.05 }}
            >
              Pay for what you track.{' '}
              <span className="text-primary">No surprises.</span>
            </h1>
            <p className="font-body text-muted text-lg leading-relaxed mb-10 max-w-xl mx-auto">
              Start free. No credit card required. Every plan includes Shopify sync, OOS alerts, and all 6 free calculator tools.
            </p>

            {/* Toggle */}
            <div
              className="inline-flex items-center gap-1 bg-surface border border-border rounded-xl p-1"
              role="group"
              aria-label="Billing period"
            >
              <button
                onClick={() => setAnnual(false)}
                className={cn('px-5 py-2 rounded-lg text-sm font-body transition-all duration-200', !annual ? 'bg-primary text-bg font-semibold shadow-sm' : 'text-muted hover:text-text')}
                aria-pressed={!annual}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={cn('px-5 py-2 rounded-lg text-sm font-body transition-all duration-200 flex items-center gap-2', annual ? 'bg-primary text-bg font-semibold shadow-sm' : 'text-muted hover:text-text')}
                aria-pressed={annual}
              >
                Annual
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-mono transition-colors duration-200', annual ? 'bg-bg/20 text-bg' : 'bg-primary/10 text-primary')}>
                  −{ANNUAL_DISCOUNT_PCT}%
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Tier Cards */}
        <section className="pb-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div ref={cardsRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              {TIERS.map((tier) => (
                <TierCard
                  key={tier.name}
                  tier={tier}
                  annual={annual}
                  onContact={setContactPlan}
                  onTrial={handleTrial}
                  onBuy={handleBuy}
                />
              ))}
            </div>

            {/* Add-ons callout */}
            <div className="mt-8 bg-surface border border-border rounded-2xl px-7 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="font-display font-bold text-text text-sm mb-1">Need more SKUs without upgrading?</p>
                <p className="font-body text-xs text-muted">Add-on packs available on CIPHER, PHANTOM, and PREDATOR: $49 per additional 50 SKUs. Max 3 active add-on packs per account.</p>
              </div>
              <Link href="mailto:sales@specterapp.io" className="shrink-0 border border-border text-muted hover:text-text hover:border-primary/40 text-xs font-semibold px-5 py-2.5 rounded-lg transition-all duration-200 whitespace-nowrap">
                Add SKUs →
              </Link>
            </div>
          </div>
        </section>

        {/* Full comparison table */}
        <section className="py-20 bg-surface/30 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <p className="font-mono text-primary text-xs uppercase tracking-widest mb-3">Full comparison</p>
              <h2 className="font-display font-bold text-text" style={{ fontSize: 'clamp(1.9rem, 3.5vw, 2.8rem)', letterSpacing: '-0.025em' }}>
                Every feature, every tier
              </h2>
            </div>
            <ComparisonTableSection />
          </div>
        </section>

        {/* ROI strip */}
        <section className="py-16 bg-bg px-6 border-y border-border">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { metric: 'Avg ROI', value: '14×', sub: 'in 90 days' },
                { metric: 'Payback period', value: '< 3 wks', sub: 'after activation' },
                { metric: 'Revenue per signal', value: '$47', sub: 'average across plans' },
                { metric: 'Scrape uptime', value: '99.3%', sub: 'SLA guaranteed' },
              ].map(({ metric, value, sub }) => (
                <div key={metric}>
                  <p className="font-display text-3xl md:text-4xl font-bold text-primary">{value}</p>
                  <p className="font-body text-sm text-text mt-1">{metric}</p>
                  <p className="font-mono text-xs text-muted">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 bg-bg px-6">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: FAQS.map(({ q, a }) => ({
                  '@type': 'Question',
                  name: q,
                  acceptedAnswer: { '@type': 'Answer', text: a },
                })),
              }),
            }}
          />
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-14">
              <p className="font-mono text-primary text-xs uppercase tracking-widest mb-3">Pricing FAQ</p>
              <h2 className="font-display font-bold text-text" style={{ fontSize: 'clamp(1.9rem, 3.5vw, 2.8rem)', letterSpacing: '-0.025em' }}>
                Common questions
              </h2>
            </div>
            <div ref={faqRef} className="flex flex-col gap-3">
              {FAQS.map((faq) => (
                <div key={faq.q} className="faq-item">
                  <FaqItem q={faq.q} a={faq.a} />
                </div>
              ))}
            </div>

            <div className="mt-10 bg-surface border border-border rounded-2xl p-7 flex items-start gap-4">
              <HelpCircle size={20} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-display font-bold text-text text-sm mb-1">Still have questions?</p>
                <p className="font-body text-xs text-muted leading-relaxed mb-3">
                  Our team responds to all sales and billing questions within 1 business hour.
                </p>
                <a
                  href="mailto:hello@specterapp.io"
                  className="font-mono text-xs text-primary hover:underline"
                >
                  hello@specterapp.io →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 bg-surface/30 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 text-primary text-xs font-mono uppercase tracking-widest px-4 py-1.5 rounded-full mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Start free · no credit card
            </div>
            <h2 className="font-display font-bold text-text mb-6" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '-0.025em' }}>
              Try SPECTER free for 14 days
            </h2>
            <p className="font-body text-muted leading-relaxed mb-10 max-w-xl mx-auto">
              Set up in under 10 minutes. Add your competitor URLs, connect Shopify, and your first signal typically fires within 12 minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/sign-up" className="gradient-primary-cta btn-ripple inline-flex items-center justify-center gap-2 font-semibold px-8 py-3.5 rounded-lg text-base transition-all duration-300">
                Start free trial
                <ArrowRight size={16} />
              </Link>
              <Link href="/features" className="inline-flex items-center justify-center gap-2 border border-border text-muted hover:text-text hover:border-primary/40 hover:bg-primary/5 px-8 py-3.5 rounded-lg transition-all duration-300 text-base">
                Explore all features →
              </Link>
            </div>
            <p className="font-body text-xs text-muted mt-6">
              {isPromoActive()
                ? 'Limited time: RECON, CIPHER & PHANTOM 100% off · PREDATOR $1,799/mo · ECLIPSE custom'
                : 'RECON $79/mo · CIPHER $249/mo · PHANTOM $699/mo · PREDATOR $1,799/mo · ECLIPSE custom'}
            </p>
          </div>
        </section>
      </main>
      <Footer />

      <PlanContactModal
        config={contactPlan ? CONTACT_PLANS[contactPlan] : null}
        onClose={() => setContactPlan(null)}
      />
    </>
  )
}
