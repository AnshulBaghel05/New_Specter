# SPECTER Planning Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create all 12 planning/reference docs in `/docs` and the root `CLAUDE.md` so every future AI session has full project context without re-reading source files.

**Architecture:** Pure markdown files. No code generation. Each doc is a scannable reference under 400 lines using headers, bullet points, and tables. These are read by Claude Code at session start — keep them dense, not prose-heavy.

**Tech Stack:** Markdown, git

---

## File Structure

```
specter-web/              ← repo root (CLAUDE.md lives here)
├── CLAUDE.md
└── docs/
    ├── PRD.md
    ├── FEATURES.md
    ├── PRICING.md
    ├── USERFLOW.md
    ├── WEBSITE.md
    ├── TOOLS.md
    ├── TECHSTACK.md
    ├── SCRAPER.md
    ├── ARCHITECTURE.md
    ├── DEVPLAN.md
    └── GROWTH.md
```

---

### Task 1: CLAUDE.md — Root Project Intelligence File

**Files:**
- Create: `CLAUDE.md` (repo root of `specter-web`)

- [ ] **Step 1: Create CLAUDE.md**

```markdown
# SPECTER — Claude Project Intelligence

## Project Summary
SPECTER is a B2B SaaS for Shopify/WooCommerce merchants that scrapes competitor pricing in real time and delivers AI-powered RAISE/LOWER/HOLD signals. Two repos: `specter-web` (Next.js, Vercel) and `specter-api` (FastAPI + Node.js scraper, Railway).

## This Repo: specter-web
Marketing site + 6 free tools + SaaS dashboard. All tool calculators are client-side (no API). Dashboard reads from specter-api.

## Tech Stack
- Next.js 14 App Router, TypeScript strict
- Tailwind CSS + shadcn/ui
- Clerk auth (JWT), Zustand, TanStack Query
- GSAP + Framer Motion + Lenis + Three.js/R3F (hero only)
- Recharts, React Hook Form + Zod, Lucide React

## Directory Structure
```
app/(marketing)/     Marketing homepage (15 sections)
app/(dashboard)/     SaaS dashboard (7 routes, Clerk-protected)
app/tools/           6 free calculator pages (client-side only)
app/(auth)/          Clerk sign-in/sign-up pages
components/marketing/ Homepage section components
components/dashboard/ Dashboard UI components
components/tools/    Shared tool page layout
lib/api.ts           TanStack Query hooks → specter-api
lib/store.ts         Zustand global store
types/index.ts       Shared TypeScript types
middleware.ts        Clerk auth guard on /dashboard/*
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
- Plan gating (SNIPER+, PREDATOR+) MUST be enforced server-side in specter-api; frontend gating is UI-only
- Always use `cn()` from `lib/utils.ts` for conditional class merging
- shadcn components go in `components/ui/` — generated, do not hand-edit
- Three.js hero only loads on `(marketing)/page.tsx` — never import R3F in dashboard or tools

## Environment Variables (.env.local)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_API_URL=https://specter-api.railway.app
NEXT_PUBLIC_POSTHOG_KEY=
```

## Related Docs
- [PRD](docs/PRD.md) — Problem, personas, user stories
- [FEATURES](docs/FEATURES.md) — Feature specs + acceptance criteria
- [PRICING](docs/PRICING.md) — Tier details, unit economics
- [WEBSITE](docs/WEBSITE.md) — 15-section homepage spec
- [TOOLS](docs/TOOLS.md) — 6 tool specs with formulas
- [TECHSTACK](docs/TECHSTACK.md) — Stack rationale + version pins
- [ARCHITECTURE](docs/ARCHITECTURE.md) — System diagram, data flow
- [DEVPLAN](docs/DEVPLAN.md) — Sprint breakdown
- [GROWTH](docs/GROWTH.md) — SEO, keywords, content strategy
- [Design Spec](docs/superpowers/specs/2026-05-23-specter-design.md)
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md project intelligence file"
```

---

### Task 2: PRD.md

**Files:**
- Create: `docs/PRD.md`

- [ ] **Step 1: Create docs/PRD.md**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/PRD.md
git commit -m "docs: add PRD"
```

---

### Task 3: FEATURES.md

**Files:**
- Create: `docs/FEATURES.md`

- [ ] **Step 1: Create docs/FEATURES.md**

```markdown
# SPECTER — Feature Specifications

## F1: Store Onboarding (Shopify OAuth)
**Description:** Merchant connects their Shopify store via OAuth. SKUs imported automatically.

**Acceptance Criteria:**
1. Merchant clicks "Connect Shopify" on /settings
2. Redirected to Shopify OAuth consent screen
3. On approval, specter-api stores access token encrypted in merchants table
4. specter-api fetches all products via Shopify Admin API, creates skus rows
5. Dashboard shows imported SKU count within 60 seconds
6. On token expiration, merchant sees "Reconnect" prompt (not silent failure)

**Edge Cases:**
- Store with 0 products: show empty state, not error
- Shopify API rate limit hit: queue remaining SKUs, show progress
- Merchant revokes app from Shopify admin: detect on next API call, notify via email

**Dependencies:** Shopify Partner account, specter-api /merchants/shopify/oauth routes

---

## F2: Competitor URL Management
**Description:** Merchant pastes competitor product URLs, maps them to their SKUs.

**Acceptance Criteria:**
1. Merchant pastes URL on /competitors page
2. System validates URL is reachable and public
3. URL saved to competitor_urls with detected domain
4. First scrape queued immediately (not on next scheduled run)
5. Merchant sees "Tracking" status within 5 minutes
6. Merchant can delete a competitor URL; scraping stops within 1 job cycle

**Edge Cases:**
- Duplicate URL across SKUs: allowed (same URL can track multiple SKUs)
- robots.txt blocks scraping: show "Cannot track this URL" with explanation
- URL returns 404: mark as failed, notify merchant

**Dependencies:** F3 (Scraper Engine)

---

## F3: Scraper Engine
**Description:** BullMQ job queue with Playwright workers scrapes competitor URLs on plan-defined schedules.

**Acceptance Criteria:**
1. SCOUT URLs scraped every 6hr; SNIPER every 1hr; PREDATOR every 15min
2. Domain batching: same URL tracked by multiple merchants = 1 scrape job
3. Each scrape: price + in_stock extracted, price_snapshot row inserted
4. Raw HTML saved to Supabase Storage (path: {domain}/{url_path}/{timestamp}.html)
5. Failed scrape: retry 3x with exponential backoff (1min, 5min, 15min)
6. After 3 consecutive failures: dead-letter queue + merchant email notification
7. robots.txt checked before first scrape of any new domain

**Edge Cases:**
- CAPTCHA encountered: 2captcha fallback, max 3 attempts
- Price not found in HTML: log parse failure, do not insert snapshot, alert ops
- Playwright timeout (>30s): treated as failure, triggers retry

**Dependencies:** Upstash Redis (BullMQ), Bright Data proxy, Supabase Storage

---

## F4: Signal Engine
**Description:** Python service compares scraped prices against merchant's price, emits RAISE/LOWER/HOLD.

**Acceptance Criteria:**
1. Signal generated within 5 minutes of price_snapshot insert
2. RAISE: any tracked competitor price > merchant current_price AND competitor in_stock
3. LOWER: merchant current_price > 5% above median of all tracked competitor prices
4. HOLD: merchant price within ±2% of median competitor price
5. Confidence score (0–1) based on number of competitor data points
6. Duplicate suppression: same signal type not re-emitted within 1hr for same SKU
7. Signals viewable on /signals with reasoning text

**Edge Cases:**
- Only 1 competitor tracked: confidence capped at 0.6
- All competitors OOS: HOLD signal (insufficient data for RAISE)
- Merchant has no floor/ceiling set: signal generated but auto-reprice disabled

**Dependencies:** F3 (price_snapshots), PostgreSQL

---

## F5: OOS Alerts
**Description:** Notify merchant within 15 minutes when a competitor goes out of stock.

**Acceptance Criteria:**
1. OOS detected: in_stock transitions from true → false in price_snapshots
2. oos_alerts row inserted within the scrape cycle (15min for PREDATOR, 1hr for SNIPER, 6hr for SCOUT)
3. Email sent via Resend within 2 minutes of oos_alerts insert
4. Email includes: competitor name, OOS'd SKU, suggested action (raise price), direct link to /repricing
5. Alert resolved automatically when competitor restocks (in_stock → true)
6. Merchant can silence a specific competitor URL's OOS alerts

**Edge Cases:**
- Competitor flaps in/out of stock within same scrape cycle: deduplicate, send 1 alert
- Merchant email bounces: log, do not retry more than 1x

**Dependencies:** F3 (scraper), Resend API

---

## F6: Dashboard Overview
**Description:** Single-screen overview showing signals today, revenue recovered (MTD), active OOS alerts.

**Acceptance Criteria:**
1. Shows count of RAISE/LOWER/HOLD signals in last 24hr
2. Shows revenue recovered MTD (sum of price_changes.revenue_delta where source='auto')
3. Shows count of active OOS alerts (oos_alerts where resolved_at IS NULL)
4. Signal feed shows last 10 signals with type badge, SKU name, time ago
5. Data refreshes every 60 seconds via TanStack Query
6. Empty state shown for new accounts with 0 signals (not broken UI)

**Dependencies:** F4 (signals), F5 (oos_alerts), F7 (attribution for revenue counter)

---

## F7: Auto-Reprice Rules (SNIPER+)
**Description:** Merchant sets floor/ceiling prices per SKU; SPECTER auto-applies price changes based on signals.

**Acceptance Criteria:**
1. Only available on SNIPER and above plans
2. Merchant sets floor_price and ceiling_price per SKU on /repricing
3. When RAISE signal fires: new price = min(competitor_price - $0.01, ceiling_price)
4. When LOWER signal fires: new price = max(median_competitor_price - $0.01, floor_price)
5. Price change applied via Shopify Admin API within 5 minutes of signal
6. price_changes row inserted with old_price, new_price, signal_id, source='auto'
7. Merchant can disable auto-reprice globally or per-SKU

**Edge Cases:**
- Suggested price below floor_price: apply floor_price, log as "floor-clamped"
- Shopify API call fails: retry 3x, then mark price_change as failed, notify merchant
- Merchant revokes Shopify token mid-repricing: stop all auto-reprice, send reconnect email

**Dependencies:** F4 (signals), Shopify Admin API, SNIPER+ plan check

---

## F8: Revenue Attribution (PREDATOR+)
**Description:** Show exact dollar impact per price change over trailing 30 days.

**Acceptance Criteria:**
1. Only available on PREDATOR and above plans
2. revenue_delta calculated as: (new_price - old_price) × units_sold_in_next_24hr
3. Units sold fetched from Shopify Orders API post-price-change
4. /attribution page shows bar chart: date vs. revenue_delta
5. Total "recovered" and "lost" tallied separately
6. CSV export of attribution data

**Edge Cases:**
- Shopify Orders API unavailable: show last known data with "data delayed" badge
- Price changed multiple times in 24hr: attribute to most recent change only

**Dependencies:** F7 (price_changes), Shopify Orders API, PREDATOR+ plan check
```

- [ ] **Step 2: Commit**

```bash
git add docs/FEATURES.md
git commit -m "docs: add FEATURES.md with acceptance criteria"
```

---

### Task 4: PRICING.md

**Files:**
- Create: `docs/PRICING.md`

- [ ] **Step 1: Create docs/PRICING.md**

```markdown
# SPECTER — Pricing & Monetization

## Pricing Philosophy
Value-based pricing anchored to measurable merchant ROI. A merchant doing $1M GMV with 5% margin improvement = $50K/year recovered. SPECTER at $1,788/year (SCOUT) is <4% of that. Price tiers are named after hunting roles to reinforce the "intelligence" brand.

## Tier Table
| Tier | Price | SKUs | Refresh | Key Features |
|------|-------|------|---------|--------------|
| SCOUT | $149/mo | 50 | 6hr | Signals, OOS alerts, email notifs, 14-day trial |
| SNIPER | $349/mo | 200 | 1hr | + Auto-reprice, API access, 14-day trial |
| PREDATOR | $1,299/mo | 500 | 15min | + Attribution, custom webhooks, demo required |
| APEX | $4,999+/mo | Unlimited | 5min | + Dedicated workers, SLA, custom contract |

**Annual discount:** 20% off (2 months free). Applied via Razorpay plan selection.

## Unit Economics
| | SCOUT | SNIPER | PREDATOR |
|--|-------|--------|----------|
| Revenue/mo | $149 | $349 | $1,299 |
| Scraping cost (est.) | ~$8 | ~$22 | ~$65 |
| Bright Data proxy cost | ~$3 | ~$8 | ~$25 |
| Supabase Storage | ~$0.50 | ~$1 | ~$3 |
| Resend email | ~$0.50 | ~$1 | ~$2 |
| **Total COGS** | ~$12 | ~$32 | ~$95 |
| **Gross Margin** | ~92% | ~91% | ~93% |
| Break-even users | 1 | 1 | 1 |

Domain batching reduces scraping cost by 40–70% as user base grows — margins improve at scale.

## Payment Provider: Razorpay
- **Why Razorpay:** Indian-founded team, supports INR + USD, Razorpay Subscriptions handles recurring billing natively, no complex tax/VAT handling needed for India market vs. Paddle/Stripe.
- **For US merchants:** Razorpay International (USD billing via Stripe-powered rails).
- **Webhook endpoint:** `POST /billing/webhook` in specter-api (signed with Razorpay webhook secret).
- **Plan IDs:** Create in Razorpay dashboard, store in env vars as RAZORPAY_PLAN_SCOUT, RAZORPAY_PLAN_SNIPER, RAZORPAY_PLAN_PREDATOR.

## Trial Policy
- SCOUT + SNIPER: 14-day free trial, no credit card required.
- PREDATOR + APEX: Demo call required, no self-serve trial.
- Trial end: Razorpay subscription auto-activates; email reminder at day 12 and day 14.
- Merchant downgraded to read-only (no new scrapes) on trial expiry without subscription.

## Upgrade Triggers
- SCOUT → SNIPER: "You have 47 RAISE signals this month. Auto-reprice would have applied them instantly."
- SNIPER → PREDATOR: "You've made 23 price changes. See exactly how much each one recovered."
```

- [ ] **Step 2: Commit**

```bash
git add docs/PRICING.md
git commit -m "docs: add PRICING.md with unit economics"
```

---

### Task 5: TECHSTACK.md

**Files:**
- Create: `docs/TECHSTACK.md`

- [ ] **Step 1: Create docs/TECHSTACK.md**

```markdown
# SPECTER — Tech Stack Reference

## Version Pins (as of 2026-05-23)
| Package | Version | Notes |
|---------|---------|-------|
| next | 14.2.x | App Router, do NOT upgrade to 15.x during MVP |
| react | 18.3.x | |
| typescript | 5.4.x | strict mode enabled |
| tailwindcss | 3.4.x | |
| @clerk/nextjs | 5.x | |
| @tanstack/react-query | 5.x | |
| zustand | 4.x | |
| framer-motion | 11.x | |
| gsap | 3.12.x | |
| @react-three/fiber | 8.x | |
| three | 0.x | |
| @lenis/react | 1.x | |
| recharts | 2.x | |
| react-hook-form | 7.x | |
| zod | 3.x | |
| lucide-react | 0.x | |

## specter-api
| Package | Version |
|---------|---------|
| Python | 3.11+ |
| fastapi | 0.111.x |
| sqlalchemy | 2.0.x |
| alembic | 1.13.x |
| pydantic | 2.x |
| httpx | 0.27.x |
| python-jose | 3.x |
| Node.js | 20 LTS |
| bullmq | 5.x |
| playwright | 1.44.x |

## Hosting
| Service | What | Cost |
|---------|------|------|
| Vercel | specter-web | Free (Hobby) → $20/mo (Pro) at scale |
| Railway | specter-api + scraper workers | $5/mo Hobby |
| Supabase | PostgreSQL + Storage | Free (500MB) → $25/mo |
| Upstash | Redis (BullMQ) | Free (10K commands/day) → $0.2/100K |
| Bright Data | Residential proxies | ~$15/GB (pay-as-you-go) |
| Resend | Transactional email | Free (3K/mo) → $20/mo |
| Clerk | Auth | Free (10K MAU) |
| Sentry | Error monitoring | Free |
| PostHog | Product analytics | Free (1M events/mo) |

## Why Each Choice
- **Next.js 14 App Router:** RSC for dashboard (fast TTI), client components for real-time signal feed. Static generation for marketing/tools pages.
- **Clerk over Supabase Auth:** Out-of-box JWT, organization features for future team plans, Shopify OAuth support. Supabase Auth as fallback if Clerk billing becomes prohibitive.
- **Supabase Storage over S3 at launch:** Same client as DB, no separate AWS account setup. Migrate to S3 after $1K MRR.
- **Railway over Fly.io:** Simpler deployment for Python + Node.js mixed repo, built-in Redis plugin, $5/mo Hobby covers MVP.
- **Razorpay over Stripe:** INR billing without additional Stripe India compliance overhead. Stripe International available via Razorpay for USD.
- **BullMQ over SQS/Pub-Sub:** Redis-backed, same Upstash instance, retry/backoff built-in, no vendor lock-in.
- **Bright Data over ScraperAPI:** 40–70% cheaper per GB at scale, residential IPs, session management for multi-page scrapes.
```

- [ ] **Step 2: Commit**

```bash
git add docs/TECHSTACK.md
git commit -m "docs: add TECHSTACK.md with version pins and rationale"
```

---

### Task 6: TOOLS.md (Calculator Formulas)

**Files:**
- Create: `docs/TOOLS.md`

- [ ] **Step 1: Create docs/TOOLS.md**

```markdown
# SPECTER — Free Tools Specification

All 6 tools are 100% client-side (no API calls). Each page structure:
`Hero pill → Calculator card (inputs) → Results panel → SPECTER CTA`

## Tool 1: Amazon FBA Fee Calculator
**Route:** `/tools/amazon-fba-calculator`  
**Primary keyword:** amazon fba fee calculator (22K/mo, HIGH competition)  
**Differentiator:** 6-marketplace comparison (US, UK, DE, FR, CA, JP) in one view

### Inputs
| Field | Type | Notes |
|-------|------|-------|
| Selling price | number | USD |
| Product cost (COGS) | number | USD |
| Weight (lbs) | number | |
| Length × Width × Height (in) | number × 3 | |
| Category | select | 30+ Amazon categories |
| Marketplace | multi-select | US/UK/DE/FR/CA/JP |

### Formula
```
dimensional_weight = (L × W × H) / 139  // Amazon divisor
billable_weight = max(actual_weight, dimensional_weight)

// US rates (2024, update annually)
fulfillment_fee = lookup(billable_weight, size_tier, US_FEE_TABLE)
referral_fee = selling_price × category_rate  // 6–17% by category
monthly_storage = billable_weight × 0.87  // Jan–Sep standard
long_term_storage = 0  // if < 365 days

net_profit = selling_price - product_cost - fulfillment_fee - referral_fee - monthly_storage
roi = (net_profit / product_cost) × 100
margin = (net_profit / selling_price) × 100
```

### Output
Show per marketplace: Fulfillment Fee | Referral Fee | Storage | Net Profit | ROI | Margin

---

## Tool 2: Shopify True Profit Calculator
**Route:** `/tools/shopify-profit-calculator`  
**Primary keyword:** shopify profit calculator (8K/mo, MEDIUM competition)  
**Differentiator:** Includes ALL hidden costs merchants miss

### Inputs
| Field | Default |
|-------|---------|
| Monthly revenue | — |
| COGS (%) | 40% |
| Shopify plan | Basic ($29) / Shopify ($79) / Advanced ($299) |
| Transaction fee (%) | 2% (Basic), 1% (Shopify), 0.5% (Advanced) |
| Payment processing | 2.9% + $0.30 (Shopify Payments) |
| Monthly app spend | — |
| Average order value | — |
| Return rate (%) | — |
| Shipping cost per order | — |
| Ad spend | — |

### Formula
```
total_orders = revenue / avg_order_value
gross_profit = revenue × (1 - cogs_pct)
shopify_fees = shopify_plan + (revenue × transaction_fee_pct)
processing_fees = (revenue × 0.029) + (total_orders × 0.30)
returns_cost = revenue × return_rate_pct × cogs_pct
shipping_total = total_orders × shipping_cost_per_order
true_profit = gross_profit - shopify_fees - processing_fees - app_spend - returns_cost - shipping_total - ad_spend
true_margin = (true_profit / revenue) × 100
```

---

## Tool 3: Shipping Rate Comparator
**Route:** `/tools/shipping-calculator`  
**Primary keyword:** shipping rate calculator (40K/mo, HIGH competition)  
**Differentiator:** Dimensional weight auto-calculation + 4 carrier side-by-side, no login

### Inputs
| Field | |
|-------|-|
| Origin ZIP | US only for MVP |
| Destination ZIP | |
| Weight (lbs) | |
| L × W × H (in) | |
| Service level | Ground / 2-Day / Overnight |

### Formula
```
// Dimensional weight
ups_dim_divisor = 139
fedex_dim_divisor = 139
usps_dim_divisor = 166  // different for USPS
dhl_dim_divisor = 139

dim_weight_ups = (L × W × H) / ups_dim_divisor
billable_ups = max(actual_weight, dim_weight_ups)

// Zone lookup (simplified — use static zone table by ZIP prefix)
zone = lookup_zone(origin_zip_prefix, dest_zip_prefix)

// Rate lookup (use static 2024 rate tables for each carrier + service)
rate_usps = USPS_RATES[service][billable_usps][zone]
rate_ups = UPS_RATES[service][billable_ups][zone]
rate_fedex = FEDEX_RATES[service][billable_fedex][zone]
rate_dhl = DHL_RATES[service][billable_dhl][zone]
```

**Note:** Use static rate lookup tables (hardcoded arrays in constants.ts). Rates update ~annually. Do NOT call carrier APIs (no CORS, requires accounts).

---

## Tool 4: Price Position Analyzer
**Route:** `/tools/price-position-analyzer`  
**Primary keyword:** competitor price analysis tool (1.2K/mo, LOW competition)  
**SPECTER funnel:** User inputs their price + up to 5 competitor prices → sees their position → CTA for automatic tracking

### Inputs
| Field | |
|-------|-|
| Your product price | |
| Your COGS | |
| Competitor prices (1–5) | |
| Your current monthly units sold | |

### Output
```
price_rank = rank of your_price among all prices (1 = cheapest)
median_competitor = median(competitor_prices)
gap_to_median = your_price - median_competitor
gap_pct = gap_to_median / median_competitor × 100

signal = 
  if gap_pct > 5%: "LOWER — You're priced above the market"
  if gap_pct < -5%: "RAISE — You're leaving margin on the table"
  else: "HOLD — You're competitively positioned"

est_margin = (your_price - cogs) / your_price × 100
est_margin_at_median = (median_competitor - cogs) / median_competitor × 100
```

**SPECTER CTA:** "SPECTER monitors these prices automatically — get alerted the instant they change."

---

## Tool 5: ROAS Profitability Calculator
**Route:** `/tools/roas-calculator`  
**Primary keyword:** roas calculator ecommerce (15K/mo, LOW competition)  
**Differentiator:** Shows TRUE profitable ROAS after all costs, not vanity ROAS

### Inputs
| Field | |
|-------|-|
| Ad spend | |
| Revenue from ads | |
| COGS (%) | |
| Shopify fee (%) | 2.9% default |
| Return rate (%) | |
| COGS of returns (%) | |

### Formula
```
reported_roas = revenue / ad_spend

net_revenue = revenue × (1 - return_rate_pct)
gross_profit = net_revenue × (1 - cogs_pct)
shopify_fees = net_revenue × shopify_fee_pct
return_costs = revenue × return_rate_pct × cogs_of_returns_pct
true_profit = gross_profit - shopify_fees - return_costs - ad_spend

true_roas = net_revenue / ad_spend
break_even_roas = 1 / (1 - cogs_pct - shopify_fee_pct)
profitable = true_profit > 0
```

---

## Tool 6: Inventory Reorder & Safety Stock Calculator
**Route:** `/tools/inventory-reorder-calculator`  
**Primary keyword:** inventory reorder point calculator (12K/mo, LOW competition)  
**Formula:** Wilson EOQ + safety stock

### Inputs
| Field | |
|-------|-|
| Average daily sales (units) | |
| Lead time (days) | |
| Lead time variability (days) | |
| Holding cost per unit per year | |
| Order cost per order | |
| Unit cost | |
| Service level | 90% / 95% / 99% |

### Formula
```
// Safety stock
z_score = {90%: 1.28, 95%: 1.645, 99%: 2.326}[service_level]
safety_stock = z_score × lead_time_variability × avg_daily_sales

// Reorder point
reorder_point = (avg_daily_sales × lead_time) + safety_stock

// Economic Order Quantity (Wilson)
annual_demand = avg_daily_sales × 365
eoq = sqrt((2 × annual_demand × order_cost) / holding_cost_per_unit_per_year)

// Days of stock at reorder
days_of_stock = reorder_point / avg_daily_sales
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/TOOLS.md
git commit -m "docs: add TOOLS.md with calculator formulas"
```

---

### Task 7: SCRAPER.md, ARCHITECTURE.md, WEBSITE.md, USERFLOW.md, DEVPLAN.md, GROWTH.md

**Files:**
- Create: `docs/SCRAPER.md`, `docs/ARCHITECTURE.md`, `docs/WEBSITE.md`, `docs/USERFLOW.md`, `docs/DEVPLAN.md`, `docs/GROWTH.md`

- [ ] **Step 1: Create docs/SCRAPER.md**

```markdown
# SPECTER — Scraper Architecture

## Stack
- Language: Node.js 20 (TypeScript)
- Queue: BullMQ backed by Upstash Redis
- Browser: Playwright (Chromium)
- Proxies: Bright Data residential (session-based)
- CAPTCHA: 2captcha API

## Queue Structure
```typescript
// queue.ts
import { Queue } from 'bullmq'
import { redis } from './redis'

export const scrapeQueue = new Queue('scrape', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
})

export type ScrapeJob = {
  url: string
  domain: string
  urlPath: string
  competitorUrlIds: string[]  // all merchants tracking this URL
}
```

## Domain Batching
Deduplication key: `${domain}:${url_path}`. Before queuing:
1. Check Redis for `scrape:lock:${domain}:${url_path}`
2. If lock exists: add competitorUrlId to existing job metadata
3. If no lock: create new job, set lock with TTL = scrape interval

## Per-Domain Parsers
Located in `scraper/domains/`. Each exports:
```typescript
export interface ParseResult {
  price: number | null
  inStock: boolean
  currency: string
  title: string | null
}
export async function parse(page: Page): Promise<ParseResult>
```

Fall through to `domains/generic.ts` if no domain-specific parser exists.
Generic parser uses: JSON-LD schema.org/Product, Open Graph price meta, common CSS selectors.

## Plan Refresh Schedules
| Plan | Interval | BullMQ repeat |
|------|----------|---------------|
| SCOUT | 6hr | `{ every: 21600000 }` |
| SNIPER | 1hr | `{ every: 3600000 }` |
| PREDATOR | 15min | `{ every: 900000 }` |

## Retry & Error Handling
- 3 retries, exponential backoff starting at 1 minute
- After 3 failures: move to `scrape:dead-letter` queue, POST to specter-api `/internal/scrape-failed`
- specter-api sends merchant email notification via Resend
- CAPTCHA: if Playwright detects challenge page, call 2captcha with screenshot, inject solution, retry

## robots.txt Compliance
On first scrape of any new domain:
1. Fetch `https://{domain}/robots.txt`
2. Parse with `robots-parser` npm package
3. If disallowed: set `competitor_urls.robots_blocked = true`, notify merchant, do not scrape
4. Cache robots.txt result in Redis for 24hr
```

- [ ] **Step 2: Create docs/ARCHITECTURE.md**

```markdown
# SPECTER — System Architecture

## High-Level Diagram
```
[Merchant Browser]
      ↓ HTTPS
[specter-web / Vercel]  ←→  [Clerk Auth]
      ↓ REST API (JWT)
[specter-api / Railway]
      ├── FastAPI routers
      ├── Signal Engine (Python)
      ├── Attribution Engine (Python)
      └── Scraper Scheduler
            ↓ BullMQ jobs
      [Upstash Redis]
            ↓
      [Playwright Workers / Railway]
            ↓
      [Bright Data Proxies]
            ↓
      [Competitor Websites]
            ↓ price_snapshots
      [Supabase PostgreSQL]
            ↑
      [specter-api reads]
            ↓ signals/alerts
      [specter-web dashboard]
```

## Request Flow: Merchant Sees a Signal
1. Merchant opens /signals in browser
2. Next.js renders page shell (RSC), TanStack Query fetches `/api/signals` from specter-api
3. specter-api validates Clerk JWT → reads signals table filtered by merchant_id + plan
4. Returns paginated signal list with confidence, reasoning, SKU name
5. TanStack Query refetches every 60 seconds

## Data Flow: Scrape → Signal
1. BullMQ scheduler (every N minutes by plan) dequeues scrape jobs
2. Playwright worker opens URL via Bright Data proxy
3. Parser extracts price + in_stock → price_snapshots row
4. Signal Engine reads latest price_snapshots for all competitor_urls of each sku_id
5. Applies RAISE/LOWER/HOLD logic → signals row
6. If OOS detected: oos_alerts row + Resend email

## Database: Supabase (PostgreSQL 15)
Row-level security (RLS) enabled. All queries go through specter-api (not direct from frontend).

## Secrets Management
- Vercel env: Clerk keys, specter-api URL, PostHog key
- Railway env: Supabase URL+key, Upstash URL, Bright Data creds, Razorpay keys, Clerk secret, Resend key, 2captcha key, AWS S3 (future)
```

- [ ] **Step 3: Create docs/WEBSITE.md**

```markdown
# SPECTER — Marketing Website Spec

**Route:** `app/(marketing)/page.tsx`  
**Sections:** 15 (imported as components into the page)

| # | Component | File | Key content |
|---|-----------|------|-------------|
| 1 | Hero | `components/marketing/hero.tsx` | Three.js particle field, "Know Before They Move", waitlist CTA |
| 2 | SocialProof | `social-proof.tsx` | Hardcoded logos + "$X recovered this month" (static at launch) |
| 3 | Problem | `problem.tsx` | 3-card grid: Manual checking (8hr/wk), Missed OOS windows (2–7 day), Enterprise gap ($50K vs $149) |
| 4 | ProductDemo | `product-demo.tsx` | Animated RAISE/LOWER/HOLD signal cards with Framer Motion |
| 5 | OOSFeature | `oos-feature.tsx` | Timeline animation: OOS detected → alert sent → price raised |
| 6 | AttributionFeature | `attribution-feature.tsx` | Recharts bar chart animation (mock data) |
| 7 | DomainBatching | `domain-batching.tsx` | Cost comparison: Single-tenant ($X) vs SPECTER ($Y) |
| 8 | CompetitorTable | `competitor-table.tsx` | SPECTER vs Prisync vs Competera vs basic apps |
| 9 | PricingSection | `pricing-section.tsx` | 4-tier cards, monthly/annual toggle, free trial badge |
| 10 | Integrations | `integrations.tsx` | Shopify + WooCommerce + Razorpay + Slack/email icon grid |
| 11 | ToolsCTA | `tools-cta.tsx` | 6-tool grid with icons, 1-line descriptions, links |
| 12 | Testimonials | `testimonials.tsx` | 3 cards — placeholder copy for launch |
| 13 | FAQ | `faq.tsx` | shadcn Accordion: legality, accuracy, onboarding, cancellation |
| 14 | FinalCTA | `final-cta.tsx` | "Start your 14-day free trial" + email input waitlist form |
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
```

- [ ] **Step 4: Create docs/USERFLOW.md**

```markdown
# SPECTER — User Flow

## Flow 1: Organic Discovery → Trial
1. User googles "amazon fba fee calculator"
2. Lands on /tools/amazon-fba-calculator
3. Uses calculator, sees SPECTER CTA at bottom
4. Clicks "Track prices automatically" → /sign-up
5. Completes Clerk signup (email or Google)
6. Redirected to onboarding → /settings
7. Connects Shopify store (OAuth)
8. Adds first competitor URL on /competitors
9. Sees first signal on /signals within 1hr (SNIPER) or 6hr (SCOUT)
10. Trial active for 14 days

## Flow 2: Trial → Paid
1. Day 12: receives "Trial ends in 2 days" email (Resend)
2. Clicks upgrade CTA in email → /settings/billing
3. Selects SCOUT or SNIPER plan
4. Razorpay payment modal
5. Subscription activated

## Flow 3: SCOUT → SNIPER Upgrade
1. User on /signals sees "Auto-reprice locked" badge on RAISE signal
2. Clicks "Unlock auto-reprice" → upgrade modal
3. Pays via Razorpay
4. Plan updated in DB via webhook → /repricing unlocked

## Flow 4: OOS Alert → Price Change
1. Competitor goes OOS
2. BullMQ scrape job detects in_stock: false
3. oos_alerts row created
4. Resend email sent within 2min
5. User clicks email link → /repricing (SNIPER+) or /alerts (SCOUT)
6. SNIPER+: auto-reprice fires automatically if enabled
7. SCOUT: user manually raises price on Shopify

## Flow 5: Waitlist (pre-launch)
1. Visitor on homepage, SaaS not live yet
2. Enters email in hero CTA or final CTA
3. Email saved to waitlist table (or Resend audience)
4. Confirmation email sent
5. Notified when SaaS launches
```

- [ ] **Step 5: Create docs/DEVPLAN.md**

```markdown
# SPECTER — Development Plan

## Week 1: specter-web — Marketing Site
| Day | Task |
|-----|------|
| 1 | Scaffold Next.js, design system, CLAUDE.md + all docs |
| 2 | Nav + Hero (Three.js) |
| 3 | Marketing sections 2–8 |
| 4 | Marketing sections 9–15 |
| 5 | Auth pages (Clerk), deploy to Vercel |

## Week 2: specter-web — 6 Free Tools
| Day | Task |
|-----|------|
| 6 | Shared tool layout + Tool 1 (FBA Calculator) |
| 7 | Tool 2 (Shopify Profit) + Tool 3 (Shipping) |
| 8 | Tool 4 (Price Position) + Tool 5 (ROAS) |
| 9 | Tool 6 (Inventory Reorder) + SEO metadata |
| 10 | QA all tools, submit sitemap to Google Search Console |

## Week 3: specter-api — Foundation
| Day | Task |
|-----|------|
| 11 | Scaffold FastAPI, DB models, Alembic migrations |
| 12 | Auth middleware (Clerk JWT), Merchants router |
| 13 | Shopify OAuth flow, SKU import |
| 14 | Competitors router, BullMQ queue setup |
| 15 | Playwright worker v1 (generic parser) |

## Week 4: specter-api — Core Intelligence
| Day | Task |
|-----|------|
| 16 | Signal engine (RAISE/LOWER/HOLD) |
| 17 | Signals router, OOS detection |
| 18 | OOS alerts (Resend email) |
| 19 | Auto-reprice service (Shopify API calls) |
| 20 | Deploy to Railway, connect specter-web dashboard |

## Week 5: specter-web — Dashboard
| Day | Task |
|-----|------|
| 21 | Dashboard layout + sidebar |
| 22 | /dashboard overview + /signals + /competitors |
| 23 | /repricing + /alerts |
| 24 | Razorpay billing, /settings |
| 25 | Plan gating UI, TanStack Query hooks |

## Week 6: Attribution + Beta Launch
| Day | Task |
|-----|------|
| 26 | Attribution engine (Python) |
| 27 | /attribution dashboard page |
| 28 | E2E QA: onboarding → first signal → alert |
| 29 | Onboard 5 beta users manually |
| 30 | Bug fixes, performance, launch |
```

- [ ] **Step 6: Create docs/GROWTH.md**

```markdown
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
```

- [ ] **Step 7: Commit all remaining docs**

```bash
git add docs/SCRAPER.md docs/ARCHITECTURE.md docs/WEBSITE.md docs/USERFLOW.md docs/DEVPLAN.md docs/GROWTH.md
git commit -m "docs: add SCRAPER, ARCHITECTURE, WEBSITE, USERFLOW, DEVPLAN, GROWTH docs"
```
