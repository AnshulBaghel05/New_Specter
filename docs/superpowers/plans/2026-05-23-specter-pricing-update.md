# SPECTER Pricing Redesign — Documentation Update Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update 7 existing markdown docs to reflect the new 5-tier pricing structure (RECON/CIPHER/PHANTOM/PREDATOR/ECLIPSE) replacing the old 4-tier structure (SCOUT/SNIPER/PREDATOR/APEX).

**Architecture:** Pure markdown edits — no code changes. Each task targets one file, commits independently. Read the spec at `docs/superpowers/specs/2026-05-23-specter-pricing-redesign.md` for pricing rationale if needed.

**Tech Stack:** Markdown, git

---

## File Map

```
CLAUDE.md                                          ← update 1 line in Critical Rules
docs/PRICING.md                                    ← full replacement
docs/FEATURES.md                                   ← update F7/F8 headers + add F9/F10
docs/SCRAPER.md                                    ← update schedule table only
docs/ARCHITECTURE.md                               ← add tier enum + subscription section
docs/DEVPLAN.md                                    ← add tier context to 3 tasks
docs/superpowers/specs/2026-05-23-specter-design.md ← mark Section 5 superseded
```

---

### Task 1: Replace docs/PRICING.md

**Files:**
- Modify: `docs/PRICING.md` (full replacement)

- [ ] **Step 1: Overwrite docs/PRICING.md with new content**

Write the following as the complete file content:

```markdown
# SPECTER — Pricing & Monetization

## Pricing Philosophy
Value-based pricing anchored to measurable merchant ROI. A merchant doing $1M GMV with 5% margin improvement = $50K/year recovered. SPECTER at $948/year (RECON) is <2% of that. Tier names reflect the intelligence-gathering progression: reconnaissance → encryption → phantom surveillance → predatory intelligence → total eclipse of competitors.

## Tier Table
| Tier | Price | SKUs | Refresh | Key Features |
|------|-------|------|---------|--------------|
| RECON | $79/mo | 100 | 6hr | Signals, OOS alerts, email notifs, 14-day trial |
| CIPHER | $249/mo | 500 | 3hr | + Auto-reprice, 14-day trial |
| PHANTOM | $699/mo | 1,000 | 2hr | + Attribution, custom webhooks, demo required |
| PREDATOR | $1,799/mo | 2,000 | 1hr | + 90-day history, priority queue, priority support |
| ECLIPSE | Custom | Custom | 5–15min | + Dedicated workers, SLA, white-glove onboarding |

**Annual discount:** 20% off (2 months free) on RECON, CIPHER, PHANTOM, PREDATOR. Applied via Razorpay plan selection.

## Unit Economics
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
| **Gross Margin** | **94.3%** | **94.3%** | **96.1%** | **95.7%** |

Proxy model: Bright Data ISP at $8.40/GB, ~75KB per scrape (Playwright with resource blocking). Domain batching is the margin moat — same competitor URL scraped once, served to all merchants tracking it.

**Margin floor (2× batching — early users, low URL overlap):**
| | RECON | CIPHER | PHANTOM | PREDATOR |
|--|-------|--------|---------|----------|
| Margin floor | 91.4% | 82.9% | 82.6% | 73.9% |

PREDATOR requires minimum 3× URL batching for 80%+ margin. Enforce URL overlap monitoring before onboarding PREDATOR accounts.

## À La Carte Add-Ons
| Add-on | Price | Available on |
|--------|-------|-------------|
| +50 SKUs | $19/mo | All plans |
| +100 SKUs | $35/mo | All plans |
| Speed boost: 50 SKUs from 6hr → 3hr | $29/mo | RECON only |
| Speed boost: 50 SKUs from 3hr → 2hr | $39/mo | CIPHER only |
| Speed boost: 50 SKUs from 2hr → 1hr | $49/mo | PHANTOM only |

Max 3 active add-on subscriptions per account. Add-ons expand quantity/speed only — they do not unlock plan-gated features.

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
- **RECON + CIPHER:** 14-day free trial, no credit card required. Razorpay subscription auto-activates day 15. Resend reminder emails at day 12 and day 14.
- **PHANTOM + PREDATOR + ECLIPSE:** Demo call required. No self-serve trial.
- **Trial expiry without payment:** Account downgraded to read-only (no new scrapes). Data retained 30 days before deletion.
- **Downgrade:** Immediate. SKUs above new plan limit are paused (not deleted). Merchant selects which to keep active.
- **Annual plans:** No refunds on annual subscriptions.

## Upgrade Triggers (in-product messaging)
- **RECON → CIPHER:** "You have {n} RAISE signals this month. Auto-reprice on CIPHER would have applied them instantly — and you're tracking {x}/100 SKUs."
- **CIPHER → PHANTOM:** "You've made {n} price changes. See exactly how much each one recovered with revenue attribution on PHANTOM."
- **PHANTOM → PREDATOR:** "Your competitors are changing prices faster than 2hr catches. PREDATOR's 1hr refresh and priority queue means you act first."
```

