# SPECTER — Monetization Strategy & Product Gate Architecture

> **For Claude:** This is the canonical reference for all free/paid feature decisions,
> tool redesign specs, conversion architecture, and pricing copy. Read this before
> touching any tool page, pricing section, or CTA component.

---

## Core Premise

```
Free tools answer:  "What is my situation right now?"
Paid platform answers: "What should I DO — and monitor it automatically, forever."
```

Every tool has three layers (canonical naming = **Public / Intermediate / Paid**, see
[master plan](superpowers/plans/2026-05-31-free-tools-plg-master.md)):
- **Layer 0 — Public (no gate):** Core calculation + 1 hero answer + ≤3 supporting + AI Summary — always complete, always useful, SEO-safe. Position Analyzer stays here as the SaaS bridge.
- **Layer 1 — Intermediate (logged-in `free`):** Save/compare history, advanced tabs/charts, the SPECTER Workspace + Opportunity Feed.
- **Layer 2 — Paid gate:** Live competitor data, automatic monitoring, AI signals, auto-reprice.

> **Gate ordering is local-first (supersedes "earned-value → email gate → save").**
> The first goal is Visitor → User, not Visitor → Lead. Saving and comparing are
> **free and local** (localStorage) with **no email wall on the first earned-value
> moment**. An account (email) is positioned later as the way to **sync + keep
> history + unlock the Workspace** — not the price of a first save. On account
> creation, local scenarios migrate into `tool_calculations`.

---

## Feature Gate Config (Source of Truth)

### Price Position Analyzer — `/tools/price-position-analyzer` (Highest conversion priority)

| Feature | Layer | Notes |
|---|---|---|
| Manual calculation (up to 3 competitors) | Free | Was 8, reduce to 3 |
| RAISE/LOWER/HOLD signal on manual data | Free | Core value demo |
| Market range stats (low/high/median) | Free | Keep |
| "SPECTER found N more competitors" | Preview (blurred) | Domain names visible, prices blurred |
| Real signal vs manual-only signal difference | Preview (blurred) | Shows gap urgency |
| Revenue lift calculation | Preview (blurred) | Dollar amount blurred |
| Live competitor prices | Paid (RECON+) | Core platform feature |
| Automatic SKU monitoring | Paid (RECON+) | Core platform feature |
| 30-day price trend sparkline | Paid (CIPHER+) | Blurred preview shown |

**Conversion hook:** After RAISE signal → "3 competitors changed prices since yesterday. RECON would have alerted you at 09:14 AM. You found out now, manually."

---

### Amazon FBA Calculator — `/tools/amazon-fba-calculator` (Highest SEO traffic)

| Feature | Layer | Notes |
|---|---|---|
| Core profit/margin/ROI/break-even | Free | Never gate this |
| Full fee breakdown | Free | Trust builder |
| Advanced inputs (VAT, dimensions, storage) | Free but collapsed | Behind "Advanced options [▼]" accordion |
| Category margin benchmark "Median: ██.█%" | Preview (blurred) | Show category, blur the number |
| Optimal price range | Preview (blurred) | Show label, blur value |
| Package Optimizer (1 suggestion teaser) | Preview (blurred) | Show savings label, blur dimension/amount |
| Package Optimizer full catalog | Paid (CIPHER+) | Gate after teaser |
| Tier fee comparison chart | Free but collapsed | Move to Details accordion |
| Cost distribution chart | Free but collapsed | Move to Details accordion |
| Batch catalog analysis | Paid (CIPHER+) | Never shown free |
| CSV export | Paid (CIPHER+) | Gate |

**Default visible inputs:** Selling Price, COGS, Category, Weight. Everything else in accordion.

---

### Shopify Profit Calculator — `/tools/shopify-profit-calculator`

| Feature | Layer | Notes |
|---|---|---|
| Core profit/margin/expenses (Tab 1) | Free | Always free |
| Plan comparison (which Shopify plan is best) | Free | Good SEO content |
| Basic LTV (Tab 2) | Email gate (Layer 1) | Drives signup |
| Advanced LTV / cohort analysis | Paid (CIPHER+) | Gate |
| Subscription / MRR tab (Tab 3) | Paid (CIPHER+) | Show preview state with sample data |
| 12-month MRR projection | Paid (CIPHER+) | Gate (show 3-month free) |
| Health badges (Healthy/Tight/Danger) | Free | Keep — good UX |

