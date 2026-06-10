# Products / SKU Workspace — Design Spec

> **Status:** Approved direction, pending spec review.
> **Date:** 2026-05-31
> **Scope:** Spec 1 of 3 in the dashboard expansion. Spec 2 = Settings + WooCommerce + account/usage. Spec 3 = Billing (Razorpay). This spec covers **only** the Products/SKU workspace and the Competitors-lens refactor.
> **Decision style:** lean v1 — one aggregate endpoint, two client-side lenses, no schema changes.

---

## 0. Problem & Goal

Merchants have no product-centric place to manage what they track. The existing `/competitors` page is a flat, tracking-centric list; products only exist via `GET /skus`. We need a **Products workspace** (nav tab directly below Competitors) where a merchant:

- adds a product (manually, or via the existing Shopify import),
- links it to multiple competitor URLs (its "group"),
- sees that product's live signal + each competitor's latest price/stock,
- sets repricing guardrails (floor/ceiling),

while plan limits are enforced and the **SKU definition is consistent everywhere**.

**SKU definition (canonical, unchanged):** *1 SKU = one of your products tracked against one competitor URL.* Usage = `COUNT(competitor_trackings WHERE merchant_id = ? AND enabled = true)`. Plan limits count **SKU pairings**, not products (RECON 100, CIPHER 500, PHANTOM 1 000, PREDATOR 2 000, ECLIPSE unlimited).

---

## 1. Architecture (v1, locked)

- **One aggregated read endpoint `GET /products`** returns the product-centric tree (product → enabled trackings → each tracking's latest price snapshot → product's latest signal) plus usage counters. Mirrors the existing `GET /repricing` composition pattern.
- **Two lenses, one query:**
  - **Products tab** = by-your-product lens (primary workspace; all linking/management).
  - **Competitors tab** = by-competitor-domain lens (monitoring only) — a **client-side pivot** of the same `GET /products` payload. No dedicated by-domain endpoint.
  - Both share one TanStack Query cache (60 s refetch); a mutation on either tab invalidates both.
- **No schema changes, no migration.** `collection_id` is deferred (future Collections spec). The "Shopify vs manual" badge is **derived** from `shopify_variant_id` (non-null ⇒ Shopify), computed in the response — no `source` column.
- **Billing model unchanged:** limit = SKU pairings; server-side enforcement already exists in `POST /competitors`.

---

## 2. Data Model

No new tables, no new columns. Existing models are sufficient:

- **`skus`** — own products. `shopify_variant_id` non-null ⇒ imported; null ⇒ manually added. Manual add already supported by `POST /skus`. Repricing guardrails `floor_price` / `ceiling_price` / `active` already present.
- **`competitor_trackings`** — billing unit (1 row = 1 SKU). The per-product group = enabled trackings sharing an `own_product_id`. Unchanged.
- **`competitor_urls`** — shared URL registry (`domain`, `url_path`, `robots_blocked`, `last_scraped_at`). Unchanged.
- **`price_snapshots`** — latest per `competitor_url_id` supplies live price / `in_stock` / `scraped_at`. Unchanged.
- **`signals`** — latest per product supplies the signal type / `price_suggestion` / `confidence` / `created_at`. Unchanged.

**Deferred (explicitly not now):** `skus.collection_id` + a Collections table — add when customers request product grouping. A `source` column — derived instead.

---

## 3. Backend API

### 3.1 New: `GET /products`
Read-only aggregation, available on all plans. Response:

