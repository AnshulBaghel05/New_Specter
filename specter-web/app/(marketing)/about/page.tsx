import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Eye, BarChart2, Zap, CheckCircle } from 'lucide-react'
import Nav from '@/components/marketing/nav'
import Footer from '@/components/marketing/footer'

export const metadata: Metadata = {
  title: 'About SPECTER — Competitor Pricing Intelligence for Shopify Merchants',
  description:
    'SPECTER is built for Shopify and WooCommerce merchants who compete on price. Real-time competitor price monitoring, AI-powered RAISE/LOWER/HOLD signals, and smart auto-repricing — starting at $79/mo.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About SPECTER — Competitor Pricing Intelligence',
    description:
      'Enterprise retailers have had real-time competitor price monitoring for years. SPECTER brings that same edge to every independent Shopify merchant.',
    type: 'website',
    url: '/about',
  },
}

const STATS = [
  { value: '6', label: 'Free tools', sub: 'Live today, no sign-up' },
  { value: '1 hr', label: 'Fastest cadence', sub: 'PREDATOR plan' },
  { value: '2,000', label: 'SKUs per account', sub: 'On paid plans' },
  { value: 'AI', label: 'Powered signals', sub: 'RAISE / LOWER / HOLD' },
]

const PROBLEMS = [
  'Finding out a competitor dropped prices two days after it happened',
  'Manually checking 50+ competitor pages every morning',
  'Repricing spreadsheets that are stale before you finish them',
  'Missing a stockout window because no one was watching the market',
  'Having no data on whether your price is high, low, or right',
]

const PILLARS = [
  {
    step: '01',
    label: 'Monitor',
    icon: Eye,
    desc: 'Add competitor product URLs. SPECTER scrapes them every 1–6 hours, detecting price changes, stock status changes, and new listings automatically.',
  },
  {
    step: '02',
    label: 'Analyze',
    icon: BarChart2,
    desc: 'Our AI compares your prices against collected market data and generates clear RAISE / LOWER / HOLD signals for every one of your SKUs.',
  },
  {
    step: '03',
    label: 'Act',
    icon: Zap,
    desc: 'Review signals in your dashboard or enable auto-repricing with per-SKU floor and ceiling guardrails — so you never race to the bottom.',
  },
]

const FREE_TOOLS = [
  { label: 'Amazon FBA Calculator', href: '/tools/amazon-fba-calculator' },
  { label: 'Shopify Profit Calculator', href: '/tools/shopify-profit-calculator' },
  { label: 'Shipping Cost Calculator', href: '/tools/shipping-calculator' },
  { label: 'Price Position Analyzer', href: '/tools/price-position-analyzer' },
  { label: 'ROAS Calculator', href: '/tools/roas-calculator' },
  { label: 'Inventory EOQ Calculator', href: '/tools/inventory-reorder-calculator' },
]

const PLATFORM_BENEFITS = [
  'Know the moment a competitor changes their price — not two days later',
  'Get a clear signal: RAISE, LOWER, or HOLD — no interpretation needed',
  'Auto-reprice within guardrails so you stay competitive without margin risk',
  'Monitor out-of-stock windows and capture demand when competitors are down',
  'Full 30–90 day price history on every competitor SKU you track',
]

