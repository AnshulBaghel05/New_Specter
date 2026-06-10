import type { FaqItem } from '@/lib/tools/schema'

/** One body section: an H2 (with anchor id) plus authored static prose HTML. */
export interface BlogSection {
  id: string
  heading: string
  /** Build-time-constant authored HTML (paragraphs, h3, lists, tables, callouts). */
  html: string
}

export interface Author {
  id: string
  name: string
  role: string
  bio: string
  /** Initials shown in the avatar chip (no external image dependency). */
  initials: string
}

export interface Category {
  slug: string
  label: string
  description: string
}

export interface BlogCTA {
  heading: string
  body: string
  primaryLabel: string
  primaryHref: string
  secondaryLabel?: string
  secondaryHref?: string
}

export interface BlogPost {
  slug: string
  title: string
  metaTitle: string
  metaDescription: string
  category: string // Category.slug
  tags: string[]
  authorId: string
  datePublished: string // ISO yyyy-mm-dd
  dateModified: string // ISO yyyy-mm-dd
  excerpt: string
  /** <100-word direct answer rendered above the fold for AEO + featured snippets. */
  heroAnswer: string
  keyword: string
  searchIntent: string
  featured?: boolean
  toc: { id: string; label: string }[]
  sections: BlogSection[]
  keyTakeaways: string[]
  faq: FaqItem[]
  internalLinks: { label: string; href: string }[]
  cta: BlogCTA
  relatedSlugs: string[]
}
