import type { Metadata } from 'next'
import { Syne, DM_Sans, JetBrains_Mono } from 'next/font/google'
import Providers from './providers'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://specterapp.io'),
  title: {
    default: 'SPECTER — Competitor Pricing Intelligence for Shopify',
    template: '%s | SPECTER',
  },
  description:
    'Know when competitors change price or go out of stock. AI-powered RAISE/LOWER/HOLD signals for Shopify and WooCommerce merchants. Start free — no credit card.',
  keywords: [
    'competitor price monitoring',
    'shopify pricing tool',
    'price intelligence',
    'ecommerce repricing',
    'competitor tracking',
    'dynamic pricing shopify',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://specterapp.io',
    siteName: 'SPECTER',
    title: 'SPECTER — Competitor Pricing Intelligence for Shopify',
    description:
      'Real-time competitor price and stock monitoring with AI signals. Know before they move.',
    images: [{
      url: '/og-image.png', width: 1200, height: 630,
      alt: 'SPECTER — competitor price monitoring dashboard for Shopify and WooCommerce',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SPECTER — Competitor Pricing Intelligence',
    description: 'Real-time competitor price monitoring with AI signals for Shopify & WooCommerce.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`dark ${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
      style={{
        '--bg': '#06070D',
        '--surface': '#0D0F1A',
        '--border': '#1A1D2E',
        '--primary': '#00E87A',
        '--text': '#E8EAF0',
        '--muted': '#6B7280',
        background: '#06070D',
        color: '#E8EAF0',
      } as React.CSSProperties}
    >
      <body className="font-body bg-bg text-text antialiased">
        {/* Organization + SoftwareApplication structured data. The description is
            the canonical one-sentence definition AI search engines extract. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'SPECTER',
                url: 'https://specterapp.io',
                logo: 'https://specterapp.io/og-image.png',
                description:
                  'SPECTER is competitor price-monitoring software for Shopify and WooCommerce stores: it tracks rival prices and stock in real time and tells you exactly when to raise, lower, or hold.',
                sameAs: [],
              },
              {
                '@context': 'https://schema.org',
                '@type': 'SoftwareApplication',
                name: 'SPECTER',
                applicationCategory: 'BusinessApplication',
                operatingSystem: 'Web',
                url: 'https://specterapp.io',
                description:
                  'Competitor price-monitoring software for Shopify and WooCommerce. SPECTER tracks competitor prices and stock in real time and delivers AI-powered RAISE, LOWER, and HOLD pricing signals.',
                offers: {
                  '@type': 'Offer',
                  price: '0',
                  priceCurrency: 'USD',
                  description: 'Free 14-day trial — no credit card required.',
                },
              },
            ]),
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
