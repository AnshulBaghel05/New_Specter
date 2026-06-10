import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ROAS Calculator — Ad Profitability & Break-Even ROAS Tool',
  description:
    'Calculate your true ROAS, break-even ROAS, and net profit from ad campaigns. Includes full funnel analysis (impressions → clicks → conversions) with platform benchmarks for Meta, Google, TikTok, Amazon, and Email.',
  keywords: [
    'roas calculator',
    'return on ad spend calculator',
    'break even roas calculator',
    'true roas calculator',
    'ad profitability calculator',
    'facebook ads roas calculator',
    'google ads roas calculator',
    'tiktok ads roas',
    'ad campaign profit calculator',
    'cpa calculator',
  ],
  alternates: { canonical: '/tools/roas-calculator' },
  openGraph: {
    title: 'ROAS Calculator — Free Ad Profitability Tool',
    description:
      'Calculate break-even ROAS, true ROAS, and net profit. Funnel analysis with benchmarks for Meta, Google, TikTok, Amazon, and Email.',
    type: 'website',
    url: '/tools/roas-calculator',
    images: [{
      url: 'https://specterapp.io/tools/og?tool=ROAS+Calculator&headline=Is+my+ad+spend+profitable%3F&sub=True+ROAS%2C+break-even+%26+net+profit',
      width: 1200,
      height: 630,
      alt: 'ROAS Calculator by SPECTER',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ROAS Calculator — Ad Profitability & Break-Even Tool',
    description: 'Free ROAS calculator with funnel analysis and platform benchmarks.',
    images: ['https://specterapp.io/tools/og?tool=ROAS+Calculator&headline=Is+my+ad+spend+profitable%3F&sub=True+ROAS%2C+break-even+%26+net+profit'],
  },
}

export default function RoasLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'ROAS & Ad Profitability Calculator',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            description:
              'Free ROAS calculator. Calculate break-even ROAS, true ROAS, ad profit, and full funnel metrics with benchmarks for Meta, Google Shopping, Google Search, TikTok, Amazon, and Email.',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
            url: 'https://specterapp.io/tools/roas-calculator',
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
