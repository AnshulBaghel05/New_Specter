'use client'

import { useScrollReveal } from '@/hooks/use-scroll-reveal'
import { Check, X } from 'lucide-react'

const COMPARISON = [
  { label: 'Scrapes per domain visit', specter: '50–200 SKUs', others: '1 SKU' },
  { label: 'Per-SKU scrape cost', specter: '$0.002', others: '$0.10–0.40' },
  { label: 'Robots.txt compliance', specter: 'Auto-detected', others: 'Manual review' },
  { label: 'IP rotation', specter: 'Included', others: 'Extra charge' },
  { label: 'Rate limiting', specter: 'Adaptive', others: 'Fixed / fails' },
]

export default function DomainBatching() {
  const headingRef = useScrollReveal<HTMLDivElement>({ y: 20 })
  const ref = useScrollReveal<HTMLDivElement>({ stagger: 0.08, childSelector: '.compare-row' })

  return (
    <section id="batching" className="py-24 bg-bg">
      <div className="max-w-7xl mx-auto px-6">
        <div ref={headingRef} className="text-center mb-16">
          <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">
            Domain Batching
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-text mb-4">
            100× more efficient than{' '}
            <span className="text-muted">anyone else.</span>
          </h2>
          <p className="font-body text-muted max-w-xl mx-auto">
            Competitors scrape one SKU per visit. SPECTER batches an entire domain in
            a single crawl — meaning near-zero marginal cost as you scale.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          {/* Header row */}
          <div className="grid grid-cols-3 gap-4 mb-2 px-4">
            <div />
            <div className="text-center font-display font-bold text-primary text-sm">
              SPECTER
            </div>
            <div className="text-center font-display font-bold text-muted text-sm">
              Others
            </div>
          </div>

          {/* Comparison rows */}
          <div
            ref={ref}
            className="bg-surface border border-border rounded-2xl overflow-hidden divide-y divide-border"
          >
            {COMPARISON.map(({ label, specter, others }) => (
              <div
                key={label}
                className="compare-row grid grid-cols-3 gap-4 px-6 py-4 items-center"
              >
                <span className="font-body text-sm text-muted">{label}</span>
                <div className="flex items-center justify-center gap-1.5">
                  <Check size={14} className="text-primary shrink-0" />
                  <span className="font-mono text-xs text-primary font-medium">{specter}</span>
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  <X size={14} className="text-muted shrink-0" />
                  <span className="font-mono text-xs text-muted">{others}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
