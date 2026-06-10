import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/blog'
import { CATEGORIES } from '@/lib/blog/categories'

const BASE = 'https://specterapp.io'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const marketing = [
    { url: BASE, priority: 1.0, changeFrequency: 'weekly' as const },
    { url: `${BASE}/features`, priority: 0.8, changeFrequency: 'monthly' as const },
    { url: `${BASE}/pricing`, priority: 0.9, changeFrequency: 'monthly' as const },
    { url: `${BASE}/about`, priority: 0.5, changeFrequency: 'monthly' as const },
    { url: `${BASE}/privacy`, priority: 0.3, changeFrequency: 'yearly' as const },
    { url: `${BASE}/terms`, priority: 0.3, changeFrequency: 'yearly' as const },
  ]

  const tools = [
    '/tools/amazon-fba-calculator',
    '/tools/shopify-profit-calculator',
    '/tools/shipping-calculator',
    '/tools/price-position-analyzer',
    '/tools/roas-calculator',
    '/tools/inventory-reorder-calculator',
  ].map((path) => ({
    url: `${BASE}${path}`,
    priority: 0.85,
    changeFrequency: 'monthly' as const,
  }))

  const toolsHub = {
    url: `${BASE}/tools`,
    priority: 0.8,
    changeFrequency: 'monthly' as const,
  }

  const blogHub = { url: `${BASE}/blog`, priority: 0.8, changeFrequency: 'weekly' as const }
  const blogCategories = CATEGORIES.map((c) => ({
    url: `${BASE}/blog/category/${c.slug}`,
    priority: 0.6,
    changeFrequency: 'weekly' as const,
  }))
  const blogPosts = getAllPosts().map((p) => ({
    url: `${BASE}/blog/${p.slug}`,
    priority: 0.7,
    changeFrequency: 'monthly' as const,
    lastModified: new Date(p.dateModified),
  }))

  const staticEntries = [...marketing, toolsHub, ...tools, blogHub, ...blogCategories].map((entry) => ({
    ...entry,
    lastModified: now,
  }))

  return [...staticEntries, ...blogPosts]
}
