import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalShell, Section, Callout, Bullets, ContactCard, MailLink, RelatedDocs } from '@/components/marketing/legal/legal-shell'
import { LEGAL_EMAILS } from '@/lib/legal/constants'

export const metadata: Metadata = {
  title: 'Enterprise & Compliance — SPECTER',
  description: 'A single reference for procurement, security, and legal teams evaluating SPECTER: documents, data handling, and compliance posture.',
  alternates: { canonical: '/enterprise-compliance' },
  robots: { index: true, follow: false },
}

const TOC = [
  { id: 'intro', label: 'For Procurement & Legal' },
  { id: 'documents', label: 'Document Index' },
  { id: 'data', label: 'Data Handling at a Glance' },
  { id: 'compliance', label: 'Regulatory Posture' },
  { id: 'maturity', label: 'Programme Maturity' },
  { id: 'requests', label: 'Vendor Reviews & Requests' },
  { id: 'contact', label: 'Contact' },
]

export default function EnterpriseCompliancePage() {
  return (
    <LegalShell title="Enterprise & Compliance" toc={TOC} contactEmail={LEGAL_EMAILS.legal} contactLabel="Procurement & legal">
      <Section id="intro" num="01" title="For Procurement, Security & Legal Teams">
        <Callout>
          <p>
            This page is a single entry point for teams evaluating SPECTER. It links the documents you
            need for a vendor review and summarises how we handle data and which regimes we design for.
            For anything not answered here, contact <MailLink email={LEGAL_EMAILS.legal} />.
          </p>
        </Callout>
      </Section>

      <Section id="documents" num="02" title="Document Index">
        <Bullets items={[
          <><Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> — the master agreement.</>,
          <><Link href="/dpa" className="text-primary hover:underline">Data Processing Addendum</Link> — Article 28 controller/processor terms, SCCs, breach notice.</>,
          <><Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> — what we collect and why; lawful bases; your rights.</>,
          <><Link href="/security" className="text-primary hover:underline">Security &amp; Trust</Link> — technical and organisational measures.</>,
          <><Link href="/subprocessors" className="text-primary hover:underline">Subprocessor List</Link> — every third party in the data path.</>,
          <><Link href="/ai-disclosure" className="text-primary hover:underline">AI &amp; Automated Decisions</Link> — how signals and repricing work and their limits.</>,
          <><Link href="/scraping-policy" className="text-primary hover:underline">Web Scraping Policy</Link> — the user-directed monitoring model and responsibilities.</>,
          <><Link href="/acceptable-use" className="text-primary hover:underline">Acceptable Use Policy</Link> — platform, API, and scraping conduct rules.</>,
        ]} />
      </Section>

      <Section id="data" num="03" title="Data Handling at a Glance">
        <Bullets items={[
          'We process business contact and usage data; we do not require or want your end-customers&apos; personal data.',
          'Competitor and product data is commercial, scoped to your account, and never shared with other customers or sold.',
          'Integration secrets (e.g. Shopify tokens) are encrypted at the application layer and never exposed.',
          'Payments run through Razorpay; we never receive full card data.',
          'AI processing (Google Gemini) receives only product titles and collected competitor prices.',
        ]} />
      </Section>

      <Section id="compliance" num="04" title="Regulatory Posture">
        <Bullets items={[
          'GDPR & UK GDPR — DPA with SCCs/UK Addendum; lawful-basis mapping; data-subject-rights support.',
          'CCPA/CPRA — we do not sell or share personal information for cross-context behavioural advertising.',
          'India DPDP Act 2023 — designed for as our home jurisdiction and ongoing compliance.',
          'PCI DSS — card data handled solely by our PCI-compliant payment processor.',
          'Canada (CASL) & email laws — consent-based marketing with one-click unsubscribe.',
        ]} />
      </Section>

      <Section id="maturity" num="05" title="Programme Maturity (Honest Status)">
        <Callout variant="warning">
          <p>
            We believe in accurate disclosure. SPECTER is an early-stage product. We implement strong
            engineering security controls, but we do <strong className="text-text">not</strong> currently
            hold third-party certifications such as SOC 2 Type II or ISO 27001, and we do not yet publish
            a contractual uptime SLA. Where an enterprise engagement requires specific commitments,
            certifications, or a negotiated agreement, contact us to discuss what we can offer on the
            relevant timeline.
          </p>
        </Callout>
      </Section>

      <Section id="requests" num="06" title="Vendor Reviews & Requests">
        <p>
          We are happy to support reasonable vendor-security reviews, complete security questionnaires,
          provide a countersigned DPA, and discuss enterprise terms (including the ECLIPSE tier). To keep
          turnaround fast, please send your requirements and timeline up front.
        </p>
      </Section>

      <Section id="contact" num="07" title="Contact">
        <ContactCard rows={[
          { label: 'Procurement & legal', value: <MailLink email={LEGAL_EMAILS.legal} /> },
          { label: 'Security', value: <MailLink email={LEGAL_EMAILS.security} /> },
          { label: 'Privacy / DPA', value: <MailLink email={LEGAL_EMAILS.privacy} /> },
        ]} />
        <RelatedDocs links={[
          { label: 'Terms of Service', href: '/terms' },
          { label: 'Security & Trust', href: '/security' },
          { label: 'Data Processing Addendum', href: '/dpa' },
        ]} />
      </Section>
    </LegalShell>
  )
}
