# SPECTER — User Flow

## Flow 1: Organic Discovery → Trial
1. User googles "amazon fba fee calculator"
2. Lands on /tools/amazon-fba-calculator
3. Uses calculator, sees SPECTER CTA at bottom
4. Clicks "Track prices automatically" → /sign-up
5. Completes Supabase signup (email or Google)
6. Redirected to onboarding → /settings
7. Connects Shopify store (OAuth)
8. Adds first competitor URL on /competitors
9. Sees first signal on /signals within 1hr (CIPHER) or 6hr (RECON)
10. Trial active for 14 days

## Flow 2: Trial → Paid
1. Day 12: receives "Trial ends in 2 days" email (Resend)
2. Clicks upgrade CTA in email → /settings/billing
3. Selects RECON or CIPHER plan
4. Razorpay payment modal
5. Subscription activated

## Flow 3: RECON → CIPHER Upgrade
1. User on /signals sees "Auto-reprice locked" badge on RAISE signal
2. Clicks "Unlock auto-reprice" → upgrade modal
3. Pays via Razorpay
4. Plan updated in DB via webhook → /repricing unlocked

## Flow 4: OOS Alert → Price Change
1. Competitor goes OOS
2. BullMQ scrape job detects in_stock: false
3. oos_alerts row created
4. Resend email sent within 2min
5. User clicks email link → /repricing (CIPHER+) or /alerts (RECON)
6. CIPHER+: auto-reprice fires automatically if enabled
7. RECON: user manually raises price on Shopify

## Flow 5: Waitlist (pre-launch)
1. Visitor on homepage, SaaS not live yet
2. Enters email in hero CTA or final CTA
3. Email saved to waitlist table (or Resend audience)
4. Confirmation email sent
5. Notified when SaaS launches

---

## PLG Free-Tool & Freemium Flows (2026-05-30)
> Design: `docs/superpowers/specs/2026-05-30-free-tools-plg-redesign-design.md`.
> Plan key for the free tier is `free` (user-facing "Free") — NOT the legacy "SCOUT" name (now RECON).

## Flow 6: Free-Tool Earned-Value Journey (anonymous → email)
1. Visitor lands on `/tools/<tool>` from organic search (still public + crawlable)
2. **Quick Answer** is visible above the fold (AEO); visitor reads the 1-sentence answer
3. Visitor fills ≤4 visible inputs (advanced inputs collapsed behind "Advanced options")
4. **THE ANSWER** renders — 1 hero verdict + "What this means" + "Do this next"
5. Visitor expands "See full breakdown" to view supporting metrics/charts (all already in DOM)
6. **Earned-value trigger fires** (Layer-1 email unlock): only after the visitor has a result worth saving
   - Value-first ask: "Email me this report + save my inputs" (CSV / scenario save / saved history)
   - No dark pattern: the on-page result stays fully visible whether or not they give email
7. Visitor enters email → FREE account auto-created (`plan='free'`), report emailed, inputs saved
8. **Layer-2 locked section** previews market intelligence (blurred) with a named-tier CTA (e.g. CIPHER)

## Flow 7: Email Capture → Free Dashboard Workspace
1. Email captured in Flow 6 (or via any tool) provisions a `free` Supabase account
2. Welcome email links to the dashboard **Tools** tab (no Shopify connection required)
3. User signs in → lands on dashboard; **Tools** tab is fully usable (same calculators as `/tools/*`)
4. Saved calculations from the public tool appear in the Tools tab history (`saved_calculations`)
5. Platform tabs (Signals / Competitors / Alerts / Repricing / Attribution) render preview/demo-data
   state with "Upgrade to unlock" — persistent feature awareness on every login
6. **PQL trigger:** repeated tool usage / save frequency surfaces an in-workspace "Start free trial" upsell

## Flow 8: Free → Trial → Paid (PQL upsell)
1. `free` user hits a value moment (e.g. 3rd saved calculation, or opens a locked platform tab)
2. In-workspace upsell: "Connect your store — start a 14-day trial of RECON"
3. User clicks → onboarding (Shopify OAuth) → `plan='recon'` + `trial_ends_at` set
4. Trial proceeds per Flow 1 (first signal, etc.); converts via Flow 2

## Flow 9: Post-Trial Fallback (trial → free, not lockout)
1. Trial expires without payment
2. Trial-expiry job sets `plan='free'` (replaces the legacy read-only 402 lockout)
3. User retains full access to the Tools tab + saved calculations; scraped/platform data goes
   back to preview/demo state
4. Nurture sequence + locked-tab awareness continue driving re-conversion (no hard wall, no data loss)
