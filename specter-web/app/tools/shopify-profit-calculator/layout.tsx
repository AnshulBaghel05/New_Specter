import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Shopify Profit Calculator — True Margin After All Fees',
  description:
    'Calculate your real Shopify monthly profit after subscription fees, payment processing, apps, returns, shipping, and ad spend. Includes plan optimizer, customer LTV, and subscription MRR projections.',
  keywords: [
    'shopify profit calculator',
    'shopify fee calculator',
    'shopify true profit margin',
    'shopify payment processing fee',
    'shopify plan comparison',
    'shopify margin calculator',
    'shopify ltv calculator',
    'shopify ecommerce profit',
    'shopify net profit calculator',
  ],
  alternates: { canonical: '/tools/shopify-profit-calculator' },
  openGraph: {
    title: 'Shopify Profit Calculator — True Margin After All Fees',
    description:
      'See your real Shopify monthly profit after fees, apps, returns, and ad spend. Free plan optimizer and LTV calculator included.',
    type: 'website',
    url: '/tools/shopify-profit-calculator',
    images: [{
      url: 'https://specterapp.io/tools/og?tool=Shopify+Profit+Calculator&headline=True+monthly+profit&sub=After+fees%2C+apps%2C+returns+%26+ad+spend',
      width: 1200,
      height: 630,
      alt: 'Shopify Profit Calculator by SPECTER',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shopify Profit Calculator — True Margin After All Fees',
    description: 'Calculate real Shopify profit after every fee and cost — free, client-side only.',
    images: ['https://specterapp.io/tools/og?tool=Shopify+Profit+Calculator&headline=True+monthly+profit&sub=After+fees%2C+apps%2C+returns+%26+ad+spend'],
  },
}

export default function ShopifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Shopify Profit Calculator',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            description:
              'Free Shopify profit calculator. See true monthly profit after subscription, processing, apps, returns, shipping and ad spend. Includes plan optimizer, LTV, and subscription revenue modeling.',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
            url: 'https://specterapp.io/tools/shopify-profit-calculator',
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
