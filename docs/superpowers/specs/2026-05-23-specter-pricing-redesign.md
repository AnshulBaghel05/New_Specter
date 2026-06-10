# SPECTER — Pricing Redesign Specification

**Date:** 2026-05-23
**Status:** Approved
**Replaces:** Section 5 of `2026-05-23-specter-design.md` (original 4-tier SCOUT/SNIPER/PREDATOR/APEX structure)

---

## 1. Why This Replaces the Original

The original structure (SCOUT $149 / SNIPER $349 / PREDATOR $1,299 / APEX $4,999+) had:
- A $149 entry price that blocks price-sensitive early adopters
- Only 50 SKUs on SCOUT (too few for merchants doing $500K+ GMV)
- 15min refresh on PREDATOR creating unsustainable infra costs at low user count
- No tier between $349 and $1,299 — a $950 gap with no upgrade path

The new 5-tier structure fixes all four problems.

---

## 2. Pricing Tiers

| Tier | Price | SKUs | Refresh | Trial |
|------|-------|------|---------|-------|
| RECON | $79/mo | 100 | 6hr | 14-day free, no CC |
| CIPHER | $249/mo | 500 | 3hr | 14-day free, no CC |
| PHANTOM | $699/mo | 1,000 | 2hr | Demo required |
| PREDATOR | $1,799/mo | 2,000 | 1hr | Demo required |
| ECLIPSE | Custom | Custom | 5–15min | Demo required |

**Annual discount:** 20% off (2 months free) on RECON, CIPHER, PHANTOM, PREDATOR. Applied via Razorpay plan selection at checkout.

---

## 3. Feature Assignment Per Tier

Features are enforced server-side in specter-api middleware. Frontend gating is UI-only.

| Feature | RECON | CIPHER | PHANTOM | PREDATOR | ECLIPSE |
|---------|:-----:|:------:|:-------:|:--------:|:-------:|
| RAISE/LOWER/HOLD signals | ✅ | ✅ | ✅ | ✅ | ✅ |
| OOS alerts | ✅ | ✅ | ✅ | ✅ | ✅ |
| Email notifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dashboard overview | ✅ | ✅ | ✅ | ✅ | ✅ |
| Competitor URL management | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shopify + WooCommerce OAuth | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auto-reprice (floor/ceiling) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Revenue attribution ($/change) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Custom webhooks | ❌ | ❌ | ✅ | ✅ | ✅ |
| 90-day price history | ❌ | ❌ | ❌ | ✅ | ✅ |
| Priority scrape queue | ❌ | ❌ | ❌ | ✅ | ✅ |
| Priority support (Slack, 24hr SLA) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Dedicated scraper workers | ❌ | ❌ | ❌ | ❌ | ✅ |
| Uptime SLA (99.9%) | ❌ | ❌ | ❌ | ❌ | ✅ |
| White-glove onboarding | ❌ | ❌ | ❌ | ❌ | ✅ |
| Custom contract + invoicing | ❌ | ❌ | ❌ | ❌ | ✅ |

**Removed from all tiers:** API access (removed from product scope entirely).

**History depth:**
- RECON / CIPHER / PHANTOM: 30-day price history
- PREDATOR / ECLIPSE: 90-day price history

---

## 4. À La Carte Add-Ons

Add-ons expand quantity or speed only. They do not unlock plan-gated features.

| Add-on | Price | Plans |
|--------|-------|-------|
| +50 SKUs | $19/mo | All |
| +100 SKUs | $35/mo | All |
| Speed boost: 50 SKUs from 6hr → 3hr | $29/mo | RECON only |
| Speed boost: 50 SKUs from 3hr → 2hr | $39/mo | CIPHER only |
| Speed boost: 50 SKUs from 2hr → 1hr | $49/mo | PHANTOM only |

Add-ons are billed via separate Razorpay subscription line items. Max 3 active add-on subscriptions per account (not per type) to avoid billing complexity at MVP.

---

## 5. Unit Economics

### Cost Model Inputs
- **Proxy:** Bright Data ISP proxies at $8.40/GB (20GB+ monthly plan)
- **Data per scrape:** ~75KB (Playwright with resource blocking — images, CSS, fonts blocked)
- **Raw proxy cost per scrape:** $8.40 × 0.000075GB = **$0.00063**
- **Domain batching:** Deduplication key `(domain, url_path)` — one scrape serves all merchants tracking the same URL. Conservative multiplier: 5–15× depending on tier.
- **Shared infra:** Railway + Supabase + Upstash + Resend + Clerk allocated proportionally per user.

### Steady-State Margins (5–15× batching)

| | RECON | CIPHER | PHANTOM | PREDATOR |
|--|-------|--------|---------|----------|
| Revenue/mo | $79 | $249 | $699 | $1,799 |
| Scrapes/mo (gross) | 12,000 | 120,000 | 360,000 | 1,440,000 |
| Raw proxy cost | $7.56 | $75.60 | $226.80 | $907.20 |
| Batching multiplier | 5× | 8× | 12× | 15× |
| Net proxy cost | $1.51 | $9.45 | $18.90 | $60.48 |
| Infra overhead | $2.50 | $4.00 | $7.00 | $15.00 |
| Email + notifications | $0.50 | $0.75 | $1.00 | $1.50 |
| **Total COGS** | **~$4.51** | **~$14.20** | **~$26.90** | **~$76.98** |
| **Gross margin** | **94.3%** | **94.3%** | **96.1%** | **95.7%** |

