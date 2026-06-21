'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useScrollReveal } from '@/hooks/use-scroll-reveal'

const FAQS = [
  {
    q: 'How does SPECTER scrape competitor prices without getting blocked?',
    a: 'SPECTER uses domain batching — one optimised crawl visit per domain collects prices for all your tracked SKUs at once, rather than one visit per SKU. This keeps our request rate low and respectful. We also honour robots.txt automatically, use residential proxies for JS-rendered sites, and rotate user agents and viewport fingerprints.',
  },
  {
    q: 'What counts as a "SKU" against my plan limit?',
    a: 'A SKU is one of your products tracked against one competitor — a single (your product → competitor) link. Each link is one competitor-page scrape per refresh cycle, so your SKU count equals the number of product-to-competitor links you set up. Examples: 100 of your products each watched against 1 rival = 100 SKUs; 33 products each watched against 3 rivals = 99 SKUs. (We scrape the competitor\'s page — your own store syncs over the Shopify/WooCommerce API and is never scraped.) So tracking the same product against 3 competitors uses 3 SKUs, not 1. Add-on packs are available at $49/50 SKUs if you need more without upgrading tiers.',
  },
  {
    q: 'How is "revenue recovered" calculated?',
    a: 'When SPECTER auto-reprices a SKU, it records the old price, new price, and then queries your Shopify Orders API 24 hours later. Revenue delta = (new_price − old_price) × units sold in that 24-hour window. This is a conservative, attributable figure — not a projection.',
  },
  {
    q: 'Can I use SPECTER without enabling auto-reprice?',
    a: 'Yes. All plans provide signals (RAISE/LOWER/HOLD) that you can act on manually. Auto-reprice is an opt-in feature on CIPHER and above — you set floor/ceiling guardrails and SPECTER only changes price within those bounds. You can disable auto-reprice per SKU at any time.',
  },
  {
    q: 'What happens when my trial expires?',
    a: 'Your account switches to read-only mode on day 15. You can still view historical signals and data, but scraping pauses and no new signals are generated until you add a payment method. No data is deleted.',
  },
  {
    q: 'Is there an API or webhook I can use?',
    a: 'Yes — PHANTOM and above include custom outbound webhooks. Every signal and OOS event can be pushed to your endpoint as a HMAC-SHA256-signed JSON payload. PREDATOR and ECLIPSE can also access our REST API directly for custom integrations.',
  },
  {
    q: 'Do you track Amazon and other marketplaces?',
    a: 'Yes, but with care. Amazon has strict rate limits (6 req/min) and our scrapers respect them. We track product detail pages — not search results. For marketplace resellers, SPECTER is especially valuable because Amazon reprices algorithmically and our 1-hour PREDATOR cadence keeps you competitive.',
  },
]

export default function Faq() {
  const headingRef = useScrollReveal<HTMLDivElement>({ y: 20 })
  const ref = useScrollReveal<HTMLDivElement>({ y: 16 })

  return (
    <section id="faq" className="py-24 bg-bg">
      {/* FAQPage structured data so search + AI engines can extract the Q&A. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQS.map(({ q, a }) => ({
              '@type': 'Question',
              name: q,
              acceptedAnswer: { '@type': 'Answer', text: a },
            })),
          }),
        }}
      />
      <div className="max-w-3xl mx-auto px-6">
        <div ref={headingRef} className="text-center mb-16">
          <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">FAQ</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-text">
            Common questions
          </h2>
        </div>

        <div ref={ref}>
          <Accordion type="single" collapsible className="flex flex-col gap-2">
            {FAQS.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="bg-surface border border-border rounded-xl px-6 data-[state=open]:border-primary/20"
              >
                <AccordionTrigger className="font-display font-bold text-text text-left text-base py-5 hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="font-body text-sm text-muted leading-relaxed pb-5">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
