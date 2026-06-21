import type { Metadata } from 'next'

// The pricing page itself is a client component (interactive billing toggle), so
// it can't export metadata. This server layout supplies unique, high-intent SEO
// metadata so /pricing no longer inherits the homepage's title/description.
export const metadata: Metadata = {
  title: 'Pricing — Plans from Free to Enterprise',
  description:
    'Simple per-SKU pricing for competitor price monitoring. Start free, no credit card. RECON, CIPHER, PHANTOM, PREDATOR and ECLIPSE plans for Shopify and WooCommerce merchants.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'SPECTER Pricing — Competitor Price Monitoring Plans',
    description:
      'Pay for what you track. Start free with no credit card; scale from RECON to ECLIPSE as you grow.',
    url: 'https://specterapp.io/pricing',
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
