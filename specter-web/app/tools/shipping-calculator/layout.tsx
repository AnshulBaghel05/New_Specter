import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Shipping Cost Calculator — Compare UPS, FedEx, USPS & DHL Rates',
  description:
    'Compare shipping rates across UPS, FedEx, USPS, and DHL for domestic zones. Calculate international shipping with duties, taxes, and landed costs. Includes bulk shipment optimizer and packaging catalog.',
  keywords: [
    'shipping cost calculator',
    'ups shipping calculator',
    'fedex shipping calculator',
    'usps shipping calculator',
    'dhl shipping calculator',
    'international shipping calculator',
    'shipping rate comparison',
    'landed cost calculator',
    'bulk shipping calculator',
    'ecommerce shipping costs',
  ],
  alternates: { canonical: '/tools/shipping-calculator' },
  openGraph: {
    title: 'Shipping Cost Calculator — Compare UPS, FedEx, USPS & DHL',
    description:
      'Compare carrier rates for domestic, international, and bulk shipments. Includes landed cost, duties, and packaging optimizer.',
    type: 'website',
    url: '/tools/shipping-calculator',
    images: [{
      url: 'https://specterapp.io/tools/og?tool=Shipping+Calculator&headline=Cheapest+way+to+ship&sub=Compare+UPS%2C+FedEx%2C+USPS+%26+DHL',
      width: 1200,
      height: 630,
      alt: 'Shipping Cost Calculator by SPECTER',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shipping Cost Calculator — Free Multi-Carrier Rate Comparison',
    description: 'Compare UPS, FedEx, USPS, and DHL rates plus international duties — free tool.',
    images: ['https://specterapp.io/tools/og?tool=Shipping+Calculator&headline=Cheapest+way+to+ship&sub=Compare+UPS%2C+FedEx%2C+USPS+%26+DHL'],
  },
}

export default function ShippingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Shipping Cost Calculator',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            description:
              'Free shipping cost calculator. Compare UPS, FedEx, USPS, and DHL rates by zone. Calculate international shipping with duties, taxes, and landed cost. Includes bulk shipment and packaging optimizer.',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
            url: 'https://specterapp.io/tools/shipping-calculator',
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
