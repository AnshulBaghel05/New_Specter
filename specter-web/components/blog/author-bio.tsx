import type { Author } from '@/lib/blog/types'

/** E-E-A-T author block rendered under the article body. */
export default function AuthorBio({ author, updated }: { author: Author; updated: string }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6 flex items-start gap-4">
      <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center font-display font-bold text-primary text-sm">
        {author.initials}
      </div>
      <div>
        <p className="font-display font-bold text-text text-sm">{author.name}</p>
        <p className="font-mono text-[11px] text-primary uppercase tracking-wider mb-2">{author.role}</p>
        <p className="font-body text-xs text-muted leading-relaxed">{author.bio}</p>
        <p className="font-mono text-[11px] text-muted/70 mt-3">Last updated {updated}</p>
      </div>
    </div>
  )
}
