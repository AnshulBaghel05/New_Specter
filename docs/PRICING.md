# SPECTER — Pricing & Monetization

## SKU Definition

**1 SKU = one of your products tracked against one competitor.**

Equivalently: a SKU is one *(your product → competitor)* link, and each link is **one competitor-page scrape per refresh cycle**. So a merchant's SKU count = the number of product→competitor links they've set up = the number of competitor scrapes per cycle. The scrape always happens on the **competitor's** page — the merchant's own store is synced over the Shopify/WooCommerce API and is never scraped.

| Setup                                     | SKUs consumed | Scrapes per cycle |
| ----------------------------------------- | ------------- | ----------------- |
| 100 of your products × 1 competitor each | 100           | 100               |
| 33 of your products × 3 competitors each | 99            | 99                |
| 1 product × 3 competitors                | 3             | 3                 |

A merchant tracking 1 of their products against 3 competitor stores consumes 3 SKUs. Tracking 10 products against 5 competitors each = 50 SKUs consumed. The plan's SKU limit is the ceiling on total active (product × competitor) pairs, not the number of products imported from Shopify.

Each plan also enforces a **Competitors per Product** limit — the maximum number of different competitor stores a merchant can map to a single own product. This prevents a merchant on RECON from routing all 100 SKUs to a single product with 100 competitors.

## Pricing Philosophy

Value-based pricing anchored to measurable merchant ROI. A merchant doing $1M GMV with 5% margin improvement = $50K/year recovered. SPECTER at $948/year (RECON) is <2% of that. Tier names reflect the intelligence-gathering progression: reconnaissance → encryption → phantom surveillance → predatory intelligence → total eclipse of competitors.

## Tier Table

| Tier     | Price     | SKUs   | Refresh  | Competitors/Product | Key Features                                                                                                                                                                     |
| -------- | --------- | ------ | -------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FREE     | $0        | —     | —       | —                  | Free tool workspace (6 calculators + saved history, scenarios, CSV via email unlock) + preview of the paid platform. No live competitor data, no monitoring. Granted on sign-up. |
| RECON    | $79/mo    | 100    | 6hr      | 3                   | Signals, OOS alerts, email notifs, 14-day trial                                                                                                                                  |
| CIPHER   | $249/mo   | 500    | 3hr      | 5                   | + Auto-reprice, 14-day trial                                                                                                                                                     |
| PHANTOM  | $699/mo   | 1,000  | 2hr      | 8                   | + Attribution, custom webhooks, demo required                                                                                                                                    |
| PREDATOR | $1,799/mo | 2,000  | 1hr      | 12                  | + 90-day history, priority queue, priority support                                                                                                                               |
| ECLIPSE  | Custom    | Custom | 5–15min | Custom              | + Dedicated workers, SLA, white-glove onboarding —[book demo](mailto:sales@specter.ai)                                                                                             |

**SKU example (RECON):** 100 SKU limit with 3 competitors/product maximum. A merchant tracking 30 products × 3 competitors = 90 SKUs (within limit). Adding a 4th competitor to any product is blocked until they upgrade.

**Annual discount:** 15% off on **RECON, CIPHER, PHANTOM only**. Applied via Razorpay plan selection at checkout. **PREDATOR has no annual discount** — it is billed at the same rate (12× monthly) whether monthly or annual. ECLIPSE pricing is negotiated directly — no self-serve annual toggle.

> ### Promotion status — RECON / CIPHER / PHANTOM: **OFF (list pricing in effect)**
>
> The temporary 100%-off promo is **currently disabled** — RECON ($79), CIPHER ($249), and PHANTOM ($699) display and bill at list price. The promo is a removable display layer only; list prices, plan hierarchy, feature allocation, and billing architecture are unchanged.
>
> **Where it lives (display):** `specter-web/lib/pricing.ts` → `PROMO_FREE_PLANS` (currently `[]`). `isPromoActive()` derives from it and gates every promo banner + per-card badge, so the whole promo is one switch with no stale copy. Every price surface derives its number from this constant + `lib/dashboard/plan-meta.ts` list prices.
>
> **To RE-ENABLE the promo (display):** set `PROMO_FREE_PLANS = ['recon','cipher','phantom']` in `specter-web/lib/pricing.ts`. All banners, badges, and prices flip automatically.
>
> ⚠️ **Billing must match display (no profit loss).** Display and billing are separate. Whenever you change the promo, also align the Razorpay side (below) so the amount charged equals the amount shown — otherwise users see one price and are charged another.
>
> **To make the promo real / revert it (Razorpay — billing is plan-ID driven, no amounts in code):**
> 1. **Apply 100% off:** in the Razorpay dashboard, attach a 100%-off offer to the RECON/CIPHER/PHANTOM subscription plans, **or** point `RAZORPAY_PLAN_RECON_MONTHLY`, `RAZORPAY_PLAN_CIPHER_MONTHLY`, `RAZORPAY_PLAN_PHANTOM_MONTHLY` (and the `_ANNUAL` vars) at $0 promo plans.
> 2. **Remove the promo:** detach the offer / restore the standard `RAZORPAY_PLAN_*` plan IDs to the list-price plans.
> 3. **Annual amounts (independent of the promo):** ensure the `_ANNUAL` Razorpay plans for RECON/CIPHER/PHANTOM are priced at **15% off** 12× monthly, and that `RAZORPAY_PLAN_PREDATOR_ANNUAL` equals **12× monthly** (no discount).
>
> The backend (`services/billing.py`, `routers/billing.py`) is intentionally untouched — it resolves plan IDs, never amounts, so promos are a dashboard + display concern.