```
ProductOut {
  id, title, handle,
  current_price,                 # Decimal | null
  source,                        # 'shopify' | 'manual'  (derived from shopify_variant_id)
  active, floor_price, ceiling_price,
  competitor_count,              # enabled trackings for this product
  latest_signal: {               # newest signals row for this product, or null
    type,                        # 'RAISE' | 'LOWER' | 'HOLD'
    price_suggestion,            # Decimal | null
    confidence,                  # 0..1
    created_at                   # ISO ts
  } | null,
  competitors: [ {
    tracking_id, competitor_url_id, url, domain,
    enabled, silenced_oos, robots_blocked,
    latest_price,                # Decimal | null (null = not scraped yet)
    in_stock,                    # bool | null
    last_checked_at              # ISO ts | null
  } ]
}
ProductsOut {
  items: ProductOut[],
  sku_used,                      # COUNT(enabled trackings)
  sku_limit,                     # PLAN_MAX_SKUS[plan]  (null = unlimited)
  max_competitors_per_sku        # merchants.max_competitors_per_sku (null = unlimited)
}
```

Join chain (per ARCHITECTURE.md): `skus → competitor_trackings(enabled) → competitor_urls → latest price_snapshots`, plus latest `signals` per product. Implemented to avoid N+1 (batch latest-snapshot and latest-signal lookups).

### 3.2 Reused, unchanged
- `POST /skus` — manual product add (title + current_price).
- `PATCH /skus/{id}` — floor / ceiling / current_price / active.
- `POST /competitors` — link a competitor URL to a product. Already enforces (a) total SKU limit → `402 sku_limit_reached`, (b) per-product competitor limit → `402 competitor_limit_reached`, (c) duplicate → `409 already_tracking`, (d) reachability → `422 url_unreachable`, and queues the probe job.
- `DELETE /competitors/{id}` — unlink (soft delete).
- `PATCH /competitors/{id}/silence-oos` — toggle OOS silencing.

### 3.3 Not built
- No `GET /competitors/by-domain` (client-side pivot instead).
- No new mutation endpoints — Products reuses the existing SKU + competitor mutations.

---

## 4. Products Tab — `app/(dashboard)/products/page.tsx`

Nav entry inserted **directly below Competitors** in `app/(dashboard)/layout.tsx`.

### 4.1 Header + meters
```
Products                                   SKUs 12 / 100  ·  up to 5 competitors / product
[ + Add product ]   [ Import from Shopify → ]   [▓▓▓▓▓▓░░░░]
```
- SKU meter (`sku-meter.tsx`) reads `sku_used / sku_limit`; amber ≥ 80 %, red at limit.
- "Import from Shopify" → triggers existing import if connected, else links to Settings.

### 4.2 Controls (all client-side)
```
[ 🔍 Search products… ]                         Sort: [ Signals first ▾ ]
```
- **Search:** instant client-side filter on product title.
- **Sort:** `Signals first` (default → RAISE, then LOWER, then HOLD; within each, confidence desc), `Recently updated` (by `latest_signal.created_at`), `Name A–Z`.

### 4.3 Product rows (collapsible; collapsed by default)
Collapsed:
```
▸ Wireless Earbuds Pro        $89.99
  RAISE → $93.40 (82%)  · updated 4m ago        3/5 competitors
```
- Confidence `(82%)` from `latest_signal.confidence` — primary trust indicator.
- "updated Nm ago" from `latest_signal.created_at` (relative time via `lib/time-ago.ts`).
- "(Shopify)" / "(manual)" badge from `source`.

Expanded (the "signal + competitor prices" depth):
```
▾ Wireless Earbuds Pro   (Shopify)   $89.99   • RAISE → $93.40 (82%) · 4m ago
    amazon.com   $79.99   in-stock   2m ago        ⋮
    rival.com    $84.99   OOS        5m ago        ⋮
    bestbuy.com  $82.00   in-stock   3m ago        ⋮
    [ + link a competitor ]        floor $— · ceiling $—  [edit]
```
- `[ + link a competitor ]` → inline URL field → `POST /competitors` with this `own_product_id`. Inline errors reuse `ApiError` body handling.
- Per-competitor **kebab (⋮)** → "Silence OOS alerts" / "Remove competitor" (cleaner at 5+ competitors). Operates on `tracking_id`.
- `[edit]` → floor / ceiling / active via `PATCH /skus/{id}`. Auto-reprice automation is **not** here — a link points to `/repricing` (CIPHER+).

