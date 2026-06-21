# SPECTER Email — Resend setup & operator checklist

This is everything **you** must do on the Resend / Supabase / DNS dashboards. The
code side (sending service, templates, triggers) is already built and tested.

---

## What the code already does
- `specter-api/services/email.py` sends all **app-driven alert** mail via Resend:
  product-signal (RAISE/LOWER + restock), OOS, scrape-failed, domain-blocked,
  trial reminders, ops alerts. Central entry point: `send_email(template, to, data)`.
- Auth mail (**account confirmation, password reset**) is sent by **Supabase**,
  which we route through Resend via SMTP (below) so it ships from your domain.
- Env vars used: `RESEND_API_KEY`, `RESEND_FROM` (default `SPECTER <alerts@specterapp.io>`),
  `DASHBOARD_URL`, optional `RESEND_UNSUBSCRIBE_MAILTO`.

---

## 1. Verify your sending domain in Resend (required)
1. Resend dashboard → **Domains → Add Domain** → enter `specterapp.io`
   (or a subdomain like `send.specterapp.io` — recommended to isolate reputation).
2. Resend shows a set of DNS records. Add **all** of them at your DNS provider exactly as shown:
   - **SPF** — a `TXT` record (`v=spf1 include:amazonses.com ~all` or as Resend specifies).
   - **DKIM** — the `TXT`/`CNAME` record(s) Resend generates (domain-specific keys).
   - **Return-Path / MX** — the `MX` record on the send subdomain Resend lists.
   - Copy them **verbatim from the dashboard** — they're account/region-specific, so don't hand-type.
3. Add a **DMARC** record (recommended): `TXT` on `_dmarc.specterapp.io` →
   `v=DMARC1; p=none; rua=mailto:dmarc@specterapp.io`.
4. Back in Resend, click **Verify**. Wait until the domain shows **Verified** (DNS can take up to ~1h).
5. Ensure `RESEND_FROM` uses an address on the verified domain, e.g.
   `SPECTER <alerts@specterapp.io>`. Set it in the specter-api environment (Railway).

## 2. Create the API key (required)
1. Resend → **API Keys → Create** (Sending access). Copy it once.
2. Set `RESEND_API_KEY` in specter-api's environment (Railway). (Rotate the one you pasted earlier in chat — treat it as compromised.)

## 3. Route Supabase auth emails through Resend (SMTP)
Your chosen approach. Supabase keeps owning auth/security; mail ships via Resend.
1. Supabase → **Project Settings → Authentication → SMTP Settings → Enable Custom SMTP**.
2. Fill in:
   - **Host:** `smtp.resend.com`
   - **Port:** `465` (SSL) — or `587` (STARTTLS)
   - **Username:** `resend`
   - **Password:** a Resend **API key** (can reuse `RESEND_API_KEY` or make a dedicated SMTP key)
   - **Sender email:** `no-reply@specterapp.io` (must be on the verified domain)
   - **Sender name:** `SPECTER`
3. Supabase → **Authentication → Email Templates**:
   - **Confirm signup** → paste `docs/email/templates/account-confirmation.html`
   - **Reset password** → paste `docs/email/templates/password-reset.html`
   - (These use Supabase's `{{ .ConfirmationURL }}` variable — leave it intact.)
4. Set the redirect URLs (Authentication → URL Configuration) to your app domain so
   `{{ .ConfirmationURL }}` lands back in the app.

## 4. (Optional) Newsletter capture
The footer capture uses a Resend **Audience** (`specter-web/lib/email/resend.ts`).
If you want it live, create an Audience in Resend and set `RESEND_AUDIENCE_ID`
(+ `RESEND_API_KEY`) in the specter-web environment.

---

## 5. Send real test emails (verify rendering & delivery)
Backend alert templates — run from `specter-api/` with the live key set:

```bash
# one email per backend template to a real inbox (or Resend's sandbox)
RESEND_API_KEY=re_xxx python scripts/send_test_email.py you@example.com
```
- Use a real Gmail address to check Gmail + the Gmail mobile app rendering.
- `delivered@resend.dev` is Resend's sandbox sink if you don't want a real inbox.

Auth templates: trigger them through the app once SMTP is configured —
sign up with a test email (confirmation) and use "Forgot password" (reset).

Visual previews without sending (already generated):
`docs/email/previews/*.html` — open in a browser. Regenerate with
`python scripts/render_email_previews.py`.

---

## 6. Failure-handling behaviour (already built — for your awareness)
- Missing/invalid `RESEND_API_KEY` → send is skipped/returns False and **logs**; the
  triggering action (signup, scrape, signal) still succeeds. Nothing crashes.
- Transient 5xx / network errors → **retried** up to 3 attempts with backoff; 4xx is
  terminal (no pointless retries).
- Every attempt is logged (`specter.email` logger): `info` on success, `warning`
  on transient, `error` on terminal failure.
- Alert emails carry a `List-Unsubscribe` header + a Settings preferences link;
  transactional auth emails (Supabase) intentionally do not.
