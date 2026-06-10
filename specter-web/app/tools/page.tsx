import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/marketing/nav'
import Footer from '@/components/marketing/footer'
import { ArrowRight, Calculator, TrendingUp, Truck, BarChart2, RefreshCw } from 'lucide-react'

export const metadata: Metadata = {
  title: '6 Free Ecommerce Calculators for Shopify & Amazon Sellers',
  description:
    'Free tools for ecommerce merchants: Amazon FBA fee calculator, Shopify profit calculator, shipping rate estimator, price position analyzer, ROAS calculator, and inventory EOQ reorder calculator. No sign-up required.',
  keywords: [
    'free ecommerce calculators',
    'shopify tools',
    'amazon fba tools',
    'ecommerce profit calculator',
    'inventory calculator',
    'shipping calculator ecommerce',
    'roas calculator free',
    'price comparison tool',
    'ecommerce free tools',
  ],
  alternates: { canonical: '/tools' },
  openGraph: {
    title: '6 Free Ecommerce Calculators — SPECTER Tools',
    description:
      'Amazon FBA, Shopify profit, shipping rates, inventory EOQ, ROAS, and price position — all free, client-side only.',
    type: 'website',
    url: '/tools',
  },
}

const TOOLS = [
  {
    href: '/tools/amazon-fba-calculator',
    icon: Calculator,
    label: 'Amazon FBA Calculator',
    description:
      'Calculate exact FBA fulfillment fees, referral fees, storage costs, and true net profit per unit using 2025 official Amazon rates.',
    badge: 'Amazon',
    badgeColor: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  },
  {
    href: '/tools/shopify-profit-calculator',
    icon: TrendingUp,
    label: 'Shopify Profit Calculator',
    description:
      'See your true monthly Shopify profit after subscription fees, payment processing, apps, returns, shipping, and ad spend.',
    badge: 'Shopify',
    badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  },
  {
    href: '/tools/shipping-calculator',
    icon: Truck,
    label: 'Shipping Cost Calculator',
    description:
      'Compare UPS, FedEx, USPS, and DHL rates for domestic zones. Calculate international shipping with duties, taxes, and landed costs.',
    badge: 'Multi-carrier',
    badgeColor: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  },
  {
    href: '/tools/price-position-analyzer',
    icon: BarChart2,
    label: 'Price Position Analyzer',
    description:
      'Enter your price and up to 8 competitor prices to see your market rank, gap analysis, and RAISE / LOWER / HOLD pricing signals.',
    badge: 'Pricing',
    badgeColor: 'text-primary bg-primary/10 border-primary/30',
  },
  {
    href: '/tools/roas-calculator',
    icon: TrendingUp,
    label: 'ROAS & Ad Profitability Calculator',
    description:
      'Calculate true ROAS, break-even ROAS, and net profit. Full funnel analysis with platform benchmarks for Meta, Google, TikTok, and Amazon.',
    badge: 'Advertising',
    badgeColor: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  },
  {
    href: '/tools/inventory-reorder-calculator',
    icon: RefreshCw,
    label: 'Inventory EOQ & Reorder Calculator',
    description:
      'Calculate Economic Order Quantity, reorder point, and safety stock. Includes seasonal demand planning and ABC inventory classification.',
    badge: 'Inventory',
    badgeColor: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
  },
]

export default function ToolsPage() {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-bg">
        {/* Hero */}
        <section className="pt-28 pb-16 text-center px-6">
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 text-primary text-xs font-mono uppercase tracking-widest px-4 py-1.5 rounded-full mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
              Free tools
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-text tracking-tight mb-5 leading-tight">
              6 free calculators built{' '}
              <span className="text-primary">for Shopify merchants.</span>
            </h1>
            <p className="font-body text-lg text-muted leading-relaxed max-w-2xl mx-auto">
              Professional-grade ecommerce tools — FBA fees, profit margins, shipping costs,
              inventory planning, ad ROAS, and competitor pricing — fully client-side, no
              account or sign-up required.
            </p>
          </div>
        </section>

        {/* Grid */}
        <section className="max-w-5xl mx-auto px-6 pb-24">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TOOLS.map(({ href, icon: Icon, label, description, badge, badgeColor }) => (
              <Link
                key={href}
                href={href}
                className="group relative bg-surface border border-border rounded-2xl p-6 hover:border-primary/40 hover:bg-surface/80 transition-all duration-300 flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-primary" aria-hidden="true" />
                  </div>
                  <span
                    className={`text-xs font-mono border rounded-full px-2.5 py-0.5 ${badgeColor}`}
                  >
                    {badge}
                  </span>
                </div>
                <h2 className="font-display text-base font-bold text-text mb-2 leading-snug group-hover:text-primary transition-colors">
                  {label}
                </h2>
                <p className="font-body text-sm text-muted leading-relaxed flex-1 mb-4">
                  {description}
                </p>
                <div className="flex items-center gap-1 text-xs font-mono text-primary">
                  Open tool
                  <ArrowRight
                    size={12}
                    className="transition-transform duration-200 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="mt-16 text-center border border-border/60 rounded-2xl bg-surface/30 p-10">
            <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">
              Want these automated?
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-text mb-4 tracking-tight">
              Stop calculating. Start{' '}
              <span className="text-primary">winning.</span>
            </h2>
            <p className="font-body text-muted mb-8 max-w-md mx-auto leading-relaxed">
              SPECTER monitors competitor prices in real time and delivers AI-powered
              RAISE / LOWER / HOLD signals directly to your Shopify dashboard.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 bg-primary text-bg font-semibold px-8 py-3 rounded-lg hover:opacity-90 transition-opacity text-sm"
            >
              Start free — 14 days
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <p className="font-body text-xs text-muted mt-4">
              No credit card required
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
