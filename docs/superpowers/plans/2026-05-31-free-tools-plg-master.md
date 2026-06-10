# SPECTER — Free-Tool Simplification & PLG Engine (Master Plan)

> **Status:** Canonical. Supersedes `2026-05-30-free-tools-plg-redesign.md`.
> Captured in-repo on 2026-06-05. Waves 0–4 shipped; Wave 5 (conversion
> polish + docs) in progress.

## Context

The 6 public calculators were built to drive SEO/AEO traffic and top-of-funnel
acquisition, but had grown **too data-dense for the target user** (new,
non-technical ecommerce owners). **Position Analyzer is excluded** from "simplify
the free tools" — it stays public as the SaaS bridge (its live-data path leads to
RECON+).

**Outcome intended:** make every public tool understandable in seconds (one hero
answer), give signup a real payoff (an Intermediate depth tier + saved/compare
workspace), preserve SEO/AEO, and build one clean Public → Intermediate → Paid
ladder — without weakening the core SaaS or adding features for their own sake.

## Deliverable 2 — The Tool Taxonomy (Public vs Intermediate vs Paid)

```
PUBLIC (anonymous, crawlable)        INTERMEDIATE (logged-in FREE)         PAID (RECON / CIPHER / PHANTOM+)
1 hero answer + ≤3 supporting        + the stripped-out depth:             + LIVE data & automation:
+ "See full breakdown" (in DOM)        multi-tab analyses, charts,         live competitor prices,
+ FAQ + educational content            scenario modeling, saved &          monitoring, AI signals,
PDF/print = free                       compared history (cross-device)     CSV/bulk/exports, attribution
Position Analyzer = SaaS bridge      "noindex" dashboard workspace        server-enforced (plan_gate)
```

- **Public** = "What is my situation right now?" (SEO/AEO answer engine).
- **Intermediate** = "Explore it deeper and keep your work" (retention floor; the
  reward for signing up; demonstrates depth exists → primes upgrade).
- **Paid** = "Do it automatically, forever, with live data" (the SaaS).

### Conversion ladder — local-first, anti-abandonment

**The first goal is Visitor → User, not Visitor → Lead.** Saving and comparing are
*free and local first* (localStorage). Account creation is positioned later as the
way to **sync + keep history + unlock the Workspace**. Email is the account
mechanism, not the price of a first save. This supersedes the "earned-value →
email gate → save" ordering in F-GATE / `MONETIZATION.md`.

## The AI Insight layer (cross-cutting)

After the hero answer every tool renders an **AI Summary** card (`ToolInsightCard`
slot in `tool-layout.tsx`, fed by `lib/tools/insights.ts`):

- **Engine = deterministic, rule-based** per tool (thresholds over calc results) —
  client-side, instant, free, SEO-safe, unit-tested. Each rule emits a
  plain-English read, a *quantified* opportunity, and a **cross-tool
  recommendation** (the next-tool loop).
- The same outputs feed the **Opportunity Feed** in the Workspace when aggregated
  across a user's saved reports.
- Optional LLM enrichment is gated to logged-in users only (server-side), never on
  the anonymous client path. The deterministic version is always the floor.

## The SPECTER Workspace (Phase 3/4)

The free-tier dashboard surface — **Saved Reports**, **Compare**, **Opportunity
Feed**, **Tool Gallery** — built on the backend `/calculations` CRUD. Logged-in
`free` accounts land here. Platform tabs (Signals/Competitors/Alerts/Repricing/
Attribution) render the preview/demo fixtures with a "Live data unlocks on RECON"
treatment — never a blank wall. Locked Paid surfaces render a `LockedValueCard`
(problem/value/why + a real preview, dismissible 7 days — no blurred fake data).

## Deliverable 12 — Rollout Roadmap (sequenced waves)

1. **Wave 0 — Foundations (backend):** signup → `free`; `tool_calculations`
   table + `/calculations` router; start-trial + trial-expiry. *(shipped)*
