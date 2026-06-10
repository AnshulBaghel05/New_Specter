# SPECTER Blog System — Design + Implementation Plan

**Date:** 2026-06-10
**Goal:** Production-grade blog (architecture + SEO/AEO framework + 10 categories + 5 long-form articles) under `app/(marketing)/blog`, native to the existing Next 14 app — driving organic traffic and qualified Shopify/Woo merchants to SPECTER.

## Verified context

- Nav already links `/blog` (currently 404). Domain `https://specterapp.io`; `metadataBase` set; title template `%s | SPECTER`.
- Reuse: `Nav`/`Footer`, JSON-LD builders in `lib/tools/schema.ts` (`buildFaqSchema`), `FaqItem` type, `/api/email-capture` (newsletter), `lib/utils.cn`, design tokens (--bg/--surface/--border/--primary/--text/--muted, fonts Syne/DM Sans/JetBrains Mono).
- No MDX, no typography plugin, no date/reading-time libs → typed TS content + scoped prose CSS + inline helpers.

## Locked decisions

1. Typed TS content registry (no CMS/MDX). 2. Product-aligned 5 topics. 3. ~1,800–2,400 words each.

## Architecture

```
app/(marketing)/blog/
  page.tsx                 Blog home (featured, categories, popular, search, newsletter, CTA)
  [slug]/page.tsx          Article (generateMetadata + JSON-LD + renderer)
  category/[category]/page.tsx   Category hub
lib/blog/
  types.ts        BlogPost, BlogSection, Author, Category types
  categories.ts   10 categories (slug,label,description,icon)
  authors.ts      Editorial author(s) for E-E-A-T
  posts/<slug>.ts one BlogPost per article (5)
  index.ts        registry + helpers (getAllPosts, getPostBySlug, getPostsByCategory, getFeatured, getRelated, searchPosts, readingTime)
components/blog/
  article-renderer.tsx  sections (h2 + prose html), key takeaways, FAQ
  blog-card.tsx         post card (category, title, excerpt, meta)
  blog-search.tsx       client-side filter over registry
  newsletter-form.tsx   posts to /api/email-capture
  table-of-contents.tsx anchors from sections
  author-bio.tsx        E-E-A-T author block
  article-cta.tsx       contextual conversion CTA
```

### Data model (`lib/blog/types.ts`)

```typescript
export interface BlogSection { id: string; heading: string; html: string } // html = static authored prose
export interface BlogPost {
  slug: string
  title: string            // H1 / display
  metaTitle: string        // <title>
  metaDescription: string  // meta description (≤160)
  category: string         // category slug
  tags: string[]
  authorId: string
  datePublished: string    // ISO
  dateModified: string     // ISO
  excerpt: string          // card + OG description
  heroAnswer: string       // <100-word AEO answer rendered above the fold
  keyword: string          // primary target keyword
  searchIntent: string
  featured?: boolean
  toc: { id: string; label: string }[]
  sections: BlogSection[]
  keyTakeaways: string[]
  faq: FaqItem[]           // reuse lib/tools/schema FaqItem
  internalLinks: { label: string; href: string }[]
  cta: { heading: string; body: string; primaryLabel: string; primaryHref: string; secondaryLabel?: string; secondaryHref?: string }
  relatedSlugs: string[]
}
```

### SEO/AEO

- Per article `generateMetadata`: title=metaTitle, description=metaDescription, `alternates.canonical: /blog/<slug>`, OG (article type, published/modified time, author).
- JSON-LD per article: **Article** + **FAQPage** (`buildFaqSchema`) + **BreadcrumbList** (new `buildArticleSchema`, `buildBreadcrumbSchema` in `schema.ts`).
- AEO: `heroAnswer` (<100 words) directly under H1; question-style H2s; key-takeaways list; FAQ; scannable formatting.
- E-E-A-T: named author + bio + role; datePublished/Modified; outbound-free, source-grounded claims.
- Sitemap: add `/blog`, each `/blog/category/<c>`, each `/blog/<slug>`.

### Internal linking

Pillars = Competitor Monitoring + Ecommerce Pricing. Each article links to: 2–3 sibling posts (`relatedSlugs`), ≥2 free tools, `/pricing` or `/features`. Category hubs interlink. Blog home links all.

## The 5 articles

| # | slug | category | keyword |
|---|------|----------|---------|
| 1 | competitor-price-monitoring-shopify | competitor-monitoring | shopify competitor price monitoring |
| 2 | catch-competitors-out-of-stock | competitor-monitoring | competitor out of stock |
| 3 | repricing-strategy-raise-lower-hold | ecommerce-pricing | ecommerce repricing strategy |
| 4 | hidden-costs-killing-ecommerce-margins | profit-optimization | ecommerce profit margin leaks |
| 5 | pricing-against-amazon-marketplace-competitors | marketplace-selling | pricing against amazon competitors |

## Tasks

1. **Schema + types + taxonomy:** extend `schema.ts` (`buildArticleSchema`, `buildBreadcrumbSchema`); `lib/blog/types.ts`, `categories.ts`, `authors.ts`. Unit-test the pure JSON-LD builders + reading-time.
2. **Registry + helpers:** `lib/blog/index.ts` (+ `readingTime`); unit tests for helpers (byCategory/related/search/slug). (Pure logic — testable per repo rules.)
3. **Prose styles:** `.article-prose` in `app/globals.css` using design tokens.
4. **Components:** blog-card, table-of-contents, author-bio, article-cta, newsletter-form, blog-search, article-renderer.
5. **Pages:** `/blog`, `/blog/category/[category]`, `/blog/[slug]` (generateStaticParams + generateMetadata + JSON-LD).
6. **Content:** write the 5 BlogPost files (~1,800–2,400 words each, all required sections).
7. **Sitemap** update.
8. **Verify:** tsc, lint, vitest (blog logic + existing), build, serve + eyeball `/blog` and one article.

## Guardrails

Pure-logic unit tests only (registry/schema/reading-time) — no tests for blog UI components (repo rule: marketing components untested). No backend changes. Reuse `/api/email-capture` as-is. `dangerouslySetInnerHTML` only on build-time-constant authored HTML.
