# SPECTER — System Design Specification

**Date:** 2026-05-23
**Status:** Approved
**Author:** Brainstorming session — Anshul Baghel

---

## 1. Product Summary

SPECTER is a B2B SaaS platform for Shopify and WooCommerce merchants doing $300K–$15M GMV/year. It automatically scrapes competitor product pricing and inventory levels in real time, then delivers AI-powered RAISE / LOWER / HOLD signals directly into the merchant's workflow. Target: 50–500 active SKUs, electronics/dropshipping/home goods verticals, 1–10 person teams who cannot afford a dedicated pricing analyst.

**Core value prop:** Know within 15 minutes when a competitor goes out of stock or changes price — and know in dollars exactly what acting on that signal recovered.

---

## 2. Architecture Decision

**Approach B — Two-Repo Split** (approved by user)

| Repo            | Stack                                             | Host    | Ships     |
| --------------- | ------------------------------------------------- | ------- | --------- |
| `specter-web` | Next.js 14, TypeScript, Tailwind, shadcn/ui       | Vercel  | Week 1–2 |
| `specter-api` | FastAPI (Python 3.11), Node.js 20 scraper, BullMQ | Railway | Week 3–5 |

**Rationale:** Website and 6 free tools ship from `specter-web` with zero backend dependency. The scraping backend ships independently in week 4. Vercel serverless cannot run Playwright (10s timeout) — separating the repos preserves the domain batching cost moat that makes SPECTER margin-positive.

---

## 3. Tech Stack

### Frontend (`specter-web`)

- **Framework:** Next.js 14 App Router, TypeScript strict mode
- **Styling:** Tailwind CSS + shadcn/ui component library
- **Animation:** GSAP (scroll triggers), Framer Motion (component transitions), Lenis (smooth scroll)
- **3D:** React Three Fiber / Three.js (homepage hero only)
- **State:** Zustand (UI), TanStack Query (server state, 60s refetch on signals)
- **Forms:** React Hook Form + Zod
- **Auth:** Clerk or Supabase (JWT, Shopify OAuth handled via backend)
- **Charts:** Recharts (attribution dashboard)
- **Icons:** Lucide React
- **Email:** Resend + React Email

### Backend (`specter-api`)

- **API:** FastAPI (async), Python 3.11+, Pydantic v2, SQLAlchemy 2.0 + Alembic
- **Scraper:** Node.js 20, Playwright, BullMQ (Redis-backed job queues)
- **Proxies:** Bright Data residential proxies; 2captcha for CAPTCHA bypass
- **Database:** PostgreSQL 15 (Supabase)
- **Cache/Queue:** Upstash Redis
- **Storage:**  Supabase at start (AWS S3 (raw HTML snapshots) after some time)
- **Monitoring:** Sentry (errors) + PostHog (product analytics)
- **Payments:** Razorpay (subscriptions + webhooks)

### Design System — "Dark Intelligence"

| Token         | Value          |
| ------------- | -------------- |
| Background    | `#06070D`    |
| Primary green | `#00E87A`    |
| Surface       | `#0D0F1A`    |
| Border        | `#1A1D2E`    |
| Text primary  | `#E8EAF0`    |
| Text muted    | `#6B7280`    |
| Font display  | Syne           |
| Font body     | DM Sans        |
| Font mono     | JetBrains Mono |

---

## 4. Database Schema

```sql
-- Core tables
merchants (id, clerk_user_id, plan, shopify_domain, woo_api_key,
           razorpay_subscription_id, created_at)

skus (id, merchant_id, title, handle, current_price, floor_price,
      ceiling_price, shopify_variant_id, created_at)

competitor_urls (id, domain, url_path, sku_id, last_scraped_at,
                 scrape_interval_minutes)

-- Scraper output
price_snapshots (id, competitor_url_id, price, in_stock,
                 scraped_at, raw_s3_key)

-- Intelligence layer
signals (id, sku_id, type ENUM('RAISE','LOWER','HOLD'),
         confidence DECIMAL, reasoning TEXT, created_at)

price_changes (id, sku_id, old_price, new_price,
               source ENUM('manual','auto'), signal_id,
               revenue_delta DECIMAL, created_at)

oos_alerts (id, competitor_url_id, sku_id, detected_at,
            resolved_at, notified_at)
```

