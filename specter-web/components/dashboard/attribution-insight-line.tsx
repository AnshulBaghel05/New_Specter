import { formatInsight, type AttributionInsight } from '@/lib/dashboard/attribution-insight'

export default function AttributionInsightLine({ insight }: { insight: AttributionInsight }) {
  return <p className="font-body text-sm text-text">{formatInsight(insight)}</p>
}
