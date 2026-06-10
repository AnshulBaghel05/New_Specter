# Free-Tool PLG Redesign — Design Spec

> **Status:** Approved direction, pending spec review.
> **Date:** 2026-05-30
> **Scope:** Strategy + documentation refresh now; tool-page implementation deferred to a follow-up plan.
> **Core decision:** *Audit & enforce* the existing `docs/MONETIZATION.md`, not replace it. The strategy is sound; the tool pages don't follow it. This spec closes that gap and refines three segmentation decisions.

---

## 0. Problem Statement & Reframe

The free tools were reported as too data-dense, too advanced for first-time users, and weak at lead capture / conversion. Investigation shows the **strategy already exists and is strong** (`MONETIZATION.md`: three-layer model, "1-3-More" output pattern, soft email gates, conversion triggers, 7-day nurture, virality, SEO rules, 90-day targets), and the **PLG component library is already built** (`email-capture-gate`, `locked-section`, `upgrade-prompt`, `share-result`, `embed-code`, `export-bar`, `scenario-panel`, `demo-mode-panel`, `quick-answer`, `preview-badge`).

The real problem is a **conformance gap**: the tool pages render everything flat and violate the very rules the docs prescribe. This spec is therefore an *enforcement + simplification* effort, plus three refined segmentation decisions, plus a documentation refresh.

**Guiding constraints (unchanged, hard rules):** never cripple the core calculation; gate only the action/intelligence layer; all gates soft and dismissable; no fake blurred data; SEO content stays in the DOM; preserve a premium feel; no dark patterns.

---

## 1. Deep Analysis — Per-Tool Conformance Audit (Deliverable 1)

Density measured from the current pages (visible metrics / output cards / whether depth is collapsed). All six have the email gate, locked section, and share wired; all six violate "1-3-More."

| Tool | Metrics shown | Output cards | Depth collapsed? | Primary gap | Priority |
|---|---|---|---|---|---|
| `shipping-calculator` | 12 | 15 | ❌ none | Flat wall of data; no accordion; multiple tabs all expanded | **1 (worst)** |
| `shopify-profit-calculator` | 13 | 9 | partial | Too many headline numbers; tabs heavy | 2 |
| `roas-calculator` | 8 | 8 | ❌ none | Nothing collapsed; benchmark table dense | 3 |
| `price-position-analyzer` | 8 | 6 | partial | Results column shows ~12 data points at once (top conversion tool) | 4 |
| `amazon-fba-calculator` | 4 | 8 | ✓ | Closest to spec; still too many cards by default | 5 |
| `inventory-reorder-calculator` | 4 | 10 | ✓ | Metric count OK; card sprawl | 6 |

**Audit scorecard dimensions** (recorded per tool in `TOOLS.md` rewrite): visible-input count, hero clarity (is there one obvious answer?), supporting-metric count (target ≤3), depth-collapsed (yes/no), email-gate trigger point, Layer-2 mapping correctness, terminology grade (plain-English vs jargon), "do this next" present (yes/no).

**Cross-cutting findings:**
- Pre-filled inputs auto-render a result on load → instant value (good) but the email gate fires against an always-present result, decoupling it from earned value (weak).
- `roas-calculator` and `shipping-calculator` import no `AdvancedAccordion` → zero progressive disclosure.
- Exports (`ExportBar`) and scenario compare (`ScenarioPanel`) are free on every tool → unused lead-capture leverage.

---

## 2. New Free-Tool Architecture (Deliverable 2)

### 2.1 The enforced standard skeleton
A single canonical render order, owned by `tool-layout.tsx`, so individual tool pages supply *content slots* rather than free-form layout. This prevents drift back into density.

```
1. Quick Answer            (1 sentence, AEO)                         — exists
2. Inputs                  (≤4 visible; rest in "Advanced [▼]")      — enforce
3. THE ANSWER  ┌ 1 hero number / verdict (large, primary)
               ├ 1 plain-English "What this means"
               └ 1 "Do this next" action                            — NEW slot
4. Supporting              (≤3 metrics that validate the hero)       — enforce
5. "See full breakdown [▼]"(collapsed: all remaining metrics/charts/tables) — enforce
6. Layer-1 unlock          (value-first email: save/compare/CSV)     — re-time
7. Layer-2 locked section  (blurred market intelligence, → tier CTA) — exists
8. Share / Embed           (viral loop)                              — exists
9. FAQ + Disclaimer        (stays in DOM for SEO)                    — exists
```

