import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToolDisclaimerProps {
  className?: string
  toolSpecific?: string
}

export default function ToolDisclaimer({ className, toolSpecific }: ToolDisclaimerProps) {
  return (
    <div
      className={cn(
        'mt-10 border border-border/60 rounded-xl p-4 flex gap-3 bg-surface/40',
        className,
      )}
      role="note"
      aria-label="Disclaimer"
    >
      <Info size={15} className="text-muted shrink-0 mt-0.5" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-body text-xs font-semibold text-text/70 uppercase tracking-wide">
          Disclaimer
        </p>
        <p className="font-body text-xs text-muted leading-relaxed">
          This tool is provided for <strong className="text-text/60">informational and educational purposes only</strong>.
          Outputs are estimates based on the inputs you provide and may not reflect your actual costs, fees, or outcomes.
          Rates, formulas, and benchmarks are subject to change and may not be current.
          {toolSpecific && <> {toolSpecific}</>}
          {' '}Always conduct your own research and consult qualified professionals before making pricing, financial,
          or business decisions. SPECTER and its operators accept no liability for decisions made based on
          this tool&apos;s outputs.
        </p>
      </div>
    </div>
  )
}