### Margin Floor (2× batching — early users, low URL overlap)

| | RECON | CIPHER | PHANTOM | PREDATOR |
|--|-------|--------|---------|----------|
| Net proxy cost (2×) | $3.78 | $37.80 | $113.40 | $453.60 |
| Total COGS | ~$6.78 | ~$42.55 | ~$121.40 | ~$470.10 |
| **Margin floor** | **91.4%** | **82.9%** | **82.6%** | **73.9%** |

> **PREDATOR risk note:** Drops below 80% target at 2× batching. Minimum required batching for 80%+ margin = 3×. Achievable at ~50 users — 3 merchants tracking the same Amazon/Walmart URL is common even early. Monitor and enforce a minimum URL overlap threshold before onboarding PREDATOR accounts at MVP.

### LTV Projections (blended estimate)

| | RECON | CIPHER | PHANTOM | PREDATOR |
|--|-------|--------|---------|----------|
| Assumed avg churn | 8%/mo | 6%/mo | 4%/mo | 3%/mo |
| Avg customer lifetime | 12.5 mo | 16.7 mo | 25 mo | 33 mo |
| LTV | ~$988 | ~$4,158 | ~$17,475 | ~$59,367 |
| LTV / COGS | 219× | 293× | 650× | 771× |

---

## 6. Trial + Billing Policy

- **RECON + CIPHER:** 14-day free trial, no credit card required at signup. Razorpay subscription auto-activates on day 15. Reminder emails via Resend at day 12 and day 14.
- **PHANTOM + PREDATOR + ECLIPSE:** Demo call required. No self-serve trial. "Book a demo" CTA on pricing page routes to Calendly (or equivalent).
- **Trial expiry without payment:** Merchant account downgraded to read-only. No new scrapes enqueued. Existing data retained for 30 days before deletion.
- **Downgrade:** Immediate. SKUs above new plan limit are paused (not deleted). Merchant chooses which to keep active.
- **Upgrade:** Immediate. Prorated billing via Razorpay.
- **Cancellation:** Active until end of billing period. No refunds on annual plans.

---

## 7. Razorpay Plan IDs

Store in Railway environment variables. Create plans in Razorpay dashboard before deployment.

```
RAZORPAY_PLAN_RECON_MONTHLY=
RAZORPAY_PLAN_RECON_ANNUAL=
RAZORPAY_PLAN_CIPHER_MONTHLY=
RAZORPAY_PLAN_CIPHER_ANNUAL=
RAZORPAY_PLAN_PHANTOM_MONTHLY=
RAZORPAY_PLAN_PHANTOM_ANNUAL=
RAZORPAY_PLAN_PREDATOR_MONTHLY=
RAZORPAY_PLAN_PREDATOR_ANNUAL=
RAZORPAY_PLAN_ADDON_50SKU=
RAZORPAY_PLAN_ADDON_100SKU=
RAZORPAY_PLAN_ADDON_SPEED_RECON=
RAZORPAY_PLAN_ADDON_SPEED_CIPHER=
RAZORPAY_PLAN_ADDON_SPEED_PHANTOM=
```

---

## 8. Upgrade Trigger Copy (in-product messaging)

- **RECON → CIPHER:** "You have {n} RAISE signals this month. Auto-reprice on CIPHER would have applied them instantly — and you're tracking {x}/100 SKUs."
- **CIPHER → PHANTOM:** "You've made {n} price changes. See exactly how much each one recovered with revenue attribution on PHANTOM."
- **PHANTOM → PREDATOR:** "Your competitors are changing prices faster than 2hr catches. PREDATOR's 1hr refresh and priority queue means you act first."

---

## 9. Files to Update After This Spec

The implementation plan (written next) must update these files to reflect the new tier names and feature gates:

| File | What changes |
|------|-------------|
| `docs/PRICING.md` | Full replacement with new tier table + unit economics |
| `docs/FEATURES.md` | Feature gate labels updated (CIPHER+ not SNIPER+, PHANTOM+ not PREDATOR+) |
| `docs/SCRAPER.md` | Refresh intervals: 6hr/3hr/2hr/1hr/5-15min + BullMQ repeat values |
| `docs/ARCHITECTURE.md` | Tier enum references, subscription middleware |
| `docs/DEVPLAN.md` | Tier names in sprint tasks |
| `CLAUDE.md` | Tier names in critical rules |
| `docs/superpowers/specs/2026-05-23-specter-design.md` | Section 5 marked superseded, pointer to this doc |

**Tier enum in database** (update `merchants.plan` column):
```sql
-- Old values: scout | sniper | predator | apex
-- New values: recon | cipher | phantom | predator | eclipse
-- Note: 'predator' persists but at a different price point ($1,799 vs $1,299)
```

---

## 10. Out of Scope for This Redesign

- AI pricing engine (Sub-project C — separate spec)
- Enterprise scraping architecture (Sub-project B — separate spec)
- PROMPTS.md (Sub-project D — separate spec)
- Actual Razorpay webhook implementation (covered in specter-api plan)
- Frontend pricing page redesign (covered in specter-web plan)
