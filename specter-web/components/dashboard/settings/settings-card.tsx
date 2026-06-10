import type { ReactNode } from 'react'

export default function SettingsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-text">{title}</h2>
      {children}
    </section>
  )
}
