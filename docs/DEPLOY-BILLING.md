# Billing — Deployment Checklist

The billing code (subscribe / trial / upgrade / downgrade / cancel / add-ons +
webhook plan elevation) is fully wired and tested. But the revenue path only
*functions* once the production configuration below is in place — the code reads
all Razorpay credentials and plan ids at runtime, so a missing value fails
silently at request/webhook time, not at build or test time.

Work top-to-bottom. Nothing here is optional for a working checkout.

---

## 1. Razorpay dashboard (do this first — the env ids point at it)

1. **Create the subscription Plans** (Settings → Subscriptions → Plans) for each
   self-serve tier and cadence you sell. Note each generated `plan_...` id.
   - RECON monthly, RECON annual
   - CIPHER monthly, CIPHER annual
   - PHANTOM monthly, PHANTOM annual
   - PREDATOR monthly, PREDATOR annual *(if sold self-serve)*
   - Add-ons: 50-SKU, 100-SKU, speed (RECON / CIPHER / PHANTOM)
2. **Register the webhook** (Settings → Webhooks):
   - URL: `https://<specter-api-host>/billing/webhook`
   - Secret: generate a strong value — this is `RAZORPAY_WEBHOOK_SECRET` below.
   - Active events (all three are required): `subscription.activated`,
     `subscription.charged`, `subscription.cancelled`.
     - `activated` / `charged` → elevate the plan and stamp the renewal date.
     - `cancelled` → drop to free at period end.
3. **Rotate the key secret** that was previously exposed in version control
   (`rzp_live_…` / `ze7xXdWi…`). Generate a fresh API key pair and use the new
   secret below. Treat the old one as compromised.

## 2. specter-api env (Railway)

| Var | Required | Notes |
|-----|----------|-------|
| `RAZORPAY_KEY_ID` | ✅ | Publishable key id (also goes to the frontend, see §3). |
| `RAZORPAY_KEY_SECRET` | ✅ | **Newly rotated** secret. Server-only. Unset ⇒ `create_subscription` → 502. |
| `RAZORPAY_WEBHOOK_SECRET` | ✅ | **Highest-risk item.** Verification fails closed: if empty, EVERY webhook is rejected, so no payment ever elevates a plan — users pay and stay on `free`. |
| `RAZORPAY_PLAN_RECON_MONTHLY` | ✅ | Plan id from §1. Unset ⇒ `/billing/subscribe` → 500 `plan_not_configured`. |
| `RAZORPAY_PLAN_RECON_ANNUAL` | ✅ | |
| `RAZORPAY_PLAN_CIPHER_MONTHLY` | ✅ | |
| `RAZORPAY_PLAN_CIPHER_ANNUAL` | ✅ | |
| `RAZORPAY_PLAN_PHANTOM_MONTHLY` | ✅ | |
| `RAZORPAY_PLAN_PHANTOM_ANNUAL` | ✅ | |
| `RAZORPAY_PLAN_PREDATOR_MONTHLY` | ⬜ | Only if PREDATOR is sold self-serve. |
| `RAZORPAY_PLAN_PREDATOR_ANNUAL` | ⬜ | |
| `RAZORPAY_PLAN_ADDON_50SKU` | ⬜ | Required only if you offer that add-on. |
| `RAZORPAY_PLAN_ADDON_100SKU` | ⬜ | |
| `RAZORPAY_PLAN_ADDON_SPEED_RECON` | ⬜ | |
| `RAZORPAY_PLAN_ADDON_SPEED_CIPHER` | ⬜ | |
| `RAZORPAY_PLAN_ADDON_SPEED_PHANTOM` | ⬜ | |
| `TRIAL_MONITOR_SECRET` | ✅ | Shared secret for the trial-expiry cron (see §5). |

## 3. specter-web env (Vercel)

| Var | Required | Notes |
|-----|----------|-------|
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | ✅ | Same value as the API's `RAZORPAY_KEY_ID`. Without it, checkout silently falls back to the hosted `short_url` page (no embedded modal). Publishable — safe to expose. |

## 4. Database migration

Apply the Alembic migration that adds the subscription-period columns:

```bash
cd specter-api && alembic upgrade head    # includes 0012_subscription_periods
```

Or apply the Supabase SQL mirror if you provision schema there. Confirm
`merchants.subscription_current_end` and `merchants.subscription_cancel_at`
exist after deploy.

## 5. Trial expiry + reminder cron

`services/trial_monitor.run_trial_monitor` downgrades lapsed RECON trials to
`free` and sends the day-12 / day-14 conversion emails. It is exposed at
`POST /internal/run-trial-monitor` (HMAC-guarded by `TRIAL_MONITOR_SECRET`).
**It must be triggered on a daily schedule or trials never expire and reminder
emails never send.**

Set up a daily Railway cron (or any scheduler) that calls it — see
`specter-api/CRON.md` for the exact command and signing.

---

## Post-deploy verification (run once, in order)

1. **New signup lands on free.** Sign up a fresh account → `GET /merchants/me`
   shows `"plan": "free"`.
2. **Trial.** Click "Start 14-day trial" → `plan` becomes `recon`,
   `trial_ends_at` ~14 days out.
3. **Subscribe (test card).** From a free/trial account, buy a self-serve plan.
   The embedded modal should open (proves `NEXT_PUBLIC_RAZORPAY_KEY_ID`). Pay
   with a Razorpay test card.
4. **Webhook elevation.** `/billing/success` should finish "Finalizing…" and
   route to the dashboard on the purchased plan within a few seconds (proves
   `RAZORPAY_WEBHOOK_SECRET` + event registration). In Razorpay → Webhooks,
   confirm the delivery returned `200`. If it sticks on "Finalizing" forever,
   the webhook secret or registration is wrong.
5. **Renewal date renders.** Settings → Billing shows "Next renewal: <date>"
   (proves `current_end` was stamped from the activation webhook).
6. **Upgrade.** recon→cipher: a new subscription is created and the *old* one is
   cancelled in the Razorpay dashboard (no double-billing).
7. **Cancel.** "Cancel subscription" → "Cancels on <date>". After Razorpay fires
   `subscription.cancelled` (or via a test event), the merchant drops to `free`.
8. **Trial expiry.** Trigger `POST /internal/run-trial-monitor` manually once and
   confirm a lapsed trial account flips back to `free`.
