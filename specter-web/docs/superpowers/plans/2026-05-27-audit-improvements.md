# Audit Improvements — Implementation Plan (Current Stage)

> **Scope:** Frontend, marketing, SEO, and security improvements applicable at the current development stage.
> Backend / API / dashboard improvements (rate limiting, caching, database indexes, scraper worker, signal pipeline) are deferred to the core SaaS build phase.

---

## What Was Fixed (This Pass)

### 1. Security & Config
- **Security headers** — Added `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` in `next.config.mjs`
- **Middleware env bypass** — Fixed silent passthrough when Supabase env vars are missing; dashboard now redirects to sign-in regardless
- **Node version pinning** — Added `.nvmrc` (Node 20) and `engines` field in `package.json`
- **Error message leakage** — `error.tsx` now hides raw stack traces in production

### 2. SEO & Discovery
- **Sitemap** — `app/sitemap.ts` auto-generates XML sitemap covering all 6 tools + marketing pages
- **Robots** — `app/robots.ts` sets crawl policy, disallows dashboard/auth/api routes, points to sitemap
- **Organization JSON-LD** — Root layout now injects `Organization` + `WebSite` schema (supports Google Knowledge Panel, sitelinks search box)
- **BreadcrumbList JSON-LD** — All 6 tool layouts now include breadcrumb schema (Home → Free Tools → [Tool Name]) for rich result eligibility
- **FAQPage JSON-LD** — All 6 tool layouts include structured FAQs for AEO/AI search engine citation
- **Tools hub page** — `app/tools/page.tsx` creates cluster page linking all 6 tools; best internal link hub for tool SEO

### 3. Missing Pages (404 Elimination)
- `/about` — Stub page with brand story and contact info
- `/privacy` — Minimal privacy policy stub (sufficient for pre-launch)
- `/terms` — Terms of service stub (sufficient for pre-launch)
- `app/not-found.tsx` — Branded 404 with navigation CTAs instead of Next.js default

### 4. Navigation & Footer Fixes
- **Mobile nav** — Already implemented with hamburger + drawer; no change needed
- **Footer 404 links** — Removed `/changelog` and `/blog` (no pages); `/security` removed; kept `/about`, `/privacy`, `/terms` (now exist)
- **Nav Blog link** — Removed `/blog` from desktop/mobile nav (no page)

### 5. Performance & Architecture
- **Lenis scoped** — Created `app/(marketing)/layout.tsx` to scope SmoothScrollProvider to marketing pages only; tools and dashboard no longer initialize Lenis
- **Loading skeletons** — `loading.tsx` added per tool route for instant perceived performance during JS hydration

### 6. Tool UX & Accessibility
- **Numeric input guard** — `Input` component in `tool-layout.tsx` now blocks `e`, `E`, `+`, `-` keypresses that create invalid scientific notation inputs
- **FAQ sections** — All 6 tool pages now have `ToolFAQ` accordion with 5 targeted Q&As below the calculator; improves dwell time, AEO, and backlink potential
- **ToolFAQ component** — Reusable accordion at `components/tools/tool-faq.tsx` with JSON-LD injection

### 7. Marketing & CRO
- **Hero H1 LCP** — H1 no longer starts at `opacity: 0`; immediately visible for Core Web Vitals LCP measurement
- **Pricing tier sub-labels** — Added contextual tier identifiers (Starter / Growth / Scale / Performance / Enterprise) under plan names
- **"No credit card required" text** — Existing in ToolLayout CTA; verified present

---

## Deferred to Core SaaS Build Phase

### Backend / API
- Rate limiting (slowapi / Upstash ratelimit)
- API routes beyond `/health` (merchants, SKUs, signals, price-snapshots)
- Redis caching layer for signal queries
- PostgreSQL indexes (price_snapshots, signals, competitor_urls)
- CORS configuration
- Pydantic settings validation at startup
- Connection pool sizing

### Frontend (After Dashboard)
- URL query param state sharing on tool pages (shareable links)
- CSV import for ABC inventory tab
- "Calculated by SPECTER" watermark on CSV exports
- Share results button encoding inputs to URL
- Dynamic OG image generation via `@vercel/og`
- Skeleton/shimmer loading states on result panels
- ScenarioPanel state sync to Supabase (cross-device persistence)
- TanStack Query global `staleTime` + `onError` toast
- Sentry error monitoring integration
- PostHog event tracking on CTAs

### SEO / AEO (After Content Exists)
- `/blog` — content strategy articles
- `/changelog` — product updates
- `/security` — security disclosure page
- `aggregateRating` on SoftwareApplication schemas (once reviews exist)
- `HowTo` JSON-LD per tool

---

## File Index

| File | Change |
|---|---|
| `next.config.mjs` | Security headers added |
| `middleware.ts` | Env bypass guard fixed |
| `.nvmrc` | Created — Node 20 |
| `package.json` | `engines` field added |
| `app/layout.tsx` | SmoothScrollProvider removed; Organization + WebSite JSON-LD added |
| `app/error.tsx` | Production error message sanitized |
| `app/sitemap.ts` | Created |
| `app/robots.ts` | Created |
| `app/not-found.tsx` | Created — branded 404 |
| `app/(marketing)/layout.tsx` | Created — scopes Lenis to marketing |
| `app/(marketing)/about/page.tsx` | Created — stub |
| `app/(marketing)/privacy/page.tsx` | Created — stub |
| `app/(marketing)/terms/page.tsx` | Created — stub |
| `app/tools/page.tsx` | Created — SEO hub |
| `app/tools/loading.tsx` | Created |
| `app/tools/*/loading.tsx` | Created × 6 |
| `components/tools/tool-faq.tsx` | Created — reusable FAQ accordion |
| `components/tools/tool-layout.tsx` | Input numeric guard added |
| `components/marketing/footer.tsx` | 404 links removed |
| `components/marketing/nav.tsx` | Blog link removed |
| `components/marketing/hero.tsx` | H1 LCP animation fixed |
| `components/marketing/pricing-section.tsx` | Tier sub-labels added |
| `app/tools/*/layout.tsx` | BreadcrumbList + FAQPage JSON-LD added × 6 |
| `app/tools/*/page.tsx` | ToolFAQ section added × 6 |
