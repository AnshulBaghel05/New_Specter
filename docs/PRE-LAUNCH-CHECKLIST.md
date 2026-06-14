# SPECTER — Pre-Launch Checklist (Prompt 18)

Verify all 7 items before sending the first beta invite. Items marked
**code-verified** were confirmed in source during Prompt 18; their **live**
check still requires the deployed production environment (credentials +
running services), which cannot be exercised from the repo alone.

> Stack note: this project uses **Supabase** for auth (not Clerk) and **Resend**
> for transactional email. The checks below reflect the real stack.

Set these once for the commands below:

```bash
export API_URL="https://<your-specter-api>.up.railway.app"
export WEB_URL="https://<your-specter-web>.vercel.app"
```

---

## 1. `GET /health` returns 200
- **Code-verified:** `routers/health.py` returns `{"status":"ok"}` with HTTP 200 only when both DB and Redis are reachable; otherwise 503 (`status:"degraded"`).
- **Live check:**
  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' "$API_URL/health"   # expect: 200
  curl -s "$API_URL/health" | jq                                # expect: db:"ok", redis:"ok"
  ```
- [ ] 200 confirmed against production

## 2. Sentry receiving production events
- **Code-verified:** API `observability.init_sentry()` runs before app build (`main.py`); web `instrumentation.ts` + `@sentry/nextjs` configured; DSNs read from `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`.
- **Live check:** confirm `SENTRY_DSN` is set on Railway and `NEXT_PUBLIC_SENTRY_DSN` on Vercel, then trigger one error and confirm it lands in the Sentry project (Issues view, `environment: production`).
- [ ] At least one production event visible in Sentry

## 3. At least 1 Playwright scrape completed end-to-end
- **Code-verified:** `scraper/workers/playwright.ts` consumes `scrape:playwright`; probe routes JS-required pages to it; result POSTs to `/internal/price-snapshot` (HMAC-signed).
- **Live check:** add a competitor URL for a JS-rendered store (or enqueue a probe), watch the job traverse `scrape:probe → scrape:playwright` in Bull Board, then confirm a row landed:
  ```sql
  SELECT id, competitor_url_id, price, scraped_at
  FROM price_snapshots ORDER BY scraped_at DESC LIMIT 5;
  ```
- [ ] One Playwright-sourced snapshot persisted

## 4. At least 1 signal generated from a real price_snapshot
- **Code-verified:** ingest advances the per-merchant cycle and calls `generate_cycle_signals` (`routers/internal.py`); signals are exposed at `GET /signals`.
- **Live check:** after a full scrape cycle for a tracked SKU:
  ```sql
  SELECT id, sku_id, type, confidence, created_at
  FROM signals ORDER BY created_at DESC LIMIT 5;
  ```
  or hit `GET /signals` as a logged-in merchant.
- [ ] One RAISE/LOWER/HOLD signal produced from real data

## 5. Razorpay `subscription.activated` webhook processed correctly
- **Code-verified:** `POST /billing/webhook` verifies the `X-Razorpay-Signature` HMAC (`services/billing.verify_webhook_signature`) and `_apply_activation` sets `merchant.plan`, clears trial, sets `subscription_current_end` (`routers/billing.py`).
- **Live check (Razorpay Test Mode):** start a self-serve subscription, complete test payment, confirm Razorpay delivers `subscription.activated` (Dashboard → Webhooks → recent deliveries = 2xx) and the merchant's `plan` elevated:
  ```sql
  SELECT id, plan, razorpay_subscription_id, subscription_current_end FROM merchants WHERE id = '<merchant>';
  ```
- [ ] Activation webhook returns 200 and elevates the plan

## 6. Resend OOS email delivered to a test inbox
- **Code-verified:** `services/email.py` posts to `https://api.resend.com/emails` using `RESEND_API_KEY` / `RESEND_FROM`; OOS detection triggers the send (skipped with a warning if the key is unset).
- **Live check:** ensure `RESEND_API_KEY` + `RESEND_FROM` are set on Railway, trigger an OOS condition for a tracked competitor URL, and confirm the email arrives at the test inbox (and shows delivered in the Resend dashboard).
- [ ] OOS email received in test inbox

## 7. Supabase sign-up → /dashboard full flow works end-to-end
- **Code-verified:** `app/(auth)/sign-up` → Supabase `signUp` → `/auth/callback` `exchangeCodeForSession`; `middleware.ts` guards `/dashboard` and redirects authed users there; first API call auto-creates a `plan='free'` merchant (`auth/supabase.py`).
- **Live check:** sign up a fresh email on `$WEB_URL/sign-up`, confirm the email, land on `/dashboard`, and verify the dashboard loads (Workspace for a free account) with no 401s.
- [ ] New user reaches /dashboard with a working session

---

### Automated portion
`scripts/prelaunch-check.sh` checks item 1 automatically against `$API_URL` and
prints the guided steps for items 2–7 (which need credentials / interactive
actions / external dashboards).
