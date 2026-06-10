import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import Nav from '@/components/marketing/nav'
import Footer from '@/components/marketing/footer'
import BlogCard from '@/components/blog/blog-card'
import BlogSearch, { type SearchIndexItem } from '@/components/blog/blog-search'
import NewsletterForm from '@/components/blog/newsletter-form'
import { getAllPosts, getFeaturedPosts, getPopularPosts } from '@/lib/blog'
import { CATEGORIES, categoryLabel } from '@/lib/blog/categories'

export const metadata: Metadata = {
  title: 'The SPECTER Blog — Ecommerce Pricing, Competitors & Profit',
  description:
    'Practical playbooks for ecommerce store owners: competitor price monitoring, repricing strategy, margin protection, and marketplace selling. Written by the SPECTER Research Desk.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'The SPECTER Blog — Ecommerce Pricing & Competitive Intelligence',
    description:
      'Competitor monitoring, repricing, and margin playbooks for Shopify and WooCommerce merchants.',
    type: 'website',
    url: '/blog',
  },
}

export default function BlogHome() {
  const all = getAllPosts()
  const featured = getFeaturedPosts()
  const lead = featured[0]
  const latest = all.filter((p) => p.slug !== lead?.slug)
  const popular = getPopularPosts(4)

  const searchIndex: SearchIndexItem[] = all.map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    category: p.category,
    categoryLabel: categoryLabel(p.category),
    tags: p.tags,
    keyword: p.keyword,
  }))

  return (
    <>
      <Nav />
      <main className="bg-bg">
        {/* Hero */}
        <section className="pt-32 pb-12 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(0,232,122,0.06),transparent)] pointer-events-none" />
          <div className="max-w-3xl mx-auto text-center relative">
            <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">SPECTER Blog</p>
            <h1
              className="font-display font-bold text-text mb-5"
              style={{ fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', letterSpacing: '-0.03em', lineHeight: 1.05 }}
            >
              Win on price. <span className="text-primary">Keep your margin.</span>
            </h1>
            <p className="font-body text-muted text-lg leading-relaxed mb-8 max-w-xl mx-auto">
              Competitor monitoring, repricing, and profit playbooks for Shopify and WooCommerce operators — grounded in real market data.
            </p>
            <div className="max-w-xl mx-auto">
              <BlogSearch items={searchIndex} />
            </div>
          </div>
        </section>

        {/* Featured */}
        {lead && (
          <section className="px-6 pb-12">
            <div className="max-w-6xl mx-auto">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted mb-4">Featured</p>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <BlogCard post={lead} featured />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {popular.filter((p) => p.slug !== lead.slug).slice(0, 2).map((p) => (
                    <BlogCard key={p.slug} post={p} />
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Categories */}
        <section className="px-6 py-12 bg-surface/30 border-y border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="font-display font-bold text-text text-2xl mb-6">Browse by topic</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {CATEGORIES.map((c) => (
                <Link
                  key={c.slug}
                  href={`/blog/category/${c.slug}`}
                  className="group bg-surface border border-border rounded-xl p-4 hover:border-primary/40 hover:bg-primary/[0.03] transition-all duration-200"
                >
                  <p className="font-display font-bold text-text text-sm group-hover:text-primary transition-colors leading-snug">
                    {c.label}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Latest */}
        <section className="px-6 py-14">
          <div className="max-w-6xl mx-auto">
            <h2 className="font-display font-bold text-text text-2xl mb-8">Latest articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {latest.map((p) => (
                <BlogCard key={p.slug} post={p} />
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 py-16 bg-surface/30 border-t border-border">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display font-bold text-text text-2xl sm:text-3xl mb-3">
              Stop checking competitor prices by hand
            </h2>
            <p className="font-body text-muted leading-relaxed mb-7 max-w-xl mx-auto">
              SPECTER monitors your competitors’ prices and stock in real time and tells you exactly when to raise, lower, or hold — try the free tools or start a trial.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/tools/price-position-analyzer" className="gradient-primary-cta btn-ripple inline-flex items-center justify-center gap-2 font-semibold px-7 py-3 rounded-lg text-sm transition-all duration-300">
                Try the free Price Analyzer <ArrowRight size={15} />
              </Link>
              <Link href="/pricing" className="inline-flex items-center justify-center gap-2 border border-border text-muted hover:text-text hover:border-primary/40 hover:bg-primary/5 px-7 py-3 rounded-lg transition-all duration-300 text-sm">
                See plans &amp; pricing
              </Link>
            </div>
          </div>
        </section>

        {/* Newsletter */}
        <section className="px-6 py-16 bg-bg border-t border-border">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display font-bold text-text text-2xl mb-3">Never miss a pricing edge</h2>
            <p className="font-body text-muted text-sm mb-6 max-w-xl mx-auto">
              Join ecommerce operators getting our competitor-monitoring and margin playbooks by email.
            </p>
            <div className="flex justify-center">
              <NewsletterForm />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
