import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalShell, Section, Callout, Legalese, Bullets, ContactCard, MailLink, RelatedDocs } from '@/components/marketing/legal/legal-shell'
import { LEGAL_EMAILS } from '@/lib/legal/constants'

export const metadata: Metadata = {
  title: 'Web Scraping & Competitive Intelligence Policy — SPECTER',
  description: 'How SPECTER performs user-directed scraping of public competitor pages, your responsibilities, and the limits of data collection.',
  alternates: { canonical: '/scraping-policy' },
  robots: { index: true, follow: false },
}

const TOC = [
  { id: 'summary', label: 'Summary' },
  { id: 'model', label: 'User-Directed Model' },
  { id: 'what', label: 'What We Collect' },
  { id: 'how', label: 'How We Collect' },
  { id: 'responsibilities', label: 'Your Responsibilities' },
  { id: 'prohibited', label: 'Prohibited Targets' },
  { id: 'takedown', label: 'Website-Owner Requests' },
  { id: 'continuity', label: 'No Continuity Guarantee' },
  { id: 'liability', label: 'Allocation of Risk' },
  { id: 'contact', label: 'Contact' },
]

export default function ScrapingPolicyPage() {
  return (
    <LegalShell title="Web Scraping & Competitive Intelligence Policy" toc={TOC} contactEmail={LEGAL_EMAILS.legal}>
      <Section id="summary" num="01" title="Summary">
        <Callout variant="warning">
          <p>
            SPECTER collects publicly available competitor pricing and availability data{' '}
            <strong className="text-text">only when, and only from the URLs that, you direct it to</strong>.
            You decide what is monitored. You are responsible for ensuring that the pages you submit are
            public and that your monitoring and use of the data is lawful in your jurisdiction. This
            Policy is part of our{' '}
            <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> and{' '}
            <Link href="/acceptable-use" className="text-primary hover:underline">Acceptable Use Policy</Link>.
          </p>
        </Callout>
      </Section>

      <Section id="model" num="02" title="The User-Directed Model">
        <p>
          SPECTER does not crawl the open web, maintain a general index, or decide on its own which
          sites to monitor. It acts <strong className="text-text">at your instruction and on your
          behalf</strong>: when you add a competitor product URL, you are authorising SPECTER to
          retrieve that specific page on a recurring basis and to extract price and availability
          information from it. In this role SPECTER provides the technical infrastructure; you remain
          the party that selects the target and determines the purpose.
        </p>
      </Section>

      <Section id="what" num="03" title="What We Collect">
        <p>From the URLs you provide, SPECTER collects only publicly visible product information:</p>
        <Bullets items={[
          'Displayed price and currency',
          'Stock / availability status',
          'Product title and basic descriptive metadata',
        ]} />
        <p>
          We do <strong className="text-text">not</strong> collect login-protected content, checkout or
          basket flows, payment data, or personal data about the end consumers of the websites you
          monitor. We do not attempt to defeat authentication.
        </p>
      </Section>

      <Section id="how" num="04" title="How We Collect">
        <p>
          Collection is designed to be lightweight and respectful of target sites. SPECTER attempts a
          standard HTTP request first and only escalates to a full browser render where a page requires
          it. Requests are rate-limited and spread over time, and collection runs on a per-plan refresh
          interval rather than continuously. We honour an internal exclusion list and will stop
          collecting from a domain when required (see Website-Owner Requests).
        </p>
        <p>
          Technical measures are not a substitute for your legal responsibility for choosing targets;
          they reduce load and risk but do not determine lawfulness.
        </p>
      </Section>

      <Section id="responsibilities" num="05" title="Your Responsibilities">
        <p>By submitting a URL to SPECTER, you represent and warrant that:</p>
        <Bullets items={[
          'The URL points to a publicly accessible page that does not require authentication to view.',
          'You have a legitimate competitive-intelligence interest in monitoring that page.',
          'Your collection and use of the data complies with all applicable laws, including computer-misuse, contract, intellectual-property, competition, and data-protection laws.',
          'You have considered the target website&apos;s terms of use and your obligations in respect of them.',
          'You will use the collected data only for your own internal business purposes and will not redistribute, resell, or sublicense raw collected data.',
        ]} />
      </Section>

      <Section id="prohibited" num="06" title="Prohibited Targets">
        <Bullets tone="danger" items={[
          'Pages behind a login, paywall, or other access control.',
          'Pages you are contractually or legally prohibited from accessing in an automated manner.',
          'Pages whose primary content is the personal data of individuals rather than products and prices.',
          'Any target where monitoring would facilitate unlawful collusion, price-fixing, or other anti-competitive conduct.',
        ]} />
      </Section>

      <Section id="takedown" num="07" title="Website-Owner Requests">
        <p>
          If you operate a website and wish to object to collection directed at your domain by SPECTER
          users, contact <MailLink email={LEGAL_EMAILS.legal} />. We maintain a domain-exclusion
          mechanism and will review legitimate requests and, where appropriate, add a domain to our
          exclusion list so that SPECTER ceases collecting from it. Because collection is user-directed,
          we may also notify affected customers that a target has become unavailable.
        </p>
      </Section>

      <Section id="continuity" num="08" title="No Continuity or Accuracy Guarantee">
        <p>
          Websites may add anti-bot measures, require login, change their structure, throttle requests,
          or block collection at any time. Collected values may be delayed, incomplete, or inaccurate
          for reasons outside our control. SPECTER does not guarantee uninterrupted collection or the
          accuracy, completeness, or currency of any collected data, and a failure to collect from a
          given URL is not a service defect and does not entitle you to a refund.
        </p>
      </Section>

      <Section id="liability" num="09" title="Allocation of Risk">
        <Legalese>
          BECAUSE YOU SELECT THE TARGETS AND CONTROL THE USE OF THE DATA, YOU ARE SOLELY RESPONSIBLE FOR
          THE LAWFULNESS OF THE MONITORING YOU DIRECT. TO THE MAXIMUM EXTENT PERMITTED BY LAW, SPECTER
          DISCLAIMS LIABILITY FOR CLAIMS ARISING FROM THE URLS YOU SUBMIT OR YOUR USE OF COLLECTED DATA,
          AND YOU AGREE TO INDEMNIFY SPECTER FOR SUCH CLAIMS AS SET OUT IN THE TERMS OF SERVICE.
        </Legalese>
      </Section>

      <Section id="contact" num="10" title="Contact">
        <ContactCard rows={[
          { label: 'Legal & website-owner requests', value: <MailLink email={LEGAL_EMAILS.legal} /> },
          { label: 'Abuse', value: <MailLink email={LEGAL_EMAILS.abuse} /> },
        ]} />
        <RelatedDocs links={[
          { label: 'Terms of Service', href: '/terms' },
          { label: 'Acceptable Use Policy', href: '/acceptable-use' },
          { label: 'AI & Automated Decisions', href: '/ai-disclosure' },
        ]} />
      </Section>
    </LegalShell>
  )
}
