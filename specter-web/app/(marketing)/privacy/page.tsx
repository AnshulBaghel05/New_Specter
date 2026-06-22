import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/marketing/nav'
import Footer from '@/components/marketing/footer'
import { SUBPROCESSORS } from '@/lib/legal/constants'

export const metadata: Metadata = {
  title: 'Privacy Policy — SPECTER',
  description:
    'How SPECTER collects, uses, protects, and shares your personal information. GDPR and CCPA compliant.',
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: false },
}

const TOC = [
  { id: 'summary', label: 'Plain English Summary' },
  { id: 'who-we-are', label: 'Who We Are' },
  { id: 'what-we-collect', label: 'Information We Collect' },
  { id: 'legal-basis', label: 'Legal Basis (GDPR)' },
  { id: 'how-we-use', label: 'How We Use Your Data' },
  { id: 'sharing', label: 'Sharing & Sub-Processors' },
  { id: 'scraping', label: 'Web Scraping & Third-Party Data' },
  { id: 'retention', label: 'Data Retention' },
  { id: 'transfers', label: 'International Transfers' },
  { id: 'rights', label: 'Your Privacy Rights' },
  { id: 'security', label: 'Security' },
  { id: 'cookies', label: 'Cookies' },
  { id: 'children', label: "Children's Privacy" },
  { id: 'changes', label: 'Changes to This Policy' },
  { id: 'contact', label: 'Contact Us' },
]

