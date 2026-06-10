# Prompt 3: Homepage Hero & Sections 1–8 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full SPECTER marketing homepage — Nav + 8 sections — wired into `app/(marketing)/page.tsx`, with Lenis smooth scroll, GSAP section reveals, Framer Motion transitions, Three.js particle hero, and Recharts attribution chart.

**Architecture:** Lenis smooth-scroll provider wraps the layout root; a shared `useScrollReveal` hook drives GSAP ScrollTrigger entry animations; hero loads via `dynamic()` with `ssr: false`; all other sections are pure RSC-compatible client components.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind + shadcn/ui, Three.js + @react-three/fiber, Framer Motion v11, GSAP 3 + ScrollTrigger, Lenis 1.3, Recharts 2.15

---

## File Map

| File | Action |
|------|--------|
| `components/providers/smooth-scroll.tsx` | Create — Lenis wrapper, 'use client' |
| `hooks/use-scroll-reveal.ts` | Create — GSAP ScrollTrigger hook |
| `app/layout.tsx` | Modify — add SmoothScrollProvider + expanded SEO metadata |
| `components/marketing/nav.tsx` | Create — sticky nav, Tools mega-dropdown |
| `components/marketing/hero.tsx` | Create — Three.js particle hero, R3F canvas |
| `components/marketing/social-proof.tsx` | Create — stat counters + platform logos |
| `components/marketing/problem.tsx` | Create — 3-card pain point grid |
| `components/marketing/product-demo.tsx` | Create — animated live signal feed |
| `components/marketing/oos-feature.tsx` | Create — OOS timeline feature section |
| `components/marketing/attribution-feature.tsx` | Create — Recharts revenue bar chart |
| `components/marketing/domain-batching.tsx` | Create — scrape cost comparison |
| `components/marketing/competitor-table.tsx` | Create — plan comparison table |
| `app/(marketing)/page.tsx` | Modify — replace smoke test, wire all sections |

---

## Task 1: Lenis Smooth-Scroll Provider

**Files:**
- Create: `components/providers/smooth-scroll.tsx`

- [ ] **Step 1: Create the provider**

```tsx
// components/providers/smooth-scroll.tsx
'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'

export default function SmoothScrollProvider({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    const rafId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [])

  return <>{children}</>
}
```

- [ ] **Step 2: Commit**

```bash
git add components/providers/smooth-scroll.tsx
git commit -m "feat: add Lenis smooth-scroll provider"
```

---

## Task 2: GSAP ScrollTrigger Reveal Hook

**Files:**
- Create: `hooks/use-scroll-reveal.ts`

- [ ] **Step 1: Create the hook**

```ts
// hooks/use-scroll-reveal.ts
'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function useScrollReveal<T extends HTMLElement = HTMLElement>(
  options: {
    y?: number
    opacity?: number
    duration?: number
    delay?: number
    stagger?: number
    childSelector?: string
  } = {}
) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const ctx = gsap.context(() => {
      const targets = options.childSelector
        ? el.querySelectorAll(options.childSelector)
        : [el]

      gsap.fromTo(
        targets,
        { opacity: 0, y: options.y ?? 32 },
        {
          opacity: 1,
          y: 0,
          duration: options.duration ?? 0.8,
          delay: options.delay ?? 0,
          stagger: options.stagger ?? 0,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        }
      )
    }, el)

    return () => ctx.revert()
  }, [options.y, options.opacity, options.duration, options.delay, options.stagger, options.childSelector])

  return ref
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-scroll-reveal.ts
git commit -m "feat: add GSAP ScrollTrigger reveal hook"
```

---

