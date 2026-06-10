# SPECTER — Free Tools Specification

All tools are 100% client-side (no API calls). Each public tool now uses the
**1-3-More** skeleton: `Quick Answer → ≤4 inputs → 1 hero answer + ≤3 supporting +
AI Summary → "See full breakdown" (in DOM) → deeper analyses (collapsed) →
FAQ/Education`.

> **Set scope (2026-06-05):** the "free tools to simplify" set is the **5 public
> calculators** — Amazon FBA, Shopify Profit, Shipping, ROAS, Inventory.
> **Price Position Analyzer is carved out**: it stays public as the **SaaS bridge**
> (its live-data path leads to RECON+) and keeps its conversion funnel — it is NOT
> simplified to 1-3-More. See
> [master plan](superpowers/plans/2026-05-31-free-tools-plg-master.md).

## Feature Gate Architecture (applies to all tools)

See `docs/MONETIZATION.md` for the full gate spec. Summary (Public / Intermediate / Paid):
- **Layer 0 — Public (no gate):** Core calculation + hero answer + AI Summary — always complete, SEO-safe
- **Layer 1 — Intermediate (logged-in `free`):** Save/compare history, advanced tabs/charts, the SPECTER Workspace + Opportunity Feed. Local-first: save/compare are free + local; the account unlocks sync/history/Workspace (not the price of a first save)
- **Layer 2 — Paid gate:** Live competitor data, automatic monitoring, AI signals — `RECON+` or `CIPHER+`

**UX rule:** 4 inputs visible by default. Everything else behind `Advanced options [▼]` accordion. Result shown BEFORE any gate appears.

---

## Tool 1: Amazon FBA Fee Calculator

**Route:** `/tools/amazon-fba-calculator`
**Primary keyword:** amazon fba fee calculator (22K/mo, HIGH competition)
**Differentiator:** 6-marketplace comparison (US, UK, DE, FR, CA, JP) in one view

### Inputs

| Field                          | Type         | Notes                 |
| ------------------------------ | ------------ | --------------------- |
| Selling price                  | number       | USD                   |
| Product cost (COGS)            | number       | USD                   |
| Weight (lbs)                   | number       |                       |
| Length × Width × Height (in) | number × 3  |                       |
| Category                       | select       | 30+ Amazon categories |
| Marketplace                    | multi-select | US/UK/DE/FR/CA/JP     |

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

### Feature Gates

| Feature | Layer | Notes |
|---------|-------|-------|
| Core profit / margin / ROI / break-even | Free | Never gate this |
| Full fee breakdown | Free | Trust builder |
| Advanced inputs (VAT, dimensions, storage) | Free, collapsed | Behind `Advanced options [▼]` accordion |
| Tier fee comparison chart | Free, collapsed | Move to Details accordion |
| Cost distribution chart | Free, collapsed | Move to Details accordion |
| Category margin benchmark "Median: ██.█%" | Preview (blurred) | Show category, blur the number |
| Optimal price range | Preview (blurred) | Show label, blur value |
| Package Optimizer — 1 suggestion | Preview (blurred) | Show savings label, blur dimension/amount |
| Package Optimizer — full catalog | Paid (CIPHER+) | Gate after teaser |
| Batch catalog analysis | Paid (CIPHER+) | Never shown free |
| CSV export | Paid (CIPHER+) | Gate |

**Default visible inputs:** Selling Price, COGS, Category, Weight. Everything else in accordion.

---

## Tool 2: Shopify True Profit Calculator

**Route:** `/tools/shopify-profit-calculator`
**Primary keyword:** shopify profit calculator (8K/mo, MEDIUM competition)
**Differentiator:** Includes ALL hidden costs merchants miss

### Inputs

