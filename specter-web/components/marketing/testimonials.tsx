'use client'

import Link from 'next/link'
import { useScrollReveal } from '@/hooks/use-scroll-reveal'
import { Radio, PackageX, Network } from 'lucide-react'

// Honest capability proof — what SPECTER does, not invented customer quotes.
// Swap this section for real, permissioned testimonials once they exist.
const CAPABILITIES = [
  {
    icon: Radio,
    tag: 'Signals',
    title: 'A decision, not a data dump',
    body: 'SPECTER watches your competitors around the clock and tells you exactly when to raise, lower, or hold — so you act on a recommendation instead of a spreadsheet of prices.',
  },
  {
    icon: PackageX,
    tag: 'OOS alerts',
    title: 'Catch out-of-stock windows',
    body: 'When a rival sells out, demand shifts to you. SPECTER flags it within minutes so you can raise prices while the window is open — not after Friday’s sales report.',
  },
  {
    icon: Network,
    tag: 'Domain batching',
    title: 'One polite crawl per domain',
    body: 'Every tracked SKU on a competitor’s site is collected in a single visit — honoring robots.txt and rotating proxies — so monitoring stays fast, respectful, and hard to block.',
  },
]

export default function Testimonials() {
  const headingRef = useScrollReveal<HTMLDivElement>({ y: 20 })
  const ref = useScrollReveal<HTMLDivElement>({ stagger: 0.1, childSelector: '.capability-card' })

  return (
    <section id="testimonials" className="py-24 bg-surface/30">
      <div className="max-w-7xl mx-auto px-6">
        <div ref={headingRef} className="text-center mb-16">
          <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">
            Why SPECTER
          </p>
          <h2
            className="font-display text-4xl md:text-5xl font-bold text-text mb-4"
            style={{ letterSpacing: '-0.025em' }}
          >
            Built for merchants who{' '}
            <span className="text-primary">can’t watch prices all day.</span>
          </h2>
        </div>

        <div ref={ref} className="grid md:grid-cols-3 gap-6">
          {CAPABILITIES.map(({ icon: Icon, tag, title, body }) => (
            <div
              key={title}
              className="capability-card bg-surface border border-border rounded-2xl p-8 flex flex-col card-hover"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center" aria-hidden="true">
                  <Icon size={20} className="text-primary" />
                </div>
                <span className="font-mono text-primary text-xs border border-primary/30 bg-primary/5 px-3 py-1 rounded-full">
                  {tag}
                </span>
              </div>
              <h3 className="font-display font-bold text-text mb-3" style={{ fontSize: '1.2rem', letterSpacing: '-0.015em' }}>
                {title}
              </h3>
              <p className="font-body text-sm text-muted leading-relaxed flex-1">{body}</p>
            </div>
          ))}
        </div>

        {/* Honest, founder-stage CTA in place of borrowed credibility. */}
        <p className="text-center font-body text-sm text-muted mt-12">
          New here and want design-partner pricing?{' '}
          <Link href="mailto:sales@specterapp.io" className="text-primary hover:underline font-medium">
            Talk to us →
          </Link>
        </p>
      </div>
    </section>
  )
}