## Unit Economics

|                           | RECON                                | CIPHER                                 | PHANTOM         | PREDATOR        |
| ------------------------- | ------------------------------------ | -------------------------------------- | --------------- | --------------- |
| Revenue/mo                | $79 | $249                           | $699 | $1,799                          |                 |                 |
| Scrapes/mo (gross)        | 12,000                               | 120,000                                | 360,000         | 1,440,000       |
| Raw proxy cost            | $7.56 | $75.60                       | $226.80 | $907.20                      |                 |                 |
| Batching multiplier       | 5×                                  | 8×                                    | 12×            | 15×            |
| Net proxy cost            | $1.51 | $9.45                        | $18.90 | $60.48                        |                 |                 |
| Infra overhead            | $2.50 | $4.00                        | $7.00 | $15.00                         |                 |                 |
| Email + notifications     | $0.50 | $0.75                        | $1.00 | $1.50                          |                 |                 |
| Gemini API cost (ceiling) | $0 | ~$7.20                          | ~$21.60 | ~$86.40                      |                 |                 |
| **Total COGS**      | **~$4.51** | **~$21.40** | **~$48.50** | **~$163.38** |                 |                 |
| **Gross Margin**    | **94.3%**                      | **91.4%**                        | **93.1%** | **90.9%** |

Gemini API costs shown at ceiling (zero cache hits). Expected 40–60% cache hit rate on stable domains reduces real-world AI costs to approximately: CIPHER ~$3.60–4.32/mo, PHANTOM ~$10.80–12.96/mo, PREDATOR ~$43.20–51.84/mo. RECON uses rule-based engine only — no Gemini cost.

Proxy model: Bright Data ISP at $8.40/GB, 75KB per scrape with resource blocking ($0.00063/scrape). Scrapes/day = 24 ÷ refresh_hours. Domain batching is the margin moat — 5–15× scraping cost reduction as users share competitor URL scrapes.

**Margin floor (2× batching — early users, low URL overlap):**

|              | RECON | CIPHER | PHANTOM | PREDATOR |
| ------------ | ----- | ------ | ------- | -------- |
| Margin floor | 91.4% | 80.0%  | 79.5%   | 69.1%    |

Gemini costs included at ceiling (no caching). PHANTOM margin floor (79.5%) recovers to 80%+ with 40%+ Gemini cache hit rate. PREDATOR requires minimum 4× URL batching for 80%+ margin with AI engine active (vs 3× without AI). Monitor URL overlap before onboarding PREDATOR accounts. See AI_PRICING.md for caching strategy.

## À La Carte Add-Ons

| Add-on                                            | Price  | Available on |
| ------------------------------------------------- | ------ | ------------ |
| +50 SKUs                                          | $19/mo | All plans    |
| +100 SKUs                                         | $35/mo | All plans    |
| Speed boost: up to 50 chosen SKUs from 6hr → 3hr | $29/mo | RECON only   |
| Speed boost: up to 50 chosen SKUs from 3hr → 2hr | $39/mo | CIPHER only  |
| Speed boost: up to 50 chosen SKUs from 2hr → 1hr | $49/mo | PHANTOM only |

Add-ons expand the SKU (product × competitor) count limit only — they do not raise the Competitors/Product ceiling or unlock plan-gated features. Max 3 active add-on subscriptions per account. Each add-on type counts as one subscription (e.g., a merchant can hold +50 SKUs + +100 SKUs + one speed boost = 3 add-ons, but cannot stack two +50 SKU subscriptions). All add-on subscriptions are cancelled immediately on downgrade — they do not carry over to the new plan.

## Payment Provider: Razorpay

- **Why Razorpay:** Supports INR + USD, native subscriptions, no complex VAT for India market.
- **For US merchants:** Razorpay International (USD via Stripe-powered rails).
- **Webhook endpoint:** `POST /billing/webhook` in specter-api (signed with Razorpay webhook secret).
- **Plan IDs (set in Railway env vars):**

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

## Trial Policy

