import Link from 'next/link'
import { ArrowLeft, Search } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 text-center">
      {/* Glow */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_40%,rgba(0,232,122,0.05),transparent)] pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-md">
        <p className="font-mono text-primary text-xs uppercase tracking-widest mb-6">
          404 — Page not found
        </p>

        <h1 className="font-display text-5xl font-bold text-text mb-4 tracking-tight">
          Nothing here.
        </h1>

        <p className="font-body text-muted leading-relaxed mb-10">
          This page doesn&apos;t exist or was moved. Check the URL or head back to
          somewhere useful.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-primary text-bg font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity text-sm"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Back to home
          </Link>
          <Link
            href="/tools"
            className="inline-flex items-center justify-center gap-2 border border-border text-muted hover:text-text px-6 py-2.5 rounded-lg transition-colors text-sm"
          >
            <Search size={14} aria-hidden="true" />
            Browse free tools
          </Link>
        </div>

        <p className="font-body text-xs text-muted">
          Need help?{' '}
          <a
            href="mailto:hello@specterapp.io"
            className="text-primary hover:underline"
          >
            hello@specterapp.io
          </a>
        </p>
      </div>
    </main>
  )
}
