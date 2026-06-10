import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, MessageSquare, Headphones, Shield, Clock, ArrowRight } from 'lucide-react'
import Nav from '@/components/marketing/nav'
import Footer from '@/components/marketing/footer'

export const metadata: Metadata = {
  title: 'Contact SPECTER — Get in Touch',
  description:
    'Reach out to the SPECTER team for sales, support, partnerships, or privacy questions. Real humans read every message.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact SPECTER',
    description: 'Sales, support, general questions, and privacy inquiries.',
    type: 'website',
    url: '/contact',
  },
}

const CONTACT_CARDS = [
  {
    icon: Mail,
    label: 'General',
    email: 'hello@specterapp.io',
    desc: 'General questions, partnerships, and press inquiries. If it doesn\'t fit elsewhere, start here.',
    response: 'Within 48 hours',
  },
  {
    icon: MessageSquare,
    label: 'Sales',
    email: 'sales@specterapp.io',
    desc: 'Questions about plans, pricing, volume discounts, or getting your team set up.',
    response: 'Within 24 hours',
  },
  {
    icon: Headphones,
    label: 'Support',
    email: 'support@specterapp.io',
    desc: 'Help with your account, Shopify integration, scraping setup, or platform features.',
    response: 'Within 24 hours',
  },
  {
    icon: Shield,
    label: 'Privacy',
    email: 'privacy@specterapp.io',
    desc: 'Data access, correction, or deletion requests. GDPR, CCPA, and all other privacy inquiries.',
    response: 'Within 30 days (legally required)',
  },
]

const FAQS = [
  {
    q: 'Is SPECTER live yet?',
    a: 'The free calculator tools are fully live at specterapp.io/tools — no account needed. The full pricing intelligence platform (real-time monitoring, AI signals, auto-repricing) is in active development. Sign up to get early access when it launches.',
  },
  {
    q: 'How do I request my data or delete my account?',
    a: 'Email privacy@specterapp.io with your request. We\'ll process it within 30 days. For data deletion, we\'ll remove all personally identifiable information from our systems and confirm when complete.',
  },
  {
    q: 'Do you support WooCommerce as well as Shopify?',
    a: 'Yes — SPECTER integrates with both Shopify and WooCommerce. If you\'re on a different platform, email hello@specterapp.io and we\'ll let you know about our roadmap.',
  },
  {
    q: 'Can I get a demo or talk to someone before signing up?',
    a: 'Absolutely. Email sales@specterapp.io and we\'ll schedule a call. We\'re happy to walk through the platform and answer any questions specific to your store.',
  },
]

export default function ContactPage() {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-bg">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="pt-32 pb-16 px-6 text-center">
          <div className="max-w-2xl mx-auto">
            <div
              className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 text-primary text-xs font-mono uppercase tracking-widest px-4 py-1.5 rounded-full mb-8"
              aria-hidden="true"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Contact
            </div>
            <h1 className="font-display text-5xl md:text-6xl font-bold text-text tracking-tight mb-5 leading-[1.08]">
              We&apos;d love to<br />
              <span className="text-primary">hear from you.</span>
            </h1>
            <p className="font-body text-lg text-muted leading-relaxed max-w-md mx-auto">
              Choose the right inbox below. We&apos;re a small team —
              real humans read every message.
            </p>
          </div>
        </section>

        {/* ── Contact cards ────────────────────────────────────────────────── */}
        <section className="px-6 pb-20">
          <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-5">
            {CONTACT_CARDS.map(({ icon: Icon, label, email, desc, response }) => (
              <a
                key={email}
                href={`mailto:${email}`}
                className="group bg-surface border border-border hover:border-primary/40 hover:bg-surface/80 rounded-2xl p-7 transition-all duration-200 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-primary" aria-hidden="true" />
                  </div>
                  <p className="font-display font-bold text-text text-sm">{label}</p>
                </div>
                <p className="font-body text-sm text-muted leading-relaxed mb-5 flex-1">{desc}</p>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-xs text-primary group-hover:underline">{email}</p>
                  <ArrowRight
                    size={12}
                    className="text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-hidden="true"
                  />
                </div>
                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/60">
                  <Clock size={11} className="text-muted shrink-0" aria-hidden="true" />
                  <p className="font-mono text-[11px] text-muted">{response}</p>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section className="py-20 px-6 bg-surface/25 border-y border-border/50">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">FAQ</p>
              <h2 className="font-display text-2xl md:text-3xl font-bold text-text tracking-tight">
                Common questions
              </h2>
            </div>
            <div className="space-y-5">
              {FAQS.map(({ q, a }) => (
                <div key={q} className="bg-surface border border-border rounded-xl p-6">
                  <p className="font-display text-sm font-bold text-text mb-2">{q}</p>
                  <p className="font-body text-sm text-muted leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pre-launch CTA ───────────────────────────────────────────────── */}
        <section className="py-20 px-6">
          <div className="max-w-2xl mx-auto text-center">
            <div
              className="inline-flex items-center gap-2 border border-amber-400/30 bg-amber-400/5 text-amber-400 text-xs font-mono uppercase tracking-widest px-4 py-1.5 rounded-full mb-8"
              aria-hidden="true"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Pre-launch · Active development
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-text mb-4 tracking-tight">
              Not ready to email?<br />
              <span className="text-primary">Join the waitlist instead.</span>
            </h2>
            <p className="font-body text-muted mb-8 text-sm leading-relaxed max-w-md mx-auto">
              Sign up to get early access when the platform launches —
              plus updates, pricing news, and priority onboarding.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/sign-up"
                className="gradient-primary-cta btn-ripple inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg font-semibold text-sm transition-all duration-300"
              >
                Get early access
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
              <Link
                href="/tools"
                className="border border-border text-muted hover:text-text px-8 py-3.5 rounded-lg text-sm text-center transition-colors"
              >
                Try free tools →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
