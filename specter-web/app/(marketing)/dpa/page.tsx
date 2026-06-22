import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalShell, Section, Callout, Bullets, TableWrap, Th, Td, ContactCard, MailLink, RelatedDocs } from '@/components/marketing/legal/legal-shell'
import { LEGAL_EMAILS } from '@/lib/legal/constants'

export const metadata: Metadata = {
  title: 'Data Processing Addendum — SPECTER',
  description: 'SPECTER&apos;s Data Processing Addendum (DPA) governing processing of personal data under GDPR, UK GDPR, and other data-protection laws.',
  alternates: { canonical: '/dpa' },
  robots: { index: true, follow: false },
}

const TOC = [
  { id: 'intro', label: 'Introduction' },
  { id: 'definitions', label: 'Definitions' },
  { id: 'roles', label: 'Roles of the Parties' },
  { id: 'scope', label: 'Scope & Instructions' },
  { id: 'details', label: 'Details of Processing' },
  { id: 'obligations', label: 'SPECTER&apos;s Obligations' },
  { id: 'security', label: 'Security Measures' },
  { id: 'subprocessors', label: 'Subprocessors' },
  { id: 'transfers', label: 'International Transfers' },
  { id: 'rights', label: 'Data-Subject Requests' },
  { id: 'breach', label: 'Breach Notification' },
  { id: 'audit', label: 'Audits' },
  { id: 'deletion', label: 'Return & Deletion' },
  { id: 'liability', label: 'Liability' },
  { id: 'accept', label: 'How to Execute' },
  { id: 'contact', label: 'Contact' },
]

