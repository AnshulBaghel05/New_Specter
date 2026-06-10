'use client'

import { useScrollReveal } from '@/hooks/use-scroll-reveal'
import { Check, X } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type CellValue = true | false | string

interface Feature {
  label: string
  specter: CellValue
  prisync: CellValue
  wiser: CellValue
  manual: CellValue
}

const FEATURES: Feature[] = [
  { label: 'Real-time OOS detection', specter: true, prisync: false, wiser: false, manual: false },
  { label: 'AI RAISE/LOWER/HOLD signals', specter: true, prisync: false, wiser: false, manual: false },
  { label: 'Auto-reprice on Shopify', specter: true, prisync: true, wiser: false, manual: false },
  { label: 'Domain batching (100× efficiency)', specter: true, prisync: false, wiser: false, manual: false },
  { label: 'Revenue attribution dashboard', specter: true, prisync: false, wiser: false, manual: false },
  { label: 'Custom webhooks', specter: true, prisync: false, wiser: false, manual: false },
  { label: 'Price floor/ceiling guardrails', specter: true, prisync: true, wiser: true, manual: false },
  { label: 'Free tools included', specter: true, prisync: false, wiser: false, manual: false },
  { label: 'Starting price', specter: '$49/mo', prisync: '$99/mo', wiser: '$139/mo', manual: '$0 + 40h/wk' },
]

type ColKey = 'specter' | 'prisync' | 'wiser' | 'manual'
const COLS: { label: string; key: ColKey }[] = [
  { label: 'SPECTER', key: 'specter' },
  { label: 'Prisync', key: 'prisync' },
  { label: 'Wiser', key: 'wiser' },
  { label: 'Manual', key: 'manual' },
]

function TableCell({ value, isSpecter }: { value: CellValue; isSpecter: boolean }) {
  if (value === true)
    return (
      <Check
        size={16}
        className={cn(
          'mx-auto animate-checkmark-pop',
          isSpecter ? 'text-primary' : 'text-muted'
        )}
        aria-label="Yes"
      />
    )
  if (value === false)
    return <X size={14} className="text-border mx-auto" aria-label="No" />
  return (
    <span className={cn('font-mono text-xs', isSpecter ? 'text-primary font-bold' : 'text-muted')}>
      {value}
    </span>
  )
}

export default function CompetitorTable() {
  const headingRef = useScrollReveal<HTMLDivElement>({ y: 20 })
  const ref = useScrollReveal<HTMLDivElement>({ y: 20 })

  return (
    <section id="compare" className="py-24 bg-surface/30">
      <div className="max-w-7xl mx-auto px-6">
        <div ref={headingRef} className="text-center mb-16">
          <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">
            How We Compare
          </p>
          <h2
            className="font-display text-4xl md:text-5xl font-bold text-text mb-4"
            style={{ letterSpacing: '-0.025em' }}
          >
            Not just cheaper.{' '}
            <span className="text-primary">Actually different.</span>
          </h2>
        </div>

        <div ref={ref} className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="text-left font-body text-muted text-sm font-normal pb-4 w-1/3" />
                {COLS.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'text-center pb-4 font-display font-bold text-sm',
                      col.key === 'specter'
                        ? 'text-primary border-x border-t border-primary/40 bg-primary/5 rounded-t-xl px-4 pt-4 shadow-[0_0_20px_rgba(0,232,122,0.08)]'
                        : 'text-muted px-4'
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((feat, fi) => (
                <tr
                  key={feat.label}
                  className="group table-row-hover"
                >
                  <td className="font-body text-sm text-muted py-3.5 pr-6 border-b border-border group-hover:text-text transition-colors duration-150">
                    {feat.label}
                  </td>
                  {COLS.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'text-center py-3.5 border-b transition-colors duration-150',
                        col.key === 'specter'
                          ? cn(
                              'border-x border-primary/40 bg-primary/5 px-4',
                              fi === FEATURES.length - 1
                                ? 'border-b border-primary/40 rounded-b-xl'
                                : 'border-b border-primary/10'
                            )
                          : 'border-border px-4 group-hover:bg-surface/60'
                      )}
                    >
                      <TableCell value={feat[col.key]} isSpecter={col.key === 'specter'} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-center mt-12">
          <Link
            href="/sign-up"
            className="gradient-primary-cta btn-ripple inline-block font-semibold px-8 py-3.5 rounded-lg transition-all duration-300"
          >
            Start free — no credit card
          </Link>
          <p className="font-body text-xs text-muted mt-3">
            14-day free trial · cancel anytime
          </p>
        </div>
      </div>
    </section>
  )
}