### 4.4 States
- **At SKU limit** (`sku_used ≥ sku_limit`): "+ Add product" and inline link buttons become disabled "Upgrade to track more SKUs →" (`/pricing`); meter red.
- **At per-product limit**: that product's link button shows "Max N competitors on your plan — upgrade for more."
- **Empty:** `EmptyState` with dual CTA (add manually / connect store).
- **No snapshot yet:** competitor row shows "checking…", not an error.
- **No signal yet:** "awaiting first signal."
- **Loading:** skeleton rows. **Query error:** banner + retry.

### 4.5 Manual add
`[ + Add product ]` → small form (title + current price) → `POST /skus` → refetch.

### 4.6 Mobile (below `md`): cards, not rows
```
┌──────────────────────────────┐
│ Wireless Earbuds Pro   $89.99 │
│ RAISE → $93.40 (82%) · 4m ago │
│ ──────────────────────────── │
│ Amazon     $79.99   in-stock  │
│ BestBuy    $82.00   in-stock  │
│ Rival      —        OOS       │
│ [ + link competitor ]      ⋮  │
└──────────────────────────────┘
```

### 4.7 Components
`product-row.tsx`, `add-product-form.tsx`, `link-competitor-inline.tsx`, `sku-meter.tsx`, `product-search-sort.tsx`, `competitor-row-menu.tsx` (kebab). Reuse `EmptyState`, signal-badge styling, `lib/time-ago.ts`.

---

## 5. Competitors Tab — by-domain lens (refactor)

`app/(dashboard)/competitors/page.tsx` is refactored from a flat tracking list into a **client-side pivot** of `GET /products` (no new endpoint). Monitoring only — no add/link form (a hint links to Products).

### 5.1 Layout (desktop)
```
Competitors                                   tracking 4 rivals across 12 SKUs
[ 🔍 Search domains… ]                         Sort: [ Most products ▾ ]

▾ amazon.com   8 products · avg price gap −7% · 6 in-stock / 2 OOS · ● Healthy · 2m ago
    Wireless Earbuds Pro   $79.99   in-stock   2m ago      ⋮
    USB-C Cable 2m         $11.20   in-stock   3m ago      ⋮
▸ rival.com    3 products · avg price gap +2% · 3 in-stock · ● Healthy · 3m ago
▸ bestbuy.com  1 product  · ⚠ Blocked — robots.txt disallows tracking
```

### 5.2 Domain summary metrics (client-side, zero extra calls)
Per domain: product count, **avg price gap** = mean of `(competitor_price − your_price)/your_price` over that domain's pairings (negative = rivals undercut you), in-stock / OOS counts, health badge, last-checked.

### 5.3 Domain health (derived; no new data)
| Badge | Condition |
|---|---|
| ⚠ **Blocked** | any `robots_blocked` true on the domain |
| ◐ **Degraded** | latest snapshots stale (last-checked > 2× plan interval) or missing / `needs_review` prices |
| ● **Healthy** | recent snapshots with valid prices |

**Deferred:** an exact rolling "% success rate" (needs a scrape-attempt counter — not in the data model). Healthy/Degraded/Blocked + last-checked covers trust at ~zero cost.

### 5.4 Controls + actions
- Search by domain substring; sort `Most products` (default) / `Most OOS` / `Domain A–Z` — all client-side.
- Per-pairing kebab (⋮) → Silence / Remove (same `tracking_id` mutations; shared cache keeps both tabs consistent).

### 5.5 Components
`competitor-domain-group.tsx`, reuse `competitor-row-menu.tsx`, `EmptyState`, `lib/time-ago.ts`. Pivot via pure helper `lib/dashboard/group-by-domain.ts`.

---

## 6. Plan Limits & SKU-Definition Consistency