**Domain batching key:** `(domain, url_path)` is deduplicated across all merchants. When two merchants track the same URL, one BullMQ job serves both — this is the 40–70% scraping cost reduction.

---

## 5. Pricing Tiers ⚠️ SUPERSEDED

> **This section is superseded by `docs/superpowers/specs/2026-05-23-specter-pricing-redesign.md`.**
> New tiers: RECON $79 / CIPHER $249 / PHANTOM $699 / PREDATOR $1,799 / ECLIPSE Custom.
> Do not use the prices, SKU limits, or tier names below for any implementation work.
> Retained for historical decision context only.

| Tier     | Price             | SKUs      | Refresh | Features                          |
| -------- | ----------------- | --------- | ------- | --------------------------------- |
| SCOUT    | $149/mo           | 50        | 6hr     | Signals, OOS alerts, email notifs |
| SNIPER   | $349/mo           | 200       | 1hr     | + Auto-reprice, API access        |
| PREDATOR | $1,299/mo         | 500       | 15min   | + Attribution, custom webhooks    |
| APEX     | Contact ($4,999+) | Unlimited | 5min    | + Dedicated workers, SLA          |

**Payment:** Razorpay subscriptions. INR pricing for India/SEA market. USD for US market.

**Trial:** 14-day free trial on SCOUT and SNIPER. No credit card required at signup. Razorpay subscription activates on day 15 or when user manually upgrades. PREDATOR/APEX: no self-serve trial — demo call required.

---

## 6. Marketing Website — 15 Sections

**Route:** `specter-web/app/(marketing)/page.tsx`

| #  | Section               | Key element                                                                                                                   |
| -- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1  | Hero                  | Three.js particle field, "Know Before They Move" headline, waitlist CTA                                                       |
| 2  | Social proof ticker   | Logos + "merchants saved $X this month" counter (hardcoded at launch; real data from attribution table once 10+ users active) |
| 3  | Problem               | 3-panel: manual checking, missed OOS windows, enterprise pricing gap                                                          |
| 4  | Product demo          | Animated signal feed mockup                                                                                                   |
| 5  | OOS Alert feature     | Timeline: competitor OOS → SPECTER alert → merchant raises price                                                            |
| 6  | Attribution           | Dollar-impact bar chart animation                                                                                             |
| 7  | Domain batching       | Cost comparison vs. competitors                                                                                               |
| 8  | Competitor comparison | Table: SPECTER vs Prisync vs Competera vs basic apps                                                                          |
| 9  | Pricing               | 4-tier card layout with plan toggle (monthly/annual)                                                                          |
| 10 | Integrations          | Shopify + WooCommerce + Razorpay + Slack/email icons                                                                          |
| 11 | Free Tools CTA        | Grid of 6 tools with icons, links to `/tools/*`                                                                             |
| 12 | Testimonials          | 3 cards (placeholder for beta users)                                                                                          |
| 13 | FAQ                   | Accordion — scraping legality, accuracy, onboarding time                                                                     |
| 14 | Final CTA             | "Start your 14-day free trial" + waitlist form                                                                                |
| 15 | Footer                | Nav links, social, legal                                                                                                      |

**Navigation:** Mega dropdown on "Tools" nav item — hover reveals all 6 tools with 1-line descriptions. Sticky nav with blur backdrop.

---

## 7. Free Tools (6 Total)

All tools are client-side only. No API calls. Each page: hero pill → calculator card → results panel → SPECTER conversion CTA.

