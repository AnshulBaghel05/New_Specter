# SPECTER — Truthful Cost & Profit-Margin Analysis

> **Status:** Independent analysis (2026-05-31). Cross-checks the numbers in `PRICING.md` and `AI_PRICING.md` against the architecture in `SCRAPER.md`/`ARCHITECTURE.md` and real-world vendor list prices. **Modeled estimates, not invoices** — every assumption is stated so you can change one number and recompute. Where this analysis disagrees with `PRICING.md`, the disagreement and its cause are called out explicitly.

---

## 0. TL;DR

- **The SKU = scrape question:** `1 SKU = 1 (product × competitor) pairing = 1 competitor-URL scrape per refresh cycle.` 100 SKUs (RECON) = **100 scrapes per cycle = 12,000 scrapes/month**, *not* 300. (Details in §1.)
- **The business model lives or dies on two levers:** (a) the **domain-batching multiplier** (how many merchants share the same competitor URLs), and (b) **which Gemini model** you actually run. Get both right → 70–90% gross margin. Get either wrong → CIPHER/PHANTOM/PREDATOR go **margin-negative**.
- **`PRICING.md`'s unit economics are optimistic and omit real costs:** payment-processing fees (~3%), FX spread, CAPTCHA solving, and retry overhead. Adding just payment fees drops the stated margins 1–4 points; the realistic scenario (modest batching) drops them to **58–83%**; the conservative scenario (no batching + true 1.5-Pro pricing) is **negative for every paid tier except RECON**.
- **One big cost you are *avoiding*:** billing is Razorpay-direct, so there is **no Shopify App Store 15% revenue cut** — worth ~12–15 margin points vs. listing through Shopify. If you ever distribute via the App Store, re-add that 15% line (§2.B).
- **These are *gross* margins (cost-to-serve only), not net profit.** They answer "is each tier priced above its serving cost?" — yes. They exclude CAC, salaries, and other OpEx (§2.D); the *company* can still be unprofitable while every *plan* shows 70–90%.
- **Margins below are computed at 100% SKU-quota utilization** (worst case for cost). Most merchants use far less, which improves real margins.

---

## 1. What a "SKU" costs in scrapes (resolving the question)

The code is unambiguous (`specter-api`): `sku_used = COUNT(competitor_trackings WHERE merchant_id=? AND enabled=true)`. A `competitor_tracking` row is exactly one *(your product × one competitor URL)* pair. The scraper scrapes **one competitor URL per enabled tracking per refresh cycle** (price snapshots are stored per URL).

Therefore **the billing unit and the scrape unit are the same thing**:

| Interpretation | Correct? | Why |
|---|---|---|
| "33 products × 3 competitors = 99 SKUs" | ✅ Correct | 99 pairings → 99 scrapes/cycle |
| "100 SKUs = 300 scrapes in RECON" | ❌ **Wrong** | 100 SKUs = 100 pairings = **100 scrapes/cycle**. 300 scrapes would require **300 SKUs** (e.g. 100 products × 3 competitors). |

The distribution across products is irrelevant to cost: 100 products × 1 competitor, or 33 products × 3 competitors, both = ~100 SKUs = ~100 scrapes/cycle. The *Competitors-per-Product* limit only caps how concentrated those pairings can be; it never multiplies the scrape count beyond the SKU total.

> **Why this matters for cost:** total scrape volume scales **linearly with the SKU count**, not with `SKUs × competitors`. If the limit were ever changed to count *products* (so each product silently fans out to N competitor scrapes), scrape volume — and proxy cost — would multiply by up to the per-plan competitor cap (3–12×) and the margins in this document would collapse. Keep the pairing definition.

### Scrape volume per fully-utilized account

`scrapes/day per SKU = 24 ÷ refresh_hours`; `monthly = SKUs × scrapes/day × 30`.

| Plan | SKUs | Refresh | Scrapes/cycle | Cycles/day | **Scrapes/month (gross)** |
|------|------|---------|---------------|-----------|---------------------------|
| RECON | 100 | 6 hr | 100 | 4 | **12,000** |
| CIPHER | 500 | 3 hr | 500 | 8 | **120,000** |
| PHANTOM | 1,000 | 2 hr | 1,000 | 12 | **360,000** |
| PREDATOR | 2,000 | 1 hr | 2,000 | 24 | **1,440,000** |
| ECLIPSE | custom | 5–15 min | custom | 96–288 | bespoke (see §7) |

"Gross" = before domain-batching dedup. This matches `PRICING.md` line 32. ✔

---

## 2. The complete cost taxonomy

