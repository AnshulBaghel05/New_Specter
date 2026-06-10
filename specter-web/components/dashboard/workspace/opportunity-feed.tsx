'use client'

import Link from 'next/link'
import { Sparkles, ArrowRight, TrendingUp } from 'lucide-react'
import { useOpportunityFeed } from '@/lib/calculations-api'
import { trackOpportunityClicked } from '@/lib/analytics'

/**
 * The Opportunity Feed — the Workspace's headline differentiator. Aggregates the
 * deterministic insight outputs across every saved report into one prioritized,
 * quantified action list ("you could save $340/mo in shipping"), each linking to
 * the tool that acts on it. This is what makes the Workspace feel like SPECTER.
 */
export default function OpportunityFeed() {
  const { items, isLoading, isError } = useOpportunityFeed()

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} className="text-primary" aria-hidden="true" />
        <h2 className="font-display text-lg font-semibold text-text">Opportunity Feed</h2>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      ) : isError || items.length === 0 ? (
        <div className="bg-surface border border-border border-dashed rounded-2xl p-6 text-center">
          <p className="font-body text-sm text-muted">
            Save a tool result and SPECTER will surface where the money is — quantified and ranked.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.calcId}>
              <Link
                href={item.href}
                onClick={() => trackOpportunityClicked(item.toolKey)}
                className="group flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <TrendingUp size={16} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-body text-sm text-text leading-relaxed">{item.text}</span>
                  <span className="block font-body text-xs text-muted mt-1">
                    From <span className="text-text">{item.calcName}</span> · {item.toolLabel}
                  </span>
                </span>
                <ArrowRight
                  size={16}
                  className="text-muted group-hover:text-primary transition-colors shrink-0 mt-0.5"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
