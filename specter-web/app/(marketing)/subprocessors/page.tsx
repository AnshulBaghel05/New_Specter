import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalShell, Section, Callout, TableWrap, Th, Td, ContactCard, MailLink, RelatedDocs } from '@/components/marketing/legal/legal-shell'
import { LEGAL_EMAILS, SUBPROCESSORS } from '@/lib/legal/constants'

export const metadata: Metadata = {
  title: 'Subprocessors — SPECTER',
  description: 'The third-party subprocessors SPECTER uses to deliver the service, the data they handle, and their locations.',
  alternates: { canonical: '/subprocessors' },
  robots: { index: true, follow: false },
}

const TOC = [
  { id: 'about', label: 'About This List' },
  { id: 'list', label: 'Current Subprocessors' },
  { id: 'changes', label: 'Notice of Changes' },
  { id: 'contact', label: 'Contact' },
]

export default function SubprocessorsPage() {
  return (
    <LegalShell title="Subprocessors" toc={TOC} contactEmail={LEGAL_EMAILS.privacy} contactLabel="Privacy questions?">
      <Section id="about" num="01" title="About This List">
        <Callout>
          <p>
            To deliver SPECTER we rely on the third-party service providers (&quot;subprocessors&quot;)
            below. Each is engaged under terms that require appropriate confidentiality and security and
            that prohibit using your data for their own purposes. This list is referenced by our{' '}
            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and our{' '}
            <Link href="/dpa" className="text-primary hover:underline">Data Processing Addendum</Link>.
          </p>
        </Callout>
      </Section>

      <Section id="list" num="02" title="Current Subprocessors">
        <TableWrap>
          <thead>
            <tr><Th>Subprocessor</Th><Th>Purpose</Th><Th>Data handled</Th><Th>Location</Th><Th>Transfer safeguard</Th></tr>
          </thead>
          <tbody>
            {SUBPROCESSORS.map((s) => (
              <tr key={`${s.name}-${s.purpose}`}>
                <Td><strong className="text-text">{s.name}</strong></Td>
                <Td>{s.purpose}</Td>
                <Td>{s.data}</Td>
                <Td>{s.location}</Td>
                <Td>{s.transfer}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <p className="font-mono text-xs text-muted">
          We may also disclose data where required by law, court order, or governmental authority, or to
          protect the rights, property, or safety of SPECTER, our customers, or the public.
        </p>
      </Section>

      <Section id="changes" num="03" title="Notice of Changes">
        <p>
          We may add or replace subprocessors as the platform evolves — including additional payment
          processors. When we make a material change affecting how personal data is processed, we will
          update this page and, for customers under a signed Data Processing Addendum, provide notice in
          accordance with that addendum so you have the opportunity to object on reasonable
          data-protection grounds.
        </p>
      </Section>

      <Section id="contact" num="04" title="Contact">
        <ContactCard rows={[{ label: 'Privacy', value: <MailLink email={LEGAL_EMAILS.privacy} /> }]} />
        <RelatedDocs links={[
          { label: 'Privacy Policy', href: '/privacy' },
          { label: 'Data Processing Addendum', href: '/dpa' },
          { label: 'Security & Trust', href: '/security' },
        ]} />
      </Section>
    </LegalShell>
  )
}