export default function DpaPage() {
  return (
    <LegalShell title="Data Processing Addendum" toc={TOC} contactEmail={LEGAL_EMAILS.privacy} contactLabel="DPA & privacy">
      <Section id="intro" num="01" title="Introduction">
        <Callout>
          <p>
            This Data Processing Addendum (&quot;DPA&quot;) forms part of the{' '}
            <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> between
            SPECTER and the customer (&quot;Customer&quot;) and applies where SPECTER processes Personal
            Data on the Customer&apos;s behalf in connection with the platform. Where the Customer is
            subject to the GDPR, UK GDPR, or comparable laws, this DPA sets out the parties&apos;
            obligations. If there is a conflict between this DPA and the Terms on data-protection matters,
            this DPA prevails.
          </p>
        </Callout>
      </Section>

      <Section id="definitions" num="02" title="Definitions">
        <p>
          &quot;Personal Data&quot;, &quot;Processing&quot;, &quot;Controller&quot;, &quot;Processor&quot;,
          &quot;Data Subject&quot;, and &quot;Supervisory Authority&quot; have the meanings given in the
          GDPR / UK GDPR. &quot;Data Protection Laws&quot; means all laws applicable to the Processing of
          Personal Data under this DPA, including the EU GDPR, the UK GDPR and UK Data Protection Act
          2018, the CCPA/CPRA, the Indian Digital Personal Data Protection Act 2023, and other applicable
          privacy laws. &quot;Standard Contractual Clauses&quot; (&quot;SCCs&quot;) means the clauses
          approved by the European Commission and/or the UK Addendum issued by the UK Information
          Commissioner.
        </p>
      </Section>

      <Section id="roles" num="03" title="Roles of the Parties">
        <p>
          In respect of Customer Personal Data processed to provide the platform (for example, data the
          Customer&apos;s authorised users submit, and store/product data the Customer connects), the{' '}
          <strong className="text-text">Customer is the Controller</strong> and{' '}
          <strong className="text-text">SPECTER is the Processor</strong>. SPECTER acts as an independent
          Controller for limited data it processes for its own purposes (e.g. account administration,
          billing, security, and product analytics), as described in the{' '}
          <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
        </p>
      </Section>

      <Section id="scope" num="04" title="Scope & Processing Instructions">
        <p>
          SPECTER will process Customer Personal Data only (a) to provide and support the platform, (b)
          in accordance with the Customer&apos;s documented lawful instructions (including the Terms and
          the Customer&apos;s configuration of the platform), and (c) as required by law, in which case
          SPECTER will inform the Customer unless legally prohibited. SPECTER will notify the Customer if,
          in its opinion, an instruction infringes Data Protection Laws.
        </p>
      </Section>

      <Section id="details" num="05" title="Details of Processing (Annex)">
        <TableWrap>
          <thead><tr><Th>Element</Th><Th>Description</Th></tr></thead>
          <tbody>
            <tr><Td>Subject matter</Td><Td>Provision of competitor price-monitoring, AI pricing signals, and optional repricing.</Td></tr>
            <tr><Td>Duration</Td><Td>For the term of the subscription, plus the retention periods in the Privacy Policy.</Td></tr>
            <tr><Td>Nature & purpose</Td><Td>Collection, storage, organisation, analysis, and transmission to deliver the platform.</Td></tr>
            <tr><Td>Categories of Data Subject</Td><Td>The Customer&apos;s authorised users and personnel.</Td></tr>
            <tr><Td>Types of Personal Data</Td><Td>Names, business email addresses, account identifiers, IP addresses, usage data, and support correspondence. Store/product and competitor data is generally commercial, not personal.</Td></tr>
            <tr><Td>Special categories</Td><Td>None requested or required. The Customer must not submit special-category data.</Td></tr>
          </tbody>
        </TableWrap>
      </Section>

      <Section id="obligations" num="06" title="SPECTER&apos;s Obligations">
        <Bullets items={[
          'Process Personal Data only on documented instructions, as set out above.',
          'Ensure personnel authorised to process Personal Data are bound by confidentiality.',
          'Implement and maintain appropriate technical and organisational security measures (see below).',
          'Assist the Customer, taking into account the nature of processing, with data-subject requests and with the Customer&apos;s obligations regarding security, breach notification, and data-protection impact assessments.',
          'Make available information reasonably necessary to demonstrate compliance with Article 28 GDPR.',
        ]} />
      </Section>

      <Section id="security" num="07" title="Security Measures">
        <p>
          SPECTER implements the technical and organisational measures described on our{' '}
          <Link href="/security" className="text-primary hover:underline">Security &amp; Trust</Link> page,
          including encryption in transit and at rest, application-layer encryption of integration
          secrets, authenticated and least-privilege access, multi-tenant isolation, and monitoring.
          These measures form part of this DPA.
        </p>
      </Section>

      <Section id="subprocessors" num="08" title="Subprocessors">
        <p>
          The Customer provides general authorisation for SPECTER to engage the subprocessors listed on
          our <Link href="/subprocessors" className="text-primary hover:underline">Subprocessor List</Link>.
          SPECTER imposes data-protection obligations on each subprocessor that are no less protective
          than those in this DPA and remains responsible for their performance. SPECTER will give notice
          of intended changes and allow the Customer to object on reasonable data-protection grounds.
        </p>
      </Section>

      <Section id="transfers" num="09" title="International Transfers">
        <p>
          Where Processing involves transferring Personal Data from the EEA, UK, or Switzerland to a
          country without an adequacy decision, the parties agree that the applicable Standard
          Contractual Clauses (and UK Addendum, where relevant) are incorporated into this DPA by
          reference and apply to that transfer, with SPECTER as data importer. The relevant modules and
          options are those appropriate to a controller-to-processor (or processor-to-processor)
          relationship.
        </p>
      </Section>

      <Section id="rights" num="10" title="Data-Subject Requests">
        <p>
          Taking into account the nature of the processing, SPECTER will assist the Customer by
          appropriate technical and organisational measures, insofar as possible, to respond to requests
          from Data Subjects exercising their rights. If SPECTER receives such a request directly, it
          will, where lawful, direct the Data Subject to the Customer and promptly inform the Customer.
        </p>
      </Section>

      <Section id="breach" num="11" title="Personal Data Breach Notification">
        <p>
          SPECTER will notify the Customer without undue delay after becoming aware of a Personal Data
          Breach affecting Customer Personal Data, and will provide information reasonably available to
          help the Customer meet its own notification obligations to authorities and Data Subjects.
        </p>
      </Section>

      <Section id="audit" num="12" title="Audits">
        <p>
          SPECTER will make available information necessary to demonstrate compliance with this DPA and
          allow for and contribute to audits, including inspections, conducted by the Customer or an
          auditor it mandates. To protect platform security and other customers&apos; confidentiality,
          audits will be conducted on reasonable prior notice, no more than once per year (except where
          required by a Supervisory Authority or following a breach), subject to confidentiality, and may
          be satisfied by SPECTER providing relevant documentation.
        </p>
      </Section>

      <Section id="deletion" num="13" title="Return & Deletion">
        <p>
          On termination, and at the Customer&apos;s choice, SPECTER will delete or return Customer
          Personal Data and delete existing copies, save to the extent retention is required by law.
          Standard deletion timelines are described in the{' '}
          <Link href="/privacy#retention" className="text-primary hover:underline">Privacy Policy</Link>{' '}
          (deletion from primary systems is initiated within 30 days; backups may persist for up to a
          further 90 days before expiry).
        </p>
      </Section>

      <Section id="liability" num="14" title="Liability">
        <p>
          Each party&apos;s liability under this DPA is subject to the limitations and exclusions of
          liability set out in the{' '}
          <Link href="/terms#liability" className="text-primary hover:underline">Terms of Service</Link>,
          to the extent permitted by applicable law.
        </p>
      </Section>

      <Section id="accept" num="15" title="How to Execute This DPA">
        <p>
          For most customers, this DPA is automatically incorporated into the Terms of Service and
          requires no separate signature. Enterprise customers who require a countersigned copy, a
          negotiated DPA, or the SCCs as a standalone document may contact{' '}
          <MailLink email={LEGAL_EMAILS.privacy} /> and we will arrange execution.
        </p>
      </Section>

      <Section id="contact" num="16" title="Contact">
        <ContactCard rows={[
          { label: 'Data protection', value: <MailLink email={LEGAL_EMAILS.privacy} /> },
          { label: 'Legal', value: <MailLink email={LEGAL_EMAILS.legal} /> },
        ]} />
        <RelatedDocs links={[
          { label: 'Privacy Policy', href: '/privacy' },
          { label: 'Subprocessors', href: '/subprocessors' },
          { label: 'Security & Trust', href: '/security' },
        ]} />
      </Section>
    </LegalShell>
  )
}