**Rule:** at most **1 hero + 3 supporting + 1 chart** visible before the user expands anything. Everything currently rendered flat moves *down* into slot 5 — nothing is deleted (SEO-safe).

### 2.2 Per-tool "1-3-More" mapping
User-facing terms (stable regardless of internal field names; implementer confirms against `lib/tools/*`):

| Tool | HERO (the answer) | 3 SUPPORTING | Into "Full breakdown" | Layer-1 (email) | Layer-2 (paid → tier) |
|---|---|---|---|---|---|
| Price Position | Signal (RAISE/LOWER/HOLD) + suggested price | Market avg, Your rank, Gap vs avg | Market low/high/median, range visualizer, position grid, "how signals work" | Save + compare scenarios; CSV | Live competitors + real signal (RECON); 30-day trend (CIPHER) |
| Amazon FBA | Net profit per unit | Margin %, ROI %, Break-even price | Full fee breakdown, tier-fee chart, cost-distribution chart, advanced inputs | Save; CSV; category benchmark context | Package optimizer full catalog, batch analysis (CIPHER) |
| Shopify Profit | Monthly net profit | Margin %, Profit per order, Health badge | Expense breakdown, plan comparison, basic LTV detail | Save; CSV; LTV tab | Cohort LTV, MRR/subscription tab, 12-mo projection (CIPHER) |
| Shipping | Cheapest carrier + cost | Cost per package, Margin impact, vs next carrier | Per-carrier table, intl duties detail, packaging optimizer (1 box) | Save; CSV; bulk-shipment tab | Packaging full catalog, 90-day rate trends (CIPHER) |
| ROAS | Your ROAS vs break-even ROAS (verdict) | Profit on ad spend, Break-even ROAS, CPA vs target | Funnel detail, full benchmark table (2 of 6 platforms free) | Save; CSV; funnel-analysis tab | 4 blurred platform benchmarks, peer-spend comparison (RECON) |
| Inventory Reorder | Reorder now? + reorder point (units) | Reorder qty, Days of stock left, Safety stock | Demand/lead-time detail, carrying-cost breakdown, multi-SKU table | Save; CSV; scenario compare | Multi-SKU bulk reorder, demand history (CIPHER) |

### 2.3 What "genuinely useful free" means here
The HERO + 3 supporting + the full breakdown accordion **fully solve the user's question** without email or payment. Email unlocks *convenience and persistence* (save, compare, CSV, one enhanced insight); payment unlocks *live data + automation*. A user who never gives an email still gets a complete, accurate, rank-worthy answer.

---

## 3. Lead-Capture Strategy — Value-First Soft Gate (Deliverable 3)

**Principle:** capture email only *after* the user has the free answer **and** has signalled investment.

- **Trigger:** the Layer-1 unlock prompt appears when the user (a) edits any pre-filled input, **or** (b) expands "Full breakdown," **or** (c) clicks Save/Compare/CSV. Not on initial pre-filled load.
- **Example labeling:** pre-filled values render with a small "Example" tag; clearing/editing replaces it. The earned-value moment is the user's own numbers.
- **What email unlocks (Layer 1 — genuine extras, never the core):**
  - **Save this result** + a shareable report link (also a viral loop).
  - **Compare scenarios** side-by-side (`ScenarioPanel`).
  - **CSV download** (`ExportBar` CSV path).
  - **One beginner "enhanced insight"** per tool (e.g., FBA category-margin context, ROAS peer band, Price-Position "what a pro would check next" checklist) — emailed and shown inline.
