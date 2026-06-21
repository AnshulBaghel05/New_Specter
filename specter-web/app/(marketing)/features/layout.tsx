import type { Metadata } from 'next'

// The features page is a client component (animated comparison table), so it can't
// export metadata. This server layout gives /features its own SEO metadata instead
// of inheriting the homepage's title/description.
export const metadata: Metadata = {
  title: 'Features — Real-Time Signals, OOS Alerts & Auto-Reprice',
  description:
    'See how SPECTER monitors competitor prices and stock, fires RAISE/LOWER/HOLD signals, detects out-of-stock windows, and auto-reprices within your guardrails — for Shopify and WooCommerce.',
  alternates: { canonical: '/features' },
  openGraph: {
    title: 'SPECTER Features — Competitor Price Intelligence',
    description:
      'Real-time competitor monitoring, AI pricing signals, out-of-stock alerts, and guardrailed auto-repricing.',
    url: 'https://specterapp.io/features',
  },
}

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
