# SPECTER — PROMPTS.md Design (Sub-project D)

**Date:** 2026-05-23
**Status:** Approved
**Scope:** A single PROMPTS.md file at the repo root — 18 sequential Claude Code prompts for building SPECTER from scratch across 5 phases

---

## 1. Purpose & Audience

PROMPTS.md is a developer accelerator. A developer with the SPECTER repo open in Claude Code can paste one prompt per session and have Claude Code implement that phase of the product. Prompts are self-contained (no external knowledge required) but reference SPECTER's existing docs for deep specs rather than duplicating them.

**Audience:** Developers building SPECTER for the first time, or rebuilding a specific layer. Not for merchants.

---

## 2. File Location

```
PROMPTS.md    ← repo root (same level as CLAUDE.md)
```

---

## 3. Prompt Template

Each of the 18 prompts follows this exact structure:

```markdown
## Prompt N: [Title]
**Phase:** [Phase name] | **Repo:** specter-web | specter-api | both
**Read first:** `docs/X.md`, `docs/Y.md`
**Builds on:** Prompt N-1 [or "Starting point" for Prompt 1]

[2-sentence context: what exists at this point, what this prompt builds]

**Your task:** [one clear imperative sentence]

**Deliverables:**
- `exact/path/to/file` — [what it does]
- `exact/path/to/file` — [what it does]

**Key requirements:**
- [specific, testable requirement]
- [specific, testable requirement]
- [specific, testable requirement]

**Success criteria:**
- [how Claude Code can self-verify this prompt is done]
- [how Claude Code can self-verify this prompt is done]
```

---

## 4. File Intro Section

The file opens with:

```markdown
# SPECTER — Development Prompts

Sequential Claude Code prompts for building SPECTER from scratch.
Each prompt is one focused session. Run them in order — Prompt N assumes
Prompt N-1 is committed and working.

**How to use:** Open Claude Code in the SPECTER repo root. Paste one prompt.
Run `npm run dev` / `uvicorn` after each prompt to verify before moving on.
Read `CLAUDE.md` before starting — it contains critical rules that apply to every session.
```

---

## 5. Phase Breakdown — All 18 Prompts

### Phase 0: Pre-Development (Prompts 1–2)

| # | Title | Repo | Read first | Objective |
|---|-------|------|-----------|-----------|
| 1 | Project Scaffolding & Design System | both | `CLAUDE.md`, `docs/TECHSTACK.md` | Scaffold specter-web (Next.js 14, Tailwind, shadcn/ui) and specter-api (FastAPI, Pydantic v2), configure design tokens, ESLint, Prettier — verify both servers start |
| 2 | Database Schema & Infrastructure | specter-api | `docs/ARCHITECTURE.md` | Implement all PostgreSQL tables as SQLAlchemy models + Alembic migrations; configure Upstash Redis and Supabase connections |

### Phase 1: Marketing Site (Prompts 3–5)

| # | Title | Repo | Read first | Objective |
|---|-------|------|-----------|-----------|
| 3 | Homepage Hero & Sections 1–8 | specter-web | `docs/WEBSITE.md`, `CLAUDE.md` | Build nav, Three.js particle hero, social proof, problem panels, product demo, OOS timeline, attribution animation, domain batching, and competitor comparison sections |
| 4 | Homepage Sections 9–15 & Auth Pages | specter-web | `docs/WEBSITE.md`, `docs/PRICING.md` | Build pricing cards with plan toggle, integrations, free tools CTA, testimonials, FAQ accordion, footer, and Clerk sign-in/sign-up pages |
| 5 | Six Free Calculator Tools | specter-web | `docs/TOOLS.md` | Implement all 6 client-side calculators (FBA, Shopify profit, shipping, price position, ROAS, inventory reorder) — zero API calls, pure client logic |

### Phase 2: Scraping Engine (Prompts 6–9)

| # | Title | Repo | Read first | Objective |
|---|-------|------|-----------|-----------|
| 6 | BullMQ Queue Architecture & Scheduler | specter-api | `docs/SCRAPER.md` | Implement all 6 BullMQ queues, ScrapeJob type, plan priority mapping, domain batching lock, and scheduler that dispatches by plan tier and domain classification |
| 7 | Probe Worker & Domain Classification | specter-api | `docs/SCRAPER.md` | Build probe worker: HEAD bot detection, GET via datacenter proxy, robots.txt Redis cache, 7 classification heuristics, Redis state machine, domain-blocked notification |
| 8 | HTTP Worker & Data Validation | specter-api | `docs/SCRAPER.md` | Build HTTP worker: rate limit check, got v14 GET, parse pipeline (JSON-LD → Open Graph → CSS), 5-rule data validation, failure counter → JS_REQUIRED reclassification |
| 9 | Playwright Worker & Per-Domain Parsers | specter-api | `docs/SCRAPER.md` | Build Playwright worker: playwright-extra + stealth, resource blocking, stealth randomisation, context reuse every 50 jobs, CAPTCHA + 2captcha, domains/ parser system |