| # | Tool                           | Route                                   | Primary keyword                    | Competition                                   |
| - | ------------------------------ | --------------------------------------- | ---------------------------------- | --------------------------------------------- |
| 1 | Amazon FBA Calculator          | `/tools/amazon-fba-calculator`        | amazon fba fee calculator          | HIGH — win via 6-marketplace comparison      |
| 2 | Shopify True Profit Calculator | `/tools/shopify-profit-calculator`    | shopify profit calculator          | MED — win via "brutal truth" framing         |
| 3 | Shipping Rate Comparator       | `/tools/shipping-calculator`          | shipping cost calculator           | HIGH — win via dimensional weight + no login |
| 4 | Price Position Analyzer        | `/tools/price-position-analyzer`      | competitor price analysis tool     | LOW — SPECTER funnel anchor                  |
| 5 | ROAS Profitability Calculator  | `/tools/roas-calculator`              | roas calculator ecommerce          | LOW — captures paid ads audience             |
| 6 | Inventory Reorder Calculator   | `/tools/inventory-reorder-calculator` | inventory reorder point calculator | LOW — Wilson EOQ formula                     |

**SEO strategy:** Each tool page targets one primary keyword + 3–5 long-tail AEO questions in FAQ schema. Tools 4–6 are designed as top-of-funnel for SPECTER's core ICP.

---

## 8. SaaS Dashboard Routes

**Route group:** `specter-web/app/(dashboard)/`
**Auth:** Clerk middleware on all dashboard routes. Plan gating enforced server-side.

| Route            | Feature                                                   | Plan gating |
| ---------------- | --------------------------------------------------------- | ----------- |
| `/dashboard`   | Overview: signals today, revenue recovered, active alerts | All plans   |
| `/competitors` | Add competitor URLs, map to SKUs                          | All plans   |
| `/signals`     | RAISE/LOWER/HOLD feed with confidence + reasoning         | All plans   |
| `/repricing`   | Auto-reprice rules, floor/ceiling per SKU                 | SNIPER+     |
| `/alerts`      | OOS log, active competitor OOS status                     | All plans   |
| `/attribution` | Revenue delta per price change, 30-day rollup             | PREDATOR+   |
| `/settings`    | Store connection (Shopify OAuth / WooCommerce), billing   | All plans   |

---

## 9. Data Flow — Signal Cycle

```
1. BullMQ scheduler fires job (per plan interval: 15min / 1hr / 6hr)
2. Playwright worker fetches competitor URL via Bright Data proxy
3. Raw HTML saved to S3 (key: {domain}/{url_path}/{timestamp}.html)
4. Parser extracts: price, in_stock, title, scraped_at
5. price_snapshots row inserted
6. Domain batching: all SKUs tracking same URL receive same snapshot
7. Signal Engine (Python): compares merchant price vs competitor price
   - RAISE: competitor price > merchant price AND competitor in_stock
   - LOWER: merchant price >5% above median of tracked competitor prices
   - HOLD: prices within ±2% of median competitor price
8. Signal written to signals table with confidence score
9. If auto-reprice enabled: Shopify/WooCommerce API call fires
10. price_changes row inserted with revenue_delta (attribution)
11. If OOS detected: oos_alerts row, email/webhook notification sent
```

---

## 10. Scraper Architecture

**Language:** Node.js 20 (Playwright cannot run in Python without bridge)
**Queue:** BullMQ backed by Upstash Redis
**Workers:** 3 concurrent workers per Railway instance (horizontal scale as needed)

```
scraper/
├── queue.ts          BullMQ queue definition, job priorities
├── worker.ts         Main worker — Playwright page lifecycle
├── parser.ts         Price/stock extraction per domain pattern
├── proxy.ts          Bright Data session management
├── domains/          Per-domain parser overrides (amazon.com, walmart.com, etc.)
└── scheduler.ts      Cron-style job scheduling by merchant plan tier
```

**Retry logic:** 3 retries with exponential backoff. Failed jobs quarantined to dead-letter queue. Merchants notified after 3 consecutive failures on a URL.

**robots.txt compliance:** SPECTER checks and respects robots.txt. Scraping only publicly accessible pricing pages. No authentication bypass. Legal review documented in `docs/LEGAL.md`.

---

## 11. Authentication & Security

