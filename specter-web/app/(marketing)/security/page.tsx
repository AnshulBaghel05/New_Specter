import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalShell, Section, Callout, Bullets, ContactCard, MailLink, RelatedDocs } from '@/components/marketing/legal/legal-shell'
import { LEGAL_EMAILS } from '@/lib/legal/constants'

export const metadata: Metadata = {
  title: 'Security & Trust — SPECTER',
  description: 'SPECTER&apos;s technical and organisational security measures: encryption, access control, tenant isolation, and responsible disclosure.',
  alternates: { canonical: '/security' },
  robots: { index: true, follow: false },
}

const TOC = [
  { id: 'overview', label: 'Overview' },
  { id: 'encryption', label: 'Encryption' },
  { id: 'auth', label: 'Authentication & Access' },
  { id: 'tenant', label: 'Tenant Isolation' },
  { id: 'integration', label: 'Integration Security' },
  { id: 'infra', label: 'Infrastructure & Hardening' },
  { id: 'payments', label: 'Payment Security' },
  { id: 'monitoring', label: 'Monitoring & Resilience' },
  { id: 'incident', label: 'Incident Response' },
  { id: 'disclosure', label: 'Responsible Disclosure' },
  { id: 'shared', label: 'Shared Responsibility' },
  { id: 'contact', label: 'Contact' },
]

export default function SecurityPage() {
  return (
    <LegalShell title="Security & Trust" toc={TOC} contactEmail={LEGAL_EMAILS.security} contactLabel="Security contact">
      <Section id="overview" num="01" title="Overview">
        <Callout>
          <p>
            Security is built into how SPECTER is engineered. This page describes the technical and
            organisational measures we use to protect your data. It reflects the platform as currently
            built; specific controls evolve as we improve. It complements our{' '}
            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and{' '}
            <Link href="/dpa" className="text-primary hover:underline">Data Processing Addendum</Link>.
          </p>
        </Callout>
      </Section>

      <Section id="encryption" num="02" title="Encryption">
        <Bullets items={[
          'Data in transit is encrypted using TLS 1.2 or higher across all endpoints.',
          'Data at rest is encrypted by our database provider (Supabase) using AES-256.',
          'Sensitive integration secrets — including Shopify access tokens — are additionally encrypted at the application layer before storage, and are never exposed in API responses, the UI, or logs.',
        ]} />
      </Section>

      <Section id="auth" num="03" title="Authentication & Access Control">
        <Bullets items={[
          'Authentication is handled by Supabase Auth using industry-standard password hashing, with multi-factor authentication available.',
          'Every API request is authenticated with a signed JSON Web Token (JWT) validated server-side.',
          'Plan-tier and feature entitlements are enforced server-side — not merely hidden in the interface.',
          'Access to production data by our personnel is limited to those who need it to operate the service.',
        ]} />
      </Section>

      <Section id="tenant" num="04" title="Multi-Tenant Isolation">
        <p>
          Each customer&apos;s data is logically isolated and scoped to their account. Requests for
          records that do not belong to the authenticated account are rejected. Your competitive
          intelligence — the URLs you monitor, the prices collected, and the signals generated — is not
          aggregated with, or made accessible to, other customers, and we do not build or sell aggregate
          market-data products from it.
        </p>
      </Section>

      <Section id="integration" num="05" title="Integration Security">
        <Bullets items={[
          'Store connections use OAuth scopes limited to what the features require (reading products, and — only if you enable repricing — updating prices).',
          'Competitor URLs are validated against anti-abuse and server-side request forgery (SSRF) protections before any collection occurs, blocking internal/private network targets.',
          'Data ingested from the scraping workers is authenticated with an HMAC-signed secret and is idempotent, so retried jobs cannot corrupt your data.',
        ]} />
      </Section>

      <Section id="infra" num="06" title="Infrastructure & Hardening">
        <Bullets items={[
          'Cross-origin access is restricted by an allowlist that fails closed in production.',
          'Sensitive and cost-incurring endpoints are rate-limited.',
          'Secrets are held in environment configuration, never committed to source control.',
          'Dependencies are reviewed and updated on an ongoing basis.',
        ]} />
      </Section>

      <Section id="payments" num="07" title="Payment Security">
        <p>
          Payments are processed by <strong className="text-text">Razorpay</strong>. SPECTER does not
          receive or store your full card number, CVC, or bank credentials — these are handled directly
          by the PCI-DSS-compliant payment processor. We store only billing metadata such as your
          billing email, plan tier, and subscription status.
        </p>
      </Section>

      <Section id="monitoring" num="08" title="Monitoring & Resilience">
        <Bullets items={[
          'Application errors and performance are monitored via Sentry to detect and diagnose issues.',
          'Liveness and readiness health checks cover database and cache connectivity.',
          'Background jobs use retry-with-backoff and a dead-letter path so transient failures do not silently drop work.',
          'The primary database is managed with provider-side backups.',
        ]} />
      </Section>

      <Section id="incident" num="09" title="Incident Response">
        <p>
          We maintain an internal process for investigating and responding to security incidents. Where
          a personal-data breach is likely to result in a risk to individuals, we will notify affected
          customers and, where applicable, supervisory authorities within the timeframes required by law
          (for example, without undue delay and, where feasible, within 72 hours under the GDPR/UK GDPR).
          Notification obligations to enterprise customers are detailed in the{' '}
          <Link href="/dpa" className="text-primary hover:underline">DPA</Link>.
        </p>
      </Section>

      <Section id="disclosure" num="10" title="Responsible Disclosure">
        <p>
          If you believe you have found a security vulnerability, please report it to{' '}
          <MailLink email={LEGAL_EMAILS.security} /> with enough detail to reproduce it. Please act in
          good faith, avoid accessing or modifying other users&apos; data, and give us a reasonable
          opportunity to remediate before any public disclosure. We will not pursue good-faith security
          research that follows this guidance.
        </p>
      </Section>

      <Section id="shared" num="11" title="Shared Responsibility">
        <p>
          Security is a shared responsibility. We secure the platform; you are responsible for
          safeguarding your account credentials, enabling MFA, managing who in your organisation has
          access, and configuring guardrails and integrations appropriately. No method of transmission
          or storage is completely secure, and we cannot guarantee absolute security.
        </p>
      </Section>

      <Section id="contact" num="12" title="Contact">
        <ContactCard rows={[
          { label: 'Security & disclosure', value: <MailLink email={LEGAL_EMAILS.security} /> },
          { label: 'Privacy', value: <MailLink email={LEGAL_EMAILS.privacy} /> },
        ]} />
        <RelatedDocs links={[
          { label: 'Privacy Policy', href: '/privacy' },
          { label: 'Data Processing Addendum', href: '/dpa' },
          { label: 'Subprocessors', href: '/subprocessors' },
          { label: 'Enterprise & Compliance', href: '/enterprise-compliance' },
        ]} />
      </Section>
    </LegalShell>
  )
}