| Field                   | Default                                       |
| ----------------------- | --------------------------------------------- |
| Monthly revenue         | —                                            |
| COGS (%)                | 40%                                           |
| Shopify plan            | Basic ($29) / Shopify ($79) / Advanced ($299) |
| Transaction fee (%)     | 2% (Basic), 1% (Shopify), 0.5% (Advanced)     |
| Payment processing      | 2.9% + $0.30 (Shopify Payments)               |
| Monthly app spend       | —                                            |
| Average order value     | —                                            |
| Return rate (%)         | —                                            |
| Shipping cost per order | —                                            |
| Ad spend                | —                                            |

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

### Feature Gates

| Feature | Layer | Notes |
|---------|-------|-------|
| Core profit / margin / expenses (Tab 1) | Free | Always free |
| Shopify plan comparison (which plan is best) | Free | Good SEO content |
| Health badges (Healthy / Tight / Danger) | Free | Good UX |
| Basic LTV (Tab 2) | Email gate (Layer 1) | Drives signup |
| Advanced LTV / cohort analysis | Paid (CIPHER+) | Gate |
| Subscription / MRR tab (Tab 3) | Paid (CIPHER+) | Show preview with sample data |
| 12-month MRR projection | Paid (CIPHER+) | Gate — show 3-month free |

**Tab display:** `[Core Profit — Free]` `[LTV — Sign in]` `[Subscription — CIPHER+]`

---

## Tool 3: Shipping Rate Comparator

**Route:** `/tools/shipping-calculator`
**Primary keyword:** shipping rate calculator (40K/mo, HIGH competition)
**Differentiator:** Dimensional weight auto-calculation + 4 carrier side-by-side, no login

### Inputs

| Field            |                            |
| ---------------- | -------------------------- |
| Origin ZIP       | US only for MVP            |
| Destination ZIP  |                            |
| Weight (lbs)     |                            |
| L × W × H (in) |                            |
| Service level    | Ground / 2-Day / Overnight |

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

### Feature Gates

| Feature | Layer | Notes |
|---------|-------|-------|
| Domestic tab — full | Free | High SEO volume |
| International tab — full | Free | High SEO volume |
| Packaging Optimizer — 1 box | Free | Keep as teaser |
| Bulk Shipment tab | Email gate (Layer 1) | Drives signup |
| Packaging Optimizer — full catalog | Paid (CIPHER+) | Gate after 1 box |
| Historical rate trends "Best carrier: ███" | Preview (blurred) | "Best carrier over 90 days: ███" |

---

## Tool 4: Price Position Analyzer

**Route:** `/tools/price-position-analyzer`
**Primary keyword:** competitor price analysis tool (1.2K/mo, LOW competition)
**SPECTER funnel:** User inputs their price + up to 5 competitor prices → sees their position → CTA for automatic tracking

### Inputs

| Field                           |  |
| ------------------------------- | - |
| Your product price              |  |
| Your COGS                       |  |
| Competitor prices (1–5)        |  |
| Your current monthly units sold |  |

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

### Feature Gates

**Highest conversion priority** — this tool produces the RAISE/LOWER/HOLD signal that mirrors the core SPECTER product.

| Feature | Layer | Notes |
|---------|-------|-------|
| Manual calculation (up to 3 competitors) | Free | Was 5, reduce to 3 |
| RAISE / LOWER / HOLD signal on manual data | Free | Core value demo |
| Market range stats (low / high / median) | Free | Keep |
| "SPECTER found N more competitors" | Preview (blurred) | Domain names visible, prices blurred |
| Real signal vs manual-only signal difference | Preview (blurred) | Shows gap urgency |
| Revenue lift calculation | Preview (blurred) | Dollar amount blurred |
| Live competitor prices | Paid (RECON+) | Core platform feature |
| Automatic SKU monitoring | Paid (RECON+) | Core platform feature |
| 30-day price trend sparkline | Paid (CIPHER+) | Blurred preview shown |

**Conversion hook:** After RAISE signal — "3 competitors changed prices since yesterday. RECON would have alerted you at 09:14 AM. You found out now, manually."

---

## Tool 5: ROAS Profitability Calculator

**Route:** `/tools/roas-calculator`
**Primary keyword:** roas calculator ecommerce (15K/mo, LOW competition)
**Differentiator:** Shows TRUE profitable ROAS after all costs, not vanity ROAS

