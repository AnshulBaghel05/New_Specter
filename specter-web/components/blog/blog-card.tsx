import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BlogPost } from '@/lib/blog/types'
import { categoryLabel } from '@/lib/blog/categories'
import { readingTimeMinutes, formatDate } from '@/lib/blog/helpers'

/** Article card used on the blog home, category hubs, and related sections. */
export default function BlogCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={cn(
        'group flex flex-col bg-surface border border-border rounded-2xl p-6 transition-all duration-250 hover:border-primary/40 hover:bg-primary/[0.03]',
        featured && 'sm:p-8',
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="font-mono text-[11px] uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-0.5">
          {categoryLabel(post.category)}
        </span>
        <span className="font-mono text-[11px] text-muted">{readingTimeMinutes(post)} min read</span>
      </div>

      <h3
        className={cn(
          'font-display font-bold text-text leading-snug group-hover:text-primary transition-colors',
          featured ? 'text-2xl mb-3' : 'text-lg mb-2',
        )}
      >
        {post.title}
      </h3>

      <p className={cn('font-body text-muted leading-relaxed flex-1', featured ? 'text-sm' : 'text-xs')}>
        {post.excerpt}
      </p>

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
        <span className="font-mono text-[11px] text-muted">{formatDate(post.datePublished)}</span>
        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          Read <ArrowUpRight size={12} />
        </span>
      </div>
    </Link>
  )
}