function Section({
  id,
  num,
  title,
  children,
}: {
  id: string
  num: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-28 mb-12 pb-12 border-b border-border/50 last:border-0 last:mb-0">
      <div className="flex items-center gap-3 mb-5">
        <span className="font-mono text-[11px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
          {num}
        </span>
        <h2 className="font-display text-xl font-bold text-text">{title}</h2>
      </div>
      <div className="font-body text-muted leading-relaxed space-y-4 text-[15px]">{children}</div>
    </section>
  )
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 font-body text-sm text-muted leading-relaxed space-y-2">
      {children}
    </div>
  )
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left font-mono text-xs text-primary uppercase tracking-wider py-2.5 px-3 bg-surface border border-border/60">
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="py-2.5 px-3 font-body text-xs text-muted border border-border/40 leading-relaxed align-top">
      {children}
    </td>
  )
}

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-bg pt-28 pb-24 px-6">
        <div className="max-w-6xl mx-auto">

          {/* Page header */}
          <div className="mb-12">
            <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">Legal</p>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-text tracking-tight mb-3">
              Privacy Policy
            </h1>
            <p className="font-body text-sm text-muted">
              Last updated: <time dateTime="2026-05-27">May 27, 2026</time>
              {' · '}
              Effective date: <time dateTime="2026-05-27">May 27, 2026</time>
            </p>
          </div>

          <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-16">

            {/* ── Sticky ToC (desktop) ──────────────────────────────────── */}
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <p className="font-mono text-[11px] text-primary uppercase tracking-widest mb-4">
                  Contents
                </p>
                <nav className="space-y-1" aria-label="Privacy policy sections">
                  {TOC.map(({ id, label }) => (
                    <a
                      key={id}
                      href={`#${id}`}
                      className="block font-body text-xs text-muted hover:text-text py-1 transition-colors leading-snug"
                    >
                      {label}
                    </a>
                  ))}
                </nav>
                <div className="mt-8 pt-6 border-t border-border/50">
                  <p className="font-mono text-[11px] text-muted mb-2">Questions?</p>
                  <a
                    href="mailto:privacy@specterapp.io"
                    className="font-mono text-[11px] text-primary hover:underline"
                  >
                    privacy@specterapp.io
                  </a>
                </div>
              </div>
            </aside>

            {/* ── Content ──────────────────────────────────────────────── */}
            <div>

              <Section id="summary" num="00" title="Plain English Summary">
                <Callout>
                  <p><strong className="text-text">What we collect:</strong> Your email, name, and store connection info when you sign up. Usage analytics to improve the product. Payment info processed by Razorpay (we never see your full card). Nothing from free tool inputs.</p>
                  <p><strong className="text-text">What we don&apos;t do:</strong> We do not sell your data. We do not share your price intelligence data with other users. We do not store what you type into our free calculators.</p>
                  <p><strong className="text-text">Web scraping:</strong> When you add competitor URLs, we scrape those public pages on your behalf. We never scrape pages that require login credentials.</p>
                  <p><strong className="text-text">Your rights:</strong> You can access, correct, export, or delete your data at any time by emailing privacy@specterapp.io.</p>
                  <p><strong className="text-text">This is not a substitute</strong> for the full policy below. Please read the complete policy for all details.</p>
                </Callout>
              </Section>

              <Section id="who-we-are" num="01" title="Who We Are">
                <p>
                  SPECTER (&quot;SPECTER&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates the website at{' '}
                  <strong className="text-text">specterapp.io</strong> and the SPECTER competitor pricing
                  intelligence platform. SPECTER is a business-to-business (B2B) SaaS product
                  serving Shopify and WooCommerce merchants.
                </p>
                <p>
                  For the purposes of the General Data Protection Regulation (GDPR), SPECTER is
                  the <strong className="text-text">data controller</strong> for personal data collected
                  from users of our platform. For data processed on behalf of our customers in
                  connection with their use of the platform, SPECTER acts as a{' '}
                  <strong className="text-text">data processor</strong>.
                </p>
                <p>
                  As an India-based business, we also process personal data in accordance with India&apos;s
                  Digital Personal Data Protection Act, 2023 (&quot;DPDP Act&quot;). Where we process
                  personal data on behalf of business customers, that processing is governed by our{' '}
                  <Link href="/dpa" className="text-primary hover:underline">Data Processing Addendum</Link>.
                </p>
                <p>
                  Contact: <a href="mailto:privacy@specterapp.io" className="text-primary hover:underline">privacy@specterapp.io</a>
                </p>
              </Section>

              <Section id="what-we-collect" num="02" title="Information We Collect">
                <p>We collect only the information necessary to provide and improve SPECTER. Here is a complete breakdown:</p>

                <p><strong className="text-text">Account data</strong></p>
                <p>
                  When you create an account (via Supabase Auth), we collect your email address and,
                  optionally, your full name, company name, and profile photo. Your account credentials
                  are managed by Supabase and are not stored directly by SPECTER.
                </p>

                <p><strong className="text-text">Store connectivity data</strong></p>
                <p>
                  When you connect your Shopify or WooCommerce store, we collect your store domain,
                  the OAuth access token Shopify issues to us, and product catalog data (product titles,
                  SKUs, and current prices). We do not collect your customers&apos; personal data, order history,
                  or payment information from your store.
                </p>

                <p><strong className="text-text">Competitor URLs and scrape targets</strong></p>
                <p>
                  When you add competitor product URLs to monitor, we store those URLs and the pricing,
                  availability, and metadata we collect from them. This data is associated with your
                  account and is not shared with other SPECTER users.
                </p>

                <p><strong className="text-text">Usage data and analytics</strong></p>
                <p>
                  We collect product analytics via PostHog: pages visited, features used, session
                  duration, and general navigation patterns. This data is used to understand how
                  merchants use SPECTER and to prioritize product improvements. We do not use this
                  data for advertising.
                </p>

                <p><strong className="text-text">Payment data</strong></p>
                <p>
                  Payment processing is handled by Razorpay (and any additional payment processor we may
                  use in future). We receive and store only your billing email, plan tier, and
                  subscription status. SPECTER never sees or stores your full card number, CVC, or bank
                  details.
                </p>

                <p><strong className="text-text">Communications</strong></p>
                <p>
                  If you email us or submit a contact form, we retain that correspondence to respond
                  to you and to maintain a record of support interactions.
                </p>

                <p><strong className="text-text">Early access sign-ups</strong></p>
                <p>
                  If you submit your email for early access before the platform launches, we store
                  your email address to notify you of launch and relevant updates. You can opt out
                  at any time by replying to any email or contacting us.
                </p>

                <p><strong className="text-text">Free calculator tools</strong></p>
                <p>
                  Our six free calculator tools (Amazon FBA Calculator, Shopify Profit Calculator,
                  Shipping Calculator, Price Position Analyzer, ROAS Calculator, Inventory EOQ
                  Calculator) run entirely in your browser. <strong className="text-text">No inputs,
                  outputs, or usage are transmitted to or stored on our servers.</strong> These tools
                  work fully offline once the page is loaded.
                </p>
              </Section>

              <Section id="legal-basis" num="03" title="Legal Basis for Processing (GDPR)">
                <p>
                  If you are located in the European Economic Area (EEA) or United Kingdom, we process
                  your personal data on the following legal bases under GDPR Article 6:
                </p>
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Processing activity</Th>
                      <Th>Legal basis</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <Td>Creating and managing your account</Td>
                      <Td>Contract (Art. 6(1)(b)) — necessary to provide the service you requested</Td>
                    </tr>
                    <tr>
                      <Td>Processing subscription payments</Td>
                      <Td>Contract (Art. 6(1)(b))</Td>
                    </tr>
                    <tr>
                      <Td>Scraping competitor URLs you provide</Td>
                      <Td>Contract (Art. 6(1)(b)) — core service feature</Td>
                    </tr>
                    <tr>
                      <Td>Sending transactional emails (account alerts, price alerts)</Td>
                      <Td>Contract (Art. 6(1)(b))</Td>
                    </tr>
                    <tr>
                      <Td>Product analytics and usage tracking</Td>
                      <Td>Legitimate interests (Art. 6(1)(f)) — improving the product</Td>
                    </tr>
                    <tr>
                      <Td>Marketing emails to existing customers</Td>
                      <Td>Legitimate interests (Art. 6(1)(f)) — soft opt-in for related services</Td>
                    </tr>
                    <tr>
                      <Td>Early access waitlist emails</Td>
                      <Td>Consent (Art. 6(1)(a)) — you opted in by submitting your email</Td>
                    </tr>
                    <tr>
                      <Td>Compliance with legal obligations</Td>
                      <Td>Legal obligation (Art. 6(1)(c))</Td>
                    </tr>
                  </tbody>
                </TableWrap>
              </Section>

              <Section id="how-we-use" num="04" title="How We Use Your Information">
                <p>We use the information we collect to:</p>
                <ul className="list-none space-y-2 pl-0">
                  {[
                    'Provide, operate, and maintain the SPECTER platform',
                    'Process subscription payments and manage your billing',
                    'Connect to your Shopify or WooCommerce store and sync product data',
                    'Scrape competitor product pages you designate and generate pricing signals',
                    'Send price alert notifications, account emails, and transactional messages',
                    'Analyze usage patterns to improve features and fix bugs',
                    'Respond to your support requests and communications',
                    'Comply with legal obligations and enforce our Terms of Service',
                    'Detect and prevent fraud, abuse, and security incidents',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="w-1 h-1 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p>
                  <strong className="text-text">We do not sell your personal data.</strong> We do not use
                  your data for behavioural advertising. We do not share your price intelligence data
                  (competitor URLs, scraped prices, your own store prices) with any other SPECTER user
                  or third party, except as described in the Sub-Processors section below.
                </p>
              </Section>

              <Section id="sharing" num="05" title="Sharing Your Information & Sub-Processors">
                <p>
                  We share personal data only with the service providers (&quot;sub-processors&quot;) necessary
                  to operate SPECTER. All sub-processors are bound by data processing agreements
                  and are prohibited from using your data for their own purposes.
                </p>
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Sub-processor</Th>
                      <Th>Purpose</Th>
                      <Th>Data shared</Th>
                      <Th>Location</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {SUBPROCESSORS.map((s) => (
                      <tr key={`${s.name}-${s.purpose}`}>
                        <Td><strong className="text-text">{s.name}</strong></Td>
                        <Td>{s.purpose}</Td>
                        <Td>{s.data}</Td>
                        <Td>{s.location}</Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
                <p>
                  This list is maintained on our{' '}
                  <Link href="/subprocessors" className="text-primary hover:underline">Subprocessors</Link>{' '}
                  page, which always reflects our current providers and the transfer safeguards used.
                </p>
                <p>
                  We may also disclose personal data if required by law, court order, or governmental
                  authority, or to protect the rights, property, or safety of SPECTER, our users,
                  or the public.
                </p>
              </Section>

              <Section id="scraping" num="06" title="Web Scraping & Third-Party Data">
                <p>
                  A core feature of SPECTER is scraping publicly accessible competitor product
                  pages on your behalf. This section explains how that works and your responsibilities
                  as a user.
                </p>
                <p>
                  <strong className="text-text">User-directed scraping.</strong> When you add a competitor
                  product URL to SPECTER, you are explicitly instructing us to retrieve and monitor
                  that page. SPECTER acts as your agent in collecting this publicly available information.
                  You represent and warrant that the URLs you submit are publicly accessible product
                  pages that do not require authentication to view.
                </p>
                <p>
                  <strong className="text-text">What we scrape.</strong> We scrape only publicly visible
                  product data — prices, availability, titles, and descriptions — from the URLs you provide.
                  We do not scrape login-protected pages, checkout flows, or personal information about
                  end consumers on third-party sites.
                </p>
                <p>
                  <strong className="text-text">Scraped data is yours.</strong> Pricing data collected from
                  URLs you provide is associated exclusively with your account. We do not share or sell
                  your competitor monitoring data to other SPECTER users.
                </p>
                <p>
                  <strong className="text-text">Your responsibility.</strong> You are responsible for
                  ensuring that your use of SPECTER&apos;s scraping features complies with applicable
                  laws and the terms of service of any website you instruct us to scrape. SPECTER
                  is not liable for how you use the collected data. See our{' '}
                  <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
                  {' '}for full details.
                </p>
                <p>
                  <strong className="text-text">No continuity guarantee.</strong> Websites may block
                  scrapers, change their structure, or require login at any time. SPECTER does not
                  guarantee uninterrupted data collection.
                </p>
              </Section>

              <Section id="retention" num="07" title="Data Retention">
                <p>
                  We retain personal data for as long as necessary to provide the service and comply
                  with legal obligations. Here are our standard retention periods:
                </p>
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Data type</Th>
                      <Th>Retention period</Th>
                      <Th>Reason</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <Td>Account data (email, name)</Td>
                      <Td>Duration of account + 90 days after deletion</Td>
                      <Td>Account recovery window</Td>
                    </tr>
                    <tr>
                      <Td>Competitor price history</Td>
                      <Td>30 days (RECON), 60 days (CIPHER/PHANTOM), 90 days (PREDATOR+)</Td>
                      <Td>Per-plan limits</Td>
                    </tr>
                    <tr>
                      <Td>Shopify OAuth token</Td>
                      <Td>Until you disconnect your store or delete your account</Td>
                      <Td>Required for store sync</Td>
                    </tr>
                    <tr>
                      <Td>Payment records (Razorpay)</Td>
                      <Td>7 years</Td>
                      <Td>Tax and accounting compliance</Td>
                    </tr>
                    <tr>
                      <Td>Usage analytics</Td>
                      <Td>24 months</Td>
                      <Td>Product improvement</Td>
                    </tr>
                    <tr>
                      <Td>Support correspondence</Td>
                      <Td>3 years</Td>
                      <Td>Support history and dispute resolution</Td>
                    </tr>
                    <tr>
                      <Td>Early access email</Td>
                      <Td>Until you unsubscribe or 24 months of inactivity</Td>
                      <Td>Launch notification</Td>
                    </tr>
                  </tbody>
                </TableWrap>
                <p>
                  When you delete your account, we initiate deletion of your personal data from
                  our primary systems within 30 days, subject to legal retention requirements.
                  Backups may retain data for up to 90 additional days.
                </p>
              </Section>

              <Section id="transfers" num="08" title="International Data Transfers">
                <p>
                  SPECTER is based in India and our sub-processors are located in the United States and
                  India (our payment processor, Razorpay, processes payment data in India). If you are in
                  the European Economic Area (EEA), United Kingdom, or Switzerland, your personal data may
                  be transferred to countries that do not have an adequacy decision from the relevant
                  supervisory authority.
                </p>
                <p>
                  When we transfer EEA personal data to the United States or other third countries,
                  we rely on <strong className="text-text">Standard Contractual Clauses (SCCs)</strong>{' '}
                  approved by the European Commission, or other appropriate safeguards, to ensure
                  your data receives an equivalent level of protection.
                </p>
                <p>
                  You can request a copy of the appropriate safeguards we use by contacting{' '}
                  <a href="mailto:privacy@specterapp.io" className="text-primary hover:underline">
                    privacy@specterapp.io
                  </a>.
                </p>
              </Section>

              <Section id="rights" num="09" title="Your Privacy Rights">
                <p><strong className="text-text">Rights under GDPR (EEA / UK users)</strong></p>
                <p>If you are located in the EEA or UK, you have the following rights:</p>
                <ul className="list-none space-y-3 pl-0">
                  {[
                    { r: 'Right of access', d: 'Request a copy of all personal data we hold about you.' },
                    { r: 'Right to rectification', d: 'Request correction of inaccurate or incomplete data.' },
                    { r: 'Right to erasure ("right to be forgotten")', d: 'Request deletion of your personal data, subject to legal retention obligations.' },
                    { r: 'Right to data portability', d: 'Receive your data in a machine-readable format or have it transferred to another controller.' },
                    { r: 'Right to restriction', d: 'Request that we restrict processing of your data in certain circumstances.' },
                    { r: 'Right to object', d: 'Object to processing based on legitimate interests. We will stop unless we have compelling legitimate grounds.' },
                    { r: 'Right to withdraw consent', d: 'Where processing is based on consent, withdraw it at any time without affecting prior processing.' },
                    { r: 'Right to lodge a complaint', d: 'Lodge a complaint with your national supervisory authority (e.g., the ICO in the UK, CNIL in France).' },
                  ].map(({ r, d }) => (
                    <li key={r} className="flex items-start gap-2.5">
                      <span className="w-1 h-1 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span><strong className="text-text">{r}:</strong> {d}</span>
                    </li>
                  ))}
                </ul>

                <p className="mt-4"><strong className="text-text">Rights under CCPA (California residents)</strong></p>
                <p>If you are a California resident, the CCPA provides you with additional rights:</p>
                <ul className="list-none space-y-2 pl-0">
                  {[
                    'Right to know what personal information is collected, used, disclosed, or sold',
                    'Right to delete personal information we have collected',
                    'Right to opt out of the sale of personal information (note: we do not sell personal information)',
                    'Right to non-discrimination for exercising your privacy rights',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="w-1 h-1 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p>
                  <strong className="text-text">How to exercise your rights:</strong> Email{' '}
                  <a href="mailto:privacy@specterapp.io" className="text-primary hover:underline">
                    privacy@specterapp.io
                  </a>{' '}
                  with your request. We will respond within 30 days (GDPR) or 45 days (CCPA).
                  We may need to verify your identity before processing your request.
                </p>
              </Section>

              <Section id="security" num="10" title="Security">
                <p>
                  We take the security of your data seriously and implement appropriate technical
                  and organizational measures, including:
                </p>
                <ul className="list-none space-y-2 pl-0">
                  {[
                    'All data in transit encrypted via TLS 1.2 or higher',
                    'Data at rest encrypted in Supabase using AES-256',
                    'Authentication managed by Supabase Auth with bcrypt password hashing and support for MFA',
                    'Shopify OAuth tokens stored encrypted and scoped to minimum necessary permissions',
                    'Regular security reviews and dependency updates',
                    'Access to production data limited to authorized personnel only',
                    'No storage of payment card data — all payments processed through Razorpay\'s PCI DSS certified infrastructure',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="w-1 h-1 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p>
                  No method of transmission over the internet is 100% secure. If you believe
                  your account has been compromised, please contact us immediately at{' '}
                  <a href="mailto:support@specterapp.io" className="text-primary hover:underline">
                    support@specterapp.io
                  </a>.
                </p>
              </Section>

              <Section id="cookies" num="11" title="Cookies">
                <p>
                  We use cookies and similar tracking technologies on specterapp.io. Here is a
                  complete breakdown:
                </p>
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Cookie</Th>
                      <Th>Type</Th>
                      <Th>Purpose</Th>
                      <Th>Duration</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <Td>sb-access-token</Td>
                      <Td>Essential</Td>
                      <Td>Maintains your authenticated session</Td>
                      <Td>1 hour</Td>
                    </tr>
                    <tr>
                      <Td>sb-refresh-token</Td>
                      <Td>Essential</Td>
                      <Td>Refreshes your session JWT</Td>
                      <Td>Session / 30 days</Td>
                    </tr>
                    <tr>
                      <Td>ph_posthog</Td>
                      <Td>Analytics</Td>
                      <Td>PostHog product analytics (pseudonymised)</Td>
                      <Td>1 year</Td>
                    </tr>
                    <tr>
                      <Td>rzp_* (Razorpay)</Td>
                      <Td>Functional</Td>
                      <Td>Razorpay fraud prevention and secure checkout state</Td>
                      <Td>Session / up to 1 year</Td>
                    </tr>
                  </tbody>
                </TableWrap>
                <p>
                  Essential cookies cannot be disabled as they are required for the service to function.
                  You may disable analytics cookies by adjusting your browser settings or using a browser
                  extension such as uBlock Origin. Where required by EEA/UK law, non-essential analytics
                  cookies are set only with your consent. For full details, see our dedicated{' '}
                  <Link href="/cookies" className="text-primary hover:underline">Cookie Policy</Link>.
                </p>
              </Section>

              <Section id="children" num="12" title="Children's Privacy">
                <p>
                  SPECTER is a business-to-business service designed for adults operating ecommerce
                  businesses. We do not knowingly collect personal information from children under
                  the age of 16 (or the applicable age of digital consent in your jurisdiction).
                </p>
                <p>
                  If you believe we have inadvertently collected personal data from a child,
                  please contact us at{' '}
                  <a href="mailto:privacy@specterapp.io" className="text-primary hover:underline">
                    privacy@specterapp.io
                  </a>{' '}
                  and we will delete it promptly.
                </p>
              </Section>

              <Section id="changes" num="13" title="Changes to This Policy">
                <p>
                  We may update this Privacy Policy from time to time. When we make material changes,
                  we will notify you by:
                </p>
                <ul className="list-none space-y-2 pl-0">
                  {[
                    'Posting a prominent notice on specterapp.io',
                    'Sending an email to the address associated with your account (for material changes)',
                    'Updating the "Last updated" date at the top of this policy',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="w-1 h-1 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p>
                  Your continued use of SPECTER after the effective date of a revised policy
                  constitutes your acceptance of the changes. If you do not agree to the updated
                  policy, you must stop using SPECTER and may request deletion of your account.
                </p>
              </Section>

              <Section id="contact" num="14" title="Contact Us">
                <p>For any questions, concerns, or requests regarding this Privacy Policy or your personal data:</p>
                <div className="bg-surface border border-border rounded-xl p-5 space-y-2">
                  <p><strong className="text-text">Email:</strong>{' '}
                    <a href="mailto:privacy@specterapp.io" className="text-primary hover:underline">
                      privacy@specterapp.io
                    </a>
                  </p>
                  <p><strong className="text-text">General contact:</strong>{' '}
                    <a href="mailto:hello@specterapp.io" className="text-primary hover:underline">
                      hello@specterapp.io
                    </a>
                  </p>
                  <p className="mt-3 pt-3 border-t border-border/50">
                    <strong className="text-text">All legal documents:</strong>{' '}
                    <Link href="/legal" className="text-primary hover:underline">specterapp.io/legal</Link>
                  </p>
                  <p className="font-mono text-xs text-muted mt-2">
                    We will acknowledge your request within 5 business days and provide a full
                    response within 30 days.
                  </p>
                </div>
                <p>
                  You also have the right to lodge a complaint with your national data protection
                  authority. A list of EU supervisory authorities is available at{' '}
                  <span className="text-primary font-mono text-sm">edpb.europa.eu</span>.
                  UK residents may contact the Information Commissioner&apos;s Office (ICO) at{' '}
                  <span className="text-primary font-mono text-sm">ico.org.uk</span>.
                </p>
              </Section>

            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
