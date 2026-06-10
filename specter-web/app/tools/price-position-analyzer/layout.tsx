import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Price Position Analyzer — Free Competitor Price Comparison Tool',
  description:
    'See exactly where your price sits vs. competitors. Get RAISE / LOWER / HOLD signals, rank position, gap-to-market analysis, and market price range visualization — free, no sign-up required.',
  keywords: [
    'price position analyzer',
    'competitor price comparison tool',
    'pricing strategy calculator',
    'price gap analysis',
    'market price comparison',
    'competitive pricing tool',
    'ecommerce price analyzer',
    'shopify pricing tool',
    'price positioning calculator',
  ],
  alternates: { canonical: '/tools/price-position-analyzer' },
  openGraph: {
    title: 'Price Position Analyzer — Free Competitor Price Comparison',
    description:
      'Compare your price vs. competitors. Get RAISE/LOWER/HOLD signals and see your exact market rank — free tool.',
    type: 'website',
    url: '/tools/price-position-analyzer',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Price Position Analyzer — Competitor Pricing Tool',
    description: 'See where you stand vs. competitors and get pricing signals — free tool.',
  },
}

export default function PricePositionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Price Position Analyzer',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            description:
              'Free competitor price position analyzer. Enter your price and up to 8 competitor prices to see your rank, gap-to-market, and RAISE/LOWER/HOLD pricing signals.',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
            url: 'https://specterapp.io/tools/price-position-analyzer',
            provider: {
              '@type': 'Organization',
              name: 'SPECTER',
              url: 'https://specterapp.io',
            },
          }),
        }}
      />
      {children}
    </>
  )
}
