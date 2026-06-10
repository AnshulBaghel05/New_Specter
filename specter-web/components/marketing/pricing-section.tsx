'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScrollReveal } from '@/hooks/use-scroll-reveal'
import { priceDisplay, PROMO_BADGE, ANNUAL_DISCOUNT_PCT } from '@/lib/pricing'

interface Tier {
  name: string
  monthly: number | null
  skus: string
  interval: string
  features: string[]
  highlight?: boolean
  cta: string
  badge?: string
}

const TIERS: Tier[] = [
  {
    name: 'RECON',
    monthly: 79,
    skus: '100 SKUs',
    interval: '6 hr scrape',
    cta: 'Start free trial',
    features: [
      'Rule-based RAISE/LOWER/HOLD signals',
      '6-hour scrape cadence',
      'Email + Slack OOS alerts',
      'Shopify & WooCommerce sync',
      '30-day price history',
      '6 free calculator tools',
    ],
  },
  {
    name: 'CIPHER',
    monthly: 249,
    skus: '500 SKUs',
    interval: '3 hr scrape',
    cta: 'Start free trial',
    features: [
      'Everything in RECON',
      'AI-powered signals (Gemini)',
      '3-hour scrape cadence',
      'Auto-reprice with guardrails',
      'Floor & ceiling per SKU',
      'Revenue attribution dashboard',
    ],
  },
  {
    name: 'PHANTOM',
    monthly: 699,
    skus: '1,000 SKUs',
    interval: '2 hr scrape',
    highlight: true,
    badge: 'Most popular',
    cta: 'Start free trial',
    features: [
      'Everything in CIPHER',
      '2-hour scrape cadence',
      'Custom webhooks',
      '90-day price history',
      'Priority queue',
      'Webhook delivery log',
    ],
  },
  {
    name: 'PREDATOR',
    monthly: 1799,
    skus: '2,000 SKUs',
    interval: '1 hr scrape',
    cta: 'Start free trial',
    features: [
      'Everything in PHANTOM',
      '1-hour scrape cadence',
      '90-day retention + date picker',
      'Priority BullMQ queue',
      'Dedicated scraper workers',
      'PREDATOR badge in dashboard',
    ],
  },
  {
    name: 'ECLIPSE',
    monthly: null,
    skus: 'Unlimited SKUs',
    interval: '5–15 min scrape',
    cta: 'Contact sales',
    features: [
      'Everything in PREDATOR',
      '5–15 min custom cadence',
      'Dedicated infrastructure',
      'Custom SLA',
      'Onboarding Slack channel',
      'Invoice billing',
    ],
  },
]

export default function PricingSection() {
  const [annual, setAnnual] = useState(false)
  const headingRef = useScrollReveal<HTMLDivElement>({ y: 20 })
  const ref = useScrollReveal<HTMLDivElement>({ y: 20 })

  return (
    <section id="pricing" className="py-24 bg-bg overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div ref={headingRef} className="text-center mb-12">
          <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">Pricing</p>
          <h2
            className="font-display font-bold text-text mb-4"
            style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', letterSpacing: '-0.025em' }}
          >
            Pay for what you track.{' '}
            <span className="text-primary">No surprises.</span>
          </h2>
          <p className="font-body text-muted max-w-xl mx-auto mb-8">
            Limited time — RECON, CIPHER &amp; PHANTOM are 100% off. No credit card required.
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-1 bg-surface border border-border rounded-xl p-1" role="group" aria-label="Billing period">
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

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          {TIERS.map((tier) => {
            const price = priceDisplay(tier.name, tier.monthly, annual)
            return (
            <div
              key={tier.name}
              className={cn(
                'pricing-card gradient-border-primary relative rounded-2xl border p-6 flex flex-col',
                tier.highlight
                  ? 'pricing-card-featured bg-primary/5 border-primary/40'
                  : 'bg-surface border-border'
              )}
            >
              {tier.badge && (
                <div
                  className="badge-shimmer absolute -top-3 left-1/2 -translate-x-1/2 text-bg font-mono text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap"
                  aria-label="Most popular plan"
                >
                  {tier.badge}
                </div>
              )}

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  {tier.highlight && <Zap size={14} className="text-primary" aria-hidden="true" />}
                  <p className="font-display font-bold text-xs text-primary tracking-widest uppercase">{tier.name}</p>
                </div>

                {price.now !== null ? (
                  <div className="mb-1">
                    {price.promoFree && (
                      <span className="inline-block mb-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/30 rounded-full px-2.5 py-0.5">
                        {PROMO_BADGE}
                      </span>
                    )}
                    <div>
                      <span className="font-display text-4xl font-bold text-text">
                        ${price.now}
                      </span>
                      <span className="font-body text-muted text-sm">/mo</span>
                    </div>
                    {price.was !== null && (
                      <p className="font-mono text-xs text-muted mt-0.5 line-through">
                        ${price.was}/mo
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="font-display text-2xl font-bold text-text mb-1">Custom</p>
                )}

                <p className="font-mono text-xs text-muted">
                  <span title="1 SKU = one of your products tracked against one competitor — one competitor scrape per refresh cycle" className="underline decoration-dotted decoration-muted/40 cursor-help">{tier.skus}</span> · {tier.interval}
                </p>
              </div>

              <ul className="flex flex-col gap-2.5 mb-8 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check size={13} className="text-primary mt-0.5 shrink-0 animate-checkmark-pop" aria-hidden="true" />
                    <span className="font-body text-xs text-muted leading-relaxed">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={tier.monthly !== null ? '/sign-up' : 'mailto:sales@specterapp.io'}
                className={cn(
                  'btn-ripple block text-center py-2.5 rounded-lg text-sm font-semibold transition-all duration-250',
                  tier.highlight
                    ? 'gradient-primary-cta'
                    : 'border border-border text-muted hover:text-text hover:border-primary/40 hover:bg-primary/5'
                )}
              >
                {tier.cta}
              </Link>
            </div>
            )
          })}
        </div>
        <p className="font-body text-xs text-muted/70 text-center mt-8 max-w-xl mx-auto">
          A SKU = one of your products tracked against one competitor — one competitor scrape per cycle. Your SKU count = the number of product→competitor links you set up (100 products × 1 competitor = 100 SKUs; 33 products × 3 competitors = 99 SKUs).
        </p>
      </div>
    </section>
  )
}
