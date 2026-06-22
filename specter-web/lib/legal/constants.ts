/**
 * Single source of truth for every legal page (Terms, Privacy, Cookie, Refund,
 * AUP, DPA, Security, Subprocessors, AI Disclosure, Scraping Policy, Enterprise).
 *
 * Keeping dates, contacts, the subprocessor list, and plan facts here is what
 * keeps the documents internally consistent — a change to a subprocessor or an
 * effective date propagates to every page that imports it, so the pages can
 * never silently contradict each other.
 *
 * NOTE FOR THE OPERATOR (pre-launch fill-ins): SPECTER is referred to throughout
 * as an operating name. Before onboarding enterprise or EU customers you should
 * insert (a) the registered legal entity name, (b) a postal/registered-office
 * address, and (c) a named court seat/city for the governing-law clause. These
 * are intentionally NOT invented here.
 */

export const LEGAL_UPDATED = 'June 22, 2026'
export const LEGAL_UPDATED_ISO = '2026-06-22'
export const LEGAL_EFFECTIVE = 'June 22, 2026'
export const LEGAL_EFFECTIVE_ISO = '2026-06-22'

export const LEGAL_DOMAIN = 'specterapp.io'
export const GOVERNING_LAW = 'India'

export const LEGAL_EMAILS = {
  legal: 'legal@specterapp.io',
  privacy: 'privacy@specterapp.io',
  security: 'security@specterapp.io',
  support: 'support@specterapp.io',
  dpo: 'privacy@specterapp.io',
  hello: 'hello@specterapp.io',
  abuse: 'abuse@specterapp.io',
} as const

/** Plan tiers, exactly as enforced server-side in specter-api (auth/plan_gate.py). */
export const PLAN_TIERS = ['FREE', 'RECON', 'CIPHER', 'PHANTOM', 'PREDATOR', 'ECLIPSE'] as const

/** Feature → minimum plan, mirroring the server gate so docs never overstate access. */
export const PLAN_FACTS = {
  autoRepriceMinPlan: 'CIPHER',
  attributionMinPlan: 'PHANTOM',
  trialDays: 14,
  failedPaymentRetries: 3,
  failedPaymentWindowDays: 7,
  refreshIntervalLabel: '1–6 hours (plan-dependent)',
  priceHistory: '30 days (RECON), 60 days (CIPHER / PHANTOM), 90 days (PREDATOR and ECLIPSE)',
} as const

export interface Subprocessor {
  name: string
  purpose: string
  data: string
  location: string
  transfer: string
}

/**
 * The ACTUAL third-party processors SPECTER relies on, verified against the
 * codebase (main.py observability, billing webhook, services/email.py,
 * services/crypto.py, lib/analytics.ts). Stripe is intentionally absent — the
 * platform processes payments through Razorpay.
 */
export const SUBPROCESSORS: Subprocessor[] = [
  {
    name: 'Supabase',
    purpose: 'Authentication, session management, and primary PostgreSQL database',
    data: 'Email, name, password hash (managed by Supabase), account data, store data, competitor URLs, price history, signals',
    location: 'United States',
    transfer: 'Standard Contractual Clauses (SCCs)',
  },
  {
    name: 'Vercel',
    purpose: 'Hosting and global CDN for the web application (specterapp.io)',
    data: 'IP addresses, request/edge logs',
    location: 'United States / global edge',
    transfer: 'Standard Contractual Clauses (SCCs)',
  },
  {
    name: 'Railway',
    purpose: 'Hosting for the API and the competitor-scraping service',
    data: 'Competitor URLs, scrape job state, application logs',
    location: 'United States',
    transfer: 'Standard Contractual Clauses (SCCs)',
  },
  {
    name: 'Upstash',
    purpose: 'Redis — rate limiting, job queues, and scrape-cycle coordination',
    data: 'Transient job and rate-limit state',
    location: 'United States / EU (region-configurable)',
    transfer: 'Standard Contractual Clauses (SCCs)',
  },
  {
    name: 'Google (Gemini API)',
    purpose: 'AI generation of RAISE / LOWER / HOLD pricing signals and suggestions',
    data: 'Your product titles and the competitor prices/availability collected for your account (no end-consumer personal data)',
    location: 'United States / global',
    transfer: 'Standard Contractual Clauses (SCCs)',
  },
  {
    name: 'PostHog',
    purpose: 'Product analytics (explicit events; autocapture disabled)',
    data: 'Pseudonymised usage events, user/merchant identifiers, IP address',
    location: 'United States (US Cloud — app.posthog.com)',
    transfer: 'Standard Contractual Clauses (SCCs)',
  },
  {
    name: 'Sentry',
    purpose: 'Error and performance monitoring (diagnostics)',
    data: 'Error events: stack traces, request metadata, IP address, and any user identifier attached to the event',
    location: 'United States',
    transfer: 'Standard Contractual Clauses (SCCs)',
  },
  {
    name: 'Razorpay',
    purpose: 'Payment processing and subscription management',
    data: 'Billing email, plan tier, subscription status, payment tokens (no full card data reaches SPECTER)',
    location: 'India',
    transfer: 'Processed in India; governed by Razorpay’s terms and applicable law',
  },
  {
    name: 'Resend',
    purpose: 'Transactional and account email delivery',
    data: 'Recipient email address and email content',
    location: 'United States',
    transfer: 'Standard Contractual Clauses (SCCs)',
  },
]

/** Legal pages, used to render the footer + the cross-links on each legal page. */
export const LEGAL_PAGES: { label: string; href: string }[] = [
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Cookie Policy', href: '/cookies' },
  { label: 'Refund & Cancellation', href: '/refunds' },
  { label: 'Acceptable Use Policy', href: '/acceptable-use' },
  { label: 'Web Scraping Policy', href: '/scraping-policy' },
  { label: 'AI & Automated Decisions', href: '/ai-disclosure' },
  { label: 'Data Processing Addendum', href: '/dpa' },
  { label: 'Security & Trust', href: '/security' },
  { label: 'Subprocessors', href: '/subprocessors' },
  { label: 'Enterprise & Compliance', href: '/enterprise-compliance' },
]
