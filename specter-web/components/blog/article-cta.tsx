import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { BlogCTA } from '@/lib/blog/types'

/** Conversion CTA block rendered inside/after an article. */
export default function ArticleCTA({ cta }: { cta: BlogCTA }) {
  return (
    <div className="relative overflow-hidden bg-primary/[0.04] border border-primary/30 rounded-2xl p-7 sm:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_100%_0%,rgba(0,232,122,0.08),transparent)] pointer-events-none" />
      <div className="relative">
        <h3 className="font-display font-bold text-text text-xl mb-2">{cta.heading}</h3>
        <p className="font-body text-sm text-muted leading-relaxed mb-6 max-w-xl">{cta.body}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={cta.primaryHref}
            className="gradient-primary-cta btn-ripple inline-flex items-center justify-center gap-2 font-semibold px-6 py-3 rounded-lg text-sm transition-all duration-300"
          >
            {cta.primaryLabel}
            <ArrowRight size={15} />
          </Link>
          {cta.secondaryLabel && cta.secondaryHref && (
            <Link
              href={cta.secondaryHref}
              className="inline-flex items-center justify-center gap-2 border border-border text-muted hover:text-text hover:border-primary/40 hover:bg-primary/5 px-6 py-3 rounded-lg transition-all duration-300 text-sm"
            >
              {cta.secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
