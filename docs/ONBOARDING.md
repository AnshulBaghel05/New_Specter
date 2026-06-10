# SPECTER — Onboarding & Lifecycle Nurture

> Design: `docs/superpowers/specs/2026-05-30-free-tools-plg-redesign-design.md`.
> Companion docs: [USERFLOW](USERFLOW.md) (journeys), [MONETIZATION](MONETIZATION.md) (gates), [GROWTH](GROWTH.md) (loops).

This doc defines the beginner-first onboarding and the email lifecycle that moves a user
**anonymous tool visitor → FREE account → trial → paid**, without dark patterns and without
making the free tools useless.

## Audience & Principles
- **Audience:** Shopify/WooCommerce merchants, often non-technical, time-poor, skeptical of "another tool".
- **Tone:** plain English, outcome-led ("recover margin", "catch competitors going OOS"), no jargon walls.
- **Trust:** every email is honest about what the product does and does not do; one-click unsubscribe; no fake urgency.
- **Value-first:** each lifecycle touch leads with a useful insight (their own result, a benchmark, a tip) before any upsell.

---

## 1. Activation Moments
A user is **activated** at the first moment they receive value. Track these as PostHog events.

| Stage | Activation moment | Event |
|-------|-------------------|-------|
| Anonymous | Sees THE ANSWER on a tool | `tool_result_viewed` |
| FREE | Email captured + report saved | `free_account_created` |
| FREE | Returns and re-uses a tool (2nd session) | `tool_reused` |
| FREE | Saves ≥3 calculations OR opens a locked platform tab | `pql_qualified` |
| Trial | Connects Shopify + sees first signal | `trial_activated` |
| Paid | Subscription active | `subscription_started` |

The **PQL trigger** (`pql_qualified`) is the single most important signal for the upsell engine.

---

## 2. First-Run Experience (FREE account)
Goal: get a brand-new FREE user to a second "aha" inside 60 seconds of first dashboard login.

1. **Welcome state** on the dashboard **Tools** tab (not an empty platform dashboard):
   - "Your saved reports" populated with the calculation that captured their email.
   - One-line orientation: "These tools are yours free. Connect your store to unlock live monitoring."
2. **No forced Shopify connection.** The connect-store CTA is present but skippable.
3. **Locked platform tabs** show a demo-data preview (not a blank/403 wall) so the user understands
   what they'd get by upgrading — feature awareness, not friction.
4. **Next-best-action card:** suggests the most relevant *other* free tool based on the one they used
   (e.g. used FBA Calculator → suggest ROAS Calculator).

Acceptance: a FREE user can reach a saved report and a second tool without connecting a store or paying.

---

## 3. Email Lifecycle — 7-Day Nurture (FREE, no trial yet)
Sent via Resend. Each email is value-first; the upsell is secondary and honest.
Stop the sequence immediately on `trial_activated` or unsubscribe.

| Day | Email | Primary value | Secondary CTA |
|-----|-------|---------------|---------------|
| 0 | **Your report is ready** | Their saved result + "what this means / do this next" | "Use another free tool" |
| 1 | **The number most merchants miss** | Educational: the hidden-cost insight behind the tool they used | Link back to dashboard Tools tab |
| 3 | **See where you rank** | Benchmark/challenge framing ("your store vs typical") + referral nudge ("share your result") | "Connect your store to track this live" |
| 5 | **What live monitoring looks like** | Concrete example of a RAISE/LOWER signal + OOS catch | "Start 14-day trial of RECON" |
| 7 | **Still useful even if you never upgrade** | Reassurance: the free tools stay free; recap of saved reports | Soft trial CTA |

**Enhanced-insight emails** (event-triggered, not on the calendar):
- On `tool_reused`: "You ran the numbers again — here's a tip to push margin further."
- On `pql_qualified`: "You're getting a lot from the tools — here's what connecting your store adds." (strongest, but still framed as their choice)

---

## 4. Trial Nurture (plan='recon', trial_ends_at set)
Reuses the existing trial emails (see [USERFLOW](USERFLOW.md) Flow 2), with onboarding reinforcement:

| Trigger | Email |
|---------|-------|
| Trial start | "Connect complete — first signal incoming" + what to expect + latency badge |
| First signal generated | "Your first signal is live" (deep link to /signals) |
| Day 12 | "Trial ends in 2 days" → /settings/billing |
| No first signal by Day 2 | Recovery: "Add a competitor URL to see your first signal" (re-engagement) |

---

## 5. Post-Trial → FREE Fallback Nurture
When a trial expires without payment, the user **downgrades to `free`** (never read-only lockout; see
[USERFLOW](USERFLOW.md) Flow 9). Tools + saved calculations remain fully accessible.

| Trigger | Email |
|---------|-------|
| Trial expired | "Your trial ended — your free tools are still here" (no data loss; recap what they keep) |
| +7 days, still FREE | "Here's what you saw during your trial" (replay the value: signals caught, margin flagged) |
| `pql_qualified` again | Re-offer trial/paid with the specific outcome that re-engaged them |

---

## 6. Referral & Virality Hooks
Woven into the nurture (not a separate blast); see [GROWTH](GROWTH.md).
- **Day 3 + post-save:** "Share your result" → per-result OG image / challenge link.
- Shared link drives a new anonymous visitor into **Flow 6**, closing the loop.

---

## 7. Measurement
Funnel (PostHog): `tool_result_viewed → free_account_created → tool_reused → pql_qualified → trial_activated → subscription_started`.

Key onboarding KPIs:
- FREE-account activation rate (email capture / tool result viewed)
- FREE→PQL rate (`pql_qualified` / `free_account_created`)
- PQL→trial rate, trial→paid rate
- Post-trial→free retention (still active in Tools tab 14 days after downgrade)
- Nurture unsubscribe rate (guardrail: keep low — signals dark-pattern drift)

Out of scope here: the gate mechanics themselves (MONETIZATION.md) and the tool render skeleton (WEBSITE.md).