**Tab display:** [Core Profit — Free] [LTV — Sign in] [Subscription — CIPHER+]

---

### Shipping Calculator — `/tools/shipping-calculator`

| Feature | Layer | Notes |
|---|---|---|
| Domestic tab — full | Free | High SEO volume |
| International tab — full | Free | High SEO volume |
| Bulk Shipment tab | Email gate (Layer 1) | Drives signup |
| Packaging Optimizer — 1 box | Free | Keep as teaser |
| Packaging Optimizer — full catalog | Paid (CIPHER+) | Gate after 1 box |
| Historical rate trends | Preview (blurred) | "Best carrier over 90 days: ███" |

---

### ROAS Calculator — `/tools/roas-calculator`

| Feature | Layer | Notes |
|---|---|---|
| Basic ROAS tab — full | Free | Core value |
| Funnel Analysis tab | Email gate (Layer 1) | High-intent users |
| Google + Facebook benchmarks | Free | Show 2 of 6 platforms |
| Amazon, TikTok, Pinterest, Snapchat benchmarks | Preview (blurred) | Blur 4 platforms |
| "Your ROAS vs merchants with similar spend" | Preview (blurred) | Drives upgrade |

**Conversion hook:** "Your ROAS is declining because competitor price cuts erode ad efficiency. RECON alerts you the moment a competitor drops price."

---

## UX Rules for All Tool Pages

### Progressive Disclosure Rule
- **4 inputs max** visible by default. Everything else behind `Advanced options [▼]` accordion.
- Never show more than 1 chart by default. Additional charts go in Details accordion.
- Multiple tabs: show 1 primary tab clearly active, gate others visually.

### The "1-3-More" Output Pattern
```
1 BIG NUMBER        ← The answer they came for (large, prominent, primary color)
3 SUPPORTING        ← Context that validates the big number (medium weight)
DETAIL ACCORDION    ← Full breakdown (collapsed by default, expandable)
LOCKED SECTION      ← Blurred market intelligence with named CTA
```

### Blurred Section Template
Every tool result page gets a `LockedSection` component below the breakdown:

```
┌──────────────────────────────────────────────┐
│  🔒  MARKET INTELLIGENCE                     │
│                                              │
│  [Specific blurred preview relevant          │
│   to this tool's core output]                │
│                                              │
│  [CTA: specific to what they'll unlock]      │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  ⚡  AUTOMATE THIS                           │
│                                              │
│  SPECTER monitors this for you 24/7.         │
│  First signal in under 12 minutes.           │
│                                              │
│  [Start 14-day free trial →]                 │
└──────────────────────────────────────────────┘
```

### Conversion CTA Rules
- **Never** say "Upgrade to unlock" — always say what they unlock specifically
- **Always** place CTAs AFTER the result is shown (never before/blocking)
- **Always** include dismissal option (soft gate, no dark patterns)
- **Match** the CTA to the signal: RAISE signal → urgency copy; margin gap → opportunity copy

---

## Pricing Page Architecture

### Value Ladder Taglines (tier `sub` field in pricing-section.tsx)
| Tier | Sub (tagline) | Job to Be Done |
|---|---|---|
| RECON | Know when they move | Monitoring + alerts |
| CIPHER | Know + act automatically | Monitoring + auto-reprice |
| PHANTOM | Know, act, prove ROI | Full intelligence + attribution |
| PREDATOR | Move first, always | Maximum speed + scale |
| ECLIPSE | Your dedicated edge | Dedicated infrastructure |

### CTA Copy Per Tier
| Tier | Primary CTA | Href |
|---|---|---|
| RECON | Start monitoring free — 14 days | /sign-up |
| CIPHER | Start repricing automatically | /sign-up |
| PHANTOM | Book a 15-min demo | mailto:sales@specterapp.io |
| PREDATOR | Talk to sales | mailto:sales@specterapp.io |
| ECLIPSE | Contact enterprise team | mailto:sales@specterapp.io |