- [ ] **Step 2: Verify file renders correctly**

Open `docs/PRICING.md` in any markdown viewer. Confirm:
- Tier table has 5 rows (RECON through ECLIPSE)
- Unit economics table has correct margin values (94.3%, 94.3%, 96.1%, 95.7%)
- Razorpay env var block is present
- No references to SCOUT, SNIPER, or old APEX tier

- [ ] **Step 3: Commit**

```bash
git add docs/PRICING.md
git commit -m "docs: replace PRICING.md with 5-tier RECON/CIPHER/PHANTOM/PREDATOR/ECLIPSE structure"
```

---

### Task 2: Update docs/FEATURES.md

**Files:**
- Modify: `docs/FEATURES.md` (4 edits: update F7 header+AC1, update F8 header+AC1, append F9, append F10)

Context: F7 was gated to SNIPER+ and F8 to PREDATOR+. In the new structure, auto-reprice is CIPHER+ and attribution is PHANTOM+. New tiers PREDATOR and ECLIPSE have features not yet documented.

- [ ] **Step 1: Update F7 header and AC1**

Find this section in `docs/FEATURES.md`:

```markdown
## F7: Auto-Reprice Rules (SNIPER+)
**Description:** Merchant sets floor/ceiling prices per SKU; SPECTER auto-applies price changes based on signals.

**Acceptance Criteria:**
1. Only available on SNIPER and above plans
```

Replace with:

```markdown
## F7: Auto-Reprice Rules (CIPHER+)
**Description:** Merchant sets floor/ceiling prices per SKU; SPECTER auto-applies price changes based on signals.

**Acceptance Criteria:**
1. Only available on CIPHER and above plans
```

- [ ] **Step 2: Update F8 header and AC1**

Find this section in `docs/FEATURES.md`:

```markdown
## F8: Revenue Attribution (PREDATOR+)
**Description:** Show exact dollar impact per price change over trailing 30 days.

**Acceptance Criteria:**
1. Only available on PREDATOR and above plans
```

Replace with:

```markdown
## F8: Revenue Attribution (PHANTOM+)
**Description:** Show exact dollar impact per price change over trailing 30 days.

**Acceptance Criteria:**
1. Only available on PHANTOM and above plans
```

- [ ] **Step 3: Append F9 and F10 to end of file**

Add the following to the end of `docs/FEATURES.md`:

```markdown
---

## F9: PREDATOR+ Priority Features
**Description:** Priority scrape queue, 90-day price history, and priority support channel for PREDATOR tier.

**Acceptance Criteria:**
1. Only available on PREDATOR and above plans
2. PREDATOR scrape jobs inserted at queue priority 10 (vs priority 1 for lower tiers); processed before lower-tier jobs when worker capacity is contested
3. price_snapshots data retained for 90 days for PREDATOR merchants (vs 30 days for RECON/CIPHER/PHANTOM)
4. /signals and /attribution pages show date range picker allowing up to 90-day lookback on PREDATOR
5. PREDATOR merchants have a dedicated Slack channel invite sent on onboarding
6. Support tickets from PREDATOR merchants tagged `priority` in the ops queue; 24hr response SLA
7. Priority badge visible in /settings to confirm tier status

**Edge Cases:**
- Merchant downgrades from PREDATOR: historical data beyond 30 days retained for 7 days then deleted
- Queue is empty: priority level irrelevant; all jobs process normally

**Dependencies:** F3 (Scraper Engine), F4 (Signal Engine), Slack workspace for support channel

---

## F10: ECLIPSE Enterprise Features
**Description:** Dedicated infrastructure, uptime SLA, and white-glove onboarding for ECLIPSE tier.

**Acceptance Criteria:**
1. Only available on ECLIPSE plan
2. ECLIPSE merchants get dedicated Railway worker instances (not shared with lower tiers); configured via ECLIPSE_WORKER_URL env var
3. Dedicated workers refresh on merchant-configured interval between 5–15 minutes (set in /settings)
4. 99.9% monthly uptime SLA documented in contract; SPECTER ops monitors with PagerDuty alert at <99.9%
5. White-glove onboarding: SPECTER team member completes Shopify OAuth and first 20 competitor URL mappings on behalf of merchant within 48hr of contract signing
6. Custom contract and NET-30 invoicing via Razorpay; no self-serve signup flow
7. ECLIPSE account marked in DB (`merchants.plan = 'eclipse'`); all PREDATOR features inherited

**Edge Cases:**
- Dedicated worker goes down: fall back to shared workers automatically; notify merchant within 15min
- Custom refresh interval conflicts with domain's rate limit: SPECTER ops team resolves manually

**Dependencies:** F3 (Scraper Engine), F9 (PREDATOR+ features), Railway dedicated instance provisioning
```

