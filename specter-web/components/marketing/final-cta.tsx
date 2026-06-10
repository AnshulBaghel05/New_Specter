'use client'

import Link from 'next/link'
import { useScrollReveal } from '@/hooks/use-scroll-reveal'

export default function FinalCta() {
  const ref = useScrollReveal<HTMLDivElement>({ y: 24 })

  return (
    <section className="py-24 bg-surface/30">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <div ref={ref}>
          <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 text-primary text-xs font-mono uppercase tracking-widest px-4 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            14-day free trial · no credit card
          </div>

          <h2 className="font-display text-5xl md:text-6xl font-bold text-text leading-[1.05] tracking-tight mb-6">
            Stop checking manually.{' '}
            <span className="text-primary">Start winning.</span>
          </h2>

          <p className="font-body text-lg text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            Join merchants who catch every competitor price move within minutes —
            not days. Set up in under 10 minutes. Cancel any time.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/sign-up"
              className="gradient-primary-cta btn-ripple inline-flex items-center justify-center gap-2 font-semibold px-8 py-3.5 rounded-lg text-base transition-all duration-300"
            >
              Start free trial — 14 days
            </Link>
            <Link
              href="mailto:sales@specterapp.io"
              className="border border-border text-muted hover:text-text hover:border-border/80 px-8 py-3.5 rounded-lg transition-colors text-base"
            >
              Talk to sales →
            </Link>
          </div>

          <p className="font-body text-xs text-muted mt-6">
            Average time to first signal: 12 minutes after install
          </p>
        </div>
      </div>
    </section>
  )
}
