// 7-day email nurture sequence spec.
// Each entry is a template definition. Actual sending is handled by your
// email provider (Resend, Klaviyo, etc.) triggered from /api/email-capture.

export interface NurtureEmail {
  day: number
  subject: string
  preheader: string
  headline: string
  body: string
  cta_text: string
  cta_href: string
}

export const NURTURE_SEQUENCE: NurtureEmail[] = [
  {
    day: 0,
    subject: 'Your calculation is saved — plus 3 merchants who use SPECTER',
    preheader: 'Here\'s what they did differently.',
    headline: 'Your result is saved.',
    body: `We've saved your calculation. You can come back to it any time.

Here's how 3 merchants in your category use SPECTER differently:
• **Store A** caught a competitor drop at 2 AM — raised their price by morning, +$4,200 that week.
• **Store B** saw a competitor go OOS and raised price 12% for 3 days. $1,800 recovered.
• **Store C** uses the HOLD signal to resist price-war pressure. Margin up 3 pts in 90 days.

The difference isn't the data. It's getting it before the window closes.`,
    cta_text: 'Start free trial — first signal in 12 min',
    cta_href: 'https://specterapp.io/sign-up',
  },
  {
    day: 1,
    subject: 'The Nike OOS event — who made money',
    preheader: 'Hint: not the people checking manually.',
    headline: 'When Nike went OOS, two types of merchants existed.',
    body: `In Q4 last year, a major Nike SKU went out of stock on Amazon for 4 hours.

Type 1 (manual): Found out 6 hours later when checking their dashboard. Opportunity gone.

Type 2 (SPECTER): Alert fired at 11:43 AM. Price raised within minutes.
Average revenue recovered: $340 per merchant in those 4 hours.

OOS events happen 3–8 times per week in competitive categories.
How many are you catching?`,
    cta_text: 'Monitor competitors free for 14 days',
    cta_href: 'https://specterapp.io/sign-up',
  },
  {
    day: 3,
    subject: 'Your saved calculation vs. what live data shows',
    preheader: 'The gap is usually surprising.',
    headline: 'You calculated with 3 manual prices. Here\'s what live shows.',
    body: `When you used our tool, you entered competitor prices manually.

Here's the problem: on average, 2 of those 3 prices have changed since you entered them.

The gap between manual research and live data is typically:
• **1–3 price changes** per competitor per week in competitive categories
• **$0 to $200** revenue delta per SKU per week (depending on margin and volume)
• **12 minutes** — that's how fast SPECTER fires after a competitor changes price

Your manual calculation was accurate when you ran it.
But accuracy decays fast.`,
    cta_text: 'See live prices — 14-day free trial',
    cta_href: 'https://specterapp.io/sign-up',
  },
  {
    day: 5,
    subject: 'Your 14-day free trial is waiting. No CC.',
    preheader: 'Takes 10 minutes to set up.',
    headline: 'Ready when you are.',
    body: `Everything you need to start:

1. Connect your Shopify store (1-click OAuth)
2. Add 3 competitor URLs for your top SKU
3. Wait 12 minutes for your first signal

That's it. No CSV uploads. No configuration. No credit card.

RECON starts at $79/month after your 14-day trial — but most merchants see ROI in week 1 from a single RAISE signal.`,
    cta_text: 'Start free trial — 10 min setup',
    cta_href: 'https://specterapp.io/sign-up',
  },
  {
    day: 7,
    subject: 'Last nudge: first signal in 12 minutes',
    preheader: 'After this we\'ll leave you alone.',
    headline: 'One more time, then we\'ll stop.',
    body: `We've sent 4 emails. You haven't started a trial yet, which means one of three things:

1. **You're not ready** — totally fine. Your calculation is still saved.
2. **You have a question** — reply to this email. We answer everything within 1 hour.
3. **You forgot** — here's your trial link one more time.

Average time to first signal: 12 minutes after install.
That's not marketing copy. That's the 30-day median across all active accounts.`,
    cta_text: 'Start now — first signal in 12 min',
    cta_href: 'https://specterapp.io/sign-up',
  },
  {
    day: 14,
    subject: 'The 1 pricing mistake 80% of Shopify merchants make',
    preheader: 'It costs $40–400/week. Most don\'t know.',
    headline: 'The silent margin drain.',
    body: `80% of Shopify merchants hold their price even when their cheapest competitor goes out of stock.

Why? They don't know it happened.

When Competitor A goes OOS, demand shifts to Competitor B and you.
That's your window to raise price 5–15% for 24–72 hours — without losing a single conversion.

The merchants catching these windows add $200–$2,000/month in margin.
The rest are leaving it on the table.

SPECTER sends an OOS alert within 2 minutes of detection.
14-day trial, no credit card, 10-minute setup.`,
    cta_text: 'Catch the next OOS window',
    cta_href: 'https://specterapp.io/sign-up',
  },
]

// ── Trigger conditions ──────────────────────────────────────────────────────

export const NURTURE_TRIGGERS = {
  // Standard sequence start
  email_captured: 'tool_email_captured',
  // Accelerate sequence if user returns to tool
  tool_revisit:   'tool_revisit_pre_trial',
} as const