- **RECON + CIPHER:** 14-day free trial, no credit card required. Razorpay subscription auto-activates day 15 at whichever billing cadence (monthly or annual) the merchant selected at signup. Resend reminder emails at day 12 and day 14.
- **PHANTOM + PREDATOR + ECLIPSE:** Demo call required. No self-serve trial.
- **Trial expiry without payment:** Account downgraded to the **FREE** plan — the full free tool workspace is retained; live monitoring, signals, and auto-reprice lock behind a paid plan. Tracked SKUs (competitor_trackings rows) are paused and retained 30 days before deletion. *(Replaces the prior read-only lockout: keeps the merchant engaged in the free workspace and nurturable, instead of churning to a dead account.)*
- **Sign-up grants FREE, not a trial.** The 14-day RECON/CIPHER trial is an explicit, prominently-promoted opt-in ("Start 14-day trial" / "Connect your store"). The trial remains the **primary CTA**; FREE is the catch-all on-ramp and post-trial fallback.
- **Downgrade:** Immediate. SKUs (competitor_trackings rows) above the new plan's limit are paused (not deleted). Merchant selects which to keep active. If their competitor count per product now exceeds the new plan's Competitors/Product limit, excess trackings are also paused. All add-on subscriptions are cancelled immediately on downgrade.
- **Annual plans:** No refunds on annual subscriptions.

## Tier Taglines (Value Ladder)

| Tier     | Tagline                  | Job to Be Done                  |
| -------- | ------------------------ | ------------------------------- |
| RECON    | Know when they move      | Monitoring + alerts             |
| CIPHER   | Know + act automatically | Monitoring + auto-reprice       |
| PHANTOM  | Know, act, prove ROI     | Full intelligence + attribution |
| PREDATOR | Move first, always       | Maximum speed + scale           |
| ECLIPSE  | Your dedicated edge      | Dedicated infrastructure        |

## CTA Copy Per Tier

| Tier     | Primary CTA                      | Href                       |
| -------- | -------------------------------- | -------------------------- |
| RECON    | Start monitoring free — 14 days | /sign-up                   |
| CIPHER   | Start repricing automatically    | /sign-up                   |
| PHANTOM  | Book a 15-min demo               | mailto:sales@specterapp.io |
| PREDATOR | Talk to sales                    | mailto:sales@specterapp.io |
| ECLIPSE  | Contact enterprise team          | mailto:sales@specterapp.io |

## JTBD Comparison (used in competitor-table.tsx)

```
Question                                     SPECTER  Prisync  Wiser   Manual
──────────────────────────────────────────────────────────────────────────────
Know when a competitor changes price           ✓        ✓       ✓        ✗
Know when a competitor goes out of stock       ✓        ✗       ✗        ✗
Get AI RAISE/LOWER/HOLD signals                ✓        ✗       ✗        ✗
Prices update automatically on Shopify         ✓        ✓       ✗        ✗
See which price changes made you money         ✓        ✗       ✗        ✗
Push signals to Slack, email, or webhooks      ✓        ✗       ✗        ✗
Price floor & ceiling guardrails               ✓        ✓       ✓        ✗
6 free calculator tools included               ✓        ✗       ✗        ✗
Starting price                               $79/mo  $99/mo  $139/mo  $0+40h/wk
```

## Upgrade Triggers (in-product messaging)

- **RECON → CIPHER:** "You have {raise_count} RAISE signals this month. Auto-reprice on CIPHER would have applied them instantly — and you're tracking {competitor_count} competitors across {product_count} products ({sku_used}/{sku_limit} SKUs)."
- **CIPHER → PHANTOM:** "You've made {price_change_count} price changes. See exactly how much each one recovered with revenue attribution on PHANTOM."
- **PHANTOM → PREDATOR:** "Your competitors are changing prices faster than 2hr catches. PREDATOR's 1hr refresh and priority queue means you act first."
- **Competitor limit hit:** "You've reached {plan.max_competitors_per_sku} competitors per product on {plan_name}. Upgrade to track up to {next_plan.max_competitors_per_sku} competitors per product."
- **FREE → trial (PQL, in-workspace):** "You've run {tool_check_count} tool checks this week. SPECTER monitors these competitors automatically and signals you the moment they move — start your 14-day trial."

## Free-Tool & Workspace Gate Config (see MONETIZATION.md + 2026-05-30 spec)

Tool outputs are layered Free / Email / Paid. Summary of the segmentation decisions:

| Capability                                                                            | Layer           | Tier         |
| ------------------------------------------------------------------------------------- | --------------- | ------------ |
| Core calculation + hero + 3 supporting + full breakdown                               | Free            | —           |
| PDF / print report                                                                    | Free            | —           |
| Save result + shareable link, scenario compare, CSV download, 1 enhanced insight/tool | Email (Layer 1) | FREE account |
| Live competitor prices, real signal, automatic monitoring                             | Paid            | RECON        |
| Auto-reprice, batch analysis, full optimizer catalogs, bulk/scheduled export          | Paid            | CIPHER       |
| Attribution, cohort LTV, 90-day history/trends                                        | Paid            | PHANTOM+     |

**Tool → tier routing for locked sections:** live data / monitoring → **RECON**; automation / batch / exports-at-scale → **CIPHER**; attribution / history → **PHANTOM+**. Locked sections always name the specific unlock, never "Upgrade to unlock."