## Task 3: Update Root Layout — Lenis Provider + SEO

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Rewrite layout.tsx**

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { Syne, DM_Sans, JetBrains_Mono } from 'next/font/google'
import SmoothScrollProvider from '@/components/providers/smooth-scroll'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://specterapp.io'),
  title: {
    default: 'SPECTER — Competitor Pricing Intelligence for Shopify',
    template: '%s | SPECTER',
  },
  description:
    'Know when competitors change price or go out of stock. AI-powered RAISE/LOWER/HOLD signals for Shopify and WooCommerce merchants. Start free — no credit card.',
  keywords: [
    'competitor price monitoring',
    'shopify pricing tool',
    'price intelligence',
    'ecommerce repricing',
    'competitor tracking',
    'dynamic pricing shopify',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://specterapp.io',
    siteName: 'SPECTER',
    title: 'SPECTER — Competitor Pricing Intelligence for Shopify',
    description:
      'Real-time competitor price and stock monitoring with AI signals. Know before they move.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'SPECTER' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SPECTER — Competitor Pricing Intelligence',
    description: 'Real-time competitor price monitoring with AI signals for Shopify.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`dark ${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-body bg-bg text-text antialiased">
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Verify build still passes**

Run: `cd specter-web && npm run build`
Expected: exit 0, no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add Lenis provider and expanded SEO metadata to root layout"
```

---

## Task 4: Navigation Bar

**Files:**
- Create: `components/marketing/nav.tsx`

- [ ] **Step 1: Create nav.tsx**

```tsx
// components/marketing/nav.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const TOOLS = [
  { label: 'Margin Calculator', href: '/tools/margin-calculator' },
  { label: 'Price Elasticity', href: '/tools/price-elasticity' },
  { label: 'Competitor Gap Finder', href: '/tools/competitor-gap' },
  { label: 'Break-Even Calculator', href: '/tools/break-even' },
  { label: 'Reprice ROI', href: '/tools/reprice-roi' },
  { label: 'OOS Revenue Loss', href: '/tools/oos-revenue' },
]

