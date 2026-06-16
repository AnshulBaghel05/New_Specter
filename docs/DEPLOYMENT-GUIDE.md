# SPECTER — Full Deployment Guide (Frontend + Backend + Scraper)

End-to-end, step-by-step guide to deploy all three SPECTER components and wire
them together:

| Component | Repo / dir | Host | What it is |
|-----------|------------|------|------------|
| **Frontend** | `specter-web` | **Vercel** | Next.js marketing site + dashboard |
| **Backend API** | `specter-api` | **Railway** | FastAPI app (auth, billing, signals, CRUD) |
| **Scraper** | `specter-api/scraper` | **Railway** | Node/BullMQ scheduler + workers + ops UI |

> **For the exhaustive, copy-pasteable step-by-step** (every Railway service,
> every env var, every UI option, plus verification + troubleshooting) see
> **[`DEPLOYMENT-RUNBOOK.md`](DEPLOYMENT-RUNBOOK.md)**. This page is the
> architectural overview; `docs/DEPLOY.md` is the quick runbook and
> `docs/DEPLOY-BILLING.md` covers the Razorpay dashboard setup in depth.
>
> **Auth is Supabase** (not Clerk). The frontend signs in with Supabase; the API
> validates the Supabase JWT on every request.

---

## 0. Architecture & how the pieces connect

```
                         ┌──────────────────────────┐
        browser ───────▶ │  Frontend (Vercel)        │
                         │  specter-web / Next.js     │
                         └────────────┬───────────────┘
                                      │  HTTPS + Supabase JWT (Bearer)
                                      │  NEXT_PUBLIC_API_URL
                                      ▼
   ┌─────────────┐   JWT    ┌──────────────────────────┐
   │  Supabase   │◀────────▶│  Backend API (Railway)    │
   │  Auth + PG  │   PG     │  specter-api / FastAPI     │
   └─────────────┘          └───┬───────────────┬────────┘
                                │ enqueue jobs   │ ▲ signed result callbacks
                                │ (BullMQ)       │ │ (HMAC: SCRAPER_INGEST_SECRET)
                                ▼                │ │
                         ┌───────────────┐       │ │
                         │ Upstash Redis │◀──────┘ │
                         │  (job queue)  │         │
                         └──────┬────────┘         │
                                │ consume          │
                                ▼                  │
   ┌────────────────────────────────────────────┐ │
   │  Scraper services (Railway)                  │ │
   │  scheduler · probe · http · playwright ·     │─┘  POST /internal/ingest
   │  captcha · bull-board (ops UI)               │    SPECTER_API_URL
   └──────────────────────────────────────────────┘
                                ▲
                                │ daily POST /internal/run-trial-monitor
                         ┌──────┴────────┐
                         │  Cron service  │  (Railway Cron)
                         └────────────────┘
```

**The four connections that MUST line up** (most deploy failures are one of these):

1. **Frontend → API:** Vercel `NEXT_PUBLIC_API_URL` = the API's public Railway URL.
2. **API ↔ Scraper queue:** API and scraper share the **same** `UPSTASH_REDIS_URL`.
3. **Scraper → API ingest:** scraper `SPECTER_API_URL` = API URL **and** scraper
   `SCRAPER_INGEST_SECRET` is byte-identical to the API's. Mismatch ⇒ every
   scrape result is rejected `401` and no prices ever appear.
4. **Cron → API:** cron `SPECTER_API_URL` = API URL and `TRIAL_MONITOR_SECRET`
   matches the API's, or trials never expire.

---

## 1. Accounts & external services you need

Create these first; you'll collect a key from each in Step 2.

| Service | Why | Plan |
|---------|-----|------|
| **Railway** | Hosts API + scraper + cron | Hobby/Pro |
| **Vercel** | Hosts the frontend | Hobby/Pro |
| **Supabase** | Auth (JWT) **and** Postgres database | Free+ |
| **Upstash** | Redis (BullMQ job queue + ephemeral state) | Free+ |
| **Razorpay** | Subscriptions billing | Live account (KYC) |
| **Google AI Studio** | Gemini API for AI signals (CIPHER+) | Pay-as-you-go |
| **Resend** | Transactional + lifecycle email | Free+ |
| **Sentry** | Error tracking (optional, recommended) | Free+ |
| **PostHog** | Product analytics (optional) | Free+ |
| **2Captcha** | CAPTCHA solving for bot-walled targets (optional) | Pay-as-you-go |
| **Proxy provider** | Datacenter + residential proxies (optional but needed for real scraping at scale) | e.g. Bright Data |