- [ ] **Step 4: Verify no SNIPER/PREDATOR+ references remain for wrong features**

Search `docs/FEATURES.md` for the word "SNIPER" — should return 0 results.
Search for "PREDATOR+" — should only appear in F9 header (PREDATOR and above), not F7 or F8.

- [ ] **Step 5: Commit**

```bash
git add docs/FEATURES.md
git commit -m "docs: update FEATURES.md — CIPHER+/PHANTOM+ gates, add F9 PREDATOR+ and F10 ECLIPSE features"
```

---

### Task 3: Update docs/SCRAPER.md

**Files:**
- Modify: `docs/SCRAPER.md` (replace Plan Refresh Schedules table only)

Context: The current table has 3 rows (SCOUT/SNIPER/PREDATOR). Replace with 5 rows for new tiers with correct millisecond values.

- [ ] **Step 1: Replace the Plan Refresh Schedules table**

Find this section in `docs/SCRAPER.md`:

```markdown
## Plan Refresh Schedules
| Plan | Interval | BullMQ repeat |
|------|----------|---------------|
| SCOUT | 6hr | `{ every: 21600000 }` |
| SNIPER | 1hr | `{ every: 3600000 }` |
| PREDATOR | 15min | `{ every: 900000 }` |
```

Replace with:

```markdown
## Plan Refresh Schedules
| Plan | Interval | ms value | BullMQ repeat |
|------|----------|----------|---------------|
| RECON | 6hr | 21,600,000 | `{ every: 21600000 }` |
| CIPHER | 3hr | 10,800,000 | `{ every: 10800000 }` |
| PHANTOM | 2hr | 7,200,000 | `{ every: 7200000 }` |
| PREDATOR | 1hr | 3,600,000 | `{ every: 3600000 }` |
| ECLIPSE | 5–15min | 300,000–900,000 | `{ every: eclipseIntervalMs }` (merchant-configured, default 300000) |

Queue priority by tier (higher = processed first when workers are contested):
| Plan | BullMQ priority |
|------|----------------|
| ECLIPSE | 20 |
| PREDATOR | 10 |
| PHANTOM | 5 |
| CIPHER | 3 |
| RECON | 1 |
```

- [ ] **Step 2: Verify ms values are correct**

Mental check:
- 6hr: 6 × 60 × 60 × 1000 = 21,600,000 ✓
- 3hr: 3 × 60 × 60 × 1000 = 10,800,000 ✓
- 2hr: 2 × 60 × 60 × 1000 = 7,200,000 ✓
- 1hr: 1 × 60 × 60 × 1000 = 3,600,000 ✓
- 5min: 5 × 60 × 1000 = 300,000 ✓

- [ ] **Step 3: Commit**

```bash
git add docs/SCRAPER.md
git commit -m "docs: update SCRAPER.md refresh schedule for 5-tier pricing (RECON→ECLIPSE) + queue priorities"
```

---

### Task 4: Update docs/ARCHITECTURE.md

**Files:**
- Modify: `docs/ARCHITECTURE.md` (add new section at end of file)

Context: ARCHITECTURE.md currently has no explicit tier references or subscription handling documentation. Add a new section covering the tier enum and how plan gating flows through the system.

- [ ] **Step 1: Append new section to end of docs/ARCHITECTURE.md**

Add the following to the end of `docs/ARCHITECTURE.md`:

```markdown

## Subscription Tier Handling

### Database Tier Enum
`merchants.plan` column accepts these values:

```sql
-- Valid values for merchants.plan
'recon' | 'cipher' | 'phantom' | 'predator' | 'eclipse'
-- Trial state stored separately: merchants.trial_ends_at TIMESTAMP
-- Add-ons stored in: merchant_addons (merchant_id, addon_type, quantity)
```

### Plan Gating Flow
```
[Request arrives at specter-api]
      ↓
[Clerk JWT validated → merchant_id extracted]
      ↓
[merchants.plan + merchants.trial_ends_at read from DB]
      ↓
[FastAPI plan_gate middleware checks feature against plan]
      ↓ ALLOWED                    ↓ DENIED
[Handler executes]         [403 {"error": "upgrade_required",
                                  "required_plan": "cipher"}]
```

Plan gate middleware checks (Python):
```python
PLAN_HIERARCHY = ['recon', 'cipher', 'phantom', 'predator', 'eclipse']

FEATURE_GATES = {
    'auto_reprice':   'cipher',
    'attribution':    'phantom',
    'webhooks':       'phantom',
    'history_90d':    'predator',
    'priority_queue': 'predator',
    'dedicated_workers': 'eclipse',
}

