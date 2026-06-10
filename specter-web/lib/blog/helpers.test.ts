import { describe, it, expect } from 'vitest'
import type { BlogPost } from './types'
import {
  readingTimeMinutes, sortByDateDesc, filterByCategory, findRelated, searchPosts, formatDate,
} from './helpers'

function post(p: Partial<BlogPost> & { slug: string }): BlogPost {
  return {
    slug: p.slug,
    title: p.title ?? p.slug,
    metaTitle: p.title ?? p.slug,
    metaDescription: '',
    category: p.category ?? 'ecommerce-pricing',
    tags: p.tags ?? [],
    authorId: 'specter-research',
    datePublished: p.datePublished ?? '2026-01-01',
    dateModified: p.datePublished ?? '2026-01-01',
    excerpt: p.excerpt ?? '',
    heroAnswer: p.heroAnswer ?? '',
    keyword: p.keyword ?? '',
    searchIntent: '',
    toc: [],
    sections: p.sections ?? [],
    keyTakeaways: [],
    faq: [],
    internalLinks: [],
    cta: { heading: '', body: '', primaryLabel: '', primaryHref: '' },
    relatedSlugs: p.relatedSlugs ?? [],
  }
}

describe('readingTimeMinutes', () => {
  it('strips HTML and estimates ~200 wpm (min 1)', () => {
    const words = Array.from({ length: 400 }, () => 'word').join(' ')
    const p = post({ slug: 'a', heroAnswer: '', sections: [{ id: 's', heading: 'H', html: `<p>${words}</p>` }] })
    expect(readingTimeMinutes(p)).toBe(2) // 400 / 200
    expect(readingTimeMinutes(post({ slug: 'b' }))).toBe(1) // empty → min 1
  })
})

describe('sortByDateDesc', () => {
  it('orders newest first and does not mutate input', () => {
    const input = [post({ slug: 'old', datePublished: '2026-01-01' }), post({ slug: 'new', datePublished: '2026-03-01' })]
    const sorted = sortByDateDesc(input)
    expect(sorted.map((p) => p.slug)).toEqual(['new', 'old'])
    expect(input.map((p) => p.slug)).toEqual(['old', 'new']) // original untouched
  })
})

describe('filterByCategory', () => {
  it('returns only posts in the category', () => {
    const posts = [post({ slug: 'a', category: 'ecommerce-pricing' }), post({ slug: 'b', category: 'competitor-monitoring' })]
    expect(filterByCategory(posts, 'competitor-monitoring').map((p) => p.slug)).toEqual(['b'])
  })
})

describe('findRelated', () => {
  it('prefers explicit relatedSlugs in order, then fills from same category, excluding self', () => {
    const a = post({ slug: 'a', category: 'cat1', relatedSlugs: ['c', 'b'] })
    const b = post({ slug: 'b', category: 'cat1' })
    const c = post({ slug: 'c', category: 'cat2' })
    const d = post({ slug: 'd', category: 'cat1' })
    const related = findRelated([a, b, c, d], a, 3)
    expect(related.map((p) => p.slug)).toEqual(['c', 'b', 'd']) // explicit c,b then same-cat d
    expect(related.some((p) => p.slug === 'a')).toBe(false) // never self
  })
})

describe('searchPosts', () => {
  it('matches title/excerpt/keyword/tags case-insensitively; empty query returns all', () => {
    const posts = [
      post({ slug: 'a', title: 'Repricing Strategy', tags: ['pricing'] }),
      post({ slug: 'b', title: 'Inventory 101', keyword: 'reorder point' }),
    ]
    expect(searchPosts(posts, 'REPRICING').map((p) => p.slug)).toEqual(['a'])
    expect(searchPosts(posts, 'reorder').map((p) => p.slug)).toEqual(['b'])
    expect(searchPosts(posts, '   ')).toHaveLength(2)
  })
})

describe('formatDate', () => {
  it('formats ISO yyyy-mm-dd as a readable date', () => {
    expect(formatDate('2026-06-10')).toBe('June 10, 2026')
    expect(formatDate('bad')).toBe('bad')
  })
})
