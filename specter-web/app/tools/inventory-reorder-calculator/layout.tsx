import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Inventory EOQ & Restock Calculator — Free Inventory Planning Tool',
  description:
    'Calculate your Economic Order Quantity (EOQ), reorder point, and safety stock using the Wilson formula. Includes seasonal demand planning, ABC inventory classification, cash flow metrics, and inventory turns.',
  keywords: [
    'eoq calculator',
    'economic order quantity calculator',
    'reorder point calculator',
    'safety stock calculator',
    'inventory reorder calculator',
    'abc inventory analysis',
    'seasonal inventory planning',
    'inventory turns calculator',
    'wilson formula eoq',
    'inventory management calculator',
  ],
  alternates: { canonical: '/tools/inventory-reorder-calculator' },
  openGraph: {
    title: 'Inventory EOQ & Restock Calculator — Free Tool',
    description:
      'Calculate optimal order quantity, reorder point, safety stock. Includes seasonal planning, ABC analysis, and cash flow metrics.',
    type: 'website',
    url: '/tools/inventory-reorder-calculator',
    images: [{
      url: 'https://specterapp.io/tools/og?tool=Inventory+EOQ+Calculator&headline=When+to+reorder&sub=Reorder+point%2C+safety+stock+%26+EOQ',
      width: 1200,
      height: 630,
      alt: 'Inventory EOQ Calculator by SPECTER',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Inventory EOQ & Restock Calculator',
    description: 'Free EOQ calculator with seasonal planning and ABC classification.',
    images: ['https://specterapp.io/tools/og?tool=Inventory+EOQ+Calculator&headline=When+to+reorder&sub=Reorder+point%2C+safety+stock+%26+EOQ'],
  },
}

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Inventory EOQ & Restock Calculator',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            description:
              'Free inventory calculator using Wilson EOQ formula. Calculate economic order quantity, reorder point, safety stock, seasonal demand adjustments, and ABC inventory classification.',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
            url: 'https://specterapp.io/tools/inventory-reorder-calculator',
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
