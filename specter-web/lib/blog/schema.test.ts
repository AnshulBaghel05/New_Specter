import { describe, it, expect } from 'vitest'
import { buildArticleSchema, buildBreadcrumbSchema, buildFaqSchema } from '@/lib/tools/schema'

describe('buildArticleSchema', () => {
  it('produces a valid schema.org Article with publisher + dates', () => {
    const s = buildArticleSchema({
      headline: 'Test', description: 'Desc',
      url: 'https://specterapp.io/blog/test',
      datePublished: '2026-06-01', dateModified: '2026-06-10',
      authorName: 'SPECTER Research Desk',
    })
    expect(s['@type']).toBe('Article')
    expect(s.headline).toBe('Test')
    expect(s.mainEntityOfPage['@id']).toBe('https://specterapp.io/blog/test')
    expect(s.datePublished).toBe('2026-06-01')
    expect(s.dateModified).toBe('2026-06-10')
    expect(s.publisher.name).toBe('SPECTER')
  })
})

describe('buildBreadcrumbSchema', () => {
  it('numbers positions from 1 in order', () => {
    const s = buildBreadcrumbSchema([
      { name: 'Home', url: 'https://specterapp.io' },
      { name: 'Blog', url: 'https://specterapp.io/blog' },
    ])
    expect(s['@type']).toBe('BreadcrumbList')
    expect(s.itemListElement.map((i) => i.position)).toEqual([1, 2])
    expect(s.itemListElement[1].name).toBe('Blog')
  })
})

describe('buildFaqSchema (reused for articles)', () => {
  it('maps FAQ items to Question/Answer entities', () => {
    const s = buildFaqSchema([{ q: 'Q1?', a: 'A1' }])
    expect(s['@type']).toBe('FAQPage')
    expect(s.mainEntity[0].name).toBe('Q1?')
    expect(s.mainEntity[0].acceptedAnswer.text).toBe('A1')
  })
})
