# SPECTER — Development Plan

## Week 1: specter-web — Marketing Site
| Day | Task |
|-----|------|
| 1 | Scaffold Next.js, design system, CLAUDE.md + all docs |
| 2 | Nav + Hero (Three.js) |
| 3 | Marketing sections 2–8 |
| 4 | Marketing sections 9–15 |
| 5 | Auth pages (Supabase), deploy to Vercel |

## Week 2: specter-web — 6 Free Tools
| Day | Task |
|-----|------|
| 6 | Shared tool layout + Tool 1 (FBA Calculator) |
| 7 | Tool 2 (Shopify Profit) + Tool 3 (Shipping) |
| 8 | Tool 4 (Price Position) + Tool 5 (ROAS) |
| 9 | Tool 6 (Inventory Reorder) + SEO metadata |
| 10 | QA all tools, submit sitemap to Google Search Console |

## Week 3: specter-api — Foundation
| Day | Task |
|-----|------|
| 11 | Scaffold FastAPI, DB models, Alembic migrations |
| 12 | Auth middleware (Supabase JWT), Merchants router |
| 13 | Shopify OAuth flow, SKU import |
| 14 | Competitors router, BullMQ queue setup |
| 15 | Playwright worker v1 (generic parser) |

## Week 4: specter-api — Core Intelligence
| Day | Task |
|-----|------|
| 16 | Signal engine (RAISE/LOWER/HOLD) |
| 17 | Signals router, OOS detection |
| 18 | OOS alerts (Resend email) |
| 19 | Auto-reprice service (Shopify API calls) — CIPHER+ only |
| 20 | Deploy to Railway, connect specter-web dashboard |

## Week 5: specter-web — Dashboard
| Day | Task |
|-----|------|
| 21 | Dashboard layout + sidebar |
| 22 | /dashboard overview + /signals + /competitors |
| 23 | /repricing + /alerts |
| 24 | Razorpay billing (RECON/CIPHER/PHANTOM/PREDATOR plans + add-ons), /settings |
| 25 | Plan gating UI, TanStack Query hooks |

## Week 6: Attribution + Beta Launch
| Day | Task |
|-----|------|
| 26 | Attribution engine (Python) — PHANTOM+ only |
| 27 | /attribution dashboard page |
| 28 | E2E QA: onboarding → first signal → alert |
| 29 | Onboard 5 beta users manually |
| 30 | Bug fixes, performance, launch |

## PLG Free-Tool Redesign + Freemium Workspace (2026-05-30)
> Design: `docs/superpowers/specs/2026-05-30-free-tools-plg-redesign-design.md`. Implementation plan: `docs/superpowers/plans/2026-05-30-free-tools-plg-redesign.md`.

| Phase | Scope |
|-------|-------|
| P1 — Shared skeleton | Refactor `tool-layout.tsx` to own the canonical render order + hero/supporting/breakdown/verdict slots |
| P2 — Per-tool simplification | Worst-first: shipping → roas → shopify-profit → price-position → fba → inventory. Move depth into accordion; set hero+3; plain-English labels + "what this means / do this next" |
| P3 — Gate timing + segmentation | Re-time Layer-1 to earned-value trigger; "Example" tags; CSV/scenario/save behind email; bulk/scheduled export behind CIPHER |
| P4 — Viral + measurement | OG images, challenge share, referral; PostHog funnel events |
| P5 — Free dashboard workspace | `free` plan state (no auto-trial; post-trial→free); Tools tab in dashboard; account-backed saves (`saved_calculations`); preview-locked platform tabs; in-workspace PQL upsell |

Each phase ships independently and keeps all tests green.