def requires_plan(feature: str):
    min_plan = FEATURE_GATES[feature]
    min_index = PLAN_HIERARCHY.index(min_plan)
    merchant_index = PLAN_HIERARCHY.index(merchant.plan)
    return merchant_index >= min_index
```

### Scrape Job Priority by Plan
PREDATOR and ECLIPSE jobs are inserted at higher BullMQ priority (10 and 20 respectively). When scraper workers are at capacity, higher-priority jobs process first. See SCRAPER.md for full priority table.

### Add-On Handling
Speed boost add-ons are stored per-SKU-group in `merchant_addons`. The scraper scheduler checks `merchant_addons` before queuing to determine the effective refresh interval for each SKU group — may differ from the base plan interval.
```

- [ ] **Step 2: Verify no old tier names appear in ARCHITECTURE.md**

Search the file for "SCOUT", "SNIPER", "APEX" — should return 0 results.

- [ ] **Step 3: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: add tier enum, plan gating flow, and priority system to ARCHITECTURE.md"
```

---

### Task 5: Update docs/DEVPLAN.md

**Files:**
- Modify: `docs/DEVPLAN.md` (add tier context to 3 specific tasks)

Context: DEVPLAN.md has no old tier names to replace but lacks context on which tiers each feature targets. Add tier notes to Day 19 (auto-reprice), Day 24 (billing), and Day 26 (attribution) so developers know the plan gate context while building.

- [ ] **Step 1: Update Day 19 task**

Find this line in `docs/DEVPLAN.md`:

```markdown
| 19 | Auto-reprice service (Shopify API calls) |
```

Replace with:

```markdown
| 19 | Auto-reprice service (Shopify API calls) — CIPHER+ only |
```

- [ ] **Step 2: Update Day 24 task**

Find this line in `docs/DEVPLAN.md`:

```markdown
| 24 | Razorpay billing, /settings |
```

Replace with:

```markdown
| 24 | Razorpay billing (RECON/CIPHER/PHANTOM/PREDATOR plans + add-ons), /settings |
```

- [ ] **Step 3: Update Day 26 task**

Find this line in `docs/DEVPLAN.md`:

```markdown
| 26 | Attribution engine (Python) |
```

Replace with:

```markdown
| 26 | Attribution engine (Python) — PHANTOM+ only |
```

- [ ] **Step 4: Commit**

```bash
git add docs/DEVPLAN.md
git commit -m "docs: add tier gate context to DEVPLAN.md tasks (CIPHER+, PHANTOM+)"
```

---

### Task 6: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (update 1 line in Critical Rules)

Context: The Critical Rules section references old tier names SNIPER+ and PREDATOR+. These map to CIPHER+ and PHANTOM+ in the new structure.

- [ ] **Step 1: Update the plan gating critical rule**

Find this line in `CLAUDE.md`:

```markdown
- Plan gating (SNIPER+, PREDATOR+) MUST be enforced server-side in specter-api; frontend gating is UI-only
```

Replace with:

```markdown
- Plan gating (CIPHER+, PHANTOM+, PREDATOR+) MUST be enforced server-side in specter-api; frontend gating is UI-only
```

- [ ] **Step 2: Verify no other old tier references in CLAUDE.md**

Search CLAUDE.md for "SCOUT", "SNIPER", "APEX" — should return 0 results.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md critical rule — CIPHER+/PHANTOM+/PREDATOR+ replaces SNIPER+/PREDATOR+"
```

---

### Task 7: Mark Section 5 Superseded in Original Design Spec

**Files:**
- Modify: `docs/superpowers/specs/2026-05-23-specter-design.md` (add superseded notice to Section 5 only)

Context: The original design spec Section 5 documents the old 4-tier pricing (SCOUT/SNIPER/PREDATOR/APEX). It should not be deleted (it's the source of record for the original decisions) but must be clearly marked as superseded so developers don't accidentally reference stale prices.

- [ ] **Step 1: Add superseded notice to Section 5 header**

Find this line in `docs/superpowers/specs/2026-05-23-specter-design.md`:

```markdown
## 5. Pricing Tiers
```

Replace with:

```markdown
## 5. Pricing Tiers ⚠️ SUPERSEDED

> **This section is superseded by `docs/superpowers/specs/2026-05-23-specter-pricing-redesign.md`.**
> New tiers: RECON $79 / CIPHER $249 / PHANTOM $699 / PREDATOR $1,799 / ECLIPSE Custom.
> Do not use the prices, SKU limits, or tier names below for any implementation work.
> Retained for historical decision context only.
```

- [ ] **Step 2: Verify the notice renders clearly**

Open the file and confirm the blockquote warning appears immediately below the Section 5 heading, before the old tier table.

- [ ] **Step 3: Commit**

```bash
git add "docs/superpowers/specs/2026-05-23-specter-design.md"
git commit -m "docs: mark original design spec Section 5 (pricing) as superseded"
```
