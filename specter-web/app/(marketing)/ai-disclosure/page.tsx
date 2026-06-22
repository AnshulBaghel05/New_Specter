import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalShell, Section, Callout, Legalese, Bullets, ContactCard, MailLink, RelatedDocs } from '@/components/marketing/legal/legal-shell'
import { LEGAL_EMAILS, PLAN_FACTS } from '@/lib/legal/constants'

export const metadata: Metadata = {
  title: 'AI & Automated Decision-Making Disclosure — SPECTER',
  description: 'How SPECTER uses AI to generate pricing signals, how optional auto-repricing works, and the limits of those features.',
  alternates: { canonical: '/ai-disclosure' },
  robots: { index: true, follow: false },
}

const TOC = [
  { id: 'summary', label: 'Summary' },
  { id: 'how', label: 'How the AI Works' },
  { id: 'provider', label: 'AI Provider & Data' },
  { id: 'signals', label: 'Signals Are Advisory' },
  { id: 'reprice', label: 'Optional Auto-Repricing' },
  { id: 'guardrails', label: 'Guardrails & Your Control' },
  { id: 'limits', label: 'Known Limitations' },
  { id: 'gdpr', label: 'Automated Decisions & GDPR' },
  { id: 'disclaimer', label: 'Disclaimer' },
  { id: 'contact', label: 'Contact' },
]

export default function AiDisclosurePage() {
  return (
    <LegalShell title="AI & Automated Decision-Making Disclosure" toc={TOC} contactEmail={LEGAL_EMAILS.legal}>
      <Section id="summary" num="01" title="Summary">
        <Callout variant="warning">
          <p>
            SPECTER uses artificial intelligence to suggest <strong className="text-text">RAISE</strong>,{' '}
            <strong className="text-text">LOWER</strong>, or <strong className="text-text">HOLD</strong>{' '}
            pricing actions for your products. These are <strong className="text-text">recommendations,
            not advice and not guarantees</strong>. You are responsible for every pricing decision,
            whether or not you rely on a signal. Auto-repricing is optional, off by default, and operates
            only inside the floor/ceiling limits you set.
          </p>
        </Callout>
      </Section>

      <Section id="how" num="02" title="How the AI Works">
        <p>
          After SPECTER collects competitor prices and availability for the products you track, an AI
          model analyses that data — together with your configured prices and guardrails — and produces
          a signal (RAISE / LOWER / HOLD), an optional suggested price, and a confidence indicator.
          Signals are generated on your plan&apos;s refresh cycle ({PLAN_FACTS.refreshIntervalLabel}).
        </p>
      </Section>

      <Section id="provider" num="03" title="AI Provider & Data Sent">
        <p>
          AI signal generation is performed using <strong className="text-text">Google&apos;s Gemini
          API</strong> as a subprocessor. The data sent for this purpose is limited to your product
          titles and the competitor price/availability data collected for your account. We do{' '}
          <strong className="text-text">not</strong> send end-consumer personal data, payment data, or
          your store&apos;s customer records to the AI provider. See our{' '}
          <Link href="/subprocessors" className="text-primary hover:underline">Subprocessor List</Link>{' '}
          and <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
        </p>
      </Section>

      <Section id="signals" num="04" title="Signals Are Advisory Only">
        <Bullets items={[
          'Signals are estimates produced from imperfect, third-party data that may be delayed or inaccurate.',
          'A signal is not financial, tax, legal, competition-law, or professional advice.',
          'Past signal performance does not predict future results; no signal guarantees profit, margin, or sales.',
          'You should apply your own commercial judgement and, where relevant, professional advice before acting.',
        ]} />
      </Section>

      <Section id="reprice" num="05" title="Optional Auto-Repricing">
        <p>
          Auto-repricing is an opt-in feature available from the {PLAN_FACTS.autoRepriceMinPlan} plan
          upward. When enabled, SPECTER may update your product prices on your connected Shopify or
          WooCommerce store automatically, but <strong className="text-text">only within the floor and
          ceiling guardrails you define</strong>. You can also apply a suggested price manually with an
          explicit one-click confirmation. Every price change SPECTER makes is recorded in an auditable
          change history.
        </p>
      </Section>

      <Section id="guardrails" num="06" title="Guardrails & Your Control">
        <Bullets items={[
          'Auto-repricing is OFF by default and must be deliberately enabled.',
          'You set a floor and ceiling; SPECTER will not price outside that band, and re-validates the limits server-side before writing.',
          'You can disable auto-repricing, per product or globally, at any time.',
          'Manual application of a suggested price always requires your explicit confirmation before it is written to your store.',
        ]} />
      </Section>

      <Section id="limits" num="07" title="Known Limitations">
        <Bullets tone="danger" items={[
          'AI models can produce incorrect, biased, or unexpected outputs ("hallucinations").',
          'Input data may be stale or wrong if a competitor page changed or blocked collection.',
          'Misconfigured guardrails (e.g. a floor set too low) can result in undesired prices — this is within your control and your responsibility.',
          'Third-party platform or API failures can delay or prevent a price update from being applied.',
        ]} />
      </Section>

      <Section id="gdpr" num="08" title="Automated Decision-Making & GDPR">
        <p>
          SPECTER&apos;s automated features make decisions about <strong className="text-text">product
          prices</strong>, not about individuals. They do not produce legal or similarly significant
          effects concerning a natural person, and therefore do not constitute solely automated
          decision-making about data subjects under Article 22 of the GDPR/UK GDPR. The merchant remains
          in control of pricing through the guardrails and confirmation steps described above.
        </p>
      </Section>

      <Section id="disclaimer" num="09" title="Disclaimer">
        <Legalese>
          AI-GENERATED SIGNALS, SUGGESTIONS, AND AUTO-REPRICING ARE PROVIDED &quot;AS IS&quot; WITHOUT
          WARRANTY OF ACCURACY, PROFITABILITY, OR FITNESS FOR ANY PURPOSE. YOU ARE SOLELY RESPONSIBLE
          FOR ALL PRICING DECISIONS AND THEIR CONSEQUENCES, INCLUDING PRICES APPLIED AUTOMATICALLY
          WITHIN GUARDRAILS YOU CONFIGURED. TO THE MAXIMUM EXTENT PERMITTED BY LAW, SPECTER DISCLAIMS
          LIABILITY FOR LOSSES ARISING FROM RELIANCE ON THESE FEATURES, AS FURTHER SET OUT IN THE{' '}
          TERMS OF SERVICE.
        </Legalese>
      </Section>

      <Section id="contact" num="10" title="Contact">
        <ContactCard rows={[{ label: 'Questions', value: <MailLink email={LEGAL_EMAILS.legal} /> }]} />
        <RelatedDocs links={[
          { label: 'Terms of Service', href: '/terms' },
          { label: 'Web Scraping Policy', href: '/scraping-policy' },
          { label: 'Subprocessors', href: '/subprocessors' },
        ]} />
      </Section>
    </LegalShell>
  )
}
