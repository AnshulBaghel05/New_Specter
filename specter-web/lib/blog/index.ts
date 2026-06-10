import type { BlogPost } from './types'
import { POSTS } from './posts'
import { sortByDateDesc, filterByCategory, findRelated, searchPosts } from './helpers'

export * from './helpers'

// ── Registry-bound API (used by pages) ──────────────────────────────────────

const ALL = sortByDateDesc(POSTS)

export function getAllPosts(): BlogPost[] {
  return ALL
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return ALL.find((p) => p.slug === slug)
}

export function getPostsByCategory(categorySlug: string): BlogPost[] {
  return filterByCategory(ALL, categorySlug)
}

export function getFeaturedPosts(): BlogPost[] {
  const featured = ALL.filter((p) => p.featured)
  return featured.length > 0 ? featured : ALL.slice(0, 1)
}

export function getPopularPosts(limit = 4): BlogPost[] {
  return ALL.slice(0, limit)
}

export function getRelatedPosts(post: BlogPost, limit = 3): BlogPost[] {
  return findRelated(ALL, post, limit)
}

export function searchAllPosts(query: string): BlogPost[] {
  return searchPosts(ALL, query)
}
