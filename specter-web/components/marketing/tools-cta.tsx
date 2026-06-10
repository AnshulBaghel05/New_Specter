'use client'

import Link from 'next/link'
import { useScrollReveal } from '@/hooks/use-scroll-reveal'
import { Package, ShoppingBag, Truck, TrendingUp, BarChart2, Archive } from 'lucide-react'

const TOOLS = [
  {
    icon: Package,
    label: 'Amazon FBA Calculator',
    description: 'True FBA profit after fulfillment fees, referral, and storage.',
    href: '/tools/amazon-fba-calculator',
  },
  {
    icon: ShoppingBag,
    label: 'Shopify Profit Calculator',
    description: 'Net profit after plan fees, processing, returns, and ad spend.',
    href: '/tools/shopify-profit-calculator',
  },
  {
    icon: Truck,
    label: 'Shipping Rate Estimator',
    description: 'Compare UPS, FedEx, USPS, and DHL rates side by side.',
    href: '/tools/shipping-calculator',
  },
  {
    icon: TrendingUp,
    label: 'Price Position Analyzer',
    description: 'See where you sit vs. competitors and get a RAISE/HOLD/LOWER signal.',
    href: '/tools/price-position-analyzer',
  },
  {
    icon: BarChart2,
    label: 'Ad ROAS Calculator',
    description: 'Find your break-even ROAS and true ad profitability.',
    href: '/tools/roas-calculator',
  },
  {
    icon: Archive,
    label: 'Inventory Reorder Calculator',
    description: 'EOQ, safety stock, and reorder point from your demand data.',
    href: '/tools/inventory-reorder-calculator',
  },
]

export default function ToolsCta() {
  const headingRef = useScrollReveal<HTMLDivElement>({ y: 20 })
  const ref = useScrollReveal<HTMLDivElement>({ stagger: 0.07, childSelector: '.tool-card' })

  return (
    <section id="tools" className="py-24 bg-bg">
      <div className="max-w-7xl mx-auto px-6">
        <div ref={headingRef} className="text-center mb-16">
          <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">
            Free Tools
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-text mb-4">
            6 calculators.{' '}
            <span className="text-primary">No sign-up needed.</span>
          </h2>
          <p className="font-body text-muted max-w-xl mx-auto">
            All math runs in your browser. Nothing is sent to our servers.
          </p>
        </div>

        <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {TOOLS.map(({ icon: Icon, label, description, href }) => (
            <Link
              key={href}
              href={href}
              className="tool-card group bg-surface border border-border rounded-2xl p-6 hover:border-primary/30 transition-all duration-300 card-hover-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                <Icon size={18} className="text-primary" />
              </div>
              <h3 className="font-display font-bold text-text mb-1.5">{label}</h3>
              <p className="font-body text-xs text-muted leading-relaxed">{description}</p>
            </Link>
          ))}
        </div>

        <div className="text-center">
          <p className="font-body text-sm text-muted">
            Want automated signals instead of manual math?{' '}
            <Link href="/sign-up" className="text-primary hover:underline">
              Try SPECTER free →
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
