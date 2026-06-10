'use client'

import { useScrollReveal } from '@/hooks/use-scroll-reveal'
import { ArrowRight } from 'lucide-react'

const INTEGRATIONS = [
  {
    name: 'Shopify',
    description: 'One-click install. Auto-sync products and write prices back via Admin API.',
    icon: '🛍️',
    href: '#',
  },
  {
    name: 'WooCommerce',
    description: 'REST API key setup. Full product catalog sync and price push.',
    icon: '🔧',
    href: '#',
  },
  {
    name: 'Slack',
    description: 'Real-time OOS and signal alerts delivered to any channel.',
    icon: '💬',
    href: '#',
  },
  {
    name: 'Klaviyo',
    description: 'Trigger email flows on OOS events and price changes.',
    icon: '📧',
    href: '#',
  },
  {
    name: 'Stripe',
    description: 'Billing and subscription management for SPECTER plans.',
    icon: '💳',
    href: '#',
  },
  {
    name: 'Webhooks',
    description: 'Push any signal or alert to your own systems via HMAC-signed webhooks.',
    icon: '🔗',
    href: '#',
  },
]

export default function Integrations() {
  const headingRef = useScrollReveal<HTMLDivElement>({ y: 20 })
  const ref = useScrollReveal<HTMLDivElement>({ stagger: 0.08, childSelector: '.integration-card' })

  return (
    <section id="integrations" className="py-24 bg-surface/30">
      <div className="max-w-7xl mx-auto px-6">
        <div ref={headingRef} className="text-center mb-16">
          <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">
            Integrations
          </p>
          <h2
            className="font-display text-4xl md:text-5xl font-bold text-text mb-4"
            style={{ letterSpacing: '-0.025em' }}
          >
            Plugs into your{' '}
            <span className="text-primary">existing stack.</span>
          </h2>
          <p className="font-body text-muted max-w-xl mx-auto">
            SPECTER connects to the tools you already use. No rip-and-replace.
          </p>
        </div>

        <div ref={ref} className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {INTEGRATIONS.map(({ name, description, icon }) => (
            <div
              key={name}
              className="integration-card relative bg-surface border border-border rounded-2xl p-6 overflow-hidden group cursor-pointer card-hover"
            >
              {/* Icon with bounce on hover */}
              <div
                className="text-2xl mb-3 w-10 h-10 flex items-center justify-center transition-transform duration-300 group-hover:animate-icon-bounce"
                aria-hidden="true"
              >
                {icon}
              </div>

              <h3 className="font-display font-bold text-text mb-1.5">{name}</h3>
              <p className="font-body text-xs text-muted leading-relaxed">{description}</p>

              {/* Hover overlay with "Learn more" */}
              <div className="absolute inset-0 bg-primary/5 border border-primary/20 rounded-2xl flex items-end p-6 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                <div className="flex items-center gap-1.5 font-mono text-xs text-primary font-bold animate-fade-up">
                  Learn more
                  <ArrowRight size={12} className="transition-transform duration-200 group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
