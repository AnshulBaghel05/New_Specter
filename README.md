# SPECTER

B2B SaaS for Shopify/WooCommerce merchants: real-time competitor price & stock
monitoring with AI-powered **RAISE / LOWER / HOLD** repricing signals, plus a
suite of free public tools that drive top-of-funnel acquisition.

This is a **monorepo** containing both deployable applications.

## Structure

| Path | App | Stack | Deploy target |
|------|-----|-------|---------------|
| [`specter-web/`](specter-web) | Marketing site, public tools, blog, SaaS dashboard | Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui | Vercel |
| [`specter-api/`](specter-api) | API + scraper (FastAPI + Node.js/BullMQ workers) | Python (FastAPI), Node.js (TypeScript) | Railway |
| [`docs/`](docs) | Product specs, plans, pricing, architecture | Markdown | — |

## Getting started

Each app has its own README/config. In short:

```bash
# Frontend
cd specter-web
cp .env.example .env.local   # fill in Supabase, API URL, etc.
npm install
npm run dev                  # http://localhost:3000

# Backend (API)
cd specter-api
cp .env.example .env         # fill in Supabase JWT secret, Redis, DB, etc.
python -m venv .venv && . .venv/bin/activate   # (Windows: .venv\Scripts\activate)
pip install -r requirements.txt
uvicorn main:app --reload    # http://localhost:8000

# Scraper workers
cd specter-api/scraper
cp .env.example .env
npm install
npm run build
```

## Deployment notes

- **Secrets are never committed.** Copy each `.env.example` to its real
  counterpart and set values in your hosting provider's environment config
  (Vercel project env, Railway service variables). Rotate any credentials that
  were ever shared in plaintext before going live.
- `specter-web` deploys from the `specter-web/` subdirectory (set the Vercel
  root directory accordingly).
- `specter-api` deploys from `specter-api/`; the scraper workers run from
  `specter-api/scraper/`.
- Plan gating (CIPHER+, PHANTOM+, PREDATOR+) is enforced **server-side** in
  `specter-api`; the frontend gating is UI-only.

## Documentation

See [`docs/`](docs) and [`CLAUDE.md`](CLAUDE.md) for product specs, pricing,
architecture, and the development plans.
