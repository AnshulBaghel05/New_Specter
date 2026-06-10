# SPECTER — Growth & SEO Strategy

## Tool SEO Keywords
| Tool | Primary keyword | Vol | Difficulty | AEO target question |
|------|----------------|-----|------------|---------------------|
| FBA Calculator | amazon fba fee calculator | 22K | HIGH | "How much does Amazon charge for FBA?" |
| Shopify Profit | shopify profit calculator | 8K | MED | "How do I calculate true Shopify profit?" |
| Shipping Comparator | shipping rate calculator | 40K | HIGH | "Which carrier is cheapest for small packages?" |
| Price Position | competitor price analysis tool | 1.2K | LOW | "How do I see where my price ranks vs competitors?" |
| ROAS Calculator | roas calculator ecommerce | 15K | LOW | "What ROAS do I need to be profitable?" |
| Inventory Reorder | reorder point calculator | 12K | LOW | "How do I calculate my reorder point?" |

## AEO (Answer Engine Optimization)
For AI search engines (Perplexity, ChatGPT Search, Google SGE):
- Add FAQ schema (JSON-LD) to every tool page
- Answer the AEO question in first 100 words of page
- Use conversational H2 headings phrased as questions
- Include the formula with plain-English explanation

## Content Calendar (Month 1–3)
| Week | Content | Target keyword |
|------|---------|----------------|
| 1 | Blog: "Amazon FBA Fees 2024: Complete Breakdown" | amazon fba fees 2024 |
| 2 | Blog: "Shopify Hidden Fees: What Your Dashboard Hides" | shopify hidden fees |
| 3 | Blog: "How to Catch Competitors Going Out of Stock" | competitor out of stock |
| 4 | Blog: "Competitor Price Monitoring for Shopify" | shopify price monitoring |
| 5+ | Case study: "How [Merchant] Recovered $12K in 30 Days" | specter reviews |

## Distribution Channels
- Reddit: r/ecommerce, r/fulfillmentbyamazon, r/shopify — share tools, no spam
- Facebook Groups: Amazon FBA Sellers, Shopify Entrepreneurs
- Twitter/X: tag @Shopify, @buildpublicly threads
- Product Hunt: launch website + tools (not SaaS MVP)
- Indie Hackers: build-in-public thread

## Waitlist Growth Tactics
- "Share to move up the waitlist" referral mechanic (use Reflio or custom)
- Tools as lead capture: every tool page CTA → /sign-up
- AppSumo lifetime deal (post-launch, $299 LTD = 1000 users × $299 vs $149/mo)

## Viral Loops & Freemium Growth (2026-05-30)
> Design: `docs/superpowers/specs/2026-05-30-free-tools-plg-redesign-design.md`.

### The growth loop
Tool result → share/embed → new visitor → tool result → **email capture (FREE account)** → in-workspace upsell + nurture → trial → paid. Each free tool is a top-of-funnel growth node; the free dashboard workspace is the retention floor.

### Existing mechanisms (keep)
- `ShareResult` — encoded `?s=` state produces a pre-filled shared result link.
- `EmbedCode` — embeddable widget on third-party sites = backlink/SEO loop.

### Additions
- **Per-result OG image** — shared links render a branded card with the headline result (curiosity + brand).
- **Benchmark / "challenge" share** — e.g., "My store ranks #2 of 6 — check yours" → drives new tool visits.
- **Referral nudge** — in the nurture sequence (Day 3 / Day 5) and post-save ("share this report").

### Freemium acquisition framing
- Trial is the **primary CTA**; the FREE account is the soft on-ramp ("not ready to connect your store? use the tools").
- Locked preview tabs in the dashboard = persistent feature awareness on every login.
- PQL trigger: tool-usage frequency drives the upsell to RECON.