### Feature Comparison Table — JTBD Format
Replace technical feature names with questions merchants actually ask:

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

---

## Conversion Architecture

### The 4 Trigger Points

1. **Gap Moment** (after result): Blurred premium section visible below result — passive but persistent
2. **Effort Moment** (3+ manual competitors added): "You're monitoring these manually. SPECTER does this automatically."
3. **Return Moment** (2nd+ tool visit): "You've used this tool before. Save time — let SPECTER track this SKU automatically."
4. **RAISE Moment** (RAISE signal fires): "Your signal says RAISE. Competitors just changed something. Act before the window closes."

### Email Capture Gate Design
- Appears **after** result (3 seconds post-calculation)
- Two paths: Email only (free save) or Trial (14-day free)
- Dismissal text: "No thanks, I'll recalculate manually"
- Gate is **soft** — dismissable, result already shown, no dark patterns

### 7-Day Email Nurture Sequence (after capture)
- **Day 0:** Calculation saved. How 3 similar merchants use SPECTER.
- **Day 1:** Real example — Nike OOS event, who profited.
- **Day 3:** Your saved calculation vs what live data shows — the gap.
- **Day 5:** Your 14-day free trial is waiting. No CC.
- **Day 7:** Last chance. Trial starts at RECON — most merchants see first signal in 12 min.
- **Day 14 (no trial):** The 1 pricing mistake 80% of Shopify merchants make.

---

## The 12-Minute Promise
**Copy anchor used everywhere:** "Average time to first signal: 12 minutes after install"

Use in:
- Hero subheadline (add "First signal in under 12 minutes.")
- Pricing page (below RECON CTA)
- Final CTA badge (already implemented as badge)
- Trial onboarding progress bar: "Signal expected in ~8 minutes..."
- Email Day 7: subject line includes "12 minutes"

---

## SEO Constraints (Do Not Violate)

- **Never remove content from tool pages** — only hide it visually (accordion/collapse)
- All FAQ sections, formulas, and explanatory text remain in the DOM (crawlable)
- Progressive disclosure is visual only — screen readers and crawlers see everything
- Add HowTo schema + FAQ schema to all tool pages (Phase 5 implementation task)
- Add "Quick Answer" paragraph above each tool for AEO (answers the primary search query directly)

---

## Implementation Phases

| Phase | Weeks | Scope |
|---|---|---|
| 1 — Components | 1–2 | LockedSection, PreviewBadge, EmailCaptureGate, UpgradePrompt, AdvancedAccordion, lib/feature-gates.ts |
| 2 — Tool Redesign | 3–5 | Simplify all 5 tool inputs + outputs, add locked sections, add email capture |
| 3 — Pricing + Conversion | 6–8 | Pricing page restructure, email nurture setup, PostHog events |
| 4 — Premium Signaling | 9–10 | Demo mode for Price Position, live competitor count lookup |
| 5 — Virality + SEO | 11–12 | Share result feature, embed widget, HowTo/FAQ schema |

---

## Success Metrics (90-day targets)

| Metric | Current | Target |
|---|---|---|
| Tool email capture rate | 0% | 8–15% |
| Trial starts from tool pages | 0% | 2–4% of tool users |
| Pricing page CTA CTR | Baseline | +40% |
| Free → trial (from email list) | N/A | 5–10% |
| Trial → paid | Unknown | 20–35% |
| Tool page organic traffic | Baseline | Maintain or +15% |

---

## Constraints (Hard Rules)

- ✅ Free tools must remain genuinely useful — never cripple the core calculation
- ✅ Gate only the "action/intelligence" layer, never the "calculation" layer
- ✅ All gates are soft (result shown first, gate appears after)
- ✅ No fake blurred data — only blur things that actually exist in paid tier
- ✅ Dismissal always available (no forced modals)
- ✅ SEO content stays in DOM regardless of visual gating

---

## Conformance, Enforcement & Freemium Workspace (2026-05-30)

> Full design: `docs/superpowers/specs/2026-05-30-free-tools-plg-redesign-design.md`. This section is the canonical summary; the strategy above is unchanged — this closes the **implementation gap** and adds the **free logged-in tier**.