### Phase 3: Signal & AI Engine (Prompts 10–11)

| # | Title | Repo | Read first | Objective |
|---|-------|------|-----------|-----------|
| 10 | Rule-Based Signal Engine | specter-api | `docs/FEATURES.md` (F4), `docs/ARCHITECTURE.md` | Build Python signal engine: RAISE/LOWER/HOLD logic, confidence scoring, 1hr duplicate suppression, OOS detection → oos_alerts rows |
| 11 | Gemini AI Signal Engine | specter-api | `docs/AI_PRICING.md`, `docs/FEATURES.md` (F11) | Implement CIPHER+ AI path: Gemini 1.5 Pro mini-batch (≤50 SKUs), prompt construction, response validation, SHA-256 Redis cache, rule-based fallback to scrape:ai-errors |

### Phase 4: Dashboard & Core Product (Prompts 12–14)

| # | Title | Repo | Read first | Objective |
|---|-------|------|-----------|-----------|
| 12 | Auth, Plan Gating & Core API Routes | both | `docs/FEATURES.md` (F1–F2), `docs/ARCHITECTURE.md` | Implement Clerk JWT middleware, FEATURE_GATES plan gate, merchants/SKUs/competitors FastAPI routers, Shopify OAuth flow, Next.js dashboard auth guard |
| 13 | Dashboard Pages: Signals, Competitors & Alerts | both | `docs/FEATURES.md` (F3–F6) | Build /dashboard overview, /signals feed, /competitors URL management, /alerts OOS log — all with TanStack Query 60s refetch against specter-api |
| 14 | Attribution, Repricing, OOS Emails & Settings | both | `docs/FEATURES.md` (F7–F8), `docs/AI_PRICING.md` | Build /repricing (CIPHER+), /attribution (PHANTOM+), /settings, and Resend email notifications for OOS alerts, scrape failures, domain-blocked events |

### Phase 5: Production (Prompts 15–18)

| # | Title | Repo | Read first | Objective |
|---|-------|------|-----------|-----------|
| 15 | Razorpay Billing & Subscriptions | specter-api | `docs/PRICING.md`, `docs/FEATURES.md` | Implement Razorpay subscription creation, POST /billing/webhook handler, plan upgrade/downgrade, add-on management, trial expiry with day-12/14 reminder emails |
| 16 | PREDATOR & ECLIPSE Enterprise Features | specter-api | `docs/FEATURES.md` (F9–F10) | Implement PREDATOR priority queue (BullMQ priority 10), 90-day retention, 90-day date picker on /signals, ECLIPSE dedicated worker routing via ECLIPSE_WORKER_URL |
| 17 | Railway Deployment & Observability | both | `docs/ARCHITECTURE.md`, `docs/DEVPLAN.md` | Configure Railway services + Vercel, set all production env vars, add /health endpoints, wire Sentry + PostHog, configure Bull Board ops dashboard |
| 18 | CI/CD Pipeline & Launch Checklist | both | `docs/DEVPLAN.md` | Set up GitHub Actions (lint/type-check/test on PR, deploy on merge), pre-commit hooks, and complete pre-launch checklist before onboarding beta users |

---

## 6. Cross-Cutting Rules (embedded in intro)

- **Prompt 1 only:** Has no "Builds on" — it is the starting point
- **Every prompt:** Claude Code must commit before the next prompt begins
- **Every specter-web prompt:** Never call specter-api from tool calculator pages (F5 — client-side only)
- **Every dashboard prompt:** Plan gating enforced server-side in specter-api; frontend is UI-only
- **Never commit:** `.env` or `.env.local`

---

## 7. Implementation Deliverable

| File | Change |
|------|--------|
| `PROMPTS.md` | New file at repo root — complete 18-prompt development roadmap |

One file, one commit.

---

## 8. Out of Scope

- Prompts for specter-api deployment on AWS/GCP (Railway is the target)
- Docker / Kubernetes / Terraform prompts (not in SPECTER's stack)
- Prompts for features marked out-of-scope in the design spec (AI SKU variant matching, multi-seat, mobile app)
- A prompt runner or automation — PROMPTS.md is a human-operated reference, not a script
