import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Amazon FBA Calculator — Free Fee & Profit Calculator (2025)',
  description:
    'Calculate exact Amazon FBA fulfillment fees, referral fees, and storage costs. See true net profit per unit, break-even price, size tier, and package optimizer — using 2025 official rates.',
  keywords: [
    'amazon fba calculator',
    'fba fee calculator',
    'amazon fulfillment fee',
    'amazon referral fee calculator',
    'fba profit calculator',
    'amazon seller profit calculator',
    'fba break even price',
    'amazon storage fee calculator',
    'fba size tier calculator',
  ],
  alternates: { canonical: '/tools/amazon-fba-calculator' },
  openGraph: {
    title: 'Amazon FBA Calculator — Free Fee & Profit Calculator (2025)',
    description:
      'Instantly calculate your FBA fulfillment fees, referral fees, storage costs, and true net profit with 2025 official Amazon rates.',
    type: 'website',
    url: '/tools/amazon-fba-calculator',
    images: [{
      url: 'https://specterapp.io/tools/og?tool=Amazon+FBA+Calculator&headline=Net+profit+per+unit&sub=Fees%2C+margin%2C+ROI+%26+break-even',
      width: 1200,
      height: 630,
      alt: 'Amazon FBA Calculator by SPECTER',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Amazon FBA Calculator — Free Fee & Profit Tool',
    description: 'Calculate exact FBA fees and true profit per unit — free, no sign-up required.',
    images: ['https://specterapp.io/tools/og?tool=Amazon+FBA+Calculator&headline=Net+profit+per+unit&sub=Fees%2C+margin%2C+ROI+%26+break-even'],
  },
}

export default function FbaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Amazon FBA Calculator',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            description:
              'Free Amazon FBA fee and profit calculator. Calculate fulfillment fees, referral fees, storage costs, and net profit per unit using 2025 official rates.',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
            url: 'https://specterapp.io/tools/amazon-fba-calculator',
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
