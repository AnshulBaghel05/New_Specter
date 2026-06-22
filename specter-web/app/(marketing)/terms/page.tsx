import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/marketing/nav'
import Footer from '@/components/marketing/footer'

export const metadata: Metadata = {
  title: 'Terms of Service — SPECTER',
  description:
    'Terms and conditions governing use of the SPECTER pricing intelligence platform and free calculator tools.',
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: false },
}

const TOC = [
  { id: 'agreement', label: 'Agreement to Terms' },
  { id: 'changes', label: 'Changes to Terms' },
  { id: 'service', label: 'Description of Service' },
  { id: 'free-tools', label: 'Free Calculator Tools' },
  { id: 'account', label: 'Account Registration & Security' },
  { id: 'integrations', label: 'Shopify & WooCommerce Integration' },
  { id: 'scraping', label: 'Competitor URLs & Web Scraping' },
  { id: 'acceptable-use', label: 'Acceptable Use Policy' },
  { id: 'billing', label: 'Subscription Plans & Billing' },
  { id: 'trial', label: 'Free Trial' },
  { id: 'cancellation', label: 'Cancellation & Refunds' },
  { id: 'ip', label: 'Intellectual Property' },
  { id: 'confidentiality', label: 'Confidentiality & Data Isolation' },
  { id: 'availability', label: 'Service Availability (No SLA)' },
  { id: 'beta', label: 'Beta & Experimental Features' },
  { id: 'api', label: 'API Usage' },
  { id: 'warranties', label: 'Disclaimer of Warranties' },
  { id: 'liability', label: 'Limitation of Liability' },
  { id: 'indemnification', label: 'Indemnification' },
  { id: 'export', label: 'Export Controls & Sanctions' },
  { id: 'data-processing', label: 'Data Processing & Privacy' },
  { id: 'governing-law', label: 'Governing Law' },
  { id: 'termination', label: 'Termination' },
  { id: 'general', label: 'General Provisions' },
  { id: 'contact', label: 'Contact' },
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

function Callout({ variant = 'info', children }: { variant?: 'info' | 'warning'; children: React.ReactNode }) {
  const styles =
    variant === 'warning'
      ? 'bg-amber-400/5 border-amber-400/20'
      : 'bg-primary/5 border-primary/20'
  return (
    <div className={`${styles} border rounded-xl p-5 font-body text-sm text-muted leading-relaxed space-y-2`}>
      {children}
    </div>
  )
}

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-bg pt-28 pb-24 px-6">
        <div className="max-w-6xl mx-auto">

          {/* Page header */}
          <div className="mb-12">
            <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">Legal</p>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-text tracking-tight mb-3">
              Terms of Service
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
                <nav className="space-y-1" aria-label="Terms of service sections">
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
                  <p className="font-mono text-[11px] text-muted mb-2">Legal questions?</p>
                  <a
                    href="mailto:legal@specterapp.io"
                    className="font-mono text-[11px] text-primary hover:underline"
                  >
                    legal@specterapp.io
                  </a>
                </div>
              </div>
            </aside>

            {/* ── Content ──────────────────────────────────────────────── */}
            <div>

              <Section id="agreement" num="01" title="Agreement to Terms">
                <Callout>
                  <p>
                    By accessing <strong className="text-text">specterapp.io</strong> or using the SPECTER
                    pricing intelligence platform or free calculator tools, you agree to be bound by
                    these Terms of Service (&quot;Terms&quot;) and our{' '}
                    <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                  </p>
                  <p>
                    If you are agreeing on behalf of a business or other legal entity, you represent
                    that you have the authority to bind that entity to these Terms. If you do not have
                    such authority, or if you do not agree to these Terms, you must not use the service.
                  </p>
                </Callout>
                <p>
                  These Terms constitute a legally binding agreement between you (or the entity you
                  represent) and SPECTER. References to &quot;you&quot;, &quot;your&quot;, or
                  &quot;Customer&quot; mean the individual or entity accepting these Terms.
                  References to &quot;SPECTER&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;
                  refer to the company operating the SPECTER service.
                </p>
              </Section>

              <Section id="changes" num="02" title="Changes to Terms">
                <p>
                  We reserve the right to modify these Terms at any time. We will notify you of
                  material changes by:
                </p>
                <ul className="list-none space-y-2 pl-0">
                  {[
                    'Sending an email to the address associated with your account',
                    'Posting a notice on the SPECTER dashboard',
                    'Updating the "Last updated" date at the top of this page',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="w-1 h-1 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p>
                  Changes take effect 30 days after notice. Your continued use of SPECTER after
                  the effective date constitutes acceptance of the revised Terms. If you object to
                  any change, your sole remedy is to stop using the service and cancel your subscription
                  before the effective date.
                </p>
              </Section>

              <Section id="service" num="03" title="Description of Service">
                <p>
                  SPECTER is a competitor price monitoring and pricing intelligence platform for
                  Shopify and WooCommerce merchants. The service consists of:
                </p>
                <ul className="list-none space-y-2 pl-0">
                  {[
                    'Automated scraping of publicly accessible competitor product pages at configurable intervals (1–6 hours depending on plan)',
                    'AI-generated RAISE / LOWER / HOLD pricing signals for your SKUs based on collected market data',
                    'A price history dashboard with 30–90 day historical data (plan-dependent)',
                    'Optional auto-repricing within user-defined floor and ceiling guardrails',
                    'Stock-out monitoring and alerts when tracked competitors go out of stock',
                    'Six free ecommerce calculator tools available without an account',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="w-1 h-1 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p>
                  SPECTER is a pre-launch product. Features, plans, and pricing are subject to change
                  before and after general availability. We will provide reasonable notice of
                  material changes that affect paid subscribers.
                </p>
              </Section>

              <Section id="free-tools" num="04" title="Free Calculator Tools">
                <p>
                  SPECTER provides six free ecommerce calculator tools (the &quot;Tools&quot;) at
                  specterapp.io/tools. The Tools are provided as a free public service and are
                  governed by the following terms:
                </p>
                <p>
                  <strong className="text-text">As-is basis.</strong> The Tools are provided
                  &quot;as is&quot; and &quot;as available&quot; for informational and educational purposes
                  only. Outputs are estimates based on publicly available rate information and
                  simplified formulas. They are not financial, tax, legal, or professional advice.
                </p>
                <p>
                  <strong className="text-text">Rates may change.</strong> Amazon FBA fees, Shopify
                  transaction rates, carrier shipping rates, and other third-party rates incorporated
                  into the Tools may change at any time without notice to us. We update the Tools
                  on a best-efforts basis but do not guarantee that rates are current.
                </p>
                <p>
                  <strong className="text-text">No data collection.</strong> The Tools run entirely
                  in your browser. No inputs, outputs, or results are transmitted to or stored by
                  SPECTER. You use the Tools entirely at your own risk.
                </p>
                <p>
                  <strong className="text-text">No warranty.</strong> We make no warranty that
                  the Tools are accurate, complete, or suitable for any particular purpose.
                  You assume all responsibility for decisions made based on Tool outputs.
                </p>
              </Section>

              <Section id="account" num="05" title="Account Registration & Security">
                <p>
                  To access the SPECTER platform (beyond free tools), you must create an account.
                  You agree to:
                </p>
                <ul className="list-none space-y-2 pl-0">
                  {[
                    'Provide accurate, current, and complete registration information',
                    'Maintain the security of your account credentials',
                    'Promptly notify us at support@specterapp.io of any unauthorized account access',
                    'Not share your account credentials with third parties',
                    'Not create multiple accounts for the purpose of circumventing plan limits',
                    'Accept responsibility for all activity that occurs under your account',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="w-1 h-1 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p>
                  Each subscription is for use by a single business entity. Team seat limits
                  apply as specified in your plan. You may not resell or sublicense access to
                  SPECTER without written permission.
                </p>
              </Section>

              <Section id="integrations" num="06" title="Shopify & WooCommerce Integration">
                <p>
                  SPECTER integrates with your Shopify or WooCommerce store via OAuth or API keys
                  that you authorize. By connecting your store, you:
                </p>
                <p>
                  <strong className="text-text">Grant SPECTER permission</strong> to read your
                  product catalog (titles, SKUs, prices), and, if you enable auto-repricing,
                  to update product prices within the guardrails you configure.
                </p>
                <p>
                  <strong className="text-text">Represent and warrant</strong> that you have the
                  authority to connect the store and grant these permissions, and that doing so
                  does not violate any agreement with Shopify, WooCommerce, or any third party.
                </p>
                <p>
                  <strong className="text-text">Understand and accept</strong> that SPECTER&apos;s
                  ability to read or update your store depends on Shopify&apos;s and WooCommerce&apos;s
                  APIs remaining available and our integrations remaining in good standing. We are
                  not liable for disruptions caused by changes to third-party APIs or platforms.
                </p>
                <p>
                  <strong className="text-text">Auto-repricing responsibility.</strong> If you
                  enable auto-repricing, you accept sole responsibility for the price changes
                  SPECTER makes within the floor/ceiling guardrails you set. SPECTER is not
                  liable for pricing errors that result from misconfigured guardrails.
                </p>
              </Section>

              <Section id="scraping" num="07" title="Competitor URLs & Web Scraping Authorization">
                <Callout variant="warning">
                  <p>
                    <strong className="text-text">This section is important.</strong> When you add competitor
                    product URLs to SPECTER, you are authorizing us to scrape those pages on your behalf and
                    accepting responsibility for ensuring that doing so is lawful.
                  </p>
                </Callout>
                <p>
                  <strong className="text-text">User-directed scraping.</strong> SPECTER scrapes
                  competitor URLs exclusively on your instruction. By adding a URL, you represent
                  and warrant that: (a) the URL points to a publicly accessible page that does not
                  require authentication to view; (b) your use of the collected data complies with
                  applicable laws; and (c) you have a legitimate competitive interest in monitoring
                  that page.
                </p>
                <p>
                  <strong className="text-text">Publicly accessible pages only.</strong> You may
                  not instruct SPECTER to scrape pages that require a login, password, or special
                  authorization to access. You may not use SPECTER to scrape pages in a manner
                  that would constitute unauthorized access under applicable computer fraud laws.
                </p>
                <p>
                  <strong className="text-text">Compliance is your responsibility.</strong> You
                  are solely responsible for ensuring that the competitor URLs you submit and
                  your use of the collected data complies with all applicable laws, regulations,
                  and the terms of service of the websites you monitor. SPECTER provides
                  infrastructure; you control what is monitored and how the data is used.
                </p>
                <p>
                  <strong className="text-text">No continuity guarantee.</strong> Websites may
                  implement anti-scraping measures, require login, change their structure, or
                  block SPECTER&apos;s data collection at any time. We do not guarantee uninterrupted
                  data collection for any URL. Failure to scrape a URL does not constitute a
                  service defect or entitle you to a refund.
                </p>
                <p>
                  <strong className="text-text">Data use restriction.</strong> Price intelligence
                  data collected by SPECTER may be used only for your own internal business
                  purposes. You may not redistribute, resell, or sublicense raw scraped data
                  collected through SPECTER.
                </p>
              </Section>

              <Section id="acceptable-use" num="08" title="Acceptable Use Policy">
                <p>You agree not to use SPECTER to:</p>
                <ul className="list-none space-y-2 pl-0">
                  {[
                    'Violate any applicable law or regulation',
                    'Scrape pages requiring authentication or that you are not authorized to access',
                    'Attempt to disrupt, overload, or damage SPECTER or any third-party website through excessive scraping',
                    'Reverse-engineer, decompile, or disassemble any portion of the SPECTER platform',
                    'Resell, sublicense, or provide access to the SPECTER platform to third parties without written permission',
                    'Use SPECTER to build a competing product or service',
                    'Circumvent or attempt to circumvent plan limits, rate limits, or access controls',
                    'Attempt to access another user\'s account or data',
                    'Transmit malware, viruses, or any code designed to disrupt or damage systems',
                    'Impersonate any person or entity or misrepresent your affiliation with any person or entity',
                    'Use SPECTER in connection with any fraudulent, deceptive, or illegal scheme',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="w-1 h-1 rounded-full bg-rose-400 mt-2.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p>
                  Violation of this Acceptable Use Policy may result in immediate suspension or
                  termination of your account without refund, at our sole discretion.
                </p>
              </Section>

              <Section id="billing" num="09" title="Subscription Plans & Billing">
                <p>
                  <strong className="text-text">Plans and pricing.</strong> SPECTER offers multiple
                  subscription tiers (RECON, CIPHER, PHANTOM, PREDATOR, ECLIPSE Enterprise).
                  Current pricing is displayed at <Link href="/pricing" className="text-primary hover:underline">
                  specterapp.io/pricing</Link>. We reserve the right to modify pricing with 30 days&apos;
                  notice to existing subscribers.
                </p>
                <p>
                  <strong className="text-text">Billing cycle.</strong> Subscriptions are billed
                  monthly or annually in advance, as selected at sign-up. Annual plans are
                  discounted as shown on the pricing page.
                </p>
                <p>
                  <strong className="text-text">Auto-renewal.</strong> Subscriptions automatically
                  renew at the end of each billing period unless cancelled before the renewal date.
                  You authorize us to charge your payment method on file for each renewal.
                </p>
                <p>
                  <strong className="text-text">Payment processing.</strong> Payments are processed by
                  Razorpay, and we may add or change payment processors over time. By subscribing, you
                  agree to the applicable payment processor&apos;s terms. We do not store your full
                  payment card details. Cancellations, renewals, refunds, and failed-payment handling
                  are governed by our{' '}
                  <Link href="/refunds" className="text-primary hover:underline">Refund &amp; Cancellation Policy</Link>.
                </p>
                <p>
                  <strong className="text-text">Failed payments.</strong> If a payment fails,
                  we will attempt to retry it up to three times over 7 days. If payment remains
                  unsuccessful, your account may be downgraded or suspended until the balance
                  is resolved.
                </p>
                <p>
                  <strong className="text-text">Taxes.</strong> Prices exclude applicable taxes.
                  You are responsible for all taxes associated with your subscription, except
                  where we are required by law to collect and remit taxes on your behalf.
                </p>
              </Section>

              <Section id="trial" num="10" title="Free Trial">
                <p>
                  New accounts may be eligible for a 14-day free trial of a paid plan tier.
                  During the trial:
                </p>
                <ul className="list-none space-y-2 pl-0">
                  {[
                    'You have full access to the features of the trial plan tier',
                    'No payment is charged until the trial ends',
                    'You may cancel at any time during the trial period without being charged',
                    'At the end of the trial, your subscription will automatically convert to a paid plan unless cancelled',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="w-1 h-1 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p>
                  We reserve the right to modify or discontinue the free trial offer at any time
                  without notice. Trial eligibility is limited to one trial per email address
                  and per business entity.
                </p>
              </Section>

              <Section id="cancellation" num="11" title="Cancellation & Refunds">
                <p>
                  <strong className="text-text">Monthly plans.</strong> You may cancel your monthly
                  subscription at any time through the dashboard. Your access continues until the
                  end of the current billing period. Monthly plans are non-refundable for the
                  current billing period.
                </p>
                <p>
                  <strong className="text-text">Annual plans.</strong> Annual subscriptions may
                  be cancelled within 14 days of the initial purchase or annual renewal date for
                  a full refund. After the 14-day window, annual plans are non-refundable for
                  the remainder of the annual term. Access continues until the end of the
                  annual term.
                </p>
                <p>
                  <strong className="text-text">Exceptions.</strong> If SPECTER experiences a
                  material service outage (more than 48 consecutive hours of unavailability),
                  you may request a prorated refund for the affected period by contacting
                  support@specterapp.io within 30 days of the incident.
                </p>
                <p>
                  <strong className="text-text">Effect of cancellation.</strong> Upon cancellation
                  or termination, your access to the paid platform features will end at the
                  close of your billing period. Your data is retained for 90 days after
                  cancellation, after which it is permanently deleted. You may export your
                  data before this window closes.
                </p>
                <p>
                  <strong className="text-text">Consumer protection rights.</strong> Nothing in
                  these Terms limits any statutory rights you may have under applicable consumer
                  protection laws in your jurisdiction.
                </p>
              </Section>

              <Section id="ip" num="12" title="Intellectual Property">
                <p>
                  <strong className="text-text">SPECTER IP.</strong> The SPECTER platform,
                  including its software, design, algorithms, AI models, trademarks, and all
                  proprietary content (excluding your data), is owned by SPECTER or its
                  licensors. These Terms do not grant you any ownership rights in the platform.
                </p>
                <p>
                  <strong className="text-text">License to use.</strong> Subject to your compliance
                  with these Terms and payment of applicable fees, SPECTER grants you a limited,
                  non-exclusive, non-transferable, revocable license to access and use the
                  platform for your internal business purposes during the subscription term.
                </p>
                <p>
                  <strong className="text-text">Your data.</strong> You retain full ownership of
                  your store data, competitor URLs, and any data you provide to SPECTER.
                  You grant SPECTER a non-exclusive license to process, store, and use your
                  data solely to provide the service to you.
                </p>
                <p>
                  <strong className="text-text">Feedback.</strong> If you provide feedback,
                  suggestions, or ideas about SPECTER, you grant us a perpetual, irrevocable,
                  royalty-free license to use them for any purpose without compensation to you.
                </p>
              </Section>

              <Section id="confidentiality" num="13" title="Confidentiality & Data Isolation">
                <p>
                  <strong className="text-text">Your price intelligence data is yours.</strong>{' '}
                  SPECTER treats your competitive pricing data — the competitor URLs you monitor,
                  the prices collected, and the signals generated for your SKUs — as your
                  confidential information. We do not share this data with other SPECTER users
                  or any third party except as required to provide the service (e.g., storing
                  data in Supabase).
                </p>
                <p>
                  <strong className="text-text">Data isolation.</strong> SPECTER maintains logical
                  separation between customer accounts. Your monitoring data is not aggregated
                  with or accessible to other customers.
                </p>
                <p>
                  <strong className="text-text">SPECTER confidentiality.</strong> By using SPECTER,
                  you may gain access to non-public information about our platform, roadmap,
                  or business. You agree not to disclose such information to third parties
                  without our consent.
                </p>
                <p>
                  <strong className="text-text">No market data aggregation.</strong> SPECTER does
                  not build or sell aggregate market intelligence products using data collected
                  from its customers&apos; monitoring targets.
                </p>
              </Section>

              <Section id="availability" num="14" title="Service Availability (No SLA)">
                <p>
                  We work hard to keep SPECTER available, but the platform is provided{' '}
                  <strong className="text-text">without a contractual uptime guarantee or service-level
                  agreement (SLA)</strong> unless a separate written SLA is agreed for an enterprise plan.
                  Access may be interrupted for maintenance, updates, or factors beyond our control,
                  including failures of third-party platforms (Shopify, WooCommerce, hosting, payment,
                  or AI providers) and competitor websites blocking or changing their pages.
                </p>
                <p>
                  Data-collection frequency is {`best-efforts and plan-dependent`}, and a failure to
                  collect from any given competitor URL is not a service defect. Our goodwill credit for
                  extended outages is described in the{' '}
                  <Link href="/refunds" className="text-primary hover:underline">Refund &amp; Cancellation Policy</Link>.
                </p>
              </Section>

              <Section id="beta" num="15" title="Beta & Experimental Features">
                <p>
                  We may offer features labelled beta, preview, early access, or experimental
                  (&quot;Beta Features&quot;). Beta Features are provided{' '}
                  <strong className="text-text">&quot;as is&quot; for evaluation</strong>, may be changed
                  or withdrawn at any time, may be less reliable than generally available features, and
                  are excluded from any warranty, support commitment, or outage credit. Your use of Beta
                  Features is at your own risk, and we may collect feedback and usage data to improve them.
                </p>
              </Section>

              <Section id="api" num="16" title="API Usage">
                <p>
                  If we provide API or programmatic access, your use is subject to the published rate
                  limits and quotas for your plan and to our{' '}
                  <Link href="/acceptable-use" className="text-primary hover:underline">Acceptable Use Policy</Link>.
                  You must keep API credentials confidential, must not exceed or circumvent limits, and
                  must not use the API to replicate the platform, build a competing dataset, or access
                  another customer&apos;s data. We may throttle, suspend, or revoke API access to protect
                  platform stability, security, or fair use, and we may change or deprecate API
                  functionality with reasonable notice.
                </p>
              </Section>

              <Section id="warranties" num="17" title="Disclaimer of Warranties">
                <p className="uppercase text-[13px] font-mono tracking-wide text-text/80 leading-loose">
                  THE SPECTER PLATFORM AND FREE TOOLS ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;
                  WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE.
                  TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, SPECTER EXPRESSLY DISCLAIMS
                  ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO: IMPLIED WARRANTIES OF MERCHANTABILITY,
                  FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
                </p>
                <p className="uppercase text-[13px] font-mono tracking-wide text-text/80 leading-loose">
                  SPECTER DOES NOT WARRANT THAT: (A) THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE,
                  OR SECURE; (B) SCRAPED COMPETITOR DATA WILL BE ACCURATE, COMPLETE, OR CURRENT;
                  (C) PRICING SIGNALS WILL BE PROFITABLE OR SUITABLE FOR YOUR BUSINESS; (D) THE
                  SERVICE WILL MEET YOUR REQUIREMENTS OR EXPECTATIONS; OR (E) DEFECTS WILL BE CORRECTED.
                </p>
                <p className="uppercase text-[13px] font-mono tracking-wide text-text/80 leading-loose">
                  USE OF THE SERVICE IS AT YOUR SOLE RISK. YOU ARE RESPONSIBLE FOR ALL PRICING
                  DECISIONS YOU MAKE, WITH OR WITHOUT RELIANCE ON SPECTER&apos;S SIGNALS.
                </p>
              </Section>

              <Section id="liability" num="18" title="Limitation of Liability">
                <p className="uppercase text-[13px] font-mono tracking-wide text-text/80 leading-loose">
                  TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL SPECTER,
                  ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, LICENSORS, OR SERVICE PROVIDERS
                  BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE,
                  OR EXEMPLARY DAMAGES — INCLUDING BUT NOT LIMITED TO LOST PROFITS, LOST
                  REVENUE, LOST BUSINESS, LOSS OF DATA, LOSS OF GOODWILL, OR COST OF SUBSTITUTE
                  SERVICES — ARISING OUT OF OR RELATED TO YOUR USE OF OR INABILITY TO USE THE
                  SERVICE, REGARDLESS OF THE CAUSE OF ACTION OR THE THEORY OF LIABILITY, AND
                  EVEN IF SPECTER HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
                </p>
                <p className="uppercase text-[13px] font-mono tracking-wide text-text/80 leading-loose">
                  SPECTER&apos;S TOTAL CUMULATIVE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF
                  OR RELATED TO THESE TERMS OR THE SERVICE — WHETHER IN CONTRACT, TORT
                  (INCLUDING NEGLIGENCE), OR OTHERWISE — WILL NOT EXCEED THE GREATER OF:
                  (A) THE TOTAL FEES YOU PAID TO SPECTER IN THE THREE (3) MONTHS IMMEDIATELY
                  PRECEDING THE CLAIM; OR (B) ONE HUNDRED US DOLLARS (USD $100).
                </p>
                <p>
                  Some jurisdictions do not allow the exclusion of certain warranties or the
                  limitation or exclusion of certain liabilities. In such jurisdictions, our
                  liability is limited to the minimum extent permitted by law. These limitations
                  apply notwithstanding any failure of essential purpose of any limited remedy.
                </p>
              </Section>

              <Section id="indemnification" num="19" title="Indemnification">
                <p>
                  You agree to defend, indemnify, and hold harmless SPECTER and its officers,
                  directors, employees, and agents from and against any claims, damages, losses,
                  costs, and expenses (including reasonable legal fees) arising out of or related to:
                </p>
                <ul className="list-none space-y-2 pl-0">
                  {[
                    'Your use of the SPECTER service or free tools',
                    'Competitor URLs you instruct SPECTER to scrape, including any claims from the operators of those websites',
                    'Your violation of these Terms or any applicable law or regulation',
                    'Your violation of any third party\'s rights, including intellectual property rights',
                    'Any pricing decisions you make based on SPECTER\'s signals',
                    'Your Shopify or WooCommerce store data or your use of the integration',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="w-1 h-1 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p>
                  SPECTER reserves the right, at its own expense, to assume the exclusive defense
                  and control of any matter subject to indemnification by you, in which case you
                  agree to cooperate with SPECTER&apos;s defense.
                </p>
              </Section>

              <Section id="export" num="20" title="Export Controls & Sanctions">
                <p>
                  You must comply with all applicable export control and economic-sanctions laws,
                  including those of India, the United States, the European Union, and the United
                  Kingdom. You represent and warrant that you are not located in, ordinarily resident in,
                  or organised under the laws of any country or region subject to comprehensive sanctions,
                  and that you are not a person with whom dealings are prohibited under applicable
                  sanctions or denied-party lists.
                </p>
                <p>
                  You agree not to use, export, or re-export the SPECTER platform in violation of those
                  laws, and not to provide access to any prohibited person. We may suspend or terminate
                  access where we reasonably believe continued provision would breach sanctions or export
                  laws.
                </p>
              </Section>

              <Section id="data-processing" num="21" title="Data Processing & Privacy">
                <p>
                  Our handling of personal data is described in our{' '}
                  <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                  Where we process personal data on your behalf as a processor, that processing is
                  governed by our{' '}
                  <Link href="/dpa" className="text-primary hover:underline">Data Processing Addendum</Link>{' '}
                  (&quot;DPA&quot;), which is incorporated into these Terms by reference and which prevails
                  over these Terms to the extent of any conflict on data-protection matters. The third
                  parties in our data path are listed on our{' '}
                  <Link href="/subprocessors" className="text-primary hover:underline">Subprocessors</Link>{' '}
                  page. You are responsible for ensuring you have any consents or notices required for the
                  data you submit, and for not submitting special-category personal data.
                </p>
              </Section>

              <Section id="governing-law" num="22" title="Governing Law">
                <p>
                  These Terms are governed by and construed in accordance with the laws of India,
                  without regard to its conflict of law provisions.
                </p>
                <p>
                  Any dispute arising out of or relating to these Terms or the SPECTER service
                  that cannot be resolved informally shall be subject to the exclusive jurisdiction
                  of the courts located in India. You consent to the personal jurisdiction of
                  such courts.
                </p>
                <p>
                  <strong className="text-text">EU / UK consumers.</strong> If you are a consumer
                  located in the European Union or United Kingdom, you may be entitled to bring
                  proceedings in the courts of your country of residence and to benefit from
                  any mandatory consumer protection laws that apply in your jurisdiction.
                  Nothing in these Terms limits those statutory rights.
                </p>
                <p>
                  <strong className="text-text">Informal resolution first.</strong> Before
                  initiating any legal proceeding, you agree to contact SPECTER at
                  legal@specterapp.io and attempt to resolve the dispute informally for
                  at least 30 days.
                </p>
              </Section>

              <Section id="termination" num="23" title="Termination">
                <p>
                  <strong className="text-text">By you.</strong> You may stop using SPECTER and
                  cancel your subscription at any time through the dashboard.
                </p>
                <p>
                  <strong className="text-text">By SPECTER.</strong> We may suspend or terminate
                  your account and access to the service immediately, without prior notice or
                  liability, if:
                </p>
                <ul className="list-none space-y-2 pl-0">
                  {[
                    'You violate these Terms or our Acceptable Use Policy',
                    'Your account is used for fraudulent, illegal, or abusive activity',
                    'We are required to do so by law or legal process',
                    'We discontinue the service (with reasonable notice)',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="w-1 h-1 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p>
                  Upon termination, all licenses granted to you immediately cease. Sections that by
                  their nature should survive (Intellectual Property, Disclaimers, Limitation of
                  Liability, Indemnification, Governing Law) will survive termination.
                </p>
              </Section>

              <Section id="general" num="24" title="General Provisions">
                <p>
                  <strong className="text-text">Entire agreement.</strong> These Terms, together with our{' '}
                  <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>,{' '}
                  <Link href="/acceptable-use" className="text-primary hover:underline">Acceptable Use Policy</Link>,{' '}
                  <Link href="/scraping-policy" className="text-primary hover:underline">Web Scraping Policy</Link>,{' '}
                  <Link href="/ai-disclosure" className="text-primary hover:underline">AI &amp; Automated Decisions Disclosure</Link>,{' '}
                  <Link href="/refunds" className="text-primary hover:underline">Refund &amp; Cancellation Policy</Link>,{' '}
                  <Link href="/dpa" className="text-primary hover:underline">Data Processing Addendum</Link>, and any
                  order forms or plan documentation, constitute the entire agreement between you and
                  SPECTER and supersede all prior understandings.
                </p>
                <p>
                  <strong className="text-text">Severability.</strong> If any provision of these Terms
                  is found to be unenforceable, that provision will be modified to the minimum extent
                  necessary to make it enforceable, and the remaining provisions will continue in
                  full force and effect.
                </p>
                <p>
                  <strong className="text-text">No waiver.</strong> Our failure to enforce any right
                  or provision of these Terms will not be deemed a waiver of such right or provision.
                </p>
                <p>
                  <strong className="text-text">Assignment.</strong> You may not assign or transfer
                  any rights under these Terms without our prior written consent. SPECTER may assign
                  these Terms in connection with a merger, acquisition, or sale of assets.
                </p>
                <p>
                  <strong className="text-text">Force majeure.</strong> Neither party will be liable
                  for delays or failures in performance resulting from causes beyond its reasonable
                  control, including acts of God, natural disasters, war, terrorism, government
                  actions, or internet outages.
                </p>
                <p>
                  <strong className="text-text">Notices.</strong> Notices to you will be sent to
                  the email address associated with your account. Notices to SPECTER must be sent
                  to legal@specterapp.io.
                </p>
              </Section>

              <Section id="contact" num="25" title="Contact">
                <div className="bg-surface border border-border rounded-xl p-5 space-y-2">
                  <p><strong className="text-text">Legal inquiries:</strong>{' '}
                    <a href="mailto:legal@specterapp.io" className="text-primary hover:underline">
                      legal@specterapp.io
                    </a>
                  </p>
                  <p><strong className="text-text">Support:</strong>{' '}
                    <a href="mailto:support@specterapp.io" className="text-primary hover:underline">
                      support@specterapp.io
                    </a>
                  </p>
                  <p><strong className="text-text">General:</strong>{' '}
                    <Link href="/contact" className="text-primary hover:underline">
                      specterapp.io/contact
                    </Link>
                  </p>
                  <p className="pt-2 border-t border-border/50">
                    <strong className="text-text">All legal documents:</strong>{' '}
                    <Link href="/legal" className="text-primary hover:underline">specterapp.io/legal</Link>
                  </p>
                  <p className="font-mono text-xs text-muted">
                    We aim to respond to all legal inquiries within 5 business days.
                  </p>
                </div>
              </Section>

            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
