# SPECTER — Marketing Website Spec

**Route:** `app/(marketing)/page.tsx`  
**Sections:** 15 (imported as components into the page)

| # | Component | File | Key content |
|---|-----------|------|-------------|
| 1 | Hero | `components/marketing/hero.tsx` | Three.js particle field, "Know Before They Move", "First signal in under 12 minutes", waitlist CTA |
| 2 | Problem | `problem.tsx` | 3-card grid: Manual checking (8hr/wk), Missed OOS windows (2–7 day), Enterprise gap ($50K vs $149) |
| 3 | ProductDemo | `product-demo.tsx` | Animated RAISE/LOWER/HOLD signal cards with Framer Motion |
| 4 | SocialProof | `social-proof.tsx` | Stats: 12,400+ SKUs, $2.1M revenue recovered this month, 99.3% uptime, <15 min latency |
| 5 | OOSFeature | `oos-feature.tsx` | Timeline animation: OOS detected → alert sent → price raised |
| 6 | AttributionFeature | `attribution-feature.tsx` | Recharts bar chart animation (mock data) |
| 7 | DomainBatching | `domain-batching.tsx` | Cost comparison: Single-tenant ($X) vs SPECTER ($Y) |
| 8 | CompetitorTable | `competitor-table.tsx` | JTBD-format: SPECTER vs Prisync vs Wiser vs Manual (9 rows, starts at $79/mo) |
| 9 | PricingSection | `pricing-section.tsx` | 5-tier cards (RECON→ECLIPSE), monthly/annual toggle (15% off; PREDATOR/ECLIPSE excluded), temporary 100%-off promo on RECON/CIPHER/PHANTOM, outcome taglines per tier |
| 10 | Integrations | `integrations.tsx` | Shopify, WooCommerce, Slack, Klaviyo, Stripe, Webhooks — Lucide icon grid |
| 11 | ToolsCTA | `tools-cta.tsx` | 6-tool grid hinting at paid monitoring layer; bottom CTA references SPECTER automation |
| 12 | Testimonials | `testimonials.tsx` | 3 cards (Marcus/Priya/James) — PHANTOM/PREDATOR/CIPHER plans |
| 13 | FAQ | `faq.tsx` | shadcn Accordion: legality, accuracy, onboarding, cancellation |
| 14 | FinalCTA | `final-cta.tsx` | "Start your 14-day free trial" + "First signal in under 12 minutes" badge |
| 15 | Footer | `footer.tsx` | Nav links, social icons, legal (Privacy Policy, Terms) |

## Navigation
**File:** `components/marketing/nav.tsx`
- Sticky, blur backdrop (`backdrop-blur-sm bg-[#06070D]/80`)
- Logo left, links center, "Start Free Trial" CTA right
- "Tools" link triggers hover mega dropdown showing all 6 tools with 1-line descriptions
- Mobile: hamburger menu, no mega dropdown (direct links)

## Animation System
- Scroll reveals: GSAP ScrollTrigger on section entry
- Component transitions: Framer Motion (`initial={{ opacity:0, y:20 }}`)
- Smooth scroll: Lenis (wraps root layout)
- Three.js hero: React Three Fiber, particle field in `components/marketing/hero.tsx`

## Fonts (self-hosted via next/font/local or Google)
- Syne: headings
- DM Sans: body
- JetBrains Mono: code/signal badges

## Tool Page Standard Skeleton (2026-05-30)
> Design: `docs/superpowers/specs/2026-05-30-free-tools-plg-redesign-design.md`. Enforced by `components/tools/tool-layout.tsx` so every `/tools/*` page renders in this fixed order:

1. **Quick Answer** — 1-sentence AEO answer (in DOM, above the fold)
2. **Inputs** — ≤4 visible; rest behind "Advanced options [▼]"
3. **THE ANSWER** — 1 hero number/verdict (large, primary color) + "What this means" + "Do this next"
4. **Supporting** — ≤3 metrics + ≤1 chart
5. **See full breakdown [▼]** — all remaining metrics/charts/tables, collapsed (stays in DOM)
6. **Layer-1 email unlock** — value-first, fires on earned value
7. **Layer-2 locked section** — blurred market intelligence + named tier CTA
8. **Share / Embed** — viral loop
9. **FAQ + Disclaimer** — crawlable, always in DOM

Constraint: at most **1 hero + 3 supporting + 1 chart** visible before the user expands anything. Progressive disclosure is visual only — crawlers and screen readers see everything.
