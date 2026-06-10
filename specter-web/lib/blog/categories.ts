import type { Category } from './types'

/** The 10 blog categories. Order = display order on the blog home category grid. */
export const CATEGORIES: Category[] = [
  { slug: 'ecommerce-pricing', label: 'Ecommerce Pricing', description: 'Pricing strategy, repricing, and how to set prices that protect margin and win sales.' },
  { slug: 'competitor-monitoring', label: 'Competitor Monitoring', description: 'Track competitor prices, stock, and moves in real time — and act before they do.' },
  { slug: 'profit-optimization', label: 'Profit Optimization', description: 'Find and fix the hidden costs and leaks quietly eroding your ecommerce margins.' },
  { slug: 'product-research', label: 'Product Research', description: 'Validate demand, vet suppliers, and pick products that actually sell.' },
  { slug: 'inventory-management', label: 'Inventory Management', description: 'Reorder points, safety stock, and avoiding the stockouts that cost you sales.' },
  { slug: 'marketplace-selling', label: 'Marketplace Selling', description: 'Compete and win on Amazon, Walmart, eBay, and other marketplaces.' },
  { slug: 'ecommerce-analytics', label: 'Ecommerce Analytics', description: 'Turn store data into decisions — the metrics that actually move profit.' },
  { slug: 'ecommerce-growth', label: 'Ecommerce Growth', description: 'Acquisition, retention, and scaling a store without breaking your unit economics.' },
  { slug: 'ecommerce-operations', label: 'Ecommerce Operations', description: 'Fulfillment, processes, and the operational details that compound at scale.' },
  { slug: 'ecommerce-strategy', label: 'Ecommerce Strategy', description: 'Positioning, moats, and the long game of building a durable ecommerce business.' },
]

const BY_SLUG: Record<string, Category> = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c]))

export function getCategory(slug: string): Category | undefined {
  return BY_SLUG[slug]
}

export function categoryLabel(slug: string): string {
  return BY_SLUG[slug]?.label ?? slug
}