Every cost that touches a paying account, grouped by how it scales. **Items marked ⚠ are missing or understated in `PRICING.md`.**

### A. Marginal per-scrape costs (scale with scrape volume)
| Cost | Driver | Notes |
|---|---|---|
| Residential/ISP proxy bandwidth | JS-rendered scrapes (Bright Data ISP, ~$8.40/GB) | Dominant variable cost at scale |
| Datacenter proxy bandwidth | HTTP_OK scrapes (cheap, ~$0.0002/scrape) | 3-tier queue routes easy sites here |
| Web Unlocker / SERP API | Hard anti-bot sites (Amazon, Walmart) | ⚠ Priced **per request** (~$1.5–3 / 1k), not per GB — far costlier than the $8.40/GB model assumes |
| Retry overhead | 3-attempt BullMQ backoff on blocks/timeouts | ⚠ Not in `PRICING.md`; adds ~10–50% to proxy volume |
| ⚠ CAPTCHA solving | 2captcha on challenged scrapes (~$1–3 / 1k solves) | ⚠ Listed as a dependency but **excluded from COGS** |
| Marginal compute | Chromium CPU/RAM per JS scrape (Railway) | Browser scrapes cost ~2–4 s each |

### B. Marginal per-account costs (scale with customers, not scrapes)
| Cost | Typical |
|---|---|
| ⚠ Payment processing (Razorpay) | **~3% international + 18% GST on the fee** (~3.5% effective). **Excluded from `PRICING.md` COGS.** |
| ⚠ FX / currency conversion | Razorpay International converts USD→INR settlement at ~1–2% spread on top of the gateway fee. Folded into the ~3.5% effective rate above as a conservative blend. |
| AI signal generation (CIPHER+) | Gemini API per batch — see §3 (and the model-pricing trap) |
| Email + push notifications | Resend (~$0.0004/email), OOS/digest/lifecycle |
| ⚠ Price-history storage (PREDATOR 90-day) | Supabase Postgres rows for 90-day `price_snapshots` retention. At 1,440,000 scrapes/mo × ~120 B/row × 3 months ≈ **0.5 GB/account** → ~$0.06/GB/mo Supabase storage ≈ **<$0.05/account/mo**. Negligible per-account, but it grows unbounded with fleet size — watch the aggregate. RECON/CIPHER/PHANTOM keep shorter windows, so even smaller. |

> **Distribution channel — a cost you are *avoiding* (state it so the comparison is honest):** SPECTER bills **direct via Razorpay**, not through Shopify Billing. That means **no Shopify App Store revenue share (15% under $1M ARR, 15–20% above)** is taken off the top. Had billing gone through the Shopify App Store, that 15% would dwarf the 3% payment fee and would cut every margin below by ~12–15 points. The Razorpay-direct decision is therefore worth ~15 margin points vs. the App-Store path — but it costs you Shopify's built-in install/discovery funnel (a customer-acquisition trade-off, not a COGS one). If a Shopify App Store listing is ever added for distribution, **re-run every table here with an extra 15% revenue-share line.**

### C. Fixed platform overhead (allocated across all active accounts)
| Cost | List price (early 2026) |
|---|---|
| Vercel (Pro) | ~$20/seat/mo + bandwidth/functions |
| Supabase (Pro) | ~$25/mo + usage |
| Upstash Redis | pay-per-request (BullMQ + caches) |
| Resend | free ≤3k/mo, then ~$20/mo (50k) |
| Always-on Railway services (API, scheduler, base workers) | ~$50–150/mo |
| Monitoring/error tracking (PagerDuty/Sentry) | ~$0–50/mo |
| **Total fixed** | **~$200–400/mo**, divided by # paying accounts |

> Fixed overhead **dominates at low customer counts**: $300/mo ÷ 20 accounts = $15/account; ÷ 200 accounts = $1.50/account. Margins improve as you scale.

### D. Operating expenses below the gross-margin line (real, but NOT in the per-plan margins)
The per-plan margins in §4 are **gross margins** (revenue − direct cost-to-serve). They are *not* net/operating profit. These company-wide expenses sit below that line and are not allocated per plan because they don't scale with an individual subscription:

