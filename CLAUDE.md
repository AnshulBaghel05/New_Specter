# SPECTER — Claude Project Intelligence

## Project Summary
SPECTER is a B2B SaaS for Shopify/WooCommerce merchants that scrapes competitor pricing in real time and delivers AI-powered RAISE/LOWER/HOLD signals. Two repos: `specter-web` (Next.js, Vercel) and `specter-api` (FastAPI + Node.js scraper, Railway).

## This Repo: specter-web
Marketing site + 5 simplified public tools + Position Analyzer (SaaS bridge) + SaaS dashboard. All tool calculators are client-side (no API). The dashboard reads from specter-api and includes a free-tier **SPECTER Workspace** (Saved Reports, Compare, Opportunity Feed) backed by the `/calculations` CRUD API; logged-in `free` accounts land there. See [MASTER PLG plan](docs/superpowers/plans/2026-05-31-free-tools-plg-master.md) for the Public→Intermediate→Paid taxonomy.

## Tech Stack
- Next.js 14 App Router, TypeScript strict
- Tailwind CSS + shadcn/ui
- Supabase Auth (JWT), Zustand, TanStack Query
- GSAP + Framer Motion + Lenis + Three.js/R3F (hero only)
- Recharts, React Hook Form + Zod, Lucide React

## Directory Structure
```
app/(marketing)/     Marketing homepage (15 sections)
app/(dashboard)/     SaaS dashboard (7 routes, Supabase-protected)
app/tools/           5 public calculators + Position Analyzer (client-side only)
app/(auth)/          Supabase sign-in/sign-up pages
components/marketing/ Homepage section components
components/dashboard/ Dashboard UI components
components/tools/    Shared tool page layout
lib/api.ts           TanStack Query hooks → specter-api
lib/store.ts         Zustand global store
types/index.ts       Shared TypeScript types
middleware.ts        Supabase auth guard on /dashboard/*
```

## Design System — "Dark Intelligence"
| Token | Value |
|-------|-------|
| --bg | #06070D |
| --surface | #0D0F1A |
| --border | #1A1D2E |
| --primary | #00E87A |
| --text | #E8EAF0 |
| --muted | #6B7280 |
| Font display | Syne |
| Font body | DM Sans |
| Font mono | JetBrains Mono |

## Common Commands
```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint check
npm test             # Vitest unit tests
npx shadcn@latest add [component]  # Add shadcn component
```

## Critical Rules
- NEVER commit .env or .env.local
- NEVER call specter-api from tool calculator pages (client-side only)
- NEVER add tests for marketing section components — test calculator math logic only
- Plan gating (CIPHER+, PHANTOM+, PREDATOR+) MUST be enforced server-side in specter-api; frontend gating is UI-only
- Always use `cn()` from `lib/utils.ts` for conditional class merging
- shadcn components go in `components/ui/` — generated, do not hand-edit
- Three.js hero only loads on `(marketing)/page.tsx` — never import R3F in dashboard or tools

## Environment Variables (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=https://specter-api.railway.app
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_RAZORPAY_KEY_ID=
```

Razorpay publishable key (`RAZORPAY_KEY_ID`) for embedded checkout; webhook `subscription.cancelled` must be registered alongside `activated`/`charged`.

specter-api (Railway) auth env: `SUPABASE_JWT_SECRET` (Project Settings → API → JWT secret) — validates the bearer token on every request.

## Related Docs
- [PRD](docs/PRD.md) — Problem, personas, user stories
- [FEATURES](docs/FEATURES.md) — Feature specs + acceptance criteria
- [PRICING](docs/PRICING.md) — Tier details, unit economics
- [WEBSITE](docs/WEBSITE.md) — 15-section homepage spec
- [TOOLS](docs/TOOLS.md) — tool specs with formulas (5 public + Position Analyzer)
- [TECHSTACK](docs/TECHSTACK.md) — Stack rationale + version pins
- [ARCHITECTURE](docs/ARCHITECTURE.md) — System diagram, data flow
- [DEVPLAN](docs/DEVPLAN.md) — Sprint breakdown
- [GROWTH](docs/GROWTH.md) — SEO, keywords, content strategy
- [Design Spec](docs/superpowers/specs/2026-05-23-specter-design.md)
- [MONETIZATION](docs/MONETIZATION.md) — Free/paid feature gates, conversion architecture, pricing copy
- [ONBOARDING](docs/ONBOARDING.md) — Beginner onboarding, FREE→trial→paid lifecycle nurture
- [USERFLOW](docs/USERFLOW.md) — End-to-end journeys incl. PLG free-tool + freemium flows
