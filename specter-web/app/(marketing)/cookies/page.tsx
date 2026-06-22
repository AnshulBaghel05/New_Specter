import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalShell, Section, Callout, Bullets, TableWrap, Th, Td, ContactCard, MailLink, RelatedDocs } from '@/components/marketing/legal/legal-shell'
import { LEGAL_EMAILS } from '@/lib/legal/constants'

export const metadata: Metadata = {
  title: 'Cookie Policy — SPECTER',
  description: 'How SPECTER uses cookies and similar technologies on specterapp.io, including analytics, essential session, and payment cookies.',
  alternates: { canonical: '/cookies' },
  robots: { index: true, follow: false },
}

const TOC = [
  { id: 'what', label: 'What Cookies Are' },
  { id: 'how', label: 'How We Use Them' },
  { id: 'table', label: 'Cookies We Set' },
  { id: 'analytics', label: 'Analytics & Consent' },
  { id: 'manage', label: 'Managing Cookies' },
  { id: 'dnt', label: 'Do Not Track' },
  { id: 'changes', label: 'Changes' },
  { id: 'contact', label: 'Contact' },
]

export default function CookiePolicyPage() {
  return (
    <LegalShell title="Cookie Policy" toc={TOC} contactEmail={LEGAL_EMAILS.privacy} contactLabel="Privacy questions?">
      <Section id="what" num="01" title="What Cookies Are">
        <p>
          Cookies are small text files placed on your device when you visit a website. Similar
          technologies include local storage and pixels. SPECTER uses a small number of these
          technologies on <strong className="text-text">specterapp.io</strong> to keep you signed
          in, to process payments securely, and to understand how merchants use the product.
        </p>
        <p>
          This Cookie Policy should be read together with our{' '}
          <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>, which
          explains your rights and how we handle personal data generally.
        </p>
      </Section>

      <Section id="how" num="02" title="How We Use Cookies">
        <p>We use cookies and local storage in three categories:</p>
        <Bullets items={[
          <><strong className="text-text">Strictly necessary</strong> — required to authenticate you and run the dashboard. These cannot be switched off without breaking the service.</>,
          <><strong className="text-text">Functional</strong> — set by our payment processor to keep checkout secure and prevent fraud.</>,
          <><strong className="text-text">Analytics</strong> — help us understand feature usage so we can improve the product. These are not used for advertising, and we do not sell the data.</>,
        ]} />
        <p>
          The free calculator tools at <Link href="/tools" className="text-primary hover:underline">specterapp.io/tools</Link>{' '}
          run entirely in your browser and do not require analytics cookies to function.
        </p>
      </Section>

      <Section id="table" num="03" title="Cookies and Storage We Set">
        <TableWrap>
          <thead>
            <tr><Th>Name</Th><Th>Category</Th><Th>Provider</Th><Th>Purpose</Th><Th>Duration</Th></tr>
          </thead>
          <tbody>
            <tr><Td>sb-access-token</Td><Td>Strictly necessary</Td><Td>Supabase</Td><Td>Maintains your authenticated session</Td><Td>~1 hour</Td></tr>
            <tr><Td>sb-refresh-token</Td><Td>Strictly necessary</Td><Td>Supabase</Td><Td>Refreshes your session securely</Td><Td>Up to 30 days</Td></tr>
            <tr><Td>ph_* / posthog (localStorage + cookie)</Td><Td>Analytics</Td><Td>PostHog (US)</Td><Td>Pseudonymised product-usage events; no advertising</Td><Td>Up to 1 year</Td></tr>
            <tr><Td>rzp_* / checkout cookies</Td><Td>Functional</Td><Td>Razorpay</Td><Td>Secure checkout state and fraud prevention during payment</Td><Td>Session – 1 year</Td></tr>
            <tr><Td>specter_pql_* (localStorage)</Td><Td>Functional</Td><Td>SPECTER</Td><Td>Remembers one-time product nudges so they aren&apos;t repeated</Td><Td>Until cleared</Td></tr>
          </tbody>
        </TableWrap>
        <p className="font-mono text-xs text-muted">
          Cookie names from third parties may change as those providers update their products. The
          categories above remain accurate.
        </p>
      </Section>

      <Section id="analytics" num="04" title="Analytics & Your Consent">
        <Callout variant="warning">
          <p>
            <strong className="text-text">EEA / UK visitors.</strong> Where required by the ePrivacy
            Directive and GDPR/UK GDPR, non-essential analytics cookies are only set with your consent.
            Strictly necessary and payment-security cookies do not require consent because they are
            essential to deliver a service you have requested.
          </p>
        </Callout>
        <p>
          Our analytics provider, PostHog, is configured to capture explicit product events
          (automatic field capture is disabled). We use it to improve features — never for behavioural
          advertising and never to sell data.
        </p>
      </Section>

      <Section id="manage" num="05" title="Managing or Disabling Cookies">
        <p>You can control cookies in several ways:</p>
        <Bullets items={[
          'Adjust your browser settings to block or delete cookies (see your browser&apos;s help pages).',
          'Use a privacy browser extension (such as uBlock Origin) to block analytics scripts.',
          'Clear your local storage from your browser&apos;s developer tools or privacy settings.',
        ]} />
        <p>
          Blocking strictly necessary cookies will prevent you from signing in and using the
          dashboard. Blocking analytics cookies has no effect on functionality.
        </p>
      </Section>

      <Section id="dnt" num="06" title="Do Not Track">
        <p>
          Some browsers send a &quot;Do Not Track&quot; (DNT) signal. There is no industry-standard
          response to DNT, and we do not currently respond to DNT signals. You can still control
          analytics using the methods above.
        </p>
      </Section>

      <Section id="changes" num="07" title="Changes to This Policy">
        <p>
          We may update this Cookie Policy as our use of cookies changes. The &quot;Last updated&quot;
          date at the top reflects the latest version. Material changes will be communicated in line
          with our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
        </p>
      </Section>

      <Section id="contact" num="08" title="Contact">
        <ContactCard
          rows={[{ label: 'Privacy & cookies', value: <MailLink email={LEGAL_EMAILS.privacy} /> }]}
          note="We aim to respond within 5 business days."
        />
        <RelatedDocs links={[
          { label: 'Privacy Policy', href: '/privacy' },
          { label: 'Subprocessors', href: '/subprocessors' },
          { label: 'Terms of Service', href: '/terms' },
        ]} />
      </Section>
    </LegalShell>
  )
}
