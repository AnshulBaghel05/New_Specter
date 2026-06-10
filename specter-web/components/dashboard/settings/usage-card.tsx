'use client'

import SkuMeter from '@/components/dashboard/sku-meter'
import SettingsCard from './settings-card'

export default function UsageCard({
  plan,
  used,
  limit,
  maxCompetitors,
  error,
}: {
  plan: string
  used: number
  limit: number | null
  maxCompetitors: number | null
  error?: boolean
}) {
  if (plan === 'free') {
    return (
      <SettingsCard title="Usage">
        <p className="font-body text-sm text-muted">
          {"Free accounts don't track competitors. Start a 14-day trial to monitor live prices and get signals."}
        </p>
        <a
          href="/pricing"
          className="gradient-primary-cta btn-ripple self-start px-5 py-2.5 rounded-xl font-semibold text-sm"
        >
          Start 14-day trial
        </a>
      </SettingsCard>
    )
  }

  return (
    <SettingsCard title="Usage">
      {error ? (
        <p className="font-body text-sm text-rose-400">{"Couldn't load usage — refresh to retry."}</p>
      ) : (
        <>
          <SkuMeter used={used} limit={limit} maxCompetitors={maxCompetitors} />
          <a href="/pricing" className="font-body text-sm text-primary hover:underline self-start">
            Need more SKUs? Add-on packs →
          </a>
        </>
      )}
    </SettingsCard>
  )
}