- **Enforcement** is server-side (`POST /competitors`, unchanged). Frontend is UI-only on top: meters, disabled-at-limit CTAs, inline `402/409/422` messages.
- **`sku-meter.tsx`** is the single meter component, used on **Products** and the dashboard **Overview** in this spec. (Settings reuses the same component in Spec 2 — not modified here.)
- **Consistency surfaces (Dashboard + pricing + docs):**
  - Dashboard (this spec): Products meter, Competitors subtitle, and Overview usage card all read "SKUs X/Y · 1 SKU = one product tracked against one competitor." (The Settings plan/usage card adopts the same copy in Spec 2.)
  - **Pricing page** (`components/marketing/pricing-section.tsx`): per-tier SKU tooltip/footnote — *"A SKU = one product tracked against one competitor. RECON = 100 SKUs (e.g. 33 products × 3 competitors)."* **(Depends on Timeline restore of this file — see §9.)**
  - **Docs:** reconcile `PRICING.md`, `ARCHITECTURE.md`, `FEATURES.md` to this exact wording.

---

## 7. Error Handling & Edge Cases

- Plan limits → inline upgrade prompts; `409 already_tracking` / `422 url_unreachable` → inline field errors.
- Freshly-linked competitor with no snapshot → "checking…". Product with no signal → "awaiting first signal."
- Blocked URLs surfaced (badge) on both lenses; never silently dropped.
- `GET /products` is read-only; no mutation side-effects in the aggregation.

---

## 8. Testing

- **Backend (pytest, TDD):** `GET /products` aggregation (join correctness, `source` derivation, `sku_used`/`sku_limit`/`max_competitors_per_sku`); manual `POST /skus`. Follows `routers/test_merchants.py` patterns (real HS256 JWT, `MagicMock(spec=Merchant)`, dependency overrides). New file `routers/test_products.py`.
- **Frontend (Vitest — pure logic only, per CLAUDE.md "test calculator math only"):** `group-by-domain.ts`, sort comparators (Signals-first ordering), avg-price-gap, relative-time. **No component tests** for pages/rows — verified via `npm run build` + manual run.

---

## 9. File / Build Map

**specter-api:**
- Create: `routers/products.py` (`GET /products`); register in `main.py`.
- Create: `routers/test_products.py`.
- No model changes, no migration.

**specter-web:**
- Create: `app/(dashboard)/products/page.tsx`; nav entry in `app/(dashboard)/layout.tsx` (below Competitors).
- Create components: `product-row.tsx`, `add-product-form.tsx`, `link-competitor-inline.tsx`, `sku-meter.tsx`, `product-search-sort.tsx`, `competitor-row-menu.tsx`, `competitor-domain-group.tsx`.
- Create helpers + tests: `lib/dashboard/group-by-domain.ts` (+ `.test.ts`), sort/avg-gap helpers (+ tests).
- Modify: `lib/api.ts` (`useProducts()` + `Product`/`ProductsOut` types); `app/(dashboard)/competitors/page.tsx` (by-domain pivot); `components/marketing/pricing-section.tsx` (SKU tooltip).
- Modify docs: `PRICING.md`, `ARCHITECTURE.md`, `FEATURES.md`.

**Verification gates:** `python -m pytest -q` green; `npm run lint && npm run build` exit 0; manual run of `/products` + `/competitors`.

**Restore dependencies (from the earlier `git reset`, not blockers for design):**
- `.eslintrc.json` — required before `npm run lint`/`build` pass.
- `components/marketing/pricing-section.tsx` — required before the pricing-copy edit.

---

## 10. Out of Scope (this spec)

- **Settings / WooCommerce / account / usage** → Spec 2.
- **Billing / Razorpay** → Spec 3.
- **Collections / product grouping** (`collection_id`, roll-up signals) → future spec when requested.
- **Competitor analytics, historical domain trends, domain scorecards, market-share, exact scrape success-rate %** → deferred (YAGNI for v1).
- **Auto-reprice automation UI** → stays on the existing `/repricing` page (CIPHER+).
- No changes to the SKU billing model, plan limits, or scrape pipeline.
