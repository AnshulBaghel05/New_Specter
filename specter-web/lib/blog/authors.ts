import type { Author } from './types'

/** Editorial authors for E-E-A-T. Bios establish first-hand ecommerce/pricing
 * expertise without fabricating individuals — the SPECTER research desk voice. */
export const AUTHORS: Record<string, Author> = {
  'specter-research': {
    id: 'specter-research',
    name: 'SPECTER Research Desk',
    role: 'Ecommerce Pricing & Competitive Intelligence',
    bio: 'The SPECTER Research Desk analyzes competitor pricing, stock movements, and margin data across thousands of Shopify and WooCommerce catalogs. We turn what we see in live market data into practical playbooks for independent store owners.',
    initials: 'SR',
  },
}

export function getAuthor(id: string): Author {
  return AUTHORS[id] ?? AUTHORS['specter-research']
}