- **Identity:** Clerk — handles signup, login, OAuth, session tokens
- **API auth:** FastAPI middleware validates Clerk JWT on every request (no server-side sessions)
- **Token lifetime:** 15min access token, 7-day refresh (Clerk managed)
- **Plan gating:** Checked in FastAPI middleware against `merchants.plan` — frontend enforcement is UI-only, not security
- **Shopify OAuth:** Standard OAuth 2.0 flow, access token stored encrypted in `merchants.shopify_access_token`
- **Secrets:** All credentials in environment variables, never in code. Sentry DSN, Razorpay keys, Bright Data credentials, Clerk keys stored in Railway + Vercel env dashboards

---

## 12. MVP Delivery Timeline

| Week | Milestone                                                   | Repo        |
| ---- | ----------------------------------------------------------- | ----------- |
| 1    | Homepage all 15 sections, design system, 3D hero            | specter-web |
| 2    | 6 free tools live, waitlist/email capture, Clerk auth pages | specter-web |
| 3    | FastAPI skeleton, DB schema, Shopify OAuth, BullMQ setup    | specter-api |
| 4    | Scraper workers live, signal engine, dashboard v1           | specter-api |
| 5    | Razorpay subscriptions, auto-reprice, OOS alerts            | specter-api |
| 6    | Attribution engine, beta user onboarding, bug fixes         | both        |

**Launch target:** 50–100 paying users by week 8. Website + tools collecting leads from week 2 onward.

---

## 13. Success Metrics (MVP)

| Metric                              | Target                                     |
| ----------------------------------- | ------------------------------------------ |
| Tool page organic traffic           | 5,000 sessions/mo by month 2               |
| Waitlist signups                    | 500 before SaaS launch                     |
| Activation rate (first signal seen) | >70% within 24hr of signup                 |
| Week-4 retention                    | >60%                                       |
| MRR at month 3                      | $15,000+ (≈50 users blended SCOUT/SNIPER) |
| Gross margin at scale               | 80–90% (domain batching + caching)        |
| Churn threshold (alarm)             | >5%/mo triggers immediate ICP review       |

---

## 14. Out of Scope for MVP

- AI SKU variant matching (Phase 2 — eliminates manual URL mapping)
- Mobile app
- Marketplace channels beyond Shopify + WooCommerce (Amazon, eBay)
- Multi-user seats / team accounts
- White-label / agency reseller program
- Historical price trend charts beyond 30 days
- Slack bot / Chrome extension
- APEX tier (defined, not built — "Contact Us" flow only)

---

## 15. Legal & Compliance Notes

- **Web scraping:** SPECTER scrapes publicly accessible pricing pages only. robots.txt respected. No CFAA-violating authentication bypass. Legal baseline: hiQ Labs v. LinkedIn (9th Cir.) supports scraping public data.
- **GDPR/CCPA:** Merchant data stored in Supabase (EU region available). PII limited to email + store domain. Cookie consent banner on marketing site. Privacy policy and ToS required before launch.
- **DPDP India:** Applicable if billing India merchants via Razorpay. Data processing agreement template needed.
- **Razorpay:** Requires Indian business entity or authorized reseller agreement for INR billing. USD billing via Razorpay International available.

---

## 16. Document Index

After implementation begins, maintain these docs in `docs/`:

| File                     | Purpose                                       |
| ------------------------ | --------------------------------------------- |
| `docs/PRD.md`          | Full product requirements, user stories       |
| `docs/FEATURES.md`     | Feature specs with acceptance criteria        |
| `docs/PRICING.md`      | Tier details, unit economics                  |
| `docs/TECHSTACK.md`    | Stack rationale and version pins              |
| `docs/SCRAPER.md`      | Scraper architecture, domain patterns         |
| `docs/ARCHITECTURE.md` | System diagrams, data flow                    |
| `docs/DEVPLAN.md`      | Sprint plan, task breakdown                   |
| `docs/GROWTH.md`       | SEO, content, acquisition strategy            |
| `docs/LEGAL.md`        | Scraping legality, GDPR, ToS templates        |
| `CLAUDE.md`            | Project intelligence file for AI-assisted dev |
