import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, Calendar, ArrowUpRight } from 'lucide-react'
import Nav from '@/components/marketing/nav'
import Footer from '@/components/marketing/footer'
import ArticleRenderer from '@/components/blog/article-renderer'
import TableOfContents from '@/components/blog/table-of-contents'
import AuthorBio from '@/components/blog/author-bio'
import ArticleCTA from '@/components/blog/article-cta'
import BlogCard from '@/components/blog/blog-card'
import NewsletterForm from '@/components/blog/newsletter-form'
import { getAllPosts, getPostBySlug, getRelatedPosts, readingTimeMinutes, formatDate } from '@/lib/blog'
import { getAuthor } from '@/lib/blog/authors'
import { categoryLabel } from '@/lib/blog/categories'
import { buildArticleSchema, buildBreadcrumbSchema, buildFaqSchema } from '@/lib/tools/schema'

const SITE = 'https://specterapp.io'

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getPostBySlug(params.slug)
  if (!post) return {}
  const url = `/blog/${post.slug}`
  return {
    title: post.metaTitle,
    description: post.metaDescription,
    alternates: { canonical: url },
    keywords: post.tags,
    openGraph: {
      title: post.metaTitle,
      description: post.metaDescription,
      type: 'article',
      url,
      publishedTime: post.datePublished,
      modifiedTime: post.dateModified,
      authors: [getAuthor(post.authorId).name],
    },
  }
}

export default function ArticlePage({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug)
  if (!post) notFound()

  const author = getAuthor(post.authorId)
  const related = getRelatedPosts(post, 3)
  const mins = readingTimeMinutes(post)

  const articleSchema = buildArticleSchema({
    headline: post.title,
    description: post.metaDescription,
    url: `${SITE}/blog/${post.slug}`,
    datePublished: post.datePublished,
    dateModified: post.dateModified,
    authorName: author.name,
  })
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: SITE },
    { name: 'Blog', url: `${SITE}/blog` },
    { name: categoryLabel(post.category), url: `${SITE}/blog/category/${post.category}` },
    { name: post.title, url: `${SITE}/blog/${post.slug}` },
  ])
  const faqSchema = post.faq.length > 0 ? buildFaqSchema(post.faq) : null

  return (
    <>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {faqSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      )}

      <main className="bg-bg">
        {/* Header */}
        <header className="pt-32 pb-10 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(0,232,122,0.05),transparent)] pointer-events-none" />
          <div className="max-w-3xl mx-auto relative">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-mono text-[11px] text-muted mb-6">
              <Link href="/blog" className="hover:text-primary inline-flex items-center gap-1">
                <ArrowLeft size={12} /> Blog
              </Link>
              <span>/</span>
              <Link href={`/blog/category/${post.category}`} className="hover:text-primary">
                {categoryLabel(post.category)}
              </Link>
            </nav>

            <Link
              href={`/blog/category/${post.category}`}
              className="inline-block font-mono text-[11px] uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1 mb-5"
            >
              {categoryLabel(post.category)}
            </Link>

            <h1
              className="font-display font-bold text-text mb-5"
              style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)', letterSpacing: '-0.03em', lineHeight: 1.08 }}
            >
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs text-muted">
              <span className="inline-flex items-center gap-1.5 text-text">{author.name}</span>
              <span className="inline-flex items-center gap-1.5"><Calendar size={12} /> {formatDate(post.datePublished)}</span>
              <span className="inline-flex items-center gap-1.5"><Clock size={12} /> {mins} min read</span>
            </div>
          </div>
        </header>

        {/* AEO hero answer */}
        <div className="px-6">
          <div className="max-w-3xl mx-auto">
            <div className="bg-primary/[0.05] border border-primary/25 rounded-2xl p-6">
              <p className="font-mono text-[11px] uppercase tracking-wider text-primary mb-2">The short answer</p>
              <p className="font-body text-text text-base leading-relaxed">{post.heroAnswer}</p>
            </div>
          </div>
        </div>

        {/* Body + TOC */}
        <div className="px-6 py-12">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10 lg:gap-12">
            <article className="max-w-3xl w-full order-2 lg:order-1">
              <ArticleRenderer post={post} />

              {/* Internal links */}
              {post.internalLinks.length > 0 && (
                <div className="mt-12 bg-surface border border-border rounded-2xl p-6">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted mb-3">Keep reading &amp; tools</p>
                  <ul className="flex flex-col gap-2.5">
                    {post.internalLinks.map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} className="inline-flex items-center gap-1.5 font-body text-sm text-primary hover:underline">
                          {l.label} <ArrowUpRight size={13} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* CTA */}
              <div className="mt-10">
                <ArticleCTA cta={post.cta} />
              </div>

              {/* Author */}
              <div className="mt-10">
                <AuthorBio author={author} updated={formatDate(post.dateModified)} />
              </div>
            </article>

            {/* TOC sidebar */}
            <aside className="order-1 lg:order-2">
              <div className="lg:sticky lg:top-28">
                <TableOfContents items={post.toc} />
              </div>
            </aside>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="px-6 py-16 bg-surface/30 border-t border-border">
            <div className="max-w-6xl mx-auto">
              <h2 className="font-display font-bold text-text text-2xl mb-8">Related reading</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {related.map((p) => (
                  <BlogCard key={p.slug} post={p} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Newsletter */}
        <section className="px-6 py-16 bg-bg border-t border-border">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display font-bold text-text text-2xl mb-3">Get the next pricing playbook</h2>
            <p className="font-body text-muted text-sm mb-6 max-w-xl mx-auto">
              Practical competitor-monitoring, repricing, and margin guides for ecommerce operators — straight to your inbox.
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