export default function AboutPage() {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-bg">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="pt-32 pb-20 px-6 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 text-primary text-xs font-mono uppercase tracking-widest px-4 py-1.5 rounded-full mb-8" aria-hidden="true">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              About SPECTER
            </div>
            <h1 className="font-display text-5xl md:text-6xl font-bold text-text tracking-tight leading-[1.08] mb-6">
              Price intelligence built for<br />
              <span className="text-primary">independent merchants.</span>
            </h1>
            <p className="font-body text-xl text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
              Enterprise retailers have had real-time competitor price monitoring for years.
              SPECTER brings that same intelligence — automated scraping, AI-powered signals,
              smart repricing — to every Shopify and WooCommerce merchant.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/sign-up"
                className="gradient-primary-cta btn-ripple inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg font-semibold text-base transition-all duration-300"
              >
                Join early access
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                href="/contact"
                className="border border-border text-muted hover:text-text hover:border-border/80 px-8 py-3.5 rounded-lg text-base text-center transition-colors"
              >
                Get in touch →
              </Link>
            </div>
          </div>
        </section>

        {/* ── Stats strip ──────────────────────────────────────────────────── */}
        <div className="px-6 border-y border-border/50">
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-border/50">
            {STATS.map(({ value, label, sub }) => (
              <div key={label} className="px-8 py-10 text-center">
                <p className="font-display text-4xl font-bold text-primary mb-1">{value}</p>
                <p className="font-body text-sm font-semibold text-text">{label}</p>
                <p className="font-mono text-xs text-muted mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Mission + Problem ────────────────────────────────────────────── */}
        <section className="py-24 px-6">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-start">
            <div>
              <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">Our mission</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-text mb-5 tracking-tight leading-tight">
                Know before<br />they move.
              </h2>
              <p className="font-body text-muted leading-relaxed mb-5">
                Every merchant deserves to know the moment a competitor drops a price or goes
                out of stock. Reaction time is a competitive advantage — and right now,
                enterprise retailers have it. SPECTER exists to change that.
              </p>
              <p className="font-body text-muted leading-relaxed mb-8">
                We believe pricing intelligence shouldn&apos;t require a six-figure contract, a
                dedicated analyst, or an enterprise IT team. It should be a toggle in your
                Shopify dashboard.
              </p>
              <div className="space-y-2.5">
                {PLATFORM_BENEFITS.map((benefit) => (
                  <div key={benefit} className="flex items-start gap-3">
                    <CheckCircle size={14} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
                    <p className="font-body text-sm text-muted leading-relaxed">{benefit}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">
                The problems we&apos;re solving
              </p>
              <div className="space-y-3">
                {PROBLEMS.map((problem) => (
                  <div
                    key={problem}
                    className="flex items-start gap-3 p-4 bg-rose-400/5 border border-rose-400/15 rounded-xl"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-2 shrink-0" aria-hidden="true" />
                    <p className="font-body text-sm text-muted leading-relaxed">{problem}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <section className="py-24 px-6 bg-surface/25 border-y border-border/50">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">How SPECTER works</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-text tracking-tight">
                Three steps. Zero spreadsheets.
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {PILLARS.map(({ step, label, icon: Icon, desc }) => (
                <div key={step} className="bg-surface border border-border rounded-2xl p-7">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="font-mono text-xs text-primary/60">{step}</span>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Icon size={18} className="text-primary" aria-hidden="true" />
                    </div>
                    <h3 className="font-display text-base font-bold text-text">{label}</h3>
                  </div>
                  <p className="font-body text-sm text-muted leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Free tools ───────────────────────────────────────────────────── */}
        <section className="py-24 px-6">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-14 items-center">
            <div>
              <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">Free tools</p>
              <h2 className="font-display text-3xl font-bold text-text mb-5 tracking-tight leading-tight">
                Before the platform,<br />we built the tools.
              </h2>
              <p className="font-body text-muted leading-relaxed mb-5">
                Six free ecommerce calculators — available right now, no account needed.
                FBA fees, Shopify profit margins, shipping rates, ROAS analysis, inventory
                planning, and price position. All run in your browser. Nothing is stored.
              </p>
              <Link
                href="/tools"
                className="inline-flex items-center gap-2 text-primary font-mono text-sm hover:gap-3 transition-all duration-200"
              >
                Browse all 6 tools
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {FREE_TOOLS.map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="group p-4 bg-surface border border-border hover:border-primary/40 hover:bg-surface/60 rounded-xl transition-all duration-200"
                >
                  <p className="font-body text-xs text-muted group-hover:text-text transition-colors leading-snug">{label}</p>
                  <ArrowRight
                    size={10}
                    className="text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pre-launch status + CTA ───────────────────────────────────────── */}
        <section className="py-24 px-6 bg-surface/25 border-t border-border/50">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 border border-amber-400/30 bg-amber-400/5 text-amber-400 text-xs font-mono uppercase tracking-widest px-4 py-1.5 rounded-full mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
              Pre-launch · Active development
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-text mb-5 tracking-tight">
              The platform is coming.<br />
              <span className="text-primary">The tools are live now.</span>
            </h2>
            <p className="font-body text-muted mb-10 leading-relaxed max-w-xl mx-auto">
              SPECTER&apos;s free calculators are fully functional today. The full pricing
              intelligence platform — real-time monitoring, AI signals, auto-repricing — is
              in active development. Sign up to get early access when it launches.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/sign-up"
                className="gradient-primary-cta btn-ripple inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg font-semibold transition-all duration-300"
              >
                Get early access
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                href="/tools"
                className="border border-border text-muted hover:text-text px-8 py-3.5 rounded-lg transition-colors text-center"
              >
                Try free tools →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
