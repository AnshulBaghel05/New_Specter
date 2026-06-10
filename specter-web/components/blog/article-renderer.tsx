import { Lightbulb, ChevronDown } from 'lucide-react'
import type { BlogPost } from '@/lib/blog/types'

/** Renders an article's body sections, key takeaways, and FAQ.
 * Section HTML is build-time-constant authored content (no user input) styled by
 * the scoped .article-prose rules in globals.css. */
export default function ArticleRenderer({ post }: { post: BlogPost }) {
  return (
    <div className="flex flex-col gap-10">
      {post.sections.map((section) => (
        <section key={section.id} id={section.id} className="scroll-mt-28">
          <h2 className="font-display font-bold text-text text-2xl sm:text-[1.7rem] leading-tight tracking-tight mb-4">
            {section.heading}
          </h2>
          <div className="article-prose" dangerouslySetInnerHTML={{ __html: section.html }} />
        </section>
      ))}

      {/* Key takeaways */}
      {post.keyTakeaways.length > 0 && (
        <section className="bg-surface border border-border rounded-2xl p-6 sm:p-7">
          <p className="flex items-center gap-2 font-display font-bold text-text text-lg mb-4">
            <Lightbulb size={18} className="text-primary" /> Key takeaways
          </p>
          <ul className="flex flex-col gap-3">
            {post.keyTakeaways.map((t, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 mt-0.5 font-mono text-[11px] text-primary border border-primary/30 bg-primary/10 rounded px-1.5 py-0.5">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-body text-sm text-muted leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* FAQ — native details so answers stay in the DOM for SEO/AEO */}
      {post.faq.length > 0 && (
        <section id="faq" className="scroll-mt-28">
          <h2 className="font-display font-bold text-text text-2xl sm:text-[1.7rem] leading-tight tracking-tight mb-5">
            Frequently asked questions
          </h2>
          <div className="flex flex-col gap-3">
            {post.faq.map((item) => (
              <details key={item.q} className="group bg-surface border border-border rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none">
                  <span className="font-display font-bold text-text text-sm pr-2">{item.q}</span>
                  <ChevronDown size={16} className="text-muted shrink-0 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-4 border-t border-border">
                  <p className="font-body text-sm text-muted leading-relaxed pt-3">{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
