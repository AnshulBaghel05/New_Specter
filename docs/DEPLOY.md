# SPECTER — Production Deployment & Observability

Covers deploying **specter-api** + the **scraper** to Railway and **specter-web**
to Vercel, plus wiring Sentry, PostHog, `/health`, and the Bull Board ops
dashboard. The code/config is in the repo (Prompt 17); the steps below are the
operational actions to run against your Railway/Vercel/Sentry accounts.

> Auth note: this stack uses **Supabase Auth** (not Clerk). Sentry attributes
> errors to `merchant_id` via the Supabase JWT dependency; PostHog identifies on
> the Supabase auth session.

---

## Railway services

Run these as **separate** Railway services off the same repo (each with its own
start command), all sharing the same Upstash Redis + Supabase Postgres:

| Service | Start command | Notes |
|---------|---------------|-------|
| **api** (web) | `uvicorn main:app --host 0.0.0.0 --port $PORT` | Config in `specter-api/railway.toml`; healthcheck `/health`. |
| **scraper workers** | `npm run dev` (or a compiled `node` entry) | BullMQ workers; root `specter-api/scraper`. |
| **bull-board** | `npm run bull-board` | Express ops UI at `/ops/queues`; healthcheck `/health`. |
| **trial-monitor cron** | daily `curl` (see `specter-api/CRON.md`) | Trial expiry + reminders. |

### Railway env (api service) — from ARCHITECTURE.md Secrets Management

```
DATABASE_URL              postgresql+asyncpg://… (Supabase, port 5432)
SUPABASE_URL              https://<proj>.supabase.co        # JWKS validation
SUPABASE_JWT_SECRET       <Supabase → API → JWT secret>     # HS256 fallback
UPSTASH_REDIS_URL         rediss://…                        # BullMQ + state
ENCRYPTION_KEY            <fernet key>                       # Shopify token enc
GEMINI_API_KEY            <…>                                # CIPHER+ AI signals
RESEND_API_KEY            <…>                                # OOS/trial emails
# Billing (see DEPLOY-BILLING.md): RAZORPAY_KEY_ID/SECRET, RAZORPAY_WEBHOOK_SECRET,
#   RAZORPAY_PLAN_*; Shopify OAuth: SHOPIFY_API_KEY/SECRET/REDIRECT_URI
TRIAL_MONITOR_SECRET      <strong secret>                    # cron bearer (CRON.md)
SENTRY_DSN                <Sentry API project DSN>           # error tracking
# Optional: SENTRY_ENVIRONMENT, SENTRY_TRACES_SAMPLE_RATE
```

### Railway env (scraper + bull-board services)

```
UPSTASH_REDIS_URL         <same instance as the api>         # required
SPECTER_API_URL           https://<api>.railway.app          # result callback
# Proxies/CAPTCHA as needed: PROXY_DATACENTER_URL, PROXY_RESIDENTIAL_URL, TWOCAPTCHA_API_KEY
# bull-board service ONLY:
BULL_BOARD_USER           ops
BULL_BOARD_PASS           <strong password>                  # fails closed if unset
```

---

## Vercel (specter-web) — env from CLAUDE.md

```
NEXT_PUBLIC_SUPABASE_URL        https://<proj>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   <anon key>
NEXT_PUBLIC_API_URL             https://<api>.railway.app
NEXT_PUBLIC_POSTHOG_KEY         phc_…                         # analytics
NEXT_PUBLIC_RAZORPAY_KEY_ID     rzp_…                         # checkout
NEXT_PUBLIC_SENTRY_DSN          <Sentry web project DSN>      # error tracking
# Build-time source maps (optional, all three needed): SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN
```

`NEXT_PUBLIC_PREVIEW` must be **unset/0** in production.

---

## Success-criteria verification (run after deploy)

1. **API health** — both Postgres + Redis up:
   ```bash
   curl https://<api>.railway.app/health
   # → {"status":"ok","db":"ok","redis":"ok"}   (503 + the down dep if either fails)
   ```
2. **Web up**:
   ```bash
   curl -I https://<web>.vercel.app          # → HTTP/2 200
   ```
3. **Bull Board** — shows probe / http / playwright / captcha / dead-letter /
   validation-errors / ai-errors:
   ```bash
   curl -u "$BULL_BOARD_USER:$BULL_BOARD_PASS" https://<bull-board>.railway.app/ops/queues
   # 401 without credentials; the dashboard HTML with them.
   ```
4. **Sentry test event** — temporarily add a dev route that raises (e.g.
   `1/0`), deploy, hit it, confirm the event lands in Sentry tagged with the
   environment, **then remove the route**. Authenticated requests carry the
   `merchant_id` tag automatically.
5. **PostHog** — sign in on the dashboard, confirm an `$identify` for the
   Supabase user and that subsequent events carry a `merchant_id` property.

---

## Notes

- `/health` deliberately checks dependencies, not just process liveness, so
  Railway pulls an instance that lost its DB/Redis out of rotation.
- Sentry and PostHog are both **no-ops without their keys**, so preview/staging
  builds need no observability config and never emit noise.
- Bull Board, scraper workers, and the API are separate services so an ops UI
  restart or a worker crash never takes down the API.
