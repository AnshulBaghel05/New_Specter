'use client'

import { useScrollReveal } from '@/hooks/use-scroll-reveal'
import { TrendingDown, Eye, Bell } from 'lucide-react'

const PAINS = [
  {
    icon: TrendingDown,
    title: "You're repricing blind",
    body: "Your competitor dropped $15 last Tuesday. You found out when your conversion rate tanked on Friday. By then, you'd left revenue on the table for three days.",
    borderClass: 'problem-blind',
    iconBg: 'bg-rose-400/10 border-rose-400/20',
    iconColor: 'text-rose-400',
    delay: '0ms',
  },
  {
    icon: Eye,
    title: "Manual checks don't scale",
    body: "Checking 50 competitor URLs every morning is a full-time job. Miss a flash sale and you lose the weekend. The person doing it burns out. Then nothing gets checked at all.",
    borderClass: 'problem-scale',
    iconBg: 'bg-amber-400/10 border-amber-400/20',
    iconColor: 'text-amber-400',
    delay: '100ms',
  },
  {
    icon: Bell,
    title: 'OOS is a hidden gold mine',
    body: "When Nike.com goes out of stock on a colorway, merchants who know first capture the demand spike. By the time you notice, the window is closed and someone else got the sale.",
    borderClass: 'problem-oos',
    iconBg: 'bg-yellow-400/10 border-yellow-400/20',
    iconColor: 'text-yellow-400',
    delay: '200ms',
  },
]

export default function Problem() {
  const headingRef = useScrollReveal<HTMLDivElement>({ y: 20 })
  const ref = useScrollReveal<HTMLDivElement>({ stagger: 0.1, childSelector: '.pain-card' })

  return (
    <section id="problem" className="py-24 bg-bg">
      <div className="max-w-7xl mx-auto px-6">
        <div ref={headingRef} className="text-center mb-16">
          <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">
            The Problem
          </p>
          <h2
            className="font-display font-bold text-text leading-tight max-w-2xl mx-auto"
            style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', letterSpacing: '-0.025em' }}
          >
            You are always one step{' '}
            <span className="text-muted">behind.</span>
          </h2>
        </div>

        <div ref={ref} className="grid md:grid-cols-3 gap-7">
          {PAINS.map(({ icon: Icon, title, body, borderClass, iconBg, iconColor, delay }) => (
            <div
              key={title}
              className={`pain-card card-hover bg-surface border border-border rounded-2xl p-8 ${borderClass}`}
              style={{ animationDelay: delay }}
            >
              <div
                className={`w-11 h-11 rounded-xl ${iconBg} border flex items-center justify-center mb-6`}
                aria-hidden="true"
              >
                <Icon size={20} className={iconColor} />
              </div>
              <h3
                className="font-display font-bold text-text mb-3"
                style={{ fontSize: '1.2rem', letterSpacing: '-0.015em' }}
              >
                {title}
              </h3>
              <p className="font-body text-muted text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
