import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const ALL_TOOLS = [
  {
    href:        '/tools/amazon-fba-calculator',
    label:       'Amazon FBA Calculator',
    description: 'Net profit, fee breakdown & package optimizer',
    badge:       'FBA',
  },
  {
    href:        '/tools/shopify-profit-calculator',
    label:       'Shopify Profit Calculator',
    description: 'True margin after fees, apps, returns & ad spend',
    badge:       'Shopify',
  },
  {
    href:        '/tools/roas-calculator',
    label:       'ROAS & Ad Profitability Calculator',
    description: 'Break-even ROAS, true ROAS & funnel analysis',
    badge:       'ROAS',
  },
  {
    href:        '/tools/inventory-reorder-calculator',
    label:       'Inventory EOQ & Restock Calculator',
    description: 'Optimal order qty, safety stock & ABC analysis',
    badge:       'EOQ',
  },
  {
    href:        '/tools/shipping-calculator',
    label:       'Shipping Cost Calculator',
    description: 'Multi-carrier rates, international duties & bulk',
    badge:       'Ship',
  },
  {
    href:        '/tools/price-position-analyzer',
    label:       'Price Position Analyzer',
    description: 'See your rank vs. competitors & AI-style signals',
    badge:       'Price',
  },
]

interface RelatedToolsProps {
  currentHref: string
}

export default function RelatedTools({ currentHref }: RelatedToolsProps) {
  const tools = ALL_TOOLS.filter(t => t.href !== currentHref)

  return (
    <section className="mt-16 pt-10 border-t border-border" aria-label="Related free tools">
      <p className="font-display text-sm font-semibold text-muted uppercase tracking-widest mb-5 text-center">
        More Free Tools
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tools.map(tool => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group flex items-start gap-3 p-4 rounded-xl border border-border bg-surface hover:border-primary/30 hover:bg-primary/5 transition-all"
          >
            <span className="shrink-0 mt-0.5 font-mono text-xs font-bold text-primary/70 bg-primary/10 px-2 py-0.5 rounded-md">
              {tool.badge}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-body text-sm font-semibold text-text group-hover:text-primary transition-colors leading-tight">
                {tool.label}
              </p>
              <p className="font-body text-xs text-muted mt-0.5 leading-relaxed">{tool.description}</p>
            </div>
            <ArrowRight
              size={14}
              className="shrink-0 text-muted group-hover:text-primary transition-colors mt-0.5"
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>
    </section>
  )
}
