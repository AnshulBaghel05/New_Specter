import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Nav from '@/components/marketing/nav'
import Footer from '@/components/marketing/footer'
import BlogCard from '@/components/blog/blog-card'
import NewsletterForm from '@/components/blog/newsletter-form'
import { getPostsByCategory } from '@/lib/blog'
import { CATEGORIES, getCategory } from '@/lib/blog/categories'

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }))
}

export function generateMetadata({ params }: { params: { category: string } }): Metadata {
  const cat = getCategory(params.category)
  if (!cat) return {}
  return {
    title: `${cat.label} — SPECTER Blog`,
    description: cat.description,
    alternates: { canonical: `/blog/category/${cat.slug}` },
    openGraph: {
      title: `${cat.label} — SPECTER Blog`,
      description: cat.description,
      type: 'website',
      url: `/blog/category/${cat.slug}`,
    },
  }
}

export default function CategoryPage({ params }: { params: { category: string } }) {
  const cat = getCategory(params.category)
  if (!cat) notFound()
  const posts = getPostsByCategory(cat.slug)

  return (
    <>
      <Nav />
      <main className="bg-bg min-h-screen">
        <section className="pt-32 pb-10 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(0,232,122,0.05),transparent)] pointer-events-none" />
          <div className="max-w-6xl mx-auto relative">
            <Link href="/blog" className="inline-flex items-center gap-1 font-mono text-[11px] text-muted hover:text-primary mb-6">
              <ArrowLeft size={12} /> All articles
            </Link>
            <p className="font-mono text-primary text-xs uppercase tracking-widest mb-3">Category</p>
            <h1 className="font-display font-bold text-text mb-4" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '-0.03em' }}>
              {cat.label}
            </h1>
            <p className="font-body text-muted text-lg leading-relaxed max-w-2xl">{cat.description}</p>
          </div>
        </section>

        <section className="px-6 pb-16">
          <div className="max-w-6xl mx-auto">
            {posts.length === 0 ? (
              <div className="bg-surface border border-border rounded-2xl p-10 text-center">
                <p className="font-display font-bold text-text text-lg mb-2">New articles coming soon</p>
                <p className="font-body text-muted text-sm mb-6">We’re actively publishing in this category. In the meantime, explore the rest of the blog.</p>
                <Link href="/blog" className="inline-flex items-center gap-2 font-body text-sm text-primary hover:underline">
                  Browse all articles →
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {posts.map((p) => (
                  <BlogCard key={p.slug} post={p} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="px-6 py-16 bg-surface/30 border-t border-border">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display font-bold text-text text-2xl mb-3">Get new {cat.label.toLowerCase()} guides by email</h2>
            <div className="flex justify-center mt-6">
              <NewsletterForm />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
