import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText, Shield, Building2 } from 'lucide-react'
import Nav from '@/components/marketing/nav'
import Footer from '@/components/marketing/footer'
import { LEGAL_EMAILS, LEGAL_UPDATED } from '@/lib/legal/constants'

export const metadata: Metadata = {
  title: 'Legal Center — SPECTER',
  description: 'Every SPECTER legal document in one place: terms, privacy, cookies, refunds, acceptable use, DPA, security, subprocessors, AI, and scraping.',
  alternates: { canonical: '/legal' },
  robots: { index: true, follow: true },
}

interface Doc {
  label: string
  href: string
  blurb: string
}

const GROUPS: { title: string; icon: typeof FileText; docs: Doc[] }[] = [
  {
    title: 'Agreements',
    icon: FileText,
    docs: [
      { label: 'Terms of Service', href: '/terms', blurb: 'The master agreement governing your use of SPECTER.' },
      { label: 'Acceptable Use Policy', href: '/acceptable-use', blurb: 'Rules for the platform, API, and scraping features.' },
      { label: 'Refund & Cancellation', href: '/refunds', blurb: 'Cancellations, renewals, refunds, and failed payments.' },
      { label: 'Web Scraping Policy', href: '/scraping-policy', blurb: 'How user-directed monitoring works and your responsibilities.' },
    ],
  },
  {
    title: 'Privacy & Data',
    icon: Shield,
    docs: [
      { label: 'Privacy Policy', href: '/privacy', blurb: 'What we collect, why, and your rights (GDPR, CCPA, DPDP).' },
      { label: 'Cookie Policy', href: '/cookies', blurb: 'Cookies we use and how to control them.' },
      { label: 'Data Processing Addendum', href: '/dpa', blurb: 'Article 28 controller/processor terms and SCCs.' },
      { label: 'Subprocessors', href: '/subprocessors', blurb: 'Every third party in our data path.' },
      { label: 'AI & Automated Decisions', href: '/ai-disclosure', blurb: 'How AI signals and auto-repricing work and their limits.' },
    ],
  },
  {
    title: 'Trust & Enterprise',
    icon: Building2,
    docs: [
      { label: 'Security & Trust', href: '/security', blurb: 'Our technical and organisational security measures.' },
      { label: 'Enterprise & Compliance', href: '/enterprise-compliance', blurb: 'A single reference for procurement and legal teams.' },
    ],
  },
]

export default function LegalCenterPage() {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-bg pt-28 pb-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">Legal Center</p>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-text tracking-tight mb-3">
              Legal documents
            </h1>
            <p className="font-body text-sm text-muted max-w-2xl">
              Everything that governs how SPECTER operates, handles your data, and protects both sides.
              Click any tag to read the full document. Last updated {LEGAL_UPDATED}.
            </p>
          </div>

          <div className="flex flex-col gap-10">
            {GROUPS.map(({ title, icon: Icon, docs }) => (
              <section key={title}>
                <div className="flex items-center gap-2.5 mb-4">
                  <Icon size={16} className="text-primary" aria-hidden="true" />
                  <h2 className="font-display text-lg font-semibold text-text">{title}</h2>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {docs.map((d) => (
                    <Link
                      key={d.href}
                      href={d.href}
                      className="font-mono text-xs text-muted hover:text-primary border border-border hover:border-primary/40 bg-surface rounded-lg px-3 py-1.5 transition-colors"
                    >
                      {d.label}
                    </Link>
                  ))}
                </div>

                {/* Cards with blurbs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {docs.map((d) => (
                    <Link
                      key={`${d.href}-card`}
                      href={d.href}
                      className="group rounded-xl border border-border bg-surface p-4 hover:border-primary/40 transition-colors"
                    >
                      <p className="font-body text-sm font-semibold text-text group-hover:text-primary transition-colors">
                        {d.label} <span aria-hidden="true">→</span>
                      </p>
                      <p className="font-body text-xs text-muted mt-1 leading-relaxed">{d.blurb}</p>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-border/50">
            <p className="font-body text-sm text-muted">
              Questions about any document? Email{' '}
              <a href={`mailto:${LEGAL_EMAILS.legal}`} className="text-primary hover:underline">{LEGAL_EMAILS.legal}</a>.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