const NAV_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Blog', href: '/blog' },
]

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed top-0 inset-x-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-bg/90 backdrop-blur-md border-b border-border/60'
          : 'bg-transparent'
      )}
    >
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="font-display text-xl font-bold text-text tracking-tight">
            SPECTER<span className="text-primary">.</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted hover:text-text transition-colors text-sm font-body"
            >
              {link.label}
            </Link>
          ))}

          {/* Tools mega dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setToolsOpen(true)}
            onMouseLeave={() => setToolsOpen(false)}
          >
            <button className="flex items-center gap-1 text-muted hover:text-text transition-colors text-sm font-body">
              Free Tools
              <ChevronDown
                size={14}
                className={cn(
                  'transition-transform duration-200',
                  toolsOpen && 'rotate-180'
                )}
              />
            </button>

            <AnimatePresence>
              {toolsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-64 bg-surface border border-border rounded-xl shadow-2xl p-2"
                >
                  {TOOLS.map((tool) => (
                    <Link
                      key={tool.href}
                      href={tool.href}
                      className="block px-4 py-2.5 rounded-lg text-sm text-muted hover:text-text hover:bg-bg/60 transition-colors"
                    >
                      {tool.label}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm text-muted hover:text-text transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="bg-primary text-bg font-semibold text-sm px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            Start free
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-muted hover:text-text transition-colors"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-surface border-b border-border overflow-hidden"
          >
            <div className="px-6 py-4 flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="py-2.5 text-muted hover:text-text transition-colors text-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-2 border-t border-border mt-2">
                <p className="text-xs text-muted uppercase tracking-widest mb-2 font-display">
                  Free Tools
                </p>
                {TOOLS.map((tool) => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="block py-2 text-sm text-muted hover:text-text transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    {tool.label}
                  </Link>
                ))}
              </div>
              <div className="pt-4 flex flex-col gap-2">
                <Link
                  href="/sign-in"
                  className="text-center py-2.5 text-sm text-muted hover:text-text border border-border rounded-lg transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="text-center py-2.5 bg-primary text-bg font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity"
                  onClick={() => setMobileOpen(false)}
                >
                  Start free
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/marketing/nav.tsx
git commit -m "feat: add sticky nav with Tools mega-dropdown and mobile drawer"
```

---

## Task 5: Three.js Particle Hero

**Files:**
- Create: `components/marketing/hero.tsx`

- [ ] **Step 1: Create hero.tsx**

```tsx
// components/marketing/hero.tsx
'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Link from 'next/link'
import { motion } from 'framer-motion'

function ParticleField() {
  const meshRef = useRef<THREE.Points>(null!)
  const count = 2800

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const green = new THREE.Color('#00E87A')
    const dim = new THREE.Color('#1A1D2E')

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 22
      positions[i * 3 + 1] = (Math.random() - 0.5) * 14
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10
      const c = Math.random() > 0.92 ? green : dim
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }

    return { positions, colors }
  }, [])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [positions, colors])

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    meshRef.current.rotation.y = clock.getElapsedTime() * 0.04
    meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.02) * 0.08
  })

  return (
    <points ref={meshRef}>
      <primitive object={geometry} attach="geometry" />
      <pointsMaterial
        size={0.045}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
      />
    </points>
  )
}

const SIGNALS = [
  { type: 'RAISE', sku: 'Nike Air Max 270', delta: '+$12' },
  { type: 'LOWER', sku: 'Adidas Ultraboost 22', delta: '-$8' },
  { type: 'HOLD', sku: 'New Balance 574', delta: '±$0' },
]

const SIGNAL_COLORS: Record<string, string> = {
  RAISE: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  LOWER: 'text-rose-400 bg-rose-400/10 border-rose-400/30',
  HOLD: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
}

export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-bg">
      {/* Three.js background */}
      <div className="absolute inset-0 pointer-events-none">
        <Canvas
          camera={{ position: [0, 0, 8], fov: 60 }}
          gl={{ antialias: false, alpha: true }}
          dpr={[1, 1.5]}
        >
          <ParticleField />
        </Canvas>
      </div>

      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(0,232,122,0.06),transparent)] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center pt-24">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 text-primary text-xs font-mono uppercase tracking-widest px-4 py-1.5 rounded-full mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Real-time competitor intelligence
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display text-5xl md:text-7xl font-bold text-text leading-[1.05] tracking-tight mb-6"
        >
          Know before{' '}
          <span className="relative">
            <span className="text-primary">they move.</span>
            <span className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="font-body text-lg md:text-xl text-muted max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          SPECTER tracks competitor prices and stock in real time, then delivers
          AI-powered <span className="text-text font-medium">RAISE / LOWER / HOLD</span> signals
          directly to your Shopify dashboard.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-3 justify-center mb-16"
        >
          <Link
            href="/sign-up"
            className="bg-primary text-bg font-semibold px-8 py-3.5 rounded-lg hover:opacity-90 transition-opacity text-base"
          >
            Start free — 14 days
          </Link>
          <Link
            href="/#product"
            className="border border-border text-muted hover:text-text hover:border-border/80 px-8 py-3.5 rounded-lg transition-colors text-base"
          >
            See it live →
          </Link>
        </motion.div>

        {/* Live signal strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-wrap justify-center gap-3"
        >
          {SIGNALS.map((s) => (
            <div
              key={s.sku}
              className={`flex items-center gap-2.5 border rounded-lg px-4 py-2.5 font-mono text-xs ${SIGNAL_COLORS[s.type]}`}
            >
              <span className="font-bold">{s.type}</span>
              <span className="text-text/60">·</span>
              <span className="text-text/80 font-body">{s.sku}</span>
              <span className="font-semibold">{s.delta}</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-bg to-transparent pointer-events-none" />
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/marketing/hero.tsx
git commit -m "feat: add Three.js particle hero with Framer Motion entrance animations"
```

---

## Task 6: Social Proof Bar

**Files:**
- Create: `components/marketing/social-proof.tsx`

- [ ] **Step 1: Create social-proof.tsx**

```tsx
// components/marketing/social-proof.tsx
'use client'

import { useScrollReveal } from '@/hooks/use-scroll-reveal'

const STATS = [
  { value: '12,400+', label: 'SKUs monitored daily' },
  { value: '$2.1M', label: 'Revenue recovered MTD' },
  { value: '99.3%', label: 'Scrape uptime' },
  { value: '< 15 min', label: 'Avg signal latency' },
]

const PLATFORMS = ['Shopify', 'WooCommerce', 'Klaviyo', 'Slack', 'Stripe']

export default function SocialProof() {
  const ref = useScrollReveal<HTMLDivElement>({ stagger: 0.1, childSelector: '.stat-card' })

  return (
    <section className="py-16 border-y border-border bg-surface/40">
      <div className="max-w-7xl mx-auto px-6">
        {/* Stats */}
        <div ref={ref} className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          {STATS.map((s) => (
            <div key={s.label} className="stat-card text-center">
              <p className="font-display text-3xl font-bold text-primary mb-1">{s.value}</p>
              <p className="font-body text-sm text-muted">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Platform logos */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="text-xs text-muted font-body mr-3">Integrates with</span>
          {PLATFORMS.map((p) => (
            <span
              key={p}
              className="px-4 py-1.5 rounded-full border border-border text-muted text-xs font-mono tracking-wide"
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/marketing/social-proof.tsx
git commit -m "feat: add social proof bar with stats and platform logos"
```

---

## Task 7: Problem Section

**Files:**
- Create: `components/marketing/problem.tsx`

- [ ] **Step 1: Create problem.tsx**

```tsx
// components/marketing/problem.tsx
'use client'

import { useScrollReveal } from '@/hooks/use-scroll-reveal'
import { TrendingDown, Eye, Bell } from 'lucide-react'

const PAINS = [
  {
    icon: TrendingDown,
    title: 'You\'re repricing blind',
    body: 'Your competitor dropped $15 last Tuesday. You found out when your conversion rate tanked on Friday. By then, you\'d left revenue on the table for three days.',
  },
  {
    icon: Eye,
    title: 'Manual checks don\'t scale',
    body: 'Checking 50 competitor URLs every morning is a full-time job. Miss a flash sale and you lose the weekend. The person doing it burns out. Then nothing gets checked at all.',
  },
  {
    icon: Bell,
    title: 'OOS is a hidden gold mine',
    body: 'When Nike.com goes out of stock on a colorway, merchants who know first capture the demand spike. By the time you notice, the window is closed and someone else got the sale.',
  },
]

export default function Problem() {
  const ref = useScrollReveal<HTMLDivElement>({ stagger: 0.12, childSelector: '.pain-card' })

  return (
    <section id="problem" className="py-24 bg-bg">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">
            The Problem
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-text leading-tight max-w-2xl mx-auto">
            You are always one step{' '}
            <span className="text-muted">behind.</span>
          </h2>
        </div>

        <div ref={ref} className="grid md:grid-cols-3 gap-6">
          {PAINS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="pain-card bg-surface border border-border rounded-2xl p-8 hover:border-primary/20 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
                <Icon size={18} className="text-primary" />
              </div>
              <h3 className="font-display text-xl font-bold text-text mb-3">{title}</h3>
              <p className="font-body text-muted text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/marketing/problem.tsx
git commit -m "feat: add problem section with 3-card pain point grid"
```

---

## Task 8: Product Demo — Live Signal Feed

**Files:**
- Create: `components/marketing/product-demo.tsx`

- [ ] **Step 1: Create product-demo.tsx**

```tsx
// components/marketing/product-demo.tsx
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useScrollReveal } from '@/hooks/use-scroll-reveal'
import { TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react'

type SignalType = 'RAISE' | 'LOWER' | 'HOLD'

interface Signal {
  id: number
  type: SignalType
  sku: string
  yourPrice: string
  competitorPrice: string
  delta: string
  store: string
  ts: string
}

const MOCK_SIGNALS: Signal[] = [
  { id: 1, type: 'RAISE', sku: 'Nike Air Max 270 – Size 10', yourPrice: '$110', competitorPrice: '$122', delta: '+$12', store: 'footlocker.com', ts: '2m ago' },
  { id: 2, type: 'LOWER', sku: 'Adidas Ultraboost 22 – Black', yourPrice: '$180', competitorPrice: '$168', delta: '-$12', store: 'adidas.com', ts: '5m ago' },
  { id: 3, type: 'HOLD', sku: 'New Balance 574 – White/Grey', yourPrice: '$99', competitorPrice: '$99', delta: '±$0', store: 'newbalance.com', ts: '8m ago' },
  { id: 4, type: 'RAISE', sku: 'Puma RS-X3 – Red/White', yourPrice: '$90', competitorPrice: '$108', delta: '+$18', store: 'puma.com', ts: '11m ago' },
  { id: 5, type: 'LOWER', sku: 'Reebok Classic – Size 11', yourPrice: '$75', competitorPrice: '$60', delta: '-$15', store: 'reebok.com', ts: '14m ago' },
]

const SIGNAL_CONFIG: Record<SignalType, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  RAISE: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
  LOWER: { icon: TrendingDown, color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/20' },
  HOLD: { icon: Minus, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
}

function SignalRow({ signal }: { signal: Signal }) {
  const cfg = SIGNAL_CONFIG[signal.type]
  const Icon = cfg.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.35 }}
      className={`flex items-center gap-4 p-4 rounded-xl border ${cfg.border} ${cfg.bg} mb-2`}
    >
      <div className={`flex items-center gap-1.5 min-w-[72px]`}>
        <Icon size={14} className={cfg.color} />
        <span className={`font-mono text-xs font-bold ${cfg.color}`}>{signal.type}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-body text-sm text-text truncate">{signal.sku}</p>
        <p className="font-mono text-xs text-muted">{signal.store}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`font-mono text-sm font-bold ${cfg.color}`}>{signal.delta}</p>
        <div className="flex items-center gap-1 justify-end">
          <Clock size={10} className="text-muted" />
          <span className="font-mono text-xs text-muted">{signal.ts}</span>
        </div>
      </div>
    </motion.div>
  )
}

export default function ProductDemo() {
  const [visibleIds, setVisibleIds] = useState([1, 2, 3])
  const ref = useScrollReveal<HTMLDivElement>({ y: 24 })

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleIds((prev) => {
        const next = prev[prev.length - 1] % MOCK_SIGNALS.length + 1
        return [...prev.slice(-2), next]
      })
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  const displayed = MOCK_SIGNALS.filter((s) => visibleIds.includes(s.id))

  return (
    <section id="product" className="py-24 bg-surface/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">
            Live Signals
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-text mb-4">
            Your pricing co-pilot,{' '}
            <span className="text-primary">always on.</span>
          </h2>
          <p className="font-body text-muted max-w-xl mx-auto">
            Every price change and stock event at every competitor URL triggers an AI
            signal — RAISE, LOWER, or HOLD — within minutes.
          </p>
        </div>

        <div ref={ref} className="max-w-2xl mx-auto">
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            {/* Header bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                <span className="font-mono text-xs text-muted">Live signal feed</span>
              </div>
              <span className="font-mono text-xs text-muted">
                {MOCK_SIGNALS.length} signals today
              </span>
            </div>

            {/* Signal list */}
            <div className="p-4">
              <AnimatePresence mode="popLayout">
                {displayed.map((signal) => (
                  <SignalRow key={signal.id} signal={signal} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/marketing/product-demo.tsx
git commit -m "feat: add animated live signal feed product demo section"
```

---

## Task 9: OOS Feature Section

**Files:**
- Create: `components/marketing/oos-feature.tsx`

- [ ] **Step 1: Create oos-feature.tsx**

```tsx
// components/marketing/oos-feature.tsx
'use client'

import { useScrollReveal } from '@/hooks/use-scroll-reveal'
import { PackageX, Zap, TrendingUp } from 'lucide-react'

const TIMELINE = [
  {
    time: '09:14 AM',
    icon: PackageX,
    label: 'OOS detected',
    body: 'Nike.com marks Air Max 270 out of stock across 3 colorways.',
    accent: 'text-rose-400',
    accentBg: 'bg-rose-400/10',
    accentBorder: 'border-rose-400/20',
  },
  {
    time: '09:16 AM',
    icon: Zap,
    label: 'RAISE signal fired',
    body: 'SPECTER detects demand gap. Signal: RAISE $18 — your store is now the best in-stock option.',
    accent: 'text-primary',
    accentBg: 'bg-primary/10',
    accentBorder: 'border-primary/20',
  },
  {
    time: '09:18 AM',
    icon: TrendingUp,
    label: 'Auto-reprice applied',
    body: 'Price updated on Shopify. Conversion rate up 34% over the next 6 hours.',
    accent: 'text-emerald-400',
    accentBg: 'bg-emerald-400/10',
    accentBorder: 'border-emerald-400/20',
  },
]

export default function OosFeature() {
  const ref = useScrollReveal<HTMLDivElement>({ stagger: 0.15, childSelector: '.timeline-item' })

  return (
    <section id="oos" className="py-24 bg-bg">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Copy */}
          <div>
            <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">
              OOS Intelligence
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-text mb-6 leading-tight">
              Competitor goes OOS.{' '}
              <span className="text-primary">You capture the demand.</span>
            </h2>
            <p className="font-body text-muted text-lg leading-relaxed mb-8">
              SPECTER watches every competitor URL for out-of-stock events. The moment
              a rival can't fulfill, you get a RAISE signal — before demand shifts
              and before your competitors notice.
            </p>
            <div className="flex flex-col gap-3">
              {['Email and Slack alerts in under 2 minutes', 'Auto-reprice on PHANTOM+ plans', 'Per-SKU alert silencing'].map((feat) => (
                <div key={feat} className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span className="font-body text-sm text-muted">{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div ref={ref} className="flex flex-col gap-0">
            {TIMELINE.map((item, i) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="timeline-item flex gap-5">
                  {/* Connector */}
                  <div className="flex flex-col items-center">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${item.accentBg} ${item.accentBorder} shrink-0`}>
                      <Icon size={15} className={item.accent} />
                    </div>
                    {i < TIMELINE.length - 1 && (
                      <div className="w-px flex-1 bg-border my-2" />
                    )}
                  </div>

                  {/* Content */}
                  <div className={i < TIMELINE.length - 1 ? 'pb-8' : ''}>
                    <p className="font-mono text-xs text-muted mb-1">{item.time}</p>
                    <p className={`font-display font-bold text-base mb-1 ${item.accent}`}>
                      {item.label}
                    </p>
                    <p className="font-body text-sm text-muted leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/marketing/oos-feature.tsx
git commit -m "feat: add OOS intelligence feature section with timeline"
```

---

## Task 10: Attribution Feature — Recharts Bar Chart

**Files:**
- Create: `components/marketing/attribution-feature.tsx`

- [ ] **Step 1: Create attribution-feature.tsx**

```tsx
// components/marketing/attribution-feature.tsx
'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { useScrollReveal } from '@/hooks/use-scroll-reveal'

const DATA = [
  { month: 'Dec', revenue: 4200 },
  { month: 'Jan', revenue: 6800 },
  { month: 'Feb', revenue: 9100 },
  { month: 'Mar', revenue: 12400 },
  { month: 'Apr', revenue: 18900 },
  { month: 'May', revenue: 26300 },
]

interface TooltipProps {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg px-4 py-3 shadow-xl">
      <p className="font-mono text-xs text-muted mb-1">{label}</p>
      <p className="font-display text-lg font-bold text-primary">
        ${payload[0].value.toLocaleString()}
      </p>
      <p className="font-body text-xs text-muted">revenue recovered</p>
    </div>
  )
}

export default function AttributionFeature() {
  const ref = useScrollReveal<HTMLDivElement>({ y: 20 })

  return (
    <section id="attribution" className="py-24 bg-surface/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Chart */}
          <div ref={ref} className="bg-surface border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="font-mono text-xs text-muted uppercase tracking-widest">
                  Revenue Recovered
                </p>
                <p className="font-display text-3xl font-bold text-primary mt-1">
                  $26,300
                </p>
                <p className="font-body text-xs text-muted">This month · auto reprice</p>
              </div>
              <div className="bg-primary/10 border border-primary/20 text-primary font-mono text-xs px-3 py-1.5 rounded-full">
                +38% MoM
              </div>
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={DATA} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1D2E" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#6B7280', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#6B7280', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,232,122,0.04)' }} />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {DATA.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === DATA.length - 1 ? '#00E87A' : '#1A1D2E'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Copy */}
          <div>
            <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">
              Revenue Attribution
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-text mb-6 leading-tight">
              See exactly how much{' '}
              <span className="text-primary">SPECTER earns you.</span>
            </h2>
            <p className="font-body text-muted text-lg leading-relaxed mb-8">
              Every auto-repriced price change is tracked end-to-end. SPECTER
              calculates the exact revenue delta attributable to its signals
              — so your ROI is never a guess.
            </p>
            <div className="flex flex-col gap-4">
              {[
                { metric: 'Avg ROI', value: '14× in 90 days' },
                { metric: 'Payback period', value: '< 3 weeks' },
                { metric: 'Revenue per signal', value: '$47 avg' },
              ].map(({ metric, value }) => (
                <div key={metric} className="flex items-center justify-between border-b border-border pb-4">
                  <span className="font-body text-muted text-sm">{metric}</span>
                  <span className="font-display font-bold text-text">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/marketing/attribution-feature.tsx
git commit -m "feat: add attribution feature section with Recharts revenue bar chart"
```

---

## Task 11: Domain Batching Cost Section

**Files:**
- Create: `components/marketing/domain-batching.tsx`

- [ ] **Step 1: Create domain-batching.tsx**

```tsx
// components/marketing/domain-batching.tsx
'use client'

import { useScrollReveal } from '@/hooks/use-scroll-reveal'
import { Check, X } from 'lucide-react'

const COMPARISON = [
  { label: 'Scrapes per domain visit', specter: '50–200 SKUs', others: '1 SKU' },
  { label: 'Per-SKU scrape cost', specter: '$0.002', others: '$0.10–0.40' },
  { label: 'Robots.txt compliance', specter: 'Auto-detected', others: 'Manual review' },
  { label: 'IP rotation', specter: 'Included', others: 'Extra charge' },
  { label: 'Rate limiting', specter: 'Adaptive', others: 'Fixed / fails' },
]

export default function DomainBatching() {
  const ref = useScrollReveal<HTMLDivElement>({ stagger: 0.08, childSelector: '.compare-row' })

  return (
    <section id="batching" className="py-24 bg-bg">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">
            Domain Batching
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-text mb-4">
            100× more efficient than{' '}
            <span className="text-muted">anyone else.</span>
          </h2>
          <p className="font-body text-muted max-w-xl mx-auto">
            Competitors scrape one SKU per visit. SPECTER batches an entire domain in
            a single crawl — meaning near-zero marginal cost as you scale.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          {/* Header row */}
          <div className="grid grid-cols-3 gap-4 mb-2 px-4">
            <div className="font-mono text-xs text-muted uppercase tracking-widest" />
            <div className="text-center font-display font-bold text-primary text-sm">
              SPECTER
            </div>
            <div className="text-center font-display font-bold text-muted text-sm">
              Others
            </div>
          </div>

          {/* Comparison rows */}
          <div ref={ref} className="bg-surface border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {COMPARISON.map(({ label, specter, others }) => (
              <div key={label} className="compare-row grid grid-cols-3 gap-4 px-6 py-4 items-center">
                <span className="font-body text-sm text-muted">{label}</span>
                <div className="flex items-center justify-center gap-1.5">
                  <Check size={14} className="text-primary shrink-0" />
                  <span className="font-mono text-xs text-primary font-medium">{specter}</span>
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  <X size={14} className="text-muted shrink-0" />
                  <span className="font-mono text-xs text-muted">{others}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/marketing/domain-batching.tsx
git commit -m "feat: add domain batching cost comparison section"
```

---

## Task 12: Competitor Comparison Table

**Files:**
- Create: `components/marketing/competitor-table.tsx`

- [ ] **Step 1: Create competitor-table.tsx**

```tsx
// components/marketing/competitor-table.tsx
'use client'

import { useScrollReveal } from '@/hooks/use-scroll-reveal'
import { Check, X, Minus } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type CellValue = true | false | string

interface Feature {
  label: string
  specter: CellValue
  prisync: CellValue
  wiser: CellValue
  manual: CellValue
}

const FEATURES: Feature[] = [
  { label: 'Real-time OOS detection', specter: true, prisync: false, wiser: false, manual: false },
  { label: 'AI RAISE/LOWER/HOLD signals', specter: true, prisync: false, wiser: false, manual: false },
  { label: 'Auto-reprice on Shopify', specter: true, prisync: true, wiser: false, manual: false },
  { label: 'Domain batching (100× efficiency)', specter: true, prisync: false, wiser: false, manual: false },
  { label: 'Revenue attribution dashboard', specter: true, prisync: false, wiser: false, manual: false },
  { label: 'Custom webhooks', specter: true, prisync: false, wiser: false, manual: false },
  { label: 'Price floor/ceiling guardrails', specter: true, prisync: true, wiser: true, manual: false },
  { label: 'Free tools included', specter: true, prisync: false, wiser: false, manual: false },
  { label: 'Starting price', specter: '$49/mo', prisync: '$99/mo', wiser: '$139/mo', manual: '$0 + 40h/wk' },
]

const COLS = ['SPECTER', 'Prisync', 'Wiser', 'Manual']

function Cell({ value, isSpecter }: { value: CellValue; isSpecter: boolean }) {
  if (value === true) return <Check size={16} className={isSpecter ? 'text-primary mx-auto' : 'text-muted mx-auto'} />
  if (value === false) return <X size={14} className="text-border mx-auto" />
  return (
    <span className={cn('font-mono text-xs', isSpecter ? 'text-primary font-bold' : 'text-muted')}>
      {value}
    </span>
  )
}

export default function CompetitorTable() {
  const ref = useScrollReveal<HTMLDivElement>({ y: 20 })

  return (
    <section id="compare" className="py-24 bg-surface/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="font-mono text-primary text-xs uppercase tracking-widest mb-4">
            How We Compare
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-text mb-4">
            Not just cheaper.{' '}
            <span className="text-primary">Actually different.</span>
          </h2>
        </div>

        <div ref={ref} className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="text-left font-body text-muted text-sm font-normal pb-4 w-1/3" />
                {COLS.map((col) => (
                  <th
                    key={col}
                    className={cn(
                      'text-center pb-4 font-display font-bold text-sm',
                      col === 'SPECTER'
                        ? 'text-primary border-x border-t border-primary/30 bg-primary/5 rounded-t-xl px-4 pt-4'
                        : 'text-muted px-4'
                    )}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((feat, fi) => (
                <tr key={feat.label} className="group">
                  <td className="font-body text-sm text-muted py-3.5 pr-6 border-b border-border">
                    {feat.label}
                  </td>
                  {[
                    { key: 'specter', val: feat.specter },
                    { key: 'prisync', val: feat.prisync },
                    { key: 'wiser', val: feat.wiser },
                    { key: 'manual', val: feat.manual },
                  ].map(({ key, val }) => (
                    <td
                      key={key}
                      className={cn(
                        'text-center py-3.5 border-b',
                        key === 'specter'
                          ? cn(
                              'border-x border-primary/30 bg-primary/5 px-4',
                              fi === FEATURES.length - 1 ? 'border-b border-primary/30 rounded-b-xl' : 'border-b border-primary/10'
                            )
                          : 'border-border px-4'
                      )}
                    >
                      <Cell value={val} isSpecter={key === 'specter'} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-center mt-12">
          <Link
            href="/sign-up"
            className="inline-block bg-primary text-bg font-semibold px-8 py-3.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            Start free — no credit card
          </Link>
          <p className="font-body text-xs text-muted mt-3">
            14-day free trial · cancel anytime
          </p>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/marketing/competitor-table.tsx
git commit -m "feat: add competitor comparison table section"
```

---

## Task 13: Wire Page — Replace Smoke Test

**Files:**
- Modify: `app/(marketing)/page.tsx`

- [ ] **Step 1: Replace page.tsx with full homepage**

```tsx
// app/(marketing)/page.tsx
import dynamic from 'next/dynamic'
import Nav from '@/components/marketing/nav'
import SocialProof from '@/components/marketing/social-proof'
import Problem from '@/components/marketing/problem'
import ProductDemo from '@/components/marketing/product-demo'
import OosFeature from '@/components/marketing/oos-feature'
import AttributionFeature from '@/components/marketing/attribution-feature'
import DomainBatching from '@/components/marketing/domain-batching'
import CompetitorTable from '@/components/marketing/competitor-table'

// Three.js hero: SSR disabled — R3F requires browser APIs
const Hero = dynamic(() => import('@/components/marketing/hero'), { ssr: false })

export default function HomePage() {
  return (
    <main>
      <Nav />
      <Hero />
      <SocialProof />
      <Problem />
      <ProductDemo />
      <OosFeature />
      <AttributionFeature />
      <DomainBatching />
      <CompetitorTable />
    </main>
  )
}
```

- [ ] **Step 2: Run build**

Run: `cd specter-web && npm run build`
Expected: exit 0, no TypeScript errors, no lint errors

- [ ] **Step 3: Run lint**

Run: `cd specter-web && npm run lint`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add app/(marketing)/page.tsx
git commit -m "feat: replace smoke-test page with full homepage — Nav + 8 sections"
```

---

## Self-Review Checklist

- [x] Lenis provider created and wired into layout
- [x] GSAP ScrollTrigger hook used by all below-fold sections
- [x] Three.js hero is `dynamic()` with `ssr: false` — never imported in dashboard or tools
- [x] `cn()` used for all conditional class merging (Nav, CompetitorTable)
- [x] shadcn/ui components untouched
- [x] `metadata` expanded with OG, Twitter, robots, keywords
- [x] Recharts chart in attribution section
- [x] AnimatePresence used in signal feed
- [x] No marketing section tests (per CLAUDE.md — calculator math only)
- [x] All file paths exact, no TBD/TODO placeholders
- [x] All code is complete in every step
