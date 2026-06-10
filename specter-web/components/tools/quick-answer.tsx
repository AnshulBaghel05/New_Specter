import { cn } from '@/lib/utils'

interface QuickAnswerProps {
  text: string
  className?: string
}

export default function QuickAnswer({ text, className }: QuickAnswerProps) {
  return (
    <div
      className={cn(
        'bg-surface/60 border border-border rounded-xl px-5 py-4 mb-6',
        className,
      )}
      itemScope
      itemType="https://schema.org/Answer"
    >
      <p className="font-mono text-[10px] text-primary uppercase tracking-widest mb-1.5">Quick answer</p>
      <p className="font-body text-sm text-text leading-relaxed" itemProp="text">
        {text}
      </p>
    </div>
  )
}