- **Friction minimisation:** single email field, no password, dismissable ("No thanks — recalculate manually"), result already on screen. One ask per session (suppressed for 7 days after dismissal via the existing gate's localStorage logic).
- **SEO/AEO safety:** the gate never blocks crawlable content; PDF/print stays free as a shareable artifact.

---

## 4. Free-to-Paid Conversion Strategy (Deliverable 4)

Map the four existing triggers (from `MONETIZATION.md`) onto the new skeleton and onto `PRICING.md` upgrade triggers:

| Trigger | Where it fires in the skeleton | Tier CTA |
|---|---|---|
| **Gap Moment** | Slot 7 locked section (always visible below result) | RECON ("see live competitors") |
| **Effort Moment** | When user adds the 3rd manual competitor / 2nd scenario | RECON/CIPHER ("we do this automatically") |
| **Return Moment** | 2nd+ visit (cookie) → banner above result | RECON ("save time — track this SKU") |
| **RAISE Moment** | Price Position RAISE signal → urgency strip | RECON ("act before the window closes") |

**Tool → tier routing:** live data / monitoring → **RECON**; automation, batch, full optimizer catalogs, exports-at-scale → **CIPHER**; attribution, history, cohort → **PHANTOM+**. Each locked section names the *specific* unlock (never "Upgrade to unlock").

---

## 5. Feature Segmentation Plan (Deliverable 5)

Canonical free / email / paid matrix (refines `MONETIZATION.md`; reconciled with code). **Three approved shifts** are baked in:

1. **Exports:** PDF/print = **Free** (shareable, SEO/AEO). CSV = **Email (Layer 1)**. Scheduled / bulk / multi-SKU export = **Paid (CIPHER+)**.
2. **Save result + Scenario compare:** **Email (Layer 1)** — the primary value-first unlock.
3. **Pre-filled inputs:** kept, but **labeled "Example."**

| Capability | Layer | Notes |
|---|---|---|
| Core calculation + hero + 3 supporting + full breakdown | **Free** | Never gated; complete answer |
| 2 of 6 benchmark platforms (ROAS); 1-box packaging (Shipping); basic LTV (Shopify) | **Free** | Teasers per `MONETIZATION.md` |
| PDF / print report | **Free** | Shareable artifact |
| Quick Answer, FAQ, formulas, schema | **Free** | SEO/AEO, in DOM |
| Save result + shareable link | **Email** | Layer-1 lead magnet |
| Scenario compare | **Email** | Layer-1 lead magnet |
| CSV download | **Email** | Layer-1 lead magnet |
| One enhanced insight per tool | **Email** | Beginner-friendly extra |
| Live competitor prices + real signal | **Paid (RECON)** | Core platform |
| Automatic SKU monitoring + alerts | **Paid (RECON)** | Core platform |
| Auto-reprice, batch analysis, full optimizer catalogs, bulk/scheduled export | **Paid (CIPHER)** | |
| Attribution, cohort LTV, 90-day history/trends | **Paid (PHANTOM+)** | |

**Anti-cripple guarantee:** every tool's Free layer answers the primary search-intent question end-to-end.

---

## 6. UX Simplification Plan (Deliverable 6)

- **Terminology:** replace jargon with plain English + an info tooltip holding the precise definition (keeps the term for SEO). Examples: "Break-even price" → *"The price where you stop losing money"*; "ROAS" → *"Revenue per $1 of ad spend"*; "Reorder point" → *"Stock level where you should order more"*; "Contribution margin" → *"What's left after product + selling costs."*
- **Guidance:** every result carries one **"What this means"** line and one **"Do this next"** action. New `ResultVerdict` content slot in the skeleton.
- **Friction:** ≤4 visible inputs, sensible defaults, inline validation, currency selector retained.
- **Interpretation:** hero number uses size + primary color; supporting metrics are visually secondary; color semantics consistent (positive/negative/warning) across all tools.

---

## 7. Viral Growth Strategy (Deliverable 7)

- **Keep:** `ShareResult` (encoded `?s=` state → pre-filled shared result) and `EmbedCode` (embeddable widget = backlink/SEO loop).
- **Add:**
  - **Per-result OG image** so shared links render a branded preview card with the headline result.
  - **Benchmark/"challenge" share** — e.g., "My store ranks #2 of 6 — check yours," a curiosity loop driving new tool visits.
  - **Referral nudge** in the nurture sequence (Day-3/Day-5) and post-save ("share this report, both get…").
- **Loop logic:** Tool result → share/embed → new visitor → tool result → email capture → nurture → trial. Each free tool is a top-of-funnel growth node.

---

## 8. Documentation Update Plan (Deliverable 8)

| File | Change |
|---|---|
| `docs/MONETIZATION.md` | Add "Conformance & Enforcement" section: the enforced skeleton, re-timed gate, three segmentation shifts, per-tool 1-3-More table. Keep existing strategy intact. |
| `docs/TOOLS.md` | Rewrite each tool's output spec to the 1-3-More mapping; add the audit scorecard; mark every output's layer. |
| `docs/PRICING.md` | Add tool→tier upgrade mapping; ensure export/scenario/CSV gates referenced; **add the `free`/SCOUT $0 tier row and post-trial→free fallback (§12)**; existing paid prices unchanged. |
| `docs/ARCHITECTURE.md` | Document the `free` plan state, `saved_calculations` table, and the dashboard Tools-tab surface (Phase 5). |
| `docs/FEATURES.md` | Add the free/email/paid feature matrix (§5) and acceptance criteria for the gates. |
| `docs/GROWTH.md` | Add viral loops, OG/challenge share, referral, embed backlink strategy. |
| `docs/USERFLOW.md` | Add the new free-tool journey + lead-capture point + return-visit path. |
| `docs/WEBSITE.md` | Update tool-page section order to the enforced skeleton. |
| `docs/DEVPLAN.md` | Add the rollout roadmap (§9) as sprints. |
| `docs/ONBOARDING.md` (**new**) | Beginner onboarding, the 7-day nurture, enhanced-insight emails, referral nudges. |

*Note:* no `Plans.md` exists; `PRICING.md` is the pricing source of truth and will be extended rather than forked, to avoid contradictory files.

---

## 9. Rollout Roadmap (Deliverable 9)

| Phase | Scope | Output |
|---|---|---|
| **P0 — Spec & Docs** *(this engagement)* | This spec + all doc updates in §8 | Aligned source of truth |
| **P1 — Shared skeleton** | Refactor `tool-layout.tsx` to own the canonical render order + `ResultVerdict`/`hero`/`supporting`/`breakdown` slots | One PR; no per-tool logic change yet |
| **P2 — Per-tool simplification** (worst-first: shipping → roas → shopify-profit → price-position → fba → inventory) | Move depth into breakdown accordion, set hero+3, add "what this means / do this next", plain-English labels | One PR per tool |
| **P3 — Gate timing + segmentation** | Re-time Layer-1 to earned-value trigger; "Example" tags; wire CSV/scenario/save behind email; bulk/scheduled export behind CIPHER | Enforcement PR |
| **P4 — Viral + measurement** | OG images, challenge share, referral; PostHog events for the 90-day funnel | Growth PR + dashboard |
| **P5 — Free dashboard workspace** | Freemium tier: `free` plan state, Tools tab in dashboard, account-backed saves, preview-locked platform tabs, in-workspace upsell (see §12.7 for P5a–P5e) | Freemium PRs (web + api) |

Each phase ships independently and keeps all tests green.

---

## 10. Risk Analysis (Deliverable 10)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **SEO/AEO regression** from hiding content | Med | High | Accordion/visual hiding only; all text + schema stay in DOM; keep Quick Answer + FAQ; monitor organic traffic vs the "maintain or +15%" target |
| **Over-gating depresses conversion/trust** | Med | High | Value-first (core always free); gates dismissable; PDF stays free; A/B the gate trigger; watch capture-rate vs bounce |
| **Trust erosion / dark-pattern perception** | Low | High | No forced modals; honest "Example" labels; no fake blurred data; clear dismissal copy |
| **Dev regression across 6 tools** | Med | Med | Shared skeleton first; per-tool incremental PRs; preserve existing tests; worst-first |
| **Lead quality dips** (email-only saves) | Med | Med | Nurture qualifies; trigger after earned value; enhanced-insight email adds value |
| **Density returns over time** | Med | Med | Skeleton *enforces* slots in `tool-layout.tsx`; lint/review checklist in `TOOLS.md` |
| **Trial cannibalization** (free tier, P5) | Med | High | Trial = hero CTA; live data firmly paid; usage-based upsell triggers; free→trial tracked as first-class KPI |
| **Plan-model migration** (adding `free`, P5) | Low | Med | `free` is additive below RECON; `plan_gate` hierarchy extends cleanly; careful migration of trial-expiry behavior (read-only → `free`) |
| **Dashboard "ghost town" feel** (P5) | Med | Med | Aspirational preview tabs with demo data (not gray locks); genuinely valuable Tools tab; repurposed Overview |

---

## 11. Success Metrics

Reuse the existing 90-day targets in `MONETIZATION.md` (tool email-capture 8–15%, trial starts 2–4% of tool users, pricing CTR +40%, free→trial 5–10%, trial→paid 20–35%, organic maintain/+15%). Add two enforcement KPIs: **median visible data points on first paint ≤ 5**, and **% of tools passing the audit scorecard = 100%**.

---

## 12. Free Dashboard Workspace — the Freemium Tier (Phase 5)

The logged-in expression of the Layer-1 value: a **free account tier** whose value is the *saved, enhanced* tool suite, with the paid platform teased through **aspirational preview tabs**. Public `/tools/*` stay public and crawlable — this is a **second, authenticated surface (a mirror with superpowers)**, never a relocation.

### 12.1 Plan state
- Add a `free` plan **beneath RECON** (proposed themed name **SCOUT**, price $0; name overridable). `PLAN_HIERARCHY` becomes `['free', 'recon', 'cipher', 'phantom', 'predator', 'eclipse']`.
- **Sign-up grants `free`, not a trial.** The 14-day trial becomes an explicit, prominently-promoted action ("Start 14-day RECON trial") that sets `plan='recon'` + `trial_ends_at`. Trial remains the **primary CTA** everywhere.
- **Post-trial fallback (retention floor):** on trial expiry without payment, downgrade to `free` (keep the tools workspace; lock platform features) **instead of** the current read-only lockout. Tracked SKUs are paused per the existing 30-day retention policy.

### 12.2 Surfaces
- **Tools tab (new, fully working):** hosts the 6 calculators (reuse the same components as the public pages) with account superpowers — saved history, scenario library, in-app CSV, enhanced insights, cross-device. This is where Layer-1 value lands for logged-in users.
- **Overview (repurposed for free users):** welcome + tool shortcuts + usage summary + contextual upgrade prompts (replaces the signal summary, which is empty for free users).
- **Signals / Competitors / Alerts / Repricing / Attribution (preview-locked):** render the *real* UI populated with realistic demo data, blurred, each with a specific "see YOUR data" CTA. Reuse `demo-mode-panel` + `locked-section`. Server-side `plan_gate` already returns 403 `upgrade_required` for `free`; the frontend shows the preview instead of a raw error.
- **Settings (working):** manage account, connect store, **Start trial** button.

### 12.3 Conversion mechanics
- Every locked tab is a persistent upsell impression (structural "Return Moment").
- **Usage-based PQL triggers:** "You've run {n} tool checks this week — SPECTER monitors these automatically." Fires the existing Effort/Return triggers from real behavior.
- Trial CTA omnipresent; free positioned as "not ready to connect your store yet? use the tools meanwhile."

### 12.4 Data model
- New `saved_calculations` table: `merchant_id`, `tool_id`, `inputs` (json), `results` (json), `label`, `created_at`. Backs Save/History.
- Account-backed scenarios (today `ScenarioPanel` uses localStorage) persisted per account.
- Free plan consumes **no** SKU/competitor/scrape limits — the tools are client-side, no scraping.

### 12.5 SEO
- Public `/tools/*` unchanged. The dashboard Tools tab sits behind auth and is `noindex` — **zero SEO impact**, no cannibalization of the public pages.

### 12.6 Primary risk — trial cannibalization
A free logged-in tier can reduce trial starts if users park in free. Mitigations: keep live competitor data firmly paid; trial is the hero CTA (free is the fallback); fire usage-based upsell triggers; measure free→trial conversion as a first-class KPI. Net effect expected positive — converts users who would otherwise bounce, and adds a retention floor.

### 12.7 Phase-5 roadmap
| Step | Scope |
|---|---|
| **P5a** | `free` plan state; sign-up no longer auto-trials; explicit trial action; post-trial → `free` fallback (replaces read-only lockout) |
| **P5b** | Tools tab in dashboard (mount the 6 calculators) + repurposed free Overview |
| **P5c** | Account-backed `saved_calculations` + scenarios + in-app CSV |
| **P5d** | Preview/demo-mode locked versions of the 5 platform tabs |
| **P5e** | In-workspace PQL upsell triggers + PostHog measurement (free→trial, workspace WAU) |

---

## 13. Out of Scope

- No changes to **existing paid tier** amounts or SKU limits — RECON/CIPHER/PHANTOM/PREDATOR/ECLIPSE numbers in `PRICING.md` unchanged. (Adding the $0 `free` tier below RECON **is** in scope.)
- No new post-login **paid** features — Phase 5 only adds the free workspace + preview tabs; it does not alter Signals/Repricing/Attribution functionality for paying users.
- No new tools — the 6 existing tools only.
- Tool-page and workspace **code implementation** — covered by the follow-up plan (P1–P5), not this spec.
```
