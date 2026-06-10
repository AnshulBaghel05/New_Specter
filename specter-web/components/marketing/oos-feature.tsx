'use client'

import { useScrollReveal } from '@/hooks/use-scroll-reveal'
import { PackageX, Zap, TrendingUp } from 'lucide-react'

const TIMELINE = [
  {
    time: '09:14 AM',
    icon: PackageX,
    label: 'OOS detected',
    body: 'Nike.com marks Air Max 270 out of stock across 3 colorways.',
    accent: 'text-rose-400',
    accentBg: 'bg-rose-400/10',
    accentBorder: 'border-rose-400/20',
  },
  {
    time: '09:16 AM',
    icon: Zap,
    label: 'RAISE signal fired',
    body: 'SPECTER detects demand gap. Signal: RAISE $18 — your store is now the best in-stock option.',
    accent: 'text-primary',
    accentBg: 'bg-primary/10',
    accentBorder: 'border-primary/20',
  },
  {
    time: '09:18 AM',
    icon: TrendingUp,
    label: 'Auto-reprice applied',
    body: 'Price updated on Shopify. Conversion rate up 34% over the next 6 hours.',
    accent: 'text-emerald-400',
    accentBg: 'bg-emerald-400/10',
    accentBorder: 'border-emerald-400/20',
  },
]

export default function OosFeature() {
  const copyRef = useScrollReveal<HTMLDivElement>({ y: 24 })
  const ref = useScrollReveal<HTMLDivElement>({ stagger: 0.15, childSelector: '.timeline-item' })

  return (
    <section id="oos" className="py-24 bg-bg">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Copy */}
          <div ref={copyRef}>
            <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">
              OOS Intelligence
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-text mb-6 leading-tight">
              Competitor goes OOS.{' '}
              <span className="text-primary">You capture the demand.</span>
            </h2>
            <p className="font-body text-muted text-lg leading-relaxed mb-8">
              SPECTER watches every competitor URL for out-of-stock events. The moment
              a rival can&apos;t fulfill, you get a RAISE signal — before demand shifts
              and before your competitors notice.
            </p>
            <div className="flex flex-col gap-3">
              {[
                'Email and Slack alerts in under 2 minutes',
                'Auto-reprice on PHANTOM+ plans',
                'Per-SKU alert silencing',
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span className="font-body text-sm text-muted">{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div ref={ref} className="flex flex-col gap-0">
            {TIMELINE.map((item, i) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="timeline-item flex gap-5">
                  {/* Connector */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center border ${item.accentBg} ${item.accentBorder} shrink-0`}
                    >
                      <Icon size={15} className={item.accent} />
                    </div>
                    {i < TIMELINE.length - 1 && (
                      <div className="w-px flex-1 bg-border my-2" />
                    )}
                  </div>

                  {/* Content */}
                  <div className={i < TIMELINE.length - 1 ? 'pb-8' : ''}>
                    <p className="font-mono text-xs text-muted mb-1">{item.time}</p>
                    <p className={`font-display font-bold text-base mb-1 ${item.accent}`}>
                      {item.label}
                    </p>
                    <p className="font-body text-sm text-muted leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
