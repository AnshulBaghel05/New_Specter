'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useScrollReveal } from '@/hooks/use-scroll-reveal'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const TESTIMONIALS = [
  {
    quote:
      "We were manually checking 40 competitor URLs every morning. With SPECTER we get a RAISE signal before we even open our laptop. Revenue from repricing alone covered the plan cost in the first week.",
    name: 'Marcus D.',
    role: 'Founder, FootwearVault',
    plan: 'PHANTOM',
    metric: '+$4,200 first month',
  },
  {
    quote:
      "The OOS detection is insane. Nike goes out of stock, SPECTER fires a RAISE signal 4 minutes later. I raised prices on 12 SKUs and sold out in 6 hours at $18 higher. That's not possible to do manually.",
    name: 'Priya S.',
    role: 'Head of Ops, TrendKick',
    plan: 'PREDATOR',
    metric: '$18 avg lift per OOS event',
  },
  {
    quote:
      "Switched from Prisync after 2 years. SPECTER is half the price and actually tells me what to DO with the data — not just what my competitors charge. The AI signals paid for themselves in two weeks.",
    name: 'James W.',
    role: 'E-commerce Director, StyleStack',
    plan: 'CIPHER',
    metric: '14× ROI in 90 days',
  },
]

export default function Testimonials() {
  const headingRef = useScrollReveal<HTMLDivElement>({ y: 20 })
  const ref = useScrollReveal<HTMLDivElement>({ y: 20 })
  const [active, setActive] = useState(0)

  function prev() { setActive((a) => (a - 1 + TESTIMONIALS.length) % TESTIMONIALS.length) }
  function next() { setActive((a) => (a + 1) % TESTIMONIALS.length) }

  return (
    <section id="testimonials" className="py-24 bg-surface/30">
      <div className="max-w-7xl mx-auto px-6">
        <div ref={headingRef} className="text-center mb-16">
          <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">
            Customer stories
          </p>
          <h2
            className="font-display text-4xl md:text-5xl font-bold text-text mb-4"
            style={{ letterSpacing: '-0.025em' }}
          >
            Merchants who{' '}
            <span className="text-primary">know first, win.</span>
          </h2>
        </div>

        {/* Desktop: 3 columns */}
        <div
          ref={ref}
          className="hidden md:grid md:grid-cols-3 gap-6"
        >
          {TESTIMONIALS.map(({ quote, name, role, plan, metric }) => (
            <div
              key={name}
              className="testimonial-card bg-surface border border-border rounded-2xl p-8 flex flex-col card-hover"
            >
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-primary text-xs border border-primary/30 bg-primary/5 px-3 py-1 rounded-full">
                  {plan}
                </span>
                <span className="font-mono text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-3 py-1 rounded-full">
                  {metric}
                </span>
              </div>
              <p className="font-body text-sm text-muted leading-relaxed mb-6 flex-1">
                &ldquo;{quote}&rdquo;
              </p>
              <div>
                <p className="font-display font-bold text-text text-sm">{name}</p>
                <p className="font-body text-xs text-muted">{role}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: carousel */}
        <div className="md:hidden">
          <div className="relative overflow-hidden rounded-2xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="bg-surface border border-border rounded-2xl p-8 flex flex-col"
              >
                {(() => {
                  const { quote, name, role, plan, metric } = TESTIMONIALS[active]
                  return (
                    <>
                      <div className="flex items-center justify-between mb-6">
                        <span className="font-mono text-primary text-xs border border-primary/30 bg-primary/5 px-3 py-1 rounded-full">
                          {plan}
                        </span>
                        <span className="font-mono text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-3 py-1 rounded-full">
                          {metric}
                        </span>
                      </div>
                      <p className="font-body text-sm text-muted leading-relaxed mb-6 flex-1">
                        &ldquo;{quote}&rdquo;
                      </p>
                      <div>
                        <p className="font-display font-bold text-text text-sm">{name}</p>
                        <p className="font-body text-xs text-muted">{role}</p>
                      </div>
                    </>
                  )
                })()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={prev}
              className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-muted hover:text-text hover:border-primary/40 transition-all duration-200"
              aria-label="Previous testimonial"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={cn(
                    'rounded-full transition-all duration-300',
                    i === active ? 'w-6 h-2 bg-primary' : 'w-2 h-2 bg-border hover:bg-muted'
                  )}
                  aria-label={`Go to testimonial ${i + 1}`}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-muted hover:text-text hover:border-primary/40 transition-all duration-200"
              aria-label="Next testimonial"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
