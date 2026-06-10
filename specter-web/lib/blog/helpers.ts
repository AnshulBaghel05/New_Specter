import type { BlogPost } from './types'

// Pure blog helpers — no registry/content import, so they unit-test in isolation.

/** Estimated reading time in minutes (strips HTML, ~200 wpm, min 1). */
export function readingTimeMinutes(post: BlogPost): number {
  const words =
    post.sections.reduce(
      (n, s) => n + s.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
      0,
    ) + post.heroAnswer.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

/** Newest first by datePublished (ISO strings sort lexically). */
export function sortByDateDesc(posts: BlogPost[]): BlogPost[] {
  return [...posts].sort((a, b) => (a.datePublished < b.datePublished ? 1 : -1))
}

export function filterByCategory(posts: BlogPost[], categorySlug: string): BlogPost[] {
  return posts.filter((p) => p.category === categorySlug)
}

/** Related posts: explicit relatedSlugs first (in order), then same-category fill. */
export function findRelated(posts: BlogPost[], post: BlogPost, limit = 3): BlogPost[] {
  const bySlug = new Map(posts.map((p) => [p.slug, p]))
  const out: BlogPost[] = []
  const push = (p?: BlogPost) => {
    if (p && p.slug !== post.slug && !out.some((x) => x.slug === p.slug)) out.push(p)
  }
  for (const slug of post.relatedSlugs) push(bySlug.get(slug))
  for (const p of filterByCategory(posts, post.category)) {
    if (out.length >= limit) break
    push(p)
  }
  return out.slice(0, limit)
}

/** Case-insensitive search over title, excerpt, keyword, and tags. */
export function searchPosts(posts: BlogPost[], query: string): BlogPost[] {
  const q = query.trim().toLowerCase()
  if (!q) return posts
  return posts.filter((p) => {
    const hay = [p.title, p.excerpt, p.keyword, ...p.tags].join(' ').toLowerCase()
    return hay.includes(q)
  })
}

/** Format an ISO date (yyyy-mm-dd) as "Month D, YYYY" without a date library. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  if (!y || !m || !d) return iso
  return `${months[m - 1]} ${d}, ${y}`
}
