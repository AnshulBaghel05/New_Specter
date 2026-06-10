'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FAQItem {
  q: string
  a: string
}

function FAQRow({ q, a }: FAQItem) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-border/60 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-4 p-4 text-left bg-surface/40 hover:bg-surface/70 transition-colors"
        aria-expanded={open}
      >
        <span className="font-body text-sm font-semibold text-text leading-snug">{q}</span>
        <ChevronDown
          size={15}
          className={cn(
            'text-muted shrink-0 mt-0.5 transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 bg-surface/20 border-t border-border/40">
          <p className="font-body text-sm text-muted leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  )
}

interface ToolFAQProps {
  items: FAQItem[]
  className?: string
}

export default function ToolFAQ({ items, className }: ToolFAQProps) {
  return (
    <section className={cn('mt-12', className)} aria-labelledby="faq-heading">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: items.map(({ q, a }) => ({
              '@type': 'Question',
              name: q,
              acceptedAnswer: { '@type': 'Answer', text: a },
            })),
          }),
        }}
      />
      <h2
        id="faq-heading"
        className="font-display text-2xl font-bold text-text mb-6 tracking-tight"
      >
        Frequently Asked Questions
      </h2>
      <div className="space-y-3">
        {items.map((item, i) => (
          <FAQRow key={i} {...item} />
        ))}
      </div>
    </section>
  )
}
