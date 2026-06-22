import type { ReactNode } from 'react'
import Link from 'next/link'
import Nav from '@/components/marketing/nav'
import Footer from '@/components/marketing/footer'
import { LEGAL_UPDATED, LEGAL_UPDATED_ISO, LEGAL_EFFECTIVE, LEGAL_EFFECTIVE_ISO, LEGAL_EMAILS } from '@/lib/legal/constants'

/**
 * Shared chrome + typographic primitives for every legal page. Kept as plain
 * server components (no hooks) so each page can still `export const metadata`.
 * One shell = consistent layout, ToC behaviour, and styling across all docs.
 */

export interface TocItem {
  id: string
  label: string
}

export function LegalShell({
  eyebrow = 'Legal',
  title,
  toc,
  contactEmail = LEGAL_EMAILS.legal,
  contactLabel = 'Legal questions?',
  children,
}: {
  eyebrow?: string
  title: string
  toc: TocItem[]
  contactEmail?: string
  contactLabel?: string
  children: ReactNode
}) {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-bg pt-28 pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">{eyebrow}</p>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-text tracking-tight mb-3">
              {title}
            </h1>
            <p className="font-body text-sm text-muted">
              Last updated: <time dateTime={LEGAL_UPDATED_ISO}>{LEGAL_UPDATED}</time>
              {' · '}
              Effective date: <time dateTime={LEGAL_EFFECTIVE_ISO}>{LEGAL_EFFECTIVE}</time>
            </p>
          </div>

          <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-16">
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <p className="font-mono text-[11px] text-primary uppercase tracking-widest mb-4">Contents</p>
                <nav className="space-y-1" aria-label={`${title} sections`}>
                  {toc.map(({ id, label }) => (
                    <a
                      key={id}
                      href={`#${id}`}
                      className="block font-body text-xs text-muted hover:text-text py-1 transition-colors leading-snug"
                    >
                      {label}
                    </a>
                  ))}
                </nav>
                <div className="mt-8 pt-6 border-t border-border/50">
                  <p className="font-mono text-[11px] text-muted mb-2">{contactLabel}</p>
                  <a href={`mailto:${contactEmail}`} className="font-mono text-[11px] text-primary hover:underline break-all">
                    {contactEmail}
                  </a>
                </div>
              </div>
            </aside>

            <div>{children}</div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

export function Section({
  id,
  num,
  title,
  children,
}: {
  id: string
  num: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-28 mb-12 pb-12 border-b border-border/50 last:border-0 last:mb-0">
      <div className="flex items-center gap-3 mb-5">
        <span className="font-mono text-[11px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
          {num}
        </span>
        <h2 className="font-display text-xl font-bold text-text">{title}</h2>
      </div>
      <div className="font-body text-muted leading-relaxed space-y-4 text-[15px]">{children}</div>
    </section>
  )
}

export function Callout({ variant = 'info', children }: { variant?: 'info' | 'warning' | 'danger'; children: ReactNode }) {
  const styles =
    variant === 'danger'
      ? 'bg-rose-400/5 border-rose-400/25'
      : variant === 'warning'
        ? 'bg-amber-400/5 border-amber-400/20'
        : 'bg-primary/5 border-primary/20'
  return (
    <div className={`${styles} border rounded-xl p-5 font-body text-sm text-muted leading-relaxed space-y-2`}>
      {children}
    </div>
  )
}

/** Legalese block — the all-caps, monospace treatment used for disclaimers/liability. */
export function Legalese({ children }: { children: ReactNode }) {
  return (
    <p className="uppercase text-[13px] font-mono tracking-wide text-text/80 leading-loose">{children}</p>
  )
}

export function Bullets({ items, tone = 'primary' }: { items: ReactNode[]; tone?: 'primary' | 'danger' }) {
  const dot = tone === 'danger' ? 'bg-rose-400' : 'bg-primary'
  return (
    <ul className="list-none space-y-2 pl-0">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className={`w-1 h-1 rounded-full ${dot} mt-2.5 shrink-0`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  )
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th className="text-left font-mono text-xs text-primary uppercase tracking-wider py-2.5 px-3 bg-surface border border-border/60">
      {children}
    </th>
  )
}

export function Td({ children }: { children: ReactNode }) {
  return (
    <td className="py-2.5 px-3 font-body text-xs text-muted border border-border/40 leading-relaxed align-top">
      {children}
    </td>
  )
}

export function ContactCard({ rows, note }: { rows: { label: string; value: ReactNode }[]; note?: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 space-y-2">
      {rows.map(({ label, value }, i) => (
        <p key={i}>
          <strong className="text-text">{label}:</strong> {value}
        </p>
      ))}
      {note && <p className="font-mono text-xs text-muted pt-2 border-t border-border/50">{note}</p>}
    </div>
  )
}

export function MailLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className="text-primary hover:underline">
      {email}
    </a>
  )
}

/** Cross-links to the rest of the legal suite — rendered at the foot of each page. */
export function RelatedDocs({ links }: { links: { label: string; href: string }[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {links.map(({ label, href }) => (
        <Link
          key={href}
          href={href}
          className="font-mono text-[11px] text-muted hover:text-primary border border-border/60 hover:border-primary/40 rounded-lg px-2.5 py-1 transition-colors"
        >
          {label} →
        </Link>
      ))}
    </div>
  )
}

export { LEGAL_EFFECTIVE, LEGAL_EFFECTIVE_ISO }
