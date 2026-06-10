import Link from 'next/link'
import { Lock } from 'lucide-react'

const PLAN_LABEL: Record<string, string> = {
  cipher: 'CIPHER',
  phantom: 'PHANTOM',
  predator: 'PREDATOR',
  eclipse: 'ECLIPSE',
}

/**
 * Shown when a dashboard page hits a 403 upgrade_required from specter-api.
 * The backend is the real gate; this is the UI the merchant sees on denial.
 */
export default function UpgradeGate({
  requiredPlan,
  feature,
  description,
}: {
  requiredPlan: string
  feature: string
  description: string
}) {
  const label = PLAN_LABEL[requiredPlan] ?? requiredPlan.toUpperCase()
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6 bg-surface border border-border rounded-2xl">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        <Lock size={24} className="text-primary" aria-hidden="true" />
      </div>
      <h2 className="font-display text-xl font-bold text-text mb-2">
        {feature} is a {label} feature
      </h2>
      <p className="font-body text-sm text-muted max-w-md mb-6">{description}</p>
      <Link
        href="/pricing"
        className="gradient-primary-cta btn-ripple px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200"
      >
        Upgrade to {label}
      </Link>
    </div>
  )
}
