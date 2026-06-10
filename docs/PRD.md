# SPECTER — Product Requirements Document

## Problem Statement
E-commerce merchants doing $300K–$15M GMV/year lose thousands monthly by:
- Underpricing (leaving margin on the table) when competitors raise prices
- Missing the 2–7 day premium pricing window when competitors go OOS
- Spending 8+ hours/week on manual competitor price checks (always stale)
- Unable to afford $50K+/year enterprise pricing tools (Competera, Intelligence Node)

## Target Persona
**Name:** Merchant Marcus  
**Role:** Founder or Head of E-commerce Operations  
**Store:** Shopify, $500K–$5M GMV, 50–300 SKUs  
**Vertical:** Electronics, consumer tech, dropshipping, home goods  
**Team size:** 1–5 people  
**Pain:** Checks competitor prices manually 2–3x/week. Has missed OOS windows before. Can't justify enterprise tools. Uses spreadsheets.

## Core Value Proposition
Know within 15 minutes when a competitor goes out of stock or changes price — and see in dollars exactly what acting on that signal recovered.

## MVP Feature Table
| Feature | Priority | Complexity | Status |
|---------|----------|------------|--------|
| Store onboarding (Shopify OAuth) | P0 | M | Planned |
| Competitor URL management | P0 | S | Planned |
| Scraper engine (BullMQ + Playwright) | P0 | L | Planned |
| RAISE/LOWER/HOLD signal engine | P0 | M | Planned |
| OOS alerts (<15min, email) | P0 | M | Planned |
| Dashboard overview | P0 | S | Planned |
| Auto-reprice rules engine | P1 | M | Planned |
| Revenue attribution tracker | P1 | M | Planned |
| WooCommerce onboarding | P1 | S | Planned |
| Razorpay subscription billing | P0 | M | Planned |
| 6 free SEO tools (client-side) | P0 | M | Planned |
| Marketing homepage (15 sections) | P0 | L | Planned |

## Out of Scope (MVP)
- AI SKU variant matching (Phase 2)
- Mobile app
- Amazon/eBay marketplace channels
- Multi-user seats / team accounts
- White-label / agency reseller
- Historical trends beyond 30 days
- Slack bot / Chrome extension
- APEX tier self-serve (demo call only)

## User Stories
- As Merchant Marcus, I want to connect my Shopify store so SPECTER can import my SKUs automatically.
- As Merchant Marcus, I want to paste a competitor product URL and see its price tracked within 1 hour.
- As Merchant Marcus, I want to receive a RAISE signal when a competitor's price increases so I can capture extra margin.
- As Merchant Marcus, I want an OOS alert within 15 minutes when a competitor runs out of stock so I can raise my price during their outage.
- As Merchant Marcus, I want to see how many dollars each price change recovered so I can justify my subscription cost.
- As Merchant Marcus, I want to set a floor and ceiling price per SKU so auto-reprice never prices me below cost.
- As a potential customer, I want to use free calculators (FBA fees, profit, shipping) so I discover SPECTER before I need it.

## Success Metrics
| Metric | Target |
|--------|--------|
| Tool page organic traffic | 5,000 sessions/mo by month 2 |
| Waitlist signups | 500 before SaaS launch |
| Activation (first signal seen) | >70% within 24hr of signup |
| Week-4 retention | >60% |
| MRR at month 3 | $15,000+ |
| Gross margin at scale | 80–90% |
| Churn alarm threshold | >5%/mo |