---

## 2. Complete API keys & secrets reference

This is the full list of every key/secret across all components. Columns:
**Where** = how to obtain it · **Used by** = which service(s) need it ·
**Required?** = hard-required to function vs optional/feature-gated.

### 2a. Shared data stores & generated secrets (create once, reuse)

| Variable | Where to get it | Used by | Required? |
|----------|-----------------|---------|-----------|
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string. **Rewrite** the scheme to `postgresql+asyncpg://…` and use the **5432** (session) port. | API, Alembic | ✅ Yes (API won't boot without it) |
| `UPSTASH_REDIS_URL` | Upstash → your Redis DB → `rediss://…` TLS URL | API, Scraper, Bull Board | ✅ Yes |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL (`https://<proj>.supabase.co`) | API, Frontend | ✅ Yes |
| `SUPABASE_JWT_SECRET` | Supabase → Project Settings → API → JWT Secret | API | ✅ Yes (auth) |
| `ENCRYPTION_KEY` | Generate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` | API | ✅ Yes (encrypts stored Shopify tokens) |
| `SCRAPER_INGEST_SECRET` | Generate: `python -c "import secrets; print(secrets.token_urlsafe(32))"` | API **and** Scraper (must match) | ✅ Yes for live scraping |
| `TRIAL_MONITOR_SECRET` | Generate (same command) | API **and** Cron (must match) | ✅ Yes for trial expiry |
| `ADMIN_API_KEY` | Generate (same command) | API | ✅ Yes (fails closed on the admin cost endpoint) |

### 2b. Backend API (Railway) — feature keys

| Variable | Where to get it | Required? |
|----------|-----------------|-----------|
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | Shopify Partners → your app → API credentials | For store connect / repricing |
| `SHOPIFY_REDIRECT_URI` | `https://<api>.railway.app/merchants/shopify/callback` (must match the app's allowed callback exactly) | With Shopify |
| `SHOPIFY_SCOPES` | `read_products,write_products` | With Shopify |
| `DASHBOARD_URL` | `https://<web>.vercel.app/dashboard` (post-OAuth redirect) | With Shopify |
| `GEMINI_API_KEY` | Google AI Studio → Get API key | For AI signals (else rule-engine fallback) |
| `RESEND_API_KEY` | Resend → API Keys | For emails (best-effort if unset) |
| `RESEND_FROM` | e.g. `SPECTER <alerts@yourdomain>` | With Resend |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay → Settings → API Keys | For billing |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay → Settings → Webhooks (the secret you set when creating the webhook) | For billing |
| `RAZORPAY_PLAN_RECON_MONTHLY` / `_RECON_ANNUAL` | Razorpay → Subscriptions → Plans (one id per plan × cadence) | For billing |
| `RAZORPAY_PLAN_CIPHER_MONTHLY` / `_CIPHER_ANNUAL` | " | For billing |
| `RAZORPAY_PLAN_PHANTOM_MONTHLY` / `_PHANTOM_ANNUAL` | " | For billing |
| `RAZORPAY_PLAN_PREDATOR_MONTHLY` / `_PREDATOR_ANNUAL` | " | For billing |
| `RAZORPAY_PLAN_ADDON_50SKU` / `_100SKU` | Razorpay add-on plans | For à-la-carte add-ons |
| `RAZORPAY_PLAN_ADDON_SPEED_RECON` / `_SPEED_CIPHER` / `_SPEED_PHANTOM` | " | For à-la-carte add-ons |
| `SENTRY_DSN` | Sentry → API project → Client Keys (DSN) | Optional (no-op if unset) |
| `SENTRY_ENVIRONMENT` / `SENTRY_TRACES_SAMPLE_RATE` | your choice (defaults: `RAILWAY_ENVIRONMENT` / `0.0`) | Optional |
| `ALLOWED_ORIGINS` | Comma-separated frontend origins, e.g. `https://<web>.vercel.app`. Restricts CORS + enables credentials; defaults to `*` if unset | Recommended in prod |
| `ECLIPSE_WORKER_URL` | Enterprise dedicated worker base URL | Optional (ECLIPSE only) |
| `RAILWAY_ENVIRONMENT` | **Auto-injected by Railway** — do not set | n/a |

> See `specter-api/.env.example` for the authoritative list with inline notes,
> and `docs/DEPLOY-BILLING.md` for the full Razorpay dashboard walkthrough.

### 2c. Scraper services (Railway)

| Variable | Where / value | Required? |
|----------|---------------|-----------|
| `UPSTASH_REDIS_URL` | **Same** instance as the API | ✅ Yes |
| `SPECTER_API_URL` | The API's public Railway URL (`https://<api>.railway.app`) | ✅ Yes |
| `SCRAPER_INGEST_SECRET` | **Same** value as the API's | ✅ Yes for ingest |
| `BROKER_REDIS_URL` / `STATE_REDIS_URL` | Optional split (durable queue vs ephemeral state on separate Redis) | Optional |
| `PROXY_DATACENTER_URLS` | Comma-list or rotating gateway, `http://user:pass@host:port` | Optional (direct fetch if unset — dev only) |
| `PROXY_RESIDENTIAL_URLS` | " (Playwright/stealth tier) | Optional |
| `ALLOW_DIRECT_FALLBACK` | `false` in prod (don't expose origin IP) | Optional |
| `TWOCAPTCHA_API_KEY` | 2Captcha dashboard | Optional (captcha worker) |
| `BROWSER_WS_ENDPOINT` | Shared Chromium farm `wss://…` | Optional (scale) |

### 2d. Bull Board ops UI (Railway)

| Variable | Value | Required? |
|----------|-------|-----------|
| `UPSTASH_REDIS_URL` | Same instance | ✅ Yes |
| `BULL_BOARD_USER` | e.g. `ops` | ✅ Yes (fails closed if unset) |
| `BULL_BOARD_PASS` | strong password | ✅ Yes |
| `BULL_BOARD_PORT` | Optional override; Railway injects `$PORT` | Optional |

### 2e. Cron service (Railway)

| Variable | Value | Required? |
|----------|-------|-----------|
| `SPECTER_API_URL` | API URL | ✅ Yes |
| `TRIAL_MONITOR_SECRET` | **Same** as the API's | ✅ Yes |

### 2f. Frontend (Vercel)

| Variable | Where / value | Required? |
|----------|---------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API → anon/public key | ✅ Yes |
| `NEXT_PUBLIC_API_URL` | The API's public Railway URL | ✅ Yes |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Same value as API's `RAZORPAY_KEY_ID` (publishable, safe to expose) | For checkout modal |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog → Project API key (`phc_…`) | Optional |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry → web project DSN | Optional |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Sentry org/project + auth token (build-time source-map upload; all three or none) | Optional |
| `RESEND_API_KEY` / `RESEND_AUDIENCE_ID` | Resend (for the `/api/email-capture` route) | Optional |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key — **server-only**, never `NEXT_PUBLIC_` | Optional |
| `NEXT_PUBLIC_PREVIEW` | **Must be unset or `0`** in production | ✅ Set to 0 |

> ⚠️ Anything prefixed `NEXT_PUBLIC_` is shipped to the browser — never put a
> secret there. The Razorpay **publishable** key id is safe; the key **secret**
> lives only on the API.

---

## 3. Step-by-step deployment

### Step 0 — Provision data stores & mint secrets

1. **Supabase project:** create it. Copy the Project URL, anon key, JWT secret,
   and the Postgres connection string. Run the SQL migrations in
   `specter-api/supabase/migrations/` (Supabase → SQL Editor) if you use Supabase
   as the app DB, or point `DATABASE_URL` at it and use Alembic (Step 1.4).
2. **Upstash Redis:** create a database, copy the `rediss://` TLS URL.
3. **Generate the shared secrets** (run locally):
   ```bash
   python -c "from cryptography.fernet import Fernet; print('ENCRYPTION_KEY=' + Fernet.generate_key().decode())"
   python -c "import secrets; print('SCRAPER_INGEST_SECRET=' + secrets.token_urlsafe(32))"
   python -c "import secrets; print('TRIAL_MONITOR_SECRET=' + secrets.token_urlsafe(32))"
   python -c "import secrets; print('ADMIN_API_KEY=' + secrets.token_urlsafe(32))"
   ```
   Keep these — several services share them.

### Step 1 — Backend API on Railway

1. **New Railway project** → **Deploy from GitHub repo** → select `New_Specter`.
2. In the service settings, set **Root Directory = `specter-api`**. Railway picks
   up `specter-api/railway.toml` automatically (nixpacks build, start command
   `uvicorn main:app --host 0.0.0.0 --port $PORT`, healthcheck `/health`).
3. **Variables:** add everything from §2a (shared) + §2b (API features) that you
   need. At minimum to boot: `DATABASE_URL`, `UPSTASH_REDIS_URL`, `SUPABASE_URL`,
   `SUPABASE_JWT_SECRET`, `ENCRYPTION_KEY`, `ADMIN_API_KEY`.
4. **Run database migrations** (not automatic on boot). Either:
   - Locally against the prod DB: `cd specter-api && alembic upgrade head`, or
   - Railway → service → **Settings → Deploy → Pre-Deploy Command:**
     `alembic upgrade head`
5. **Deploy.** Wait for the healthcheck to go green, then note the public URL
   (Railway → Settings → Networking → Generate Domain) — call it `<api>`.
6. **Verify:** `curl https://<api>.railway.app/health` → `{"status":"ok","db":"ok","redis":"ok"}`.

### Step 2 — Scraper services on Railway

The scraper is **multiple processes**: a scheduler (dispatches jobs) plus one
worker process per queue. Each runs as its **own Railway service** off the same
repo with **Root Directory = `specter-api/scraper`**, differing only in start
command. (Workers can't share a process — each owns its own shutdown handler and
Redis connection.)

Shared variables on **every** scraper service: `UPSTASH_REDIS_URL`,
`SPECTER_API_URL` (= `<api>` from Step 1), `SCRAPER_INGEST_SECRET` (= the API's).

| Service | Start command | Extra variables | Needed for |
|---------|---------------|-----------------|------------|
| **scheduler** | `npm run scheduler` | — | Dispatching scrape jobs on schedule |
| **probe-worker** | `npm run worker:probe` | proxies (optional) | Classifying domains (always) |
| **http-worker** | `npm run worker:http` | proxies (optional) | HTTP/SSR price scrapes (most sites) |
| **playwright-worker** | `npm run worker:playwright` | `BROWSER_WS_ENDPOINT?`, residential proxy | JS-rendered sites |
| **captcha-worker** | `npm run worker:captcha` | `TWOCAPTCHA_API_KEY` | Bot-walled targets |

**Minimal viable staging** (cheapest, scrapes static/SSR sites): `scheduler` +
`probe-worker` + `http-worker`. Add `playwright-worker` and `captcha-worker` when
you need JS-heavy or bot-protected targets.

> The start commands map to the npm scripts in `specter-api/scraper/package.json`
> (`scheduler`, `worker:probe`, `worker:http`, `worker:playwright`,
> `worker:captcha`). They run via `ts-node`.

### Step 3 — Bull Board ops UI (Railway)

1. New service, **Root Directory = `specter-api/scraper`**, start command
   `npm run bull-board`.
2. Variables: `UPSTASH_REDIS_URL`, `BULL_BOARD_USER`, `BULL_BOARD_PASS`.
3. Generate a domain → `<bull-board>`. The dashboard is at
   `https://<bull-board>.railway.app/ops/queues` (HTTP Basic Auth, fails closed).

### Step 4 — Trial-monitor cron (Railway)

Follow `specter-api/CRON.md`. Railway → New → **Cron Service**, Root Directory
`specter-api`:
- **Schedule:** `0 2 * * *` (daily 02:00 UTC)
- **Command:**
  ```bash
  curl -fsS -X POST "$SPECTER_API_URL/internal/run-trial-monitor" \
    -H "Authorization: Bearer $TRIAL_MONITOR_SECRET"
  ```
- Variables: `SPECTER_API_URL` (= `<api>`), `TRIAL_MONITOR_SECRET` (= the API's).

### Step 5 — Frontend on Vercel

1. **New Project** → import `New_Specter` from GitHub.
2. **Root Directory = `specter-web`** (Vercel auto-detects Next.js).
3. **Environment Variables:** add §2f. Set `NEXT_PUBLIC_API_URL = https://<api>.railway.app`
   and leave `NEXT_PUBLIC_PREVIEW` **unset or 0**.
4. **Deploy.** Note the domain → `<web>`.
5. **Verify:** `curl -I https://<web>.vercel.app` → `HTTP/2 200`.

### Step 6 — Wire the connections & Razorpay webhook

1. **Frontend → API:** confirm `NEXT_PUBLIC_API_URL` on Vercel points at `<api>`;
   redeploy the frontend if you changed it.
2. **Shopify redirect:** in Shopify Partners, set the allowed callback to exactly
   `https://<api>.railway.app/merchants/shopify/callback`, and set the API's
   `SHOPIFY_REDIRECT_URI` + `DASHBOARD_URL` accordingly.
3. **Razorpay webhook** (see `docs/DEPLOY-BILLING.md`): in Razorpay → Webhooks,
   add `https://<api>.railway.app/billing/webhook` with the events
   `subscription.activated`, `subscription.charged`, **and**
   `subscription.cancelled`; set the signing secret = the API's
   `RAZORPAY_WEBHOOK_SECRET`.

---

## 4. Post-deploy verification

| # | Check | Command / action | Expected |
|---|-------|------------------|----------|
| 1 | API health | `curl https://<api>.railway.app/health` | `{"status":"ok","db":"ok","redis":"ok"}` |
| 2 | Frontend up | `curl -I https://<web>.vercel.app` | `HTTP/2 200` |
| 3 | Auth round-trip | Sign up on `<web>`, load the dashboard | Loads without 401 |
| 4 | Queues visible | open `https://<bull-board>.railway.app/ops/queues` | 7 queues (probe/http/playwright/captcha/dead-letter/validation-errors/ai-errors); 401 without creds |
| 5 | Scrape ingest | connect a store / add a competitor, watch Bull Board | jobs flow probe→http; **no 401s** in worker logs (a 401 means `SCRAPER_INGEST_SECRET` mismatch) |
| 6 | Trial monitor | run the curl from §3-Step4 manually | `{"status":"ok","reminders":{…},"expired":N}` |
| 7 | Billing | run a test checkout (Razorpay test mode first) | webhook elevates the plan; `/billing/success` polls to the new plan |
| 8 | Sentry (if on) | temp route that raises → hit it → remove route | event lands tagged with env + `merchant_id` |
| 9 | PostHog (if on) | sign in | `$identify` for the user; events carry `merchant_id` |

---

## 5. Security — rotate before going live

Treat any secret that has ever been committed, pasted, or shared as compromised
and **rotate it** before this deployment serves real traffic:

- **Razorpay** key id + secret (regenerate in the dashboard), webhook secret.
- **Supabase** keys, **Upstash** Redis URL.
- Mint **fresh** `SCRAPER_INGEST_SECRET`, `TRIAL_MONITOR_SECRET`, `ADMIN_API_KEY`,
  `ENCRYPTION_KEY` for production (don't reuse dev values).
- Never commit `.env` / `.env.local` (already gitignored). Set every value in the
  Railway/Vercel dashboards.

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `/health` returns 503 with `"db":"down"` | Bad `DATABASE_URL` / wrong driver/port | Use `postgresql+asyncpg://…`, port 5432 |
| `/health` returns 503 with `"redis":"down"` | Wrong `UPSTASH_REDIS_URL` or non-TLS | Use the `rediss://` URL |
| API boots then crashes immediately | Missing `DATABASE_URL`/`UPSTASH_REDIS_URL` (hard-required) | Set them; they're not optional |
| Scrapes never produce prices; worker logs show `401 invalid_ingest_signature` | `SCRAPER_INGEST_SECRET` differs between API and scraper | Make them byte-identical, redeploy both |
| Ingest endpoint returns `500 config_error` | `SCRAPER_INGEST_SECRET` unset on the API | Set it on the API service |
| Trials never expire | Cron not running or `TRIAL_MONITOR_SECRET` mismatch / unset | Verify cron + matching secret (`CRON.md`) |
| Dashboard 401s on every API call | `NEXT_PUBLIC_API_URL` wrong, or `SUPABASE_JWT_SECRET` mismatch | Point at `<api>`; use the project's JWT secret |
| Frontend shows demo data only | `NEXT_PUBLIC_PREVIEW=1` left on | Unset it / set `0`, redeploy |
| Bull Board returns 500 | `BULL_BOARD_USER`/`PASS` unset (fails closed) | Set both |

### CORS

`specter-api/main.py` reads `ALLOWED_ORIGINS` (comma-separated). Set it to your
Vercel domain(s) in production to restrict CORS; leave it unset only for local
dev (defaults to `*`). When restricted, credentials are enabled automatically.