2. **Wave 1 — Skeleton + insight engine + pilot:** `ResultVerdict` /
   `SupportingMetrics` / `FullBreakdown` + `ToolInsightCard` slots in
   `tool-layout.tsx`; `lib/tools/insights.ts`; migrate **shipping** (worst
   offender) + FAQ/Quick Answer/Education. *(shipped)*
3. **Wave 2 — Remaining public tools:** same treatment for shopify-profit, fba,
   roas, inventory. *(shipped)*
4. **Wave 3 — SPECTER Workspace:** plan-aware shell + Workspace home (Saved
   Reports + Compare + Opportunity Feed) + API hooks + local-first save with
   localStorage→DB migration; preview/demo platform tabs. *(shipped)*
5. **Wave 4 — Intermediate tier + virality:** promoted depth behind login;
   `LockedValueCard` for Paid surfaces; OG-image route + challenge-share wired
   into all 5 tools (static-safe `?s=` rehydration); PQL events. *(shipped)*
6. **Wave 5 — Conversion polish + docs:** first-visit hero coachmark; upgrade
   triggers; optional LLM-enriched insight (logged-in); nurture wiring; docs
   reconciliation (this Deliverable 11). *(in progress)*

Each wave is independently shippable and testable; tools stay live throughout.

## Deliverable 11 — Documentation reconciliation

- **Supersede** `2026-05-30-free-tools-plg-redesign.md` (banner added).
- **CLAUDE.md** — "6 free tools" → "5 simplified public tools + Position Analyzer
  (SaaS bridge)"; note the free Workspace + `/calculations` API.
- **MONETIZATION.md / F-GATE** — gate ordering is **local-first** (free local
  save/compare; account = sync/history/Workspace, not the price of a first save).
- **TOOLS.md** — carve Position Analyzer out of the "free tools to simplify" set;
  add the Intermediate-tier column.
- **Document** the AI Insight layer (deterministic + optional LLM) and the SPECTER
  Workspace (Saved Reports, Compare, Opportunity Feed) as first-class surfaces.

## Critical files

**Frontend (specter-web):** `components/tools/tool-layout.tsx` (skeleton slots +
`ToolInsightCard` + `HeroCoachmark`); `lib/tools/insights.ts`
(+`__tests__/tools/insights.test.ts`); `app/tools/<tool>/page.tsx` (×5 thin glue);
`components/tools/{tool-faq,quick-answer,locked-section,share-result}.tsx`,
`lib/tools/{schema,share,scenarios,coachmark}.ts`;
`app/(dashboard)/{layout,workspace/page}.tsx` +
`components/dashboard/workspace/*`; `lib/calculations-api.ts`,
`lib/tools/{workspace,migrate-scenarios}.ts`; `components/dashboard/locked-value-card.tsx`;
`app/tools/og/route.tsx`.

**Backend (specter-api):** `auth/supabase.py` (signup default `free`);
`models/tool_calculations.py` + migration; `routers/calculations.py`;
`routers/merchants.py` (start-trial) + trial-expiry job; `auth/plan_gate.py`
(free-aware).

## Verification

- **Density gate per public tool:** ≤4 visible inputs, exactly 1 hero + ≤3
  supporting + ≤1 chart before expand; AI Summary present; "See full breakdown"
  reveals the rest; FAQ + Quick Answer present.
- **SEO/AEO:** `npm run build` clean; JSON-LD (QuickAnswer + FAQPage) + all
  breakdown text in the DOM (collapsed, not removed); `/tools/*` indexable + static
  (`○`); dashboard Workspace `noindex`.
- **Local-first save:** anonymous Save + Compare work with no account/email prompt.
- **Free account:** signup → `plan='free'`; lands on Workspace; platform tabs show
  preview/demo; local scenarios migrate into `tool_calculations`; Opportunity Feed
  lists quantified actions.
- **Conversion plumbing:** `LockedValueCard` shows problem/value/why + real
  preview; dismissals suppress 7 days; PQL fires at N saves; next-tool links route
  correctly; share links rehydrate inputs; tools stay static.
