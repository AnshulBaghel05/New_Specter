'use client'

import Link from 'next/link'
import { Truck, Store, Package, Target, Boxes, Crosshair, ArrowRight, type LucideIcon } from 'lucide-react'

interface ToolCard {
  label: string
  blurb: string
  href: string
  icon: LucideIcon
  bridge?: boolean
}

const TOOLS: ToolCard[] = [
  { label: 'Shipping Calculator', blurb: 'Cheapest carrier & billable weight', href: '/tools/shipping-calculator', icon: Truck },
  { label: 'Shopify Profit', blurb: 'True monthly profit after every fee', href: '/tools/shopify-profit-calculator', icon: Store },
  { label: 'Amazon FBA', blurb: 'Net profit per unit & break-even', href: '/tools/amazon-fba-calculator', icon: Package },
  { label: 'ROAS Calculator', blurb: 'Is your ad spend actually profitable?', href: '/tools/roas-calculator', icon: Target },
  { label: 'Inventory EOQ', blurb: 'When to reorder & how much to buy', href: '/tools/inventory-reorder-calculator', icon: Boxes },
  { label: 'Position Analyzer', blurb: 'Where you sit vs. live competitor prices', href: '/tools/price-position-analyzer', icon: Crosshair, bridge: true },
]

export default function ToolGallery() {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-text mb-1">Run a tool</h2>
      <p className="font-body text-sm text-muted mb-4">
        Every result can be saved here, compared, and turned into an Opportunity Feed action.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TOOLS.map(({ label, blurb, href, icon: Icon, bridge }) => (
          <Link
            key={href}
            href={href}
            className="group bg-surface border border-border rounded-2xl p-4 flex items-start gap-3 hover:border-primary/40 hover:bg-primary/5 transition-all"
          >
            <span className="w-9 h-9 rounded-xl bg-border/40 flex items-center justify-center shrink-0">
              <Icon size={17} className="text-primary" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-display text-sm font-semibold text-text">{label}</span>
                {bridge && (
                  <span className="font-mono text-[10px] uppercase tracking-wide text-primary border border-primary/30 rounded px-1 py-0.5">
                    Live
                  </span>
                )}
              </span>
              <span className="block font-body text-xs text-muted mt-0.5">{blurb}</span>
            </span>
            <ArrowRight
              size={15}
              className="text-muted group-hover:text-primary transition-colors shrink-0 mt-1"
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>
    </section>
  )
}
