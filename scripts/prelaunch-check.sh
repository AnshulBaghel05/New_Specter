#!/usr/bin/env bash
# SPECTER pre-launch check — automates item 1 (health) and lists the guided
# manual steps for items 2–7 (which require credentials / external dashboards).
#
# Usage:  API_URL=https://your-api.up.railway.app ./scripts/prelaunch-check.sh
set -u

API_URL="${API_URL:-}"
fail=0

echo "── SPECTER pre-launch check ───────────────────────────────────────────"

# 1. GET /health → 200
if [ -z "$API_URL" ]; then
  echo "1. /health        SKIP   (set API_URL to run this check)"
  fail=1
else
  code="$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/health" || echo 000)"
  if [ "$code" = "200" ]; then
    echo "1. /health        PASS   ($API_URL/health → 200)"
  else
    echo "1. /health        FAIL   ($API_URL/health → $code, expected 200)"
    fail=1
  fi
fi

# 2–7 require live infra / dashboards / interactive flows — print the steps.
cat <<'STEPS'
2. Sentry          MANUAL  trigger one prod error → appears in Sentry (env=production)
3. Playwright      MANUAL  enqueue a JS-required scrape → new row in price_snapshots
4. Signal          MANUAL  after a cycle → new row in signals / GET /signals
5. Razorpay        MANUAL  test-mode subscribe → subscription.activated webhook 200 → plan elevated
6. Resend OOS      MANUAL  trigger OOS → email arrives in test inbox (Resend = delivered)
7. Supabase auth   MANUAL  sign up fresh email → confirm → lands on /dashboard, no 401s

See docs/PRE-LAUNCH-CHECKLIST.md for the exact command / SQL for each.
STEPS

echo "───────────────────────────────────────────────────────────────────────"
[ "$fail" = "0" ] && echo "Automated checks passed." || echo "Automated checks incomplete (see above)."
exit "$fail"