- **FREE-plan users**: client-side calculators + email capture, **$0 revenue** (§6).
- **14-day trials**: full RECON/CIPHER scraping at **$0 revenue** (~half a month of that tier's scrape cost per trial) (§6).
- **Annual discount**: 15% off (RECON/CIPHER/PHANTOM only; PREDATOR & ECLIPSE have none) → 15% less revenue on those annual subs (modeled separately in §5). *(A temporary 100% promo on RECON/CIPHER/PHANTOM is a display/Razorpay layer and is intentionally NOT modeled here — margin modeling uses list economics; see PRICING.md.)*
- **Customer acquisition (CAC)**: ads, content/SEO, the 6 free tools as a funnel, sales time on PHANTOM+/ECLIPSE demos. Usually the single largest line for an early SaaS — frequently larger than all COGS combined.
- **Salaries / contractors**: engineering, support, ops.
- **Support / demos / onboarding labor**: PHANTOM+ require human demos and "priority support"; ECLIPSE adds white-glove onboarding + SLA.
- **Software & tooling subscriptions** not tied to serving (analytics — PostHog, CRM, design, CI).
- **Churn, refunds, failed-payment retries, chargebacks.**

> **So "profit margin" has two meanings.** The headline numbers in §4 are **gross margin per plan** — the right lens for "is each tier priced above its cost to serve?" (Yes, comfortably, in Optimistic/Realistic.) **Net/operating margin** for the company = blended gross profit across all paying accounts − the fixed OpEx above. Until CAC and salaries are funded by gross profit, the *business* can be unprofitable even while every *plan* shows 70–90% gross margin. Don't conflate the two.

---

## 3. The Gemini model-pricing trap (critical)

`AI_PRICING.md` states **model = `gemini-1.5-pro`** but prices it at **input $0.075 / output $0.30 per 1M tokens** and derives ~$0.003 per 50-SKU batch.

Those rates are **Gemini 1.5 _Flash_**, not 1.5 Pro. Real list prices (early 2026):

| Model | Input /1M | Output /1M | Cost per 50-SKU batch (~20k in + 4k out) |
|---|---|---|---|
| Gemini 1.5 **Flash** | $0.075 | $0.30 | ~$0.0027 |
| Gemini 1.5 **Pro** | $1.25 | $5.00 | ~$0.045 (**~16×**) |

**Monthly AI cost at ceiling (zero cache):**

| Plan | Batches/cycle × cycles/day × 30 = calls/mo | **Flash** | **Pro (named model)** |
|------|-------------------------------------------|-----------|----------------------|
| CIPHER | 10 × 8 × 30 = 2,400 | ~$7.20 | **~$108** |
| PHANTOM | 20 × 12 × 30 = 7,200 | ~$21.60 | **~$324** |
| PREDATOR | 40 × 24 × 30 = 28,800 | ~$86.40 | **~$1,296** |

**Decision required:** either (a) **run Gemini 1.5 Flash** (the quoted price; Flash is more than capable for structured RAISE/LOWER/HOLD JSON) and the doc's AI numbers hold, or (b) genuinely run 1.5 Pro and accept ~16× AI cost — at which point **PREDATOR's AI bill alone ($1,296) is 72% of its $1,799 revenue**, before a single scrape. This analysis uses **Flash** for the Optimistic/Realistic scenarios and shows **Pro** in the Conservative scenario as the downside.

---

## 4. Per-plan margin — three scenarios

All figures are **per fully-utilized account per month**, COGS in USD. Margin = `(Revenue − COGS) ÷ Revenue`.

**Shared assumptions**
- Payment fee: **3%** of revenue (Razorpay international; add ~18% GST on the fee for India billing).
- Email/notifications: $0.50 (RECON) → $1.50 (PREDATOR).
- Fixed overhead allocation: **$5/account** (≈ $300/mo ÷ 60 accounts; scale-dependent).
- AI: Flash @ 50% cache hit (Optimistic/Realistic); Pro @ ceiling (Conservative).
- Scrape-delivery blended rate **per scrape** (proxy + retries + CAPTCHA + marginal compute, **after batching**):

| Scenario | Batching | Domain mix / proxy | Blended $/scrape |
|---|---|---|---|
| **Optimistic** (matches `PRICING.md`) | 5–15× | 75 KB, resource-blocked, mostly ISP | $0.00005–0.00013 |
| **Realistic** | ~2× | 55% datacenter / 45% residential, +20% retries, light CAPTCHA | **~$0.00045** |
| **Conservative** | 1× (no overlap) | residential/Web-Unlocker heavy, +50% retries, more CAPTCHA | **~$0.0018** |

### Scenario A — Optimistic (the docs' own model + payment fee added)

| | RECON | CIPHER | PHANTOM | PREDATOR |
|--|------:|-------:|--------:|---------:|
| Revenue | $79 | $249 | $699 | $1,799 |
| Scrape delivery | $1.51 | $9.45 | $18.90 | $60.48 |
| AI (Flash, 50% cache) | $0 | $3.60 | $10.80 | $43.20 |
| Payment fee (3%) ⚠ | $2.37 | $7.47 | $20.97 | $53.97 |
| Email/notif | $0.50 | $0.75 | $1.00 | $1.50 |
| Fixed alloc | $5.00 | $5.00 | $5.00 | $5.00 |
| **COGS** | **$9.38** | **$26.27** | **$56.67** | **$164.15** |
| **Gross margin** | **88.1%** | **89.5%** | **91.9%** | **90.9%** |

*(`PRICING.md` claims 94.3 / 91.4 / 93.1 / 90.9% — those exclude payment fees. Adding fees gives the above; still very healthy.)*

### Scenario B — Realistic (modest 2× batching, Flash, mixed domains)

| | RECON | CIPHER | PHANTOM | PREDATOR |
|--|------:|-------:|--------:|---------:|
| Revenue | $79 | $249 | $699 | $1,799 |
| Scrape delivery (@$0.00045) | $5.40 | $54.00 | $162.00 | $648.00 |
| AI (Flash, 50% cache) | $0 | $3.60 | $10.80 | $43.20 |
| Payment fee (3%) | $2.37 | $7.47 | $20.97 | $53.97 |
| Email/notif | $0.50 | $0.75 | $1.00 | $1.50 |
| Fixed alloc | $5.00 | $5.00 | $5.00 | $5.00 |
| **COGS** | **$13.27** | **$70.82** | **$199.77** | **$751.67** |
| **Gross margin** | **83.2%** | **71.6%** | **71.4%** | **58.2%** |

> Realistic = the honest "today" number for a young product with limited cross-merchant URL overlap. PREDATOR is the squeeze point: at 1-hour refresh on 2,000 SKUs, scrape delivery alone is ~36% of revenue.

### Scenario C — Conservative (no batching, true 1.5-Pro pricing, heavy anti-bot)

| | RECON | CIPHER | PHANTOM | PREDATOR |
|--|------:|-------:|--------:|---------:|
| Revenue | $79 | $249 | $699 | $1,799 |
| Scrape delivery (@$0.0018) | $21.60 | $216.00 | $648.00 | $2,592.00 |
| AI (Pro, ceiling) | $0 | $108.00 | $324.00 | $1,296.00 |
| Payment fee (3%) | $2.37 | $7.47 | $20.97 | $53.97 |
| Email/notif | $0.50 | $0.75 | $1.00 | $1.50 |
| Fixed alloc | $8.00 | $8.00 | $8.00 | $8.00 |
| **COGS** | **$32.47** | **$340.22** | **$1,001.97** | **$3,951.47** |
| **Gross margin** | **58.9%** | **−36.6%** | **−43.3%** | **−119.6%** |

> Conservative shows what "everything that can go wrong" looks like: only RECON survives (rule-based, no AI, low volume). CIPHER+ bleed money. This is not fear-mongering — it is the natural state **before** you accumulate enough overlapping customers to drive batching, **if** you also run the expensive model.

### Margin summary

| Plan | Optimistic | **Realistic** | Conservative |
|------|-----------:|--------------:|-------------:|
| RECON | 88.1% | **83.2%** | 58.9% |
| CIPHER | 89.5% | **71.6%** | −36.6% |
| PHANTOM | 91.9% | **71.4%** | −43.3% |
| PREDATOR | 90.9% | **58.2%** | −119.6% |

---

## 5. Annual-plan margin (20% discount)

Annual billing reduces effective monthly revenue 20% while COGS is unchanged. Using **Realistic** COGS:

| Plan | Annual eff. rev/mo | Realistic COGS | Margin |
|------|-------------------:|---------------:|-------:|
| RECON | $63.20 | $13.27 | 79.0% |
| CIPHER | $199.20 | $70.82 | 64.4% |
| PHANTOM | $559.20 | $199.77 | 64.3% |
| PREDATOR | $1,439.20 | $751.67 | 47.8% |

> Annual + Realistic pushes **PREDATOR below 50%**. Cash-flow upside (12 months paid upfront) partly offsets the margin hit, but PREDATOR annual is the thinnest combination in the catalog.

---

## 6. Cost centers with $0 revenue

| Center | Cost driver | Est. cost | Revenue |
|---|---|---|---|
| **FREE plan** | Calculators are client-side; cost is Vercel bandwidth/functions + email-capture (Resend) + DB rows. **No scraping.** | ~$0.10–0.50 / active free user / mo | $0 |
| **14-day trial (RECON)** | ~14 days of RECON scraping | ~½ × RECON scrape cost ≈ **$0.75–2.70** / trial | $0 until day 15 |
| **14-day trial (CIPHER)** | ~14 days of CIPHER scraping + AI | ~½ × CIPHER variable ≈ **$5–27** / trial | $0 until day 15 |

Implications: FREE is cheap to keep open (the PLG on-ramp is well-designed — no scrape cost). **CIPHER trials are the expensive ones** — a trial that churns costs you up to ~$27 with nothing to show. Trial→paid conversion rate directly gates blended margin; watch it.

---

## 7. ECLIPSE (custom)

ECLIPSE runs 5–15-min refresh on dedicated workers. At 5-min refresh, scrapes/day per SKU = 288 (72× RECON's 4/day). Even at, say, 1,000 SKUs that is **8.64M scrapes/month** — far past shared-infra economics, which is exactly why it's **dedicated infrastructure on a bespoke contract**. Price ECLIPSE off a cost-plus model: `(dedicated worker fleet + dedicated proxy commit + dedicated AI quota) × target margin`. Do **not** apply the self-serve tier margins to it.

---

## 8. Sensitivity — the two levers that decide viability

**Lever 1: batching multiplier** (cross-merchant URL overlap). PREDATOR scrape-delivery cost, holding everything else at Realistic:

| Batching | $/scrape | PREDATOR scrape cost/mo | PREDATOR margin* |
|---|---|---|---|
| 1× | $0.00090 | $1,296 | 22.6% |
| 2× | $0.00045 | $648 | 58.2% |
| 5× | $0.00018 | $259 | 79.8% |
| 10× | $0.00009 | $130 | 87.0% |

*Flash AI @ 50% cache, 3% fee, $5 fixed.

**Lever 2: SKU-quota utilization.** Margins above assume 100% of the quota is tracked. At 50% utilization, scrape volume (and scrape cost) halves, lifting every paid-tier margin ~5–20 points. Real fleets rarely sit at 100%, so Realistic margins are likely a **floor**, not a midpoint — provided batching holds.

**Bottom line:** push **URL overlap up** (curate/recommend popular competitor URLs, cluster merchants by niche) and **keep AI on Flash with high cache hit-rates**. Those two moves move CIPHER+ from "fragile" to "80%+."

---

## 9. Recommendations

1. **Fix the docs:** correct `AI_PRICING.md` to either say *Gemini 1.5 Flash* (matching the quoted price) or re-price 1.5 Pro at $1.25/$5.00 and re-derive. Right now the model name and the price contradict each other by ~16×.
2. **Add the two missing COGS lines** to `PRICING.md`: payment fees (~3% + GST) and CAPTCHA. Re-state gross margins with them included (Scenario A above).
3. **Run Flash, not Pro**, unless signal quality testing proves Pro materially better — the margin delta is enormous, especially on PREDATOR.
4. **Instrument the batching multiplier and per-domain proxy mix in production** before onboarding PREDATOR/ECLIPSE accounts; `PRICING.md` already warns PREDATOR needs ≥4× batching with AI on. Treat that as a hard gate.
5. **Track CIPHER trial→paid conversion** — it's the most expensive $0-revenue path.
6. **Re-run this model with real invoice data** after the first 60–90 days. Replace the assumed $/scrape and batching multiplier with measured values.

---

## Appendix — assumptions & sources

- Scrape volumes: derived from `PRICING.md` tier table (SKUs, refresh) and confirmed against `24 ÷ refresh_hours × SKUs × 30`.
- Proxy model: Bright Data ISP $8.40/GB, 75 KB/scrape ($0.00063/scrape raw) per `PRICING.md`; 3-tier datacenter/HTTP/Playwright routing per `SCRAPER.md`; retry policy `attempts: 3` per `SCRAPER.md`.
- AI: token estimate ~20k in / 4k out per 50-SKU batch per `AI_PRICING.md`; Flash $0.075/$0.30 and Pro $1.25/$5.00 per 1M tokens (Google list prices, early 2026, ≤128k context tier).
- Payment: Razorpay ~3% international + 18% GST on fee (India billing) — list rates.
- CAPTCHA: 2captcha reCAPTCHA ~$1–3 / 1,000 solves — list rates.
- Platform: Vercel Pro ~$20, Supabase Pro ~$25, Resend ~$20/50k, Railway always-on ~$50–150 — list rates, early 2026.
- All vendor prices are list and **subject to change**; volume commits lower them. Margins are modeled at **100% SKU-quota utilization** (worst case for cost). This document supersedes nothing in `PRICING.md`; it stress-tests it.