### Why this section exists
Audit finding: the tool pages do **not** follow the strategy above. Density (visible metrics / cards): shipping 12/15, shopify-profit 13/9, roas 8/8 (no accordion), price-position 8/6, fba 4/8, inventory 4/10. All six violate the "1-3-More" rule; roas + shipping collapse nothing. The components (`email-capture-gate`, `locked-section`, `share-result`, etc.) already exist — they're just not sequenced per spec.

### Enforced standard skeleton (owned by `tool-layout.tsx`)
Fixed render order, max **1 hero + 3 supporting + 1 chart** visible before any expand:
1. Quick Answer → 2. Inputs (≤4 visible, rest in Advanced) → 3. **THE ANSWER** (hero number + "what this means" + "do this next") → 4. ≤3 supporting metrics → 5. "See full breakdown" accordion (everything else, collapsed) → 6. Layer-1 email unlock → 7. Layer-2 locked section → 8. Share/Embed → 9. FAQ + disclaimer (in DOM).

### Per-tool 1-3-More mapping
| Tool | HERO | 3 SUPPORTING | Layer-1 (email) | Layer-2 (paid→tier) |
|---|---|---|---|---|
| Price Position | Signal + suggested price | Market avg, Rank, Gap vs avg | Save/compare, CSV | Live competitors + real signal (RECON); 30-day trend (CIPHER) |
| Amazon FBA | Net profit/unit | Margin %, ROI %, Break-even | Save, CSV, category benchmark | Package optimizer catalog, batch (CIPHER) |
| Shopify Profit | Monthly net profit | Margin %, Profit/order, Health | Save, CSV, LTV tab | Cohort LTV, MRR tab, 12-mo projection (CIPHER) |
| Shipping | Cheapest carrier + cost | Cost/package, Margin impact, vs next | Save, CSV, bulk tab | Packaging catalog, 90-day trends (CIPHER) |
| ROAS | ROAS vs break-even (verdict) | Profit on spend, Break-even ROAS, CPA vs target | Save, CSV, funnel tab | 4 blurred benchmarks, peer comparison (RECON) |
| Inventory | Reorder now? + reorder point | Reorder qty, Days left, Safety stock | Save, CSV, scenario compare | Multi-SKU bulk, demand history (CIPHER) |

### Re-timed, value-first lead capture
Layer-1 gate fires on **earned value** (user edits an input, expands the breakdown, or clicks save/compare/CSV) — **not** on initial pre-filled load. Pre-filled values carry an "Example" tag. Email unlocks save + shareable link, scenario compare, CSV, and one enhanced insight. Always dismissable; suppressed 7 days after dismissal. PDF/print stays free.

### Three segmentation shifts
1. PDF/print **Free** · CSV **Email** · bulk/scheduled export **Paid (CIPHER)**.
2. Save result + scenario compare → **Email (Layer 1)** primary unlock.
3. Pre-filled inputs kept but **labeled "Example."**

### Free Dashboard Workspace (freemium tier)
- New **FREE** plan beneath RECON (plan key `free`; named "Free", *not* SCOUT — that's the legacy name for the entry paid tier now called RECON). Sign-up grants FREE (no auto-trial); trial is an explicit, primary CTA; **post-trial expiry → FREE** (replaces read-only lockout = retention floor).
- Dashboard gains a **Tools tab** (the 6 calculators with account superpowers: saved history, scenarios, in-app CSV, enhanced insights) + a repurposed free **Overview**.
- Signals / Competitors / Alerts / Repricing / Attribution render as **aspirational preview tabs** — real UI + realistic demo data, blurred, with "see YOUR data" CTAs (reuse `demo-mode-panel` + `locked-section`). Server-side `plan_gate` already returns 403 `upgrade_required` for `free`.
- Public `/tools/*` stay public and crawlable; the dashboard Tools tab is `noindex` — **zero SEO impact**.
- Primary risk: **trial cannibalization** — mitigated by keeping live data paid, trial as hero CTA, usage-based PQL upsell, and tracking free→trial as a first-class KPI.
