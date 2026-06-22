import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalShell, Section, Callout, Bullets, ContactCard, MailLink, RelatedDocs } from '@/components/marketing/legal/legal-shell'
import { LEGAL_EMAILS, PLAN_FACTS } from '@/lib/legal/constants'

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy — SPECTER',
  description: 'How cancellations, renewals, refunds, failed payments, and downgrades work for SPECTER subscriptions billed via Razorpay.',
  alternates: { canonical: '/refunds' },
  robots: { index: true, follow: false },
}

const TOC = [
  { id: 'overview', label: 'Overview' },
  { id: 'cancel', label: 'How to Cancel' },
  { id: 'monthly', label: 'Monthly Plans' },
  { id: 'annual', label: 'Annual Plans' },
  { id: 'trial', label: 'Free Trial' },
  { id: 'renewals', label: 'Auto-Renewal' },
  { id: 'failed', label: 'Failed Payments' },
  { id: 'outage', label: 'Service-Outage Credits' },
  { id: 'exclusions', label: 'What Is Not Refundable' },
  { id: 'chargebacks', label: 'Disputes & Chargebacks' },
  { id: 'consumer', label: 'Consumer Rights' },
  { id: 'contact', label: 'Contact' },
]

export default function RefundPolicyPage() {
  return (
    <LegalShell title="Refund & Cancellation Policy" toc={TOC} contactEmail={LEGAL_EMAILS.support} contactLabel="Billing help?">
      <Section id="overview" num="01" title="Overview">
        <Callout>
          <p>
            This policy explains cancellations, renewals, and refunds for paid SPECTER subscriptions.
            It forms part of, and should be read with, our{' '}
            <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>.
            Payments are processed by <strong className="text-text">Razorpay</strong>; we may add or
            change payment processors over time.
          </p>
        </Callout>
        <p>
          SPECTER is a business-to-business subscription service. Plans (RECON, CIPHER, PHANTOM,
          PREDATOR, and ECLIPSE Enterprise) are billed in advance on a monthly or annual cycle, as
          shown at <Link href="/pricing" className="text-primary hover:underline">specterapp.io/pricing</Link>.
        </p>
      </Section>

      <Section id="cancel" num="02" title="How to Cancel">
        <p>
          You can cancel at any time from your dashboard billing settings. Cancellation stops the next
          renewal; it does not retroactively refund the current period except as set out below. After
          cancellation your access continues until the end of the period you have already paid for.
        </p>
      </Section>

      <Section id="monthly" num="03" title="Monthly Plans">
        <Bullets items={[
          'You may cancel a monthly plan at any time.',
          'Access continues until the end of the current monthly billing period.',
          'Monthly fees already charged are non-refundable for the current period.',
        ]} />
      </Section>

      <Section id="annual" num="04" title="Annual Plans">
        <Bullets items={[
          <><strong className="text-text">14-day refund window.</strong> You may cancel an annual plan within 14 days of the initial purchase or of an annual renewal for a full refund of that annual charge.</>,
          'After the 14-day window, the annual fee is non-refundable for the remainder of the term.',
          'Access continues until the end of the annual term.',
        ]} />
      </Section>

      <Section id="trial" num="05" title="Free Trial">
        <p>
          New accounts may be eligible for a {PLAN_FACTS.trialDays}-day free trial of a paid tier. No
          charge is made during the trial. If you do not cancel before the trial ends, the
          subscription converts to a paid plan and the first charge is taken. Trial eligibility is
          limited to one trial per email address and per business entity.
        </p>
      </Section>

      <Section id="renewals" num="06" title="Auto-Renewal Authorisation">
        <p>
          Subscriptions renew automatically at the end of each billing period unless cancelled before
          the renewal date. By subscribing you authorise SPECTER and Razorpay to charge your payment
          method on file for each renewal at the then-current price for your plan. We provide advance
          notice of any price change to existing subscribers as described in the Terms.
        </p>
      </Section>

      <Section id="failed" num="07" title="Failed Payments & Dunning">
        <p>
          If a renewal payment fails, we will retry it up to {PLAN_FACTS.failedPaymentRetries} times
          over approximately {PLAN_FACTS.failedPaymentWindowDays} days and notify you by email. If
          payment still cannot be collected, your account may be downgraded to the free tier or
          suspended until the balance is resolved. Suspension does not relieve you of amounts already
          due for service provided.
        </p>
      </Section>

      <Section id="outage" num="08" title="Service-Outage Credits">
        <p>
          SPECTER is provided without a contractual uptime guarantee (see the{' '}
          <Link href="/terms#availability" className="text-primary hover:underline">Service Availability</Link>{' '}
          section of the Terms). As a goodwill measure, if the core platform is unavailable for more
          than 48 consecutive hours due to a fault attributable to us, you may request a pro-rata
          credit for the affected period by contacting <MailLink email={LEGAL_EMAILS.support} /> within
          30 days of the incident. Outages caused by third-party platforms, your own configuration, or
          a competitor website blocking data collection are excluded.
        </p>
      </Section>

      <Section id="exclusions" num="09" title="What Is Not Refundable">
        <Bullets tone="danger" items={[
          'Fees for a billing period already in progress (monthly), outside the annual 14-day window.',
          'Charges arising from your failure to cancel before a renewal or trial conversion.',
          'Dissatisfaction with AI-generated signals, scraped-data accuracy, or pricing outcomes — these are inherent characteristics of the service, disclaimed in the Terms.',
          'Inability to monitor a specific competitor URL, where that website blocks, changes, or restricts access.',
          'Accounts terminated for breach of the Terms or Acceptable Use Policy.',
        ]} />
      </Section>

      <Section id="chargebacks" num="10" title="Payment Disputes & Chargebacks">
        <p>
          If you believe you were charged in error, please contact us first — most issues are resolved
          quickly. Initiating a chargeback or payment dispute without contacting us may result in
          immediate suspension of your account pending resolution. We reserve the right to contest
          chargebacks we believe are invalid and to recover associated fees.
        </p>
      </Section>

      <Section id="consumer" num="11" title="Statutory Consumer Rights">
        <p>
          Nothing in this policy limits any non-waivable rights you may have under the consumer
          protection laws of your jurisdiction (including in the EU, UK, Australia, and India). Where
          such laws grant you a refund or cancellation right that exceeds this policy, that right
          prevails to the extent required by law.
        </p>
      </Section>

      <Section id="contact" num="12" title="Contact">
        <ContactCard
          rows={[
            { label: 'Billing & refunds', value: <MailLink email={LEGAL_EMAILS.support} /> },
            { label: 'Legal', value: <MailLink email={LEGAL_EMAILS.legal} /> },
          ]}
          note="We aim to acknowledge billing requests within 2 business days."
        />
        <RelatedDocs links={[
          { label: 'Terms of Service', href: '/terms' },
          { label: 'Pricing', href: '/pricing' },
        ]} />
      </Section>
    </LegalShell>
  )
}
