import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalShell, Section, Callout, Bullets, ContactCard, MailLink, RelatedDocs } from '@/components/marketing/legal/legal-shell'
import { LEGAL_EMAILS } from '@/lib/legal/constants'

export const metadata: Metadata = {
  title: 'Acceptable Use Policy — SPECTER',
  description: 'The rules governing acceptable use of the SPECTER platform, scraping features, API, and integrations.',
  alternates: { canonical: '/acceptable-use' },
  robots: { index: true, follow: false },
}

const TOC = [
  { id: 'scope', label: 'Scope' },
  { id: 'prohibited', label: 'Prohibited Uses' },
  { id: 'scraping', label: 'Scraping Conduct' },
  { id: 'api', label: 'API & Automation' },
  { id: 'security', label: 'Security & Integrity' },
  { id: 'content', label: 'Data & Content' },
  { id: 'enforcement', label: 'Enforcement' },
  { id: 'report', label: 'Reporting Abuse' },
]

export default function AcceptableUsePage() {
  return (
    <LegalShell title="Acceptable Use Policy" toc={TOC} contactEmail={LEGAL_EMAILS.abuse} contactLabel="Report abuse">
      <Section id="scope" num="01" title="Scope">
        <p>
          This Acceptable Use Policy (&quot;AUP&quot;) governs your use of the SPECTER platform, its
          scraping features, its API, and its Shopify/WooCommerce integrations. It is incorporated into
          and forms part of our{' '}
          <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>. Capitalised
          terms have the meaning given in the Terms. Violating this AUP is a material breach of the Terms.
        </p>
      </Section>

      <Section id="prohibited" num="02" title="Prohibited Uses">
        <p>You must not use SPECTER to:</p>
        <Bullets tone="danger" items={[
          'Violate any applicable law, regulation, or third-party right.',
          'Instruct SPECTER to access pages that require a login, password, paywall, or other authorisation, or that you are not permitted to access.',
          'Engage in any activity that constitutes unauthorised access under computer-misuse or computer-fraud laws.',
          'Resell, sublicense, white-label, or provide access to the platform to third parties without our written permission.',
          'Build or assist in building a competing product, or use the platform to benchmark for a competing service.',
          'Circumvent or attempt to circumvent plan limits, rate limits, quotas, billing, or access controls.',
          'Access, or attempt to access, another customer&apos;s account, data, or competitive intelligence.',
          'Impersonate any person or entity, or misrepresent your affiliation.',
          'Use the platform in connection with any fraudulent, deceptive, defamatory, or unlawful scheme.',
          'Use the platform to facilitate anti-competitive conduct, unlawful price-fixing, or collusion.',
        ]} />
      </Section>

      <Section id="scraping" num="03" title="Scraping Conduct">
        <Callout variant="warning">
          <p>
            You direct what SPECTER monitors. You are responsible for ensuring each competitor URL you
            submit is a publicly accessible page and that your monitoring and use of the data is lawful.
            Full terms are in our{' '}
            <Link href="/scraping-policy" className="text-primary hover:underline">Web Scraping &amp; Competitive Intelligence Policy</Link>.
          </p>
        </Callout>
        <Bullets tone="danger" items={[
          'Do not submit URLs to pages behind authentication, paywalls, or access controls.',
          'Do not use SPECTER to overload, disrupt, or damage any third-party website.',
          'Do not target pages containing primarily personal data of individuals rather than product/price information.',
          'Do not redistribute, resell, or sublicense raw data collected through SPECTER.',
        ]} />
      </Section>

      <Section id="api" num="04" title="API & Automation">
        <p>If we make an API or programmatic access available to you, you must:</p>
        <Bullets items={[
          'Stay within the published rate limits and quotas for your plan.',
          'Keep API keys and access tokens confidential and not embed them in client-side or public code.',
          'Not use automation to scrape, mirror, or replicate the SPECTER platform itself.',
          'Not aggregate API responses to reconstruct another customer&apos;s data or to build a competing dataset.',
        ]} />
        <p>
          We may throttle, suspend, or revoke API access that threatens platform stability, security,
          or fair use for other customers.
        </p>
      </Section>

      <Section id="security" num="05" title="Security & Integrity">
        <Bullets tone="danger" items={[
          'Do not probe, scan, or test the vulnerability of the platform without our prior written consent (see our responsible-disclosure contact in the Security page).',
          'Do not transmit malware, or any code intended to disrupt, disable, or damage systems.',
          'Do not reverse-engineer, decompile, or disassemble any part of the platform except where that restriction is prohibited by law.',
          'Do not interfere with the integrity or performance of the platform or its data.',
        ]} />
      </Section>

      <Section id="content" num="06" title="Data & Content Responsibility">
        <p>
          You are responsible for the lawfulness of the URLs, store data, and instructions you provide,
          and for your use of any output. You must not use SPECTER to process special-category personal
          data or to monitor pages whose primary purpose is to expose individuals&apos; personal
          information.
        </p>
      </Section>

      <Section id="enforcement" num="07" title="Enforcement">
        <p>
          We may investigate suspected violations and may suspend or terminate access — with or without
          notice, and without refund — where we reasonably believe this AUP has been breached or where
          required to protect the platform, other customers, third parties, or to comply with law.
          Where practical and lawful, we will give you notice and an opportunity to cure.
        </p>
      </Section>

      <Section id="report" num="08" title="Reporting Abuse">
        <ContactCard
          rows={[
            { label: 'Report abuse', value: <MailLink email={LEGAL_EMAILS.abuse} /> },
            { label: 'Security disclosure', value: <MailLink email={LEGAL_EMAILS.security} /> },
          ]}
        />
        <RelatedDocs links={[
          { label: 'Terms of Service', href: '/terms' },
          { label: 'Web Scraping Policy', href: '/scraping-policy' },
          { label: 'Security & Trust', href: '/security' },
        ]} />
      </Section>
    </LegalShell>
  )
}