### Inputs

| Field               |              |
| ------------------- | ------------ |
| Ad spend            |              |
| Revenue from ads    |              |
| COGS (%)            |              |
| Shopify fee (%)     | 2.9% default |
| Return rate (%)     |              |
| COGS of returns (%) |              |

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

### Feature Gates

| Feature | Layer | Notes |
|---------|-------|-------|
| Basic ROAS tab — full | Free | Core value |
| Google + Facebook benchmarks | Free | Show 2 of 6 platforms |
| Funnel Analysis tab | Email gate (Layer 1) | High-intent users |
| Amazon, TikTok, Pinterest, Snapchat benchmarks | Preview (blurred) | Blur 4 platforms |
| "Your ROAS vs merchants with similar spend" | Preview (blurred) | Drives upgrade |

**Conversion hook:** "Your ROAS is declining because competitor price cuts erode ad efficiency. RECON alerts you the moment a competitor drops price."

---

## Tool 6: Inventory Reorder & Safety Stock Calculator

**Route:** `/tools/inventory-reorder-calculator`
**Primary keyword:** inventory reorder point calculator (12K/mo, LOW competition)
**Formula:** Wilson EOQ + safety stock

### Inputs

| Field                          |                 |
| ------------------------------ | --------------- |
| Average daily sales (units)    |                 |
| Lead time (days)               |                 |
| Lead time variability (days)   |                 |
| Holding cost per unit per year |                 |
| Order cost per order           |                 |
| Unit cost                      |                 |
| Service level                  | 90% / 95% / 99% |

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

### Feature Gates

| Feature | Layer | Notes |
|---------|-------|-------|
| EOQ, safety stock, reorder point | Free | Full calculation always free |
| Days-of-stock display | Free | Keep |
| Multi-SKU batch reorder analysis | Email gate (Layer 1) | Drives signup |
| Supplier lead time tracking | Paid (RECON+) | Pairs with OOS alerts |

**SPECTER CTA:** "SPECTER alerts you when a competitor goes OOS — so you can raise your price before the demand spike hits your reorder point."

---

## PLG Output Redesign — "1-3-More" Conformance (2026-05-30)

> Design: `docs/superpowers/specs/2026-05-30-free-tools-plg-redesign-design.md`. Every tool page must conform to the **enforced standard skeleton** (owned by `tool-layout.tsx`).

### Audit scorecard (each tool must pass before ship)
- Visible inputs ≤ 4 (rest behind "Advanced [▼]")
- Exactly **1 hero** output (the answer they came for) + **≤3 supporting** metrics + **≤1 chart** visible before any expand
- All remaining metrics/charts/tables live in a collapsed "See full breakdown [▼]" accordion (still in the DOM for SEO)
- One plain-English "What this means" + one "Do this next" action on the hero
- Layer-1 email unlock fires on earned value, not on load; pre-filled inputs tagged "Example"
- Layer-2 locked section present, named to the specific unlock + tier
- Plain-English terminology with tooltips holding the precise term

### Baseline density (pre-redesign) and target
| Tool | Was (metrics/cards) | Target visible | Priority |
|---|---|---|---|
| shipping-calculator | 12 / 15 (no accordion) | 1 hero + 3 + 1 chart | 1 |
| shopify-profit | 13 / 9 | 1 hero + 3 | 2 |
| roas-calculator | 8 / 8 (no accordion) | 1 hero + 3 | 3 |
| price-position | 8 / 6 | 1 hero + 3 | 4 |
| amazon-fba | 4 / 8 | 1 hero + 3 | 5 |
| inventory-reorder | 4 / 10 | 1 hero + 3 | 6 |

### Per-tool hero / supporting / layers
See the mapping table in `MONETIZATION.md` → "Per-tool 1-3-More mapping". Each tool's existing Feature Gates table above is superseded by that mapping where they differ (notably: CSV → Email Layer-1; scenario compare → Email Layer-1; PDF/print → Free).
