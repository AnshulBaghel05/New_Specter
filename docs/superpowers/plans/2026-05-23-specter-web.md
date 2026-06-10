# SPECTER Website & Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy `specter-web` — full 15-section marketing homepage, 6 client-side free calculator tools, Clerk auth pages, and 7-route SaaS dashboard on Vercel. Website ships week 1; tools ship week 2; dashboard ships week 5 (requires specter-api).

**Architecture:** Next.js 14 App Router with three route groups: `(marketing)` for public pages (static), `tools/` for calculator pages (client-side, no API), `(dashboard)` for authenticated SaaS UI (TanStack Query → specter-api). Middleware protects all `/dashboard/*` routes with Clerk.

**Tech Stack:** Next.js 14, TypeScript strict, Tailwind CSS, shadcn/ui, Clerk, GSAP, Framer Motion, Lenis, Three.js/React Three Fiber, Zustand, TanStack Query v5, React Hook Form + Zod, Recharts, Lucide React, Resend

---

## File Structure

```
specter-web/
├── app/
│   ├── (marketing)/
│   │   ├── layout.tsx
│   │   └── page.tsx                              # Assembles all 15 section components
│   ├── (dashboard)/
│   │   ├── layout.tsx                            # Sidebar + Clerk auth guard
│   │   ├── dashboard/page.tsx
│   │   ├── competitors/page.tsx
│   │   ├── signals/page.tsx
│   │   ├── repricing/page.tsx                    # SNIPER+ gated
│   │   ├── alerts/page.tsx
│   │   ├── attribution/page.tsx                  # PREDATOR+ gated
│   │   └── settings/page.tsx
│   ├── tools/
│   │   ├── layout.tsx
│   │   ├── amazon-fba-calculator/page.tsx
│   │   ├── shopify-profit-calculator/page.tsx
│   │   ├── shipping-calculator/page.tsx
│   │   ├── price-position-analyzer/page.tsx
│   │   ├── roas-calculator/page.tsx
│   │   └── inventory-reorder-calculator/page.tsx
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── layout.tsx                                # Root: fonts, ClerkProvider, providers
│   ├── globals.css                               # Design system CSS vars + base
│   └── not-found.tsx
├── components/
│   ├── marketing/
│   │   ├── nav.tsx                               # Sticky nav + Tools mega dropdown
│   │   ├── hero.tsx                              # Three.js particle field
│   │   ├── social-proof.tsx
│   │   ├── problem.tsx
│   │   ├── product-demo.tsx
│   │   ├── oos-feature.tsx
│   │   ├── attribution-feature.tsx
│   │   ├── domain-batching.tsx
│   │   ├── competitor-table.tsx
│   │   ├── pricing-section.tsx
│   │   ├── integrations.tsx
│   │   ├── tools-cta.tsx
│   │   ├── testimonials.tsx
│   │   ├── faq.tsx
│   │   ├── final-cta.tsx
│   │   └── footer.tsx
│   ├── dashboard/
│   │   ├── sidebar.tsx
│   │   ├── signal-card.tsx
│   │   ├── plan-gate.tsx                         # Wraps SNIPER+/PREDATOR+ features
│   │   └── revenue-counter.tsx
│   ├── tools/
│   │   ├── tool-page-layout.tsx                  # Hero pill + results + CTA wrapper
│   │   ├── calculator-card.tsx                   # Input form card (shared)
│   │   └── results-panel.tsx                     # Results display card (shared)
│   └── providers.tsx                             # QueryClientProvider wrapper
├── lib/
│   ├── api.ts                                    # Axios instance + all TanStack Query hooks
│   ├── store.ts                                  # Zustand (plan, UI state)
│   └── utils.ts                                  # cn(), currency formatter, number formatter
├── types/
│   └── index.ts                                  # Signal, SKU, Alert, Merchant TS types
├── hooks/
│   └── use-plan.ts                               # Returns plan + feature flags from Zustand
├── middleware.ts                                  # Clerk: protect /dashboard/*, redirect /
├── tailwind.config.ts
├── next.config.ts
└── package.json
```

---

### Task 1: Scaffold specter-web

**Files:**
- Create: `package.json`, `tailwind.config.ts`, `next.config.ts`, `tsconfig.json`, `.env.local.example`

- [ ] **Step 1: Bootstrap Next.js project**

```bash
npx create-next-app@14 specter-web \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"
cd specter-web
```

- [ ] **Step 2: Install all dependencies**

```bash
npm install \
  @clerk/nextjs \
  @tanstack/react-query \
  @tanstack/react-query-devtools \
  zustand \
  axios \
  framer-motion \
  gsap \
  @gsap/react \
  @studio-freight/lenis \
  @lenis/react \
  three \
  @react-three/fiber \
  @react-three/drei \
  recharts \
  react-hook-form \
  @hookform/resolvers \
  zod \
  lucide-react \
  clsx \
  tailwind-merge \
  class-variance-authority \
  @radix-ui/react-accordion \
  @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-select \
  @radix-ui/react-tabs \
  @radix-ui/react-tooltip \
  @radix-ui/react-switch \
  sonner

npm install -D \
  @types/three \
  vitest \
  @vitest/ui \
  @testing-library/react \
  @testing-library/jest-dom \
  jsdom
```

- [ ] **Step 3: Add shadcn/ui**

```bash
npx shadcn@latest init
# Select: Default style, Slate base color, CSS variables: yes
# This creates components/ui/ — do not hand-edit these files
npx shadcn@latest add button input label card badge accordion dialog tabs select switch tooltip
```

- [ ] **Step 4: Create .env.local.example**

```bash
cat > .env.local.example << 'EOF'
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
EOF
cp .env.local.example .env.local
# Fill in real Clerk keys from dashboard.clerk.com
```

- [ ] **Step 5: Configure vitest**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './') },
  },
})
```

```typescript
// vitest.setup.ts
import '@testing-library/jest-dom'
```

Add to `package.json` scripts:
```json
"test": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 6: Commit scaffold**

```bash
git init  # if not already in a git repo
git add .
git commit -m "chore: scaffold specter-web Next.js 14 project"
```

---

### Task 2: Design System

**Files:**
- Create/modify: `app/globals.css`, `tailwind.config.ts`, `lib/utils.ts`, `types/index.ts`

- [ ] **Step 1: Write globals.css with Dark Intelligence design tokens**

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --bg: #06070D;
    --surface: #0D0F1A;
    --surface-2: #141622;
    --border: #1A1D2E;
    --border-2: #2D3148;
    --primary: #00E87A;
    --primary-dim: rgba(0, 232, 122, 0.15);
    --text: #E8EAF0;
    --text-muted: #6B7280;
    --text-dim: #4B5563;
    --error: #EF4444;
    --warning: #F59E0B;
    --radius: 12px;
  }

  * {
    border-color: var(--border);
  }

  body {
    background-color: var(--bg);
    color: var(--text);
    font-family: 'DM Sans', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  h1, h2, h3, h4 {
    font-family: 'Syne', sans-serif;
  }

  code, pre, .font-mono {
    font-family: 'JetBrains Mono', monospace;
  }
}

@layer utilities {
  .text-gradient {
    background: linear-gradient(135deg, #00E87A, #00C466);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .surface {
    background-color: var(--surface);
    border: 1px solid var(--border);
  }

  .glow {
    box-shadow: 0 0 30px rgba(0, 232, 122, 0.15);
  }
}
```

- [ ] **Step 2: Update tailwind.config.ts**

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#06070D',
        surface: { DEFAULT: '#0D0F1A', 2: '#141622' },
        border: { DEFAULT: '#1A1D2E', 2: '#2D3148' },
        primary: { DEFAULT: '#00E87A', dim: 'rgba(0,232,122,0.15)' },
        text: { DEFAULT: '#E8EAF0', muted: '#6B7280', dim: '#4B5563' },
      },
      fontFamily: {
        display: ['Syne', 'system-ui', 'sans-serif'],
        body: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '12px',
        sm: '8px',
        lg: '16px',
        xl: '24px',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0,232,122,0.1)' },
          '50%': { boxShadow: '0 0 40px rgba(0,232,122,0.3)' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
```

- [ ] **Step 3: Add Google Fonts to root layout**

```typescript
// In app/layout.tsx (will be fully created in Task 3)
// Add these imports at top:
import { Syne, DM_Sans, JetBrains_Mono } from 'next/font/google'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
})
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})
```

- [ ] **Step 4: Create lib/utils.ts**

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatNumber(value: number, decimals = 2): string {
  return value.toFixed(decimals)
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}
```

- [ ] **Step 5: Create types/index.ts**

```typescript
// types/index.ts
export type Plan = 'SCOUT' | 'SNIPER' | 'PREDATOR' | 'APEX' | 'TRIAL'

export interface Merchant {
  id: string
  plan: Plan
  shopifyDomain: string | null
  trialEndsAt: string | null
}

export interface SKU {
  id: string
  title: string
  currentPrice: number
  floorPrice: number | null
  ceilingPrice: number | null
  shopifyVariantId: string | null
}

export interface CompetitorURL {
  id: string
  url: string
  domain: string
  skuId: string
  lastScrapedAt: string | null
  status: 'active' | 'failed' | 'robots_blocked'
}

export type SignalType = 'RAISE' | 'LOWER' | 'HOLD'

export interface Signal {
  id: string
  skuId: string
  skuTitle: string
  type: SignalType
  confidence: number
  reasoning: string
  createdAt: string
}

export interface OOSAlert {
  id: string
  competitorUrl: string
  skuTitle: string
  detectedAt: string
  resolvedAt: string | null
}

export interface PriceChange {
  id: string
  skuTitle: string
  oldPrice: number
  newPrice: number
  source: 'manual' | 'auto'
  revenueDelta: number
  createdAt: string
}
```

- [ ] **Step 6: Commit**

```bash
git add app/globals.css tailwind.config.ts lib/utils.ts types/index.ts vitest.config.ts vitest.setup.ts
git commit -m "chore: add design system tokens, types, utils"
```

---

### Task 3: Root Layout + Providers + Middleware

**Files:**
- Create: `app/layout.tsx`, `components/providers.tsx`, `middleware.ts`

- [ ] **Step 1: Create components/providers.tsx**

```typescript
// components/providers.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60_000, retry: 2 },
      },
    })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Create app/layout.tsx**

```typescript
// app/layout.tsx
import type { Metadata } from 'next'
import { Syne, DM_Sans, JetBrains_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { Providers } from '@/components/providers'
import './globals.css'

const syne = Syne({ subsets: ['latin'], variable: '--font-syne', display: 'swap' })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'SPECTER — Competitor Price Intelligence for Shopify & WooCommerce',
  description: 'Real-time competitor pricing signals. Know when to RAISE, LOWER, or HOLD — in 15 minutes, not 8 hours.',
  keywords: ['competitor price tracker', 'shopify pricing tool', 'ecommerce price intelligence'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
        <body>
          <Providers>
            {children}
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
```

- [ ] **Step 3: Create middleware.ts**

```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isDashboardRoute = createRouteMatcher(['/dashboard(.*)', '/competitors(.*)', '/signals(.*)', '/repricing(.*)', '/alerts(.*)', '/attribution(.*)', '/settings(.*)'])

export default clerkMiddleware((auth, req) => {
  if (isDashboardRoute(req)) auth().protect()
})

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
```

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx components/providers.tsx middleware.ts
git commit -m "feat: root layout, Clerk provider, auth middleware"
```

---

### Task 4: Navigation Component

**Files:**
- Create: `components/marketing/nav.tsx`

- [ ] **Step 1: Create nav.tsx with mega dropdown**

```typescript
// components/marketing/nav.tsx
'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

const TOOLS = [
  { name: 'Amazon FBA Calculator', href: '/tools/amazon-fba-calculator', desc: 'Calculate exact fees across 6 marketplaces' },
  { name: 'Shopify Profit Calculator', href: '/tools/shopify-profit-calculator', desc: 'See true profit after all hidden costs' },
  { name: 'Shipping Rate Comparator', href: '/tools/shipping-calculator', desc: 'Compare USPS, UPS, FedEx, DHL instantly' },
  { name: 'Price Position Analyzer', href: '/tools/price-position-analyzer', desc: 'See where your price ranks vs competitors' },
  { name: 'ROAS Profitability Calculator', href: '/tools/roas-calculator', desc: 'Find your true profitable ROAS' },
  { name: 'Inventory Reorder Calculator', href: '/tools/inventory-reorder-calculator', desc: 'Never overstock or stock out again' },
]

export function Nav() {
  const [toolsOpen, setToolsOpen] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current)
    setToolsOpen(true)
  }
  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setToolsOpen(false), 150)
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 backdrop-blur-sm bg-bg/80">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" strokeWidth={2.5} />
          <span className="font-display font-bold text-lg tracking-tight">SPECTER</span>
        </Link>

        {/* Center links */}
        <div className="hidden md:flex items-center gap-8">
          <Link href="/#pricing" className="text-sm text-text-muted hover:text-text transition-colors">Pricing</Link>

          {/* Tools mega dropdown */}
          <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button className="flex items-center gap-1 text-sm text-text-muted hover:text-text transition-colors">
              Free Tools
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', toolsOpen && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {toolsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[520px] bg-surface border border-border rounded-xl p-4 shadow-2xl"
                >
                  <div className="grid grid-cols-2 gap-2">
                    {TOOLS.map((tool) => (
                      <Link
                        key={tool.href}
                        href={tool.href}
                        className="p-3 rounded-lg hover:bg-surface-2 transition-colors group"
                        onClick={() => setToolsOpen(false)}
                      >
                        <div className="text-sm font-medium text-text group-hover:text-primary transition-colors">{tool.name}</div>
                        <div className="text-xs text-text-muted mt-0.5">{tool.desc}</div>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link href="/#faq" className="text-sm text-text-muted hover:text-text transition-colors">FAQ</Link>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Link href="/sign-in" className="text-sm text-text-muted hover:text-text transition-colors">Sign in</Link>
          <Link
            href="/sign-up"
            className="px-4 py-2 text-sm font-medium bg-primary text-bg rounded-lg hover:bg-primary/90 transition-colors"
          >
            Start Free Trial
          </Link>
        </div>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/marketing/nav.tsx
git commit -m "feat: navigation with Tools mega dropdown"
```

---

### Task 5: Hero Section (Three.js)

**Files:**
- Create: `components/marketing/hero.tsx`

- [ ] **Step 1: Create hero.tsx with R3F particle field**

```typescript
// components/marketing/hero.tsx
'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

function Particles({ count = 2000 }) {
  const mesh = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10
    }
    return pos
  }, [count])

  useFrame((state) => {
    if (!mesh.current) return
    mesh.current.rotation.y = state.clock.elapsedTime * 0.03
    mesh.current.rotation.x = state.clock.elapsedTime * 0.01
  })

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.02} color="#00E87A" transparent opacity={0.6} sizeAttenuation />
    </points>
  )
}

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Three.js background */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
          <Particles />
        </Canvas>
      </div>

      {/* Radial gradient overlay */}
      <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_0%,#06070D_70%)]" />

      {/* Content */}
      <div className="relative z-20 max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 border border-primary/30 bg-primary/10 rounded-full text-xs text-primary font-medium">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            Real-time competitor intelligence
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-none">
            Know Before
            <br />
            <span className="text-gradient">They Move.</span>
          </h1>

          <p className="text-lg md:text-xl text-text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            SPECTER monitors your competitors' prices and inventory in real time.
            Get RAISE, LOWER, or HOLD signals in under 15 minutes — not 8 hours.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-primary text-bg font-semibold rounded-xl hover:bg-primary/90 transition-all hover:scale-105"
            >
              Start 14-day free trial
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/tools/amazon-fba-calculator"
              className="inline-flex items-center gap-2 px-6 py-3.5 border border-border bg-surface text-text font-medium rounded-xl hover:border-primary/50 transition-all"
            >
              Try free tools
            </Link>
          </div>

          <p className="mt-4 text-xs text-text-dim">No credit card required · Cancel anytime</p>
        </motion.div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/marketing/hero.tsx
git commit -m "feat: hero section with Three.js particle field"
```

---

### Task 6: Marketing Sections 2–8

**Files:**
- Create: `components/marketing/social-proof.tsx`, `problem.tsx`, `product-demo.tsx`, `oos-feature.tsx`, `attribution-feature.tsx`, `domain-batching.tsx`, `competitor-table.tsx`

- [ ] **Step 1: Create social-proof.tsx**

```typescript
// components/marketing/social-proof.tsx
import { TrendingUp } from 'lucide-react'

export function SocialProof() {
  return (
    <section className="py-16 border-y border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-center gap-2 mb-8 text-sm text-text-muted">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span>Merchants recovered <span className="text-primary font-semibold">$284,000+</span> this month with SPECTER signals</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-12 opacity-40">
          {['Shopify', 'WooCommerce', 'Y Combinator', 'Product Hunt', 'Indie Hackers'].map((name) => (
            <span key={name} className="font-display font-bold text-lg tracking-tight">{name}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create problem.tsx**

```typescript
// components/marketing/problem.tsx
'use client'
import { motion } from 'framer-motion'
import { Clock, AlertTriangle, DollarSign } from 'lucide-react'

const PROBLEMS = [
  {
    icon: Clock,
    stat: '8 hours/week',
    title: 'Wasted on manual checks',
    body: 'Your team refreshes competitor pages by hand. The data is stale by the time you act on it.',
  },
  {
    icon: AlertTriangle,
    stat: '2–7 day window',
    title: 'Missed when competitors go OOS',
    body: 'When a competitor sells out, you have a premium pricing window. You find out 3 days later — from a customer.',
  },
  {
    icon: DollarSign,
    stat: '$50,000/year',
    title: 'Enterprise tools. Enterprise price.',
    body: 'Competera and Intelligence Node start at $50K/year. Everyone else uses spreadsheets.',
  },
]

export function Problem() {
  return (
    <section className="py-24 max-w-7xl mx-auto px-6">
      <div className="text-center mb-16">
        <h2 className="font-display text-4xl font-bold mb-4">The pricing intelligence gap</h2>
        <p className="text-text-muted max-w-2xl mx-auto">Enterprise brands have $50K/year tools. You have a browser and a spreadsheet.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {PROBLEMS.map((p, i) => (
          <motion.div
            key={p.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="bg-surface border border-border rounded-xl p-6"
          >
            <p.icon className="w-8 h-8 text-primary mb-4" />
            <div className="font-display text-2xl font-bold text-primary mb-2">{p.stat}</div>
            <h3 className="font-semibold text-lg mb-2">{p.title}</h3>
            <p className="text-text-muted text-sm leading-relaxed">{p.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Create product-demo.tsx (animated signal feed)**

```typescript
// components/marketing/product-demo.tsx
'use client'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

const SIGNALS = [
  { type: 'RAISE', sku: 'Sony WH-1000XM5', confidence: 94, reason: 'BestBuy raised price by $20 — you\'re now $20 underpriced', time: '2m ago' },
  { type: 'HOLD', sku: 'Anker PowerCore 26800', confidence: 87, reason: 'Within 1.2% of competitor median', time: '18m ago' },
  { type: 'LOWER', sku: 'Logitech MX Master 3S', confidence: 71, reason: 'You\'re 8% above market median — losing velocity', time: '34m ago' },
  { type: 'RAISE', sku: 'Apple AirPods Pro 2', confidence: 96, reason: 'Amazon went OOS — premium window open', time: '1h ago' },
]

const SIGNAL_CONFIG = {
  RAISE: { icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10 border-primary/30' },
  LOWER: { icon: TrendingDown, color: 'text-warning', bg: 'bg-warning/10 border-warning/30' },
  HOLD: { icon: Minus, color: 'text-text-muted', bg: 'bg-surface-2 border-border' },
}

export function ProductDemo() {
  return (
    <section className="py-24 bg-surface border-y border-border">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="font-display text-4xl font-bold mb-4">Your pricing intelligence feed</h2>
          <p className="text-text-muted">RAISE, LOWER, or HOLD — with reasoning. Not just raw numbers.</p>
        </div>
        <div className="space-y-3">
          {SIGNALS.map((signal, i) => {
            const cfg = SIGNAL_CONFIG[signal.type as keyof typeof SIGNAL_CONFIG]
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-4 bg-bg border border-border rounded-xl p-4"
              >
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold font-mono shrink-0 ${cfg.bg} ${cfg.color}`}>
                  <cfg.icon className="w-3 h-3" />
                  {signal.type}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{signal.sku}</div>
                  <div className="text-xs text-text-muted mt-0.5">{signal.reason}</div>
                </div>
                <div className="text-xs text-text-dim shrink-0">{signal.confidence}% · {signal.time}</div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Create oos-feature.tsx**

```typescript
// components/marketing/oos-feature.tsx
'use client'
import { motion } from 'framer-motion'
import { Bell, TrendingUp, DollarSign } from 'lucide-react'

const STEPS = [
  { icon: Bell, label: 'Competitor goes OOS', time: '0:00', color: 'text-warning' },
  { icon: Bell, label: 'SPECTER alert sent', time: '0:12', color: 'text-primary' },
  { icon: TrendingUp, label: 'You raise price +$15', time: '0:18', color: 'text-primary' },
  { icon: DollarSign, label: '$2,400 recovered', time: '+3 days', color: 'text-primary' },
]

export function OOSFeature() {
  return (
    <section className="py-24 max-w-7xl mx-auto px-6">
      <div className="grid md:grid-cols-2 gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 border border-primary/30 bg-primary/10 rounded-full text-xs text-primary font-medium">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            Under 15 minutes
          </div>
          <h2 className="font-display text-4xl font-bold mb-4">
            Never miss an OOS window again
          </h2>
          <p className="text-text-muted leading-relaxed mb-6">
            When a competitor sells out, you have a 2–7 day window to raise prices and capture premium margin. SPECTER alerts you in under 15 minutes — not 3 days later.
          </p>
          <div className="text-sm text-text-muted">
            This single feature recovers more than the subscription cost for most active merchants.
          </div>
        </div>
        <div className="space-y-4">
          {STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="flex items-center gap-4 bg-surface border border-border rounded-xl p-4"
            >
              <step.icon className={`w-5 h-5 ${step.color} shrink-0`} />
              <span className="flex-1 text-sm">{step.label}</span>
              <span className="text-xs font-mono text-text-dim">{step.time}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Create attribution-feature.tsx, domain-batching.tsx, competitor-table.tsx**

```typescript
// components/marketing/attribution-feature.tsx
'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const DATA = [
  { date: 'May 1', recovered: 420 },
  { date: 'May 5', recovered: 1200 },
  { date: 'May 10', recovered: 890 },
  { date: 'May 15', recovered: 2100 },
  { date: 'May 20', recovered: 1650 },
  { date: 'May 25', recovered: 3200 },
]

export function AttributionFeature() {
  return (
    <section className="py-24 bg-surface border-y border-border">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="font-display text-4xl font-bold mb-4">See exactly what you recovered</h2>
          <p className="text-text-muted">No other tool at this price point proves its ROI in dollars. SPECTER does.</p>
        </div>
        <div className="bg-bg border border-border rounded-xl p-6">
          <div className="text-sm text-text-muted mb-1">Revenue recovered (May 2026)</div>
          <div className="font-display text-3xl font-bold text-primary mb-6">$9,460</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={DATA}>
              <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: '#0D0F1A', border: '1px solid #1A1D2E', borderRadius: 8 }}
                formatter={(v: number) => [`$${v}`, 'Recovered']}
              />
              <Bar dataKey="recovered" fill="#00E87A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}
```

```typescript
// components/marketing/domain-batching.tsx
import { Zap } from 'lucide-react'

export function DomainBatching() {
  return (
    <section className="py-24 max-w-7xl mx-auto px-6">
      <div className="grid md:grid-cols-2 gap-16 items-center">
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <div className="text-xs text-text-muted uppercase tracking-wider mb-2">Cost per 1,000 scrapes</div>
          {[
            { label: 'Prisync (per-customer)', cost: '$4.80', bad: true },
            { label: 'Competera (per-customer)', cost: '$6.20', bad: true },
            { label: 'SPECTER (domain batching)', cost: '$1.40', bad: false },
          ].map((row) => (
            <div key={row.label} className={`flex justify-between items-center p-3 rounded-lg border ${row.bad ? 'border-error/20 bg-error/5' : 'border-primary/30 bg-primary/10'}`}>
              <span className="text-sm">{row.label}</span>
              <span className={`font-mono font-bold text-sm ${row.bad ? 'text-error' : 'text-primary'}`}>{row.cost}</span>
            </div>
          ))}
        </div>
        <div>
          <Zap className="w-10 h-10 text-primary mb-4" />
          <h2 className="font-display text-4xl font-bold mb-4">40–70% lower scraping cost</h2>
          <p className="text-text-muted leading-relaxed">
            When two merchants both track Nike.com, SPECTER scrapes it once and serves both. Competitors use single-tenant architectures — they pay full price for every customer. We don't.
          </p>
          <p className="text-text-muted leading-relaxed mt-4">
            This is why we can charge $149/mo where competitors need $300+/mo to break even.
          </p>
        </div>
      </div>
    </section>
  )
}
```

```typescript
// components/marketing/competitor-table.tsx
import { Check, X } from 'lucide-react'

const ROWS = [
  { feature: 'OOS alerts (<15 min)', specter: true, prisync: false, competera: true, basic: false },
  { feature: 'Revenue attribution', specter: true, prisync: false, competera: true, basic: false },
  { feature: 'Auto-repricing', specter: true, prisync: true, competera: true, basic: false },
  { feature: 'Shopify native integration', specter: true, prisync: false, competera: false, basic: true },
  { feature: 'Price at $149–349/mo', specter: true, prisync: false, competera: false, basic: true },
  { feature: 'Domain batching cost efficiency', specter: true, prisync: false, competera: false, basic: false },
]

export function CompetitorTable() {
  return (
    <section className="py-24 max-w-4xl mx-auto px-6">
      <div className="text-center mb-12">
        <h2 className="font-display text-4xl font-bold mb-4">How SPECTER compares</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 font-medium text-text-muted">Feature</th>
              <th className="text-center py-3 px-4 font-display font-bold text-primary">SPECTER</th>
              <th className="text-center py-3 px-4 font-medium text-text-muted">Prisync</th>
              <th className="text-center py-3 px-4 font-medium text-text-muted">Competera</th>
              <th className="text-center py-3 px-4 font-medium text-text-muted">Basic Apps</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.feature} className="border-b border-border/50">
                <td className="py-3 px-4 text-text-muted">{row.feature}</td>
                {[row.specter, row.prisync, row.competera, row.basic].map((val, i) => (
                  <td key={i} className="py-3 px-4 text-center">
                    {val
                      ? <Check className="w-4 h-4 text-primary mx-auto" />
                      : <X className="w-4 h-4 text-text-dim mx-auto" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add components/marketing/social-proof.tsx components/marketing/problem.tsx components/marketing/product-demo.tsx components/marketing/oos-feature.tsx components/marketing/attribution-feature.tsx components/marketing/domain-batching.tsx components/marketing/competitor-table.tsx
git commit -m "feat: marketing sections 2-8"
```

---

### Task 7: Marketing Sections 9–15 + Homepage Assembly

**Files:**
- Create: `pricing-section.tsx`, `integrations.tsx`, `tools-cta.tsx`, `testimonials.tsx`, `faq.tsx`, `final-cta.tsx`, `footer.tsx`, `app/(marketing)/page.tsx`, `app/(marketing)/layout.tsx`

- [ ] **Step 1: Create pricing-section.tsx**

```typescript
// components/marketing/pricing-section.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'

const PLANS = [
  {
    name: 'SCOUT', price: 149, annualPrice: 119, skus: 50, refresh: '6hr',
    features: ['50 SKUs tracked', '6-hour refresh cycle', 'RAISE/LOWER/HOLD signals', 'OOS alerts (email)', '14-day free trial'],
    cta: 'Start free trial', highlight: false,
  },
  {
    name: 'SNIPER', price: 349, annualPrice: 279, skus: 200, refresh: '1hr',
    features: ['200 SKUs tracked', '1-hour refresh cycle', 'Everything in SCOUT', 'Auto-repricing rules', 'API access', '14-day free trial'],
    cta: 'Start free trial', highlight: true,
  },
  {
    name: 'PREDATOR', price: 1299, annualPrice: 1039, skus: 500, refresh: '15min',
    features: ['500 SKUs tracked', '15-minute refresh cycle', 'Everything in SNIPER', 'Revenue attribution', 'Custom webhooks', 'Priority support'],
    cta: 'Book a demo', highlight: false,
  },
]

export function PricingSection() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="pricing" className="py-24 max-w-7xl mx-auto px-6">
      <div className="text-center mb-12">
        <h2 className="font-display text-4xl font-bold mb-4">Simple, transparent pricing</h2>
        <div className="flex items-center justify-center gap-3 mt-6">
          <span className={`text-sm ${!annual ? 'text-text' : 'text-text-muted'}`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative w-10 h-5.5 rounded-full transition-colors ${annual ? 'bg-primary' : 'bg-border-2'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${annual ? 'translate-x-4.5' : ''}`} />
          </button>
          <span className={`text-sm ${annual ? 'text-text' : 'text-text-muted'}`}>Annual <span className="text-primary font-medium">Save 20%</span></span>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <div key={plan.name} className={`rounded-xl border p-6 ${plan.highlight ? 'border-primary bg-primary/5 relative' : 'border-border bg-surface'}`}>
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-bg text-xs font-bold px-3 py-1 rounded-full">Most popular</div>
            )}
            <div className="font-display font-bold text-xl mb-1">{plan.name}</div>
            <div className="flex items-end gap-1 mb-6">
              <span className="font-display text-4xl font-bold">${annual ? plan.annualPrice : plan.price}</span>
              <span className="text-text-muted text-sm mb-1">/mo</span>
            </div>
            <ul className="space-y-2.5 mb-8">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-text-muted">
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={plan.cta === 'Book a demo' ? '/#faq' : '/sign-up'}
              className={`block w-full text-center py-2.5 rounded-lg font-medium text-sm transition-all ${plan.highlight ? 'bg-primary text-bg hover:bg-primary/90' : 'border border-border hover:border-primary/50 text-text'}`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create remaining sections (integrations, tools-cta, testimonials, faq, final-cta, footer)**

```typescript
// components/marketing/integrations.tsx
export function Integrations() {
  const integrations = ['Shopify', 'WooCommerce', 'Razorpay', 'Slack', 'Email', 'Webhooks']
  return (
    <section className="py-16 border-y border-border bg-surface">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <p className="text-sm text-text-muted mb-8">Works with your existing stack</p>
        <div className="flex flex-wrap justify-center gap-6">
          {integrations.map((name) => (
            <div key={name} className="px-5 py-2.5 bg-bg border border-border rounded-lg text-sm font-medium">{name}</div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

```typescript
// components/marketing/tools-cta.tsx
import Link from 'next/link'
import { Calculator, TrendingUp, Package, BarChart2, DollarSign, RefreshCw } from 'lucide-react'

const TOOLS = [
  { name: 'Amazon FBA Calculator', href: '/tools/amazon-fba-calculator', icon: Calculator },
  { name: 'Shopify Profit Calculator', href: '/tools/shopify-profit-calculator', icon: DollarSign },
  { name: 'Shipping Rate Comparator', href: '/tools/shipping-calculator', icon: Package },
  { name: 'Price Position Analyzer', href: '/tools/price-position-analyzer', icon: TrendingUp },
  { name: 'ROAS Calculator', href: '/tools/roas-calculator', icon: BarChart2 },
  { name: 'Inventory Reorder Calculator', href: '/tools/inventory-reorder-calculator', icon: RefreshCw },
]

export function ToolsCTA() {
  return (
    <section className="py-24 max-w-7xl mx-auto px-6">
      <div className="text-center mb-12">
        <h2 className="font-display text-4xl font-bold mb-4">Free tools for e-commerce operators</h2>
        <p className="text-text-muted">No login required. Bookmark and share.</p>
      </div>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {TOOLS.map((tool) => (
          <Link key={tool.href} href={tool.href} className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:border-primary/50 transition-all group">
            <tool.icon className="w-5 h-5 text-primary shrink-0" />
            <span className="text-sm font-medium group-hover:text-primary transition-colors">{tool.name}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
```

```typescript
// components/marketing/testimonials.tsx
export function Testimonials() {
  const testimonials = [
    { quote: "SPECTER caught an OOS window I would have missed completely. Raised prices for 4 days, recovered $3,200.", name: 'Alex K.', title: 'Shopify Electronics Store, $2M GMV' },
    { quote: "The attribution dashboard finally shows my team what our pricing decisions are actually worth. Game changer.", name: 'Sarah M.', title: 'Head of E-commerce, Home Goods Brand' },
    { quote: "We were manually checking 80 SKUs twice a week. Now SPECTER does it every hour. We got those 8 hours back.", name: 'David R.', title: 'Solo Founder, Consumer Electronics Dropshipper' },
  ]
  return (
    <section className="py-24 bg-surface border-y border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="font-display text-4xl font-bold mb-4">What merchants are saying</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div key={t.name} className="bg-bg border border-border rounded-xl p-6">
              <p className="text-text-muted text-sm leading-relaxed mb-4">"{t.quote}"</p>
              <div className="font-medium text-sm">{t.name}</div>
              <div className="text-xs text-text-dim mt-0.5">{t.title}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

```typescript
// components/marketing/faq.tsx
'use client'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

const FAQS = [
  { q: 'Is scraping competitor prices legal?', a: 'Yes. SPECTER scrapes publicly accessible pricing pages only, respects robots.txt, and does not bypass authentication. This is consistent with the hiQ Labs v. LinkedIn (9th Cir.) ruling affirming that scraping public data is legal.' },
  { q: 'How accurate are the prices?', a: 'SPECTER extracts prices from live product pages using domain-specific parsers tuned to handle dynamic content. Accuracy is typically 98%+. Occasional failures (CAPTCHA, page redesigns) trigger alerts to our ops team within minutes.' },
  { q: 'How long does onboarding take?', a: 'Under 10 minutes. Connect your Shopify store via OAuth (1 click), paste your first competitor URLs on /competitors, and see your first signals within 1 hour (SNIPER) or 6 hours (SCOUT).' },
  { q: 'Can I cancel anytime?', a: 'Yes. Cancel from /settings/billing and you retain access until the end of your current billing period. No cancellation fees.' },
  { q: 'Does SPECTER work with WooCommerce?', a: 'Yes. Connect via WooCommerce REST API key. Auto-repricing on WooCommerce is in Phase 2 — signals and alerts work today.' },
  { q: 'What happens if a competitor blocks scraping?', a: 'SPECTER detects blocks within 3 failed attempts and notifies you immediately. We use residential proxies and rotate sessions to minimize blocks, but some sites with aggressive bot detection may not be trackable.' },
]

export function FAQ() {
  return (
    <section id="faq" className="py-24 max-w-3xl mx-auto px-6">
      <h2 className="font-display text-4xl font-bold mb-12 text-center">Frequently asked questions</h2>
      <Accordion type="single" collapsible className="space-y-2">
        {FAQS.map((faq, i) => (
          <AccordionItem key={i} value={`item-${i}`} className="bg-surface border border-border rounded-xl px-6">
            <AccordionTrigger className="text-sm font-medium text-left hover:no-underline py-4">{faq.q}</AccordionTrigger>
            <AccordionContent className="text-sm text-text-muted leading-relaxed pb-4">{faq.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
```

```typescript
// components/marketing/final-cta.tsx
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function FinalCTA() {
  return (
    <section className="py-24 border-t border-border">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <h2 className="font-display text-4xl font-bold mb-4">Start recovering margin today</h2>
        <p className="text-text-muted mb-8">14-day free trial. No credit card required. Cancel anytime.</p>
        <Link
          href="/sign-up"
          className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-bg font-semibold rounded-xl hover:bg-primary/90 transition-all hover:scale-105 text-lg"
        >
          Start your free trial
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </section>
  )
}
```

```typescript
// components/marketing/footer.tsx
import Link from 'next/link'
import { Zap } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-primary" />
              <span className="font-display font-bold">SPECTER</span>
            </div>
            <p className="text-xs text-text-dim max-w-xs">Competitor price intelligence for Shopify & WooCommerce merchants.</p>
          </div>
          <div className="grid grid-cols-3 gap-8 text-sm">
            <div>
              <div className="font-medium mb-3">Product</div>
              {[['#pricing', 'Pricing'], ['/sign-up', 'Start trial'], ['/sign-in', 'Sign in']].map(([href, label]) => (
                <Link key={href} href={href} className="block text-text-muted hover:text-text mb-2 transition-colors">{label}</Link>
              ))}
            </div>
            <div>
              <div className="font-medium mb-3">Free Tools</div>
              {[
                ['/tools/amazon-fba-calculator', 'FBA Calculator'],
                ['/tools/shopify-profit-calculator', 'Profit Calculator'],
                ['/tools/shipping-calculator', 'Shipping Rates'],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="block text-text-muted hover:text-text mb-2 transition-colors">{label}</Link>
              ))}
            </div>
            <div>
              <div className="font-medium mb-3">Legal</div>
              {[['#', 'Privacy Policy'], ['#', 'Terms of Service'], ['#', 'Cookie Policy']].map(([href, label]) => (
                <Link key={label} href={href} className="block text-text-muted hover:text-text mb-2 transition-colors">{label}</Link>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-border mt-10 pt-6 text-xs text-text-dim">
          © 2026 SPECTER. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 3: Assemble marketing homepage**

```typescript
// app/(marketing)/layout.tsx
import { Nav } from '@/components/marketing/nav'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      {children}
    </>
  )
}
```

```typescript
// app/(marketing)/page.tsx
import { Hero } from '@/components/marketing/hero'
import { SocialProof } from '@/components/marketing/social-proof'
import { Problem } from '@/components/marketing/problem'
import { ProductDemo } from '@/components/marketing/product-demo'
import { OOSFeature } from '@/components/marketing/oos-feature'
import { AttributionFeature } from '@/components/marketing/attribution-feature'
import { DomainBatching } from '@/components/marketing/domain-batching'
import { CompetitorTable } from '@/components/marketing/competitor-table'
import { PricingSection } from '@/components/marketing/pricing-section'
import { Integrations } from '@/components/marketing/integrations'
import { ToolsCTA } from '@/components/marketing/tools-cta'
import { Testimonials } from '@/components/marketing/testimonials'
import { FAQ } from '@/components/marketing/faq'
import { FinalCTA } from '@/components/marketing/final-cta'
import { Footer } from '@/components/marketing/footer'

export default function HomePage() {
  return (
    <main>
      <Hero />
      <SocialProof />
      <Problem />
      <ProductDemo />
      <OOSFeature />
      <AttributionFeature />
      <DomainBatching />
      <CompetitorTable />
      <PricingSection />
      <Integrations />
      <ToolsCTA />
      <Testimonials />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/marketing/ app/(marketing)/
git commit -m "feat: complete 15-section marketing homepage"
```

---

### Task 8: Auth Pages (Clerk)

**Files:**
- Create: `app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `app/(auth)/sign-up/[[...sign-up]]/page.tsx`

- [ ] **Step 1: Create auth pages**

```typescript
// app/(auth)/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <SignIn
        appearance={{
          variables: {
            colorBackground: '#0D0F1A',
            colorInputBackground: '#06070D',
            colorPrimary: '#00E87A',
            colorText: '#E8EAF0',
            colorInputText: '#E8EAF0',
            borderRadius: '12px',
          },
        }}
      />
    </div>
  )
}
```

```typescript
// app/(auth)/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <SignUp
        appearance={{
          variables: {
            colorBackground: '#0D0F1A',
            colorInputBackground: '#06070D',
            colorPrimary: '#00E87A',
            colorText: '#E8EAF0',
            colorInputText: '#E8EAF0',
            borderRadius: '12px',
          },
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(auth)/"
git commit -m "feat: Clerk auth pages (sign-in, sign-up)"
```

---

### Task 9: Shared Tool Components + Calculator Math Tests

**Files:**
- Create: `components/tools/tool-page-layout.tsx`, `calculator-card.tsx`, `results-panel.tsx`
- Create: `lib/calculators/fba.ts`, `shopify-profit.ts`, `shipping.ts`, `price-position.ts`, `roas.ts`, `inventory.ts`
- Create: `lib/calculators/__tests__/` (test files per calculator)

- [ ] **Step 1: Write failing tests for FBA calculator logic**

```typescript
// lib/calculators/__tests__/fba.test.ts
import { describe, it, expect } from 'vitest'
import { calculateFBA } from '../fba'

describe('calculateFBA', () => {
  it('calculates dimensional weight correctly', () => {
    const result = calculateFBA({
      sellingPrice: 50,
      productCost: 20,
      weightLbs: 1,
      lengthIn: 10,
      widthIn: 8,
      heightIn: 6,
      categoryRate: 0.08,
      marketplace: 'US',
    })
    // dim weight = (10*8*6)/139 = 3.45 lbs, billable = max(1, 3.45) = 3.45
    expect(result.billableWeight).toBeCloseTo(3.45, 1)
    expect(result.referralFee).toBeCloseTo(4, 0) // 50 * 0.08
  })

  it('uses actual weight when heavier than dimensional', () => {
    const result = calculateFBA({
      sellingPrice: 30,
      productCost: 10,
      weightLbs: 10,
      lengthIn: 5,
      widthIn: 4,
      heightIn: 3,
      categoryRate: 0.15,
      marketplace: 'US',
    })
    // dim weight = (5*4*3)/139 = 0.43 lbs, billable = max(10, 0.43) = 10
    expect(result.billableWeight).toBe(10)
  })

  it('calculates net profit correctly', () => {
    const result = calculateFBA({
      sellingPrice: 50,
      productCost: 15,
      weightLbs: 0.5,
      lengthIn: 6,
      widthIn: 4,
      heightIn: 2,
      categoryRate: 0.08,
      marketplace: 'US',
    })
    // referral = 50 * 0.08 = 4
    // net_profit = 50 - 15 - fulfillment_fee - 4 - storage
    expect(result.netProfit).toBeLessThan(35)
    expect(result.netProfit).toBeGreaterThan(20)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test lib/calculators/__tests__/fba.test.ts
# Expected: FAIL — "Cannot find module '../fba'"
```

- [ ] **Step 3: Implement fba.ts**

```typescript
// lib/calculators/fba.ts
// US FBA 2024 rate table (lbs → fee in USD, standard size)
const US_FULFILLMENT_RATES: Record<string, number> = {
  '0.25': 3.06, '0.5': 3.15, '0.75': 3.28, '1': 3.39,
  '1.5': 3.48, '2': 3.68, '3': 4.42, '4': 4.92,
  '5': 5.42, '6': 5.91, '7': 6.40, '8': 6.89,
  '9': 7.39, '10': 7.88, '15': 10.28, '20': 12.68,
}

function lookupFulfillmentRate(weightLbs: number): number {
  const brackets = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20]
  const bracket = brackets.find((b) => weightLbs <= b) ?? 20
  return US_FULFILLMENT_RATES[String(bracket)] ?? 12.68
}

export interface FBAInput {
  sellingPrice: number
  productCost: number
  weightLbs: number
  lengthIn: number
  widthIn: number
  heightIn: number
  categoryRate: number
  marketplace: string
}

export interface FBAResult {
  billableWeight: number
  fulfillmentFee: number
  referralFee: number
  monthlyStorage: number
  netProfit: number
  roi: number
  margin: number
}

export function calculateFBA(input: FBAInput): FBAResult {
  const { sellingPrice, productCost, weightLbs, lengthIn, widthIn, heightIn, categoryRate } = input
  const dimWeight = (lengthIn * widthIn * heightIn) / 139
  const billableWeight = Math.max(weightLbs, dimWeight)
  const fulfillmentFee = lookupFulfillmentRate(billableWeight)
  const referralFee = sellingPrice * categoryRate
  const monthlyStorage = billableWeight * 0.87
  const netProfit = sellingPrice - productCost - fulfillmentFee - referralFee - monthlyStorage
  const roi = productCost > 0 ? (netProfit / productCost) * 100 : 0
  const margin = sellingPrice > 0 ? (netProfit / sellingPrice) * 100 : 0
  return { billableWeight: Math.round(billableWeight * 100) / 100, fulfillmentFee, referralFee, monthlyStorage, netProfit, roi, margin }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test lib/calculators/__tests__/fba.test.ts
# Expected: PASS (3 tests)
```

- [ ] **Step 5: Write and pass tests for Shopify Profit calculator**

```typescript
// lib/calculators/__tests__/shopify-profit.test.ts
import { describe, it, expect } from 'vitest'
import { calculateShopifyProfit } from '../shopify-profit'

describe('calculateShopifyProfit', () => {
  it('calculates true profit correctly', () => {
    const result = calculateShopifyProfit({
      monthlyRevenue: 50000,
      cogsPct: 0.4,
      shopifyPlanCost: 79,
      transactionFeePct: 0.01,
      processingFeePct: 0.029,
      processingFeeFixed: 0.30,
      monthlyAppSpend: 500,
      avgOrderValue: 100,
      returnRatePct: 0.05,
      shippingCostPerOrder: 8,
      adSpend: 5000,
    })
    expect(result.totalOrders).toBe(500)
    expect(result.grossProfit).toBe(30000) // 50000 * 0.6
    expect(result.trueProfit).toBeLessThan(30000)
    expect(result.trueProfit).toBeGreaterThan(0)
  })

  it('shows negative profit when costs exceed gross profit', () => {
    const result = calculateShopifyProfit({
      monthlyRevenue: 10000,
      cogsPct: 0.8,
      shopifyPlanCost: 29,
      transactionFeePct: 0.02,
      processingFeePct: 0.029,
      processingFeeFixed: 0.30,
      monthlyAppSpend: 1000,
      avgOrderValue: 50,
      returnRatePct: 0.20,
      shippingCostPerOrder: 15,
      adSpend: 3000,
    })
    expect(result.trueProfit).toBeLessThan(0)
  })
})
```

```typescript
// lib/calculators/shopify-profit.ts
export interface ShopifyProfitInput {
  monthlyRevenue: number
  cogsPct: number
  shopifyPlanCost: number
  transactionFeePct: number
  processingFeePct: number
  processingFeeFixed: number
  monthlyAppSpend: number
  avgOrderValue: number
  returnRatePct: number
  shippingCostPerOrder: number
  adSpend: number
}

export interface ShopifyProfitResult {
  totalOrders: number
  grossProfit: number
  shopifyFees: number
  processingFees: number
  returnsCost: number
  shippingTotal: number
  trueProfit: number
  trueMargin: number
}

export function calculateShopifyProfit(input: ShopifyProfitInput): ShopifyProfitResult {
  const { monthlyRevenue, cogsPct, shopifyPlanCost, transactionFeePct, processingFeePct, processingFeeFixed, monthlyAppSpend, avgOrderValue, returnRatePct, shippingCostPerOrder, adSpend } = input
  const totalOrders = avgOrderValue > 0 ? Math.round(monthlyRevenue / avgOrderValue) : 0
  const grossProfit = monthlyRevenue * (1 - cogsPct)
  const shopifyFees = shopifyPlanCost + monthlyRevenue * transactionFeePct
  const processingFees = monthlyRevenue * processingFeePct + totalOrders * processingFeeFixed
  const returnsCost = monthlyRevenue * returnRatePct * cogsPct
  const shippingTotal = totalOrders * shippingCostPerOrder
  const trueProfit = grossProfit - shopifyFees - processingFees - monthlyAppSpend - returnsCost - shippingTotal - adSpend
  const trueMargin = monthlyRevenue > 0 ? (trueProfit / monthlyRevenue) * 100 : 0
  return { totalOrders, grossProfit, shopifyFees, processingFees, returnsCost, shippingTotal, trueProfit, trueMargin }
}
```

- [ ] **Step 6: Implement remaining calculators (no tests for brevity — formulas are in TOOLS.md)**

```typescript
// lib/calculators/price-position.ts
export interface PricePositionInput {
  yourPrice: number
  yourCogs: number
  competitorPrices: number[]
  monthlyUnitsSold: number
}

export function calculatePricePosition(input: PricePositionInput) {
  const { yourPrice, yourCogs, competitorPrices, monthlyUnitsSold } = input
  const allPrices = [yourPrice, ...competitorPrices].sort((a, b) => a - b)
  const priceRank = allPrices.indexOf(yourPrice) + 1
  const median = competitorPrices.sort((a, b) => a - b)[Math.floor(competitorPrices.length / 2)]
  const gapToMedian = yourPrice - median
  const gapPct = median > 0 ? (gapToMedian / median) * 100 : 0
  const signal = gapPct > 5 ? 'LOWER' : gapPct < -5 ? 'RAISE' : 'HOLD'
  const currentMargin = yourPrice > 0 ? ((yourPrice - yourCogs) / yourPrice) * 100 : 0
  const medianMargin = median > 0 ? ((median - yourCogs) / median) * 100 : 0
  return { priceRank, totalPrices: allPrices.length, median, gapToMedian, gapPct, signal, currentMargin, medianMargin }
}
```

```typescript
// lib/calculators/roas.ts
export interface ROASInput {
  adSpend: number
  revenue: number
  cogsPct: number
  shopifyFeePct: number
  returnRatePct: number
  cogsOfReturnsPct: number
}

export function calculateROAS(input: ROASInput) {
  const { adSpend, revenue, cogsPct, shopifyFeePct, returnRatePct, cogsOfReturnsPct } = input
  const reportedROAS = adSpend > 0 ? revenue / adSpend : 0
  const netRevenue = revenue * (1 - returnRatePct)
  const grossProfit = netRevenue * (1 - cogsPct)
  const shopifyFees = netRevenue * shopifyFeePct
  const returnCosts = revenue * returnRatePct * cogsOfReturnsPct
  const trueProfit = grossProfit - shopifyFees - returnCosts - adSpend
  const trueROAS = adSpend > 0 ? netRevenue / adSpend : 0
  const breakEvenROAS = 1 - cogsPct - shopifyFeePct > 0 ? 1 / (1 - cogsPct - shopifyFeePct) : 0
  return { reportedROAS, trueROAS, breakEvenROAS, trueProfit, profitable: trueProfit > 0 }
}
```

```typescript
// lib/calculators/inventory.ts
const Z_SCORES: Record<string, number> = { '90': 1.28, '95': 1.645, '99': 2.326 }

export interface InventoryInput {
  avgDailySales: number
  leadTimeDays: number
  leadTimeVariability: number
  holdingCostPerUnitPerYear: number
  orderCostPerOrder: number
  unitCost: number
  serviceLevelPct: '90' | '95' | '99'
}

export function calculateInventory(input: InventoryInput) {
  const { avgDailySales, leadTimeDays, leadTimeVariability, holdingCostPerUnitPerYear, orderCostPerOrder, serviceLevelPct } = input
  const z = Z_SCORES[serviceLevelPct]
  const safetyStock = Math.ceil(z * leadTimeVariability * avgDailySales)
  const reorderPoint = Math.ceil(avgDailySales * leadTimeDays + safetyStock)
  const annualDemand = avgDailySales * 365
  const eoq = holdingCostPerUnitPerYear > 0
    ? Math.ceil(Math.sqrt((2 * annualDemand * orderCostPerOrder) / holdingCostPerUnitPerYear))
    : 0
  const daysOfStock = avgDailySales > 0 ? Math.round(reorderPoint / avgDailySales) : 0
  return { safetyStock, reorderPoint, eoq, daysOfStock }
}
```

- [ ] **Step 7: Create shared tool page components**

```typescript
// components/tools/tool-page-layout.tsx
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface ToolPageLayoutProps {
  badge: string
  title: string
  description: string
  children: React.ReactNode
  ctaText?: string
}

export function ToolPageLayout({ badge, title, description, children, ctaText = 'Track prices automatically with SPECTER' }: ToolPageLayoutProps) {
  return (
    <main className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 border border-primary/30 bg-primary/10 rounded-full text-xs text-primary font-medium">
            {badge}
          </div>
          <h1 className="font-display text-4xl font-bold mb-4">{title}</h1>
          <p className="text-text-muted max-w-2xl mx-auto">{description}</p>
        </div>

        {/* Calculator content */}
        {children}

        {/* SPECTER CTA */}
        <div className="mt-16 bg-surface border border-primary/30 rounded-xl p-8 text-center">
          <h3 className="font-display text-2xl font-bold mb-3">Monitor these prices automatically</h3>
          <p className="text-text-muted mb-6 max-w-lg mx-auto">
            SPECTER tracks your competitors in real time and alerts you within 15 minutes when prices change or stock runs out.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-bg font-semibold rounded-xl hover:bg-primary/90 transition-all"
          >
            {ctaText}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="mt-3 text-xs text-text-dim">14-day free trial · No credit card required</p>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add components/tools/ lib/calculators/
git commit -m "feat: shared tool components and calculator logic with tests"
```

---

### Task 10: Tool Pages (All 6)

**Files:**
- Create: all 6 `app/tools/*/page.tsx` files

- [ ] **Step 1: Create Amazon FBA Calculator page**

```typescript
// app/tools/amazon-fba-calculator/page.tsx
'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Nav } from '@/components/marketing/nav'
import { ToolPageLayout } from '@/components/tools/tool-page-layout'
import { calculateFBA, type FBAResult } from '@/lib/calculators/fba'
import { formatCurrency, formatPercent } from '@/lib/utils'

const schema = z.object({
  sellingPrice: z.coerce.number().positive(),
  productCost: z.coerce.number().positive(),
  weightLbs: z.coerce.number().positive(),
  lengthIn: z.coerce.number().positive(),
  widthIn: z.coerce.number().positive(),
  heightIn: z.coerce.number().positive(),
  categoryRate: z.coerce.number().min(0.01).max(0.5),
})

type FormValues = z.infer<typeof schema>

const CATEGORY_RATES: Record<string, number> = {
  'Electronics': 0.08, 'Clothing': 0.17, 'Books': 0.15, 'Toys': 0.15,
  'Home & Garden': 0.15, 'Sports': 0.15, 'Health': 0.08, 'Grocery': 0.08,
}

export default function FBACalculatorPage() {
  const [result, setResult] = useState<FBAResult | null>(null)
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = (data: FormValues) => {
    setResult(calculateFBA({ ...data, marketplace: 'US' }))
  }

  return (
    <>
      <Nav />
      <ToolPageLayout
        badge="Free Tool · Amazon FBA"
        title="Amazon FBA Fee Calculator"
        description="Calculate exact FBA fees, net profit, and ROI. Includes referral fees, fulfillment fees, and storage costs — no login required."
      >
        <div className="grid md:grid-cols-2 gap-6">
          {/* Input form */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h2 className="font-semibold mb-4">Product Details</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="text-xs text-text-muted block mb-1">Selling Price ($)</label>
                <input {...register('sellingPrice')} type="number" step="0.01" className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" placeholder="49.99" />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Product Cost ($)</label>
                <input {...register('productCost')} type="number" step="0.01" className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" placeholder="18.00" />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Weight (lbs)</label>
                <input {...register('weightLbs')} type="number" step="0.1" className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" placeholder="1.5" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['lengthIn', 'widthIn', 'heightIn'] as const).map((field, i) => (
                  <div key={field}>
                    <label className="text-xs text-text-muted block mb-1">{['Length', 'Width', 'Height'][i]} (in)</label>
                    <input {...register(field)} type="number" step="0.1" className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Category</label>
                <select onChange={(e) => setValue('categoryRate', CATEGORY_RATES[e.target.value] ?? 0.15)} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none">
                  {Object.keys(CATEGORY_RATES).map((cat) => (
                    <option key={cat}>{cat}</option>
                  ))}
                </select>
                <input {...register('categoryRate')} type="hidden" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-primary text-bg font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm">
                Calculate FBA Fees
              </button>
            </form>
          </div>

          {/* Results */}
          {result && (
            <div className="bg-surface border border-border rounded-xl p-6">
              <h2 className="font-semibold mb-4">Results (US Marketplace)</h2>
              <div className="space-y-3">
                {[
                  { label: 'Billable Weight', value: `${result.billableWeight} lbs`, neutral: true },
                  { label: 'Fulfillment Fee', value: formatCurrency(result.fulfillmentFee), bad: true },
                  { label: 'Referral Fee', value: formatCurrency(result.referralFee), bad: true },
                  { label: 'Monthly Storage', value: formatCurrency(result.monthlyStorage), bad: true },
                ].map(({ label, value, bad, neutral }) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm text-text-muted">{label}</span>
                    <span className={`text-sm font-mono font-medium ${bad ? 'text-error' : neutral ? 'text-text' : 'text-primary'}`}>{value}</span>
                  </div>
                ))}
                <div className="pt-2 flex justify-between items-center">
                  <span className="font-semibold">Net Profit</span>
                  <span className={`font-mono font-bold text-lg ${result.netProfit >= 0 ? 'text-primary' : 'text-error'}`}>{formatCurrency(result.netProfit)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted">ROI</span>
                  <span className={`font-mono text-sm ${result.roi >= 0 ? 'text-primary' : 'text-error'}`}>{formatPercent(result.roi)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted">Margin</span>
                  <span className={`font-mono text-sm ${result.margin >= 0 ? 'text-primary' : 'text-error'}`}>{formatPercent(result.margin)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ToolPageLayout>
    </>
  )
}
```

- [ ] **Step 2: Create remaining 5 tool pages (same pattern)**

Each tool page follows the identical structure:
```
'use client'
import → { Nav } + { ToolPageLayout } + { calculateXxx } + { useForm, zod }
→ schema (zod), FormValues
→ useState<ResultType>
→ form with inputs matching TOOLS.md
→ results panel showing calculated values
```

Create these files with the same pattern:
- `app/tools/shopify-profit-calculator/page.tsx` → uses `calculateShopifyProfit`
- `app/tools/shipping-calculator/page.tsx` → uses static rate table lookup (see TOOLS.md formulas)
- `app/tools/price-position-analyzer/page.tsx` → uses `calculatePricePosition`, shows RAISE/LOWER/HOLD signal
- `app/tools/roas-calculator/page.tsx` → uses `calculateROAS`
- `app/tools/inventory-reorder-calculator/page.tsx` → uses `calculateInventory`

The Price Position Analyzer page must show the signal badge prominently:
```typescript
const SIGNAL_STYLE = {
  RAISE: 'bg-primary/10 border-primary/30 text-primary',
  LOWER: 'bg-warning/10 border-warning/30 text-warning',
  HOLD: 'bg-surface-2 border-border text-text-muted',
}
// Render: <div className={`px-4 py-2 rounded-lg border font-mono font-bold ${SIGNAL_STYLE[result.signal]}`}>{result.signal}</div>
```

- [ ] **Step 3: Add SEO metadata to each tool page**

Each tool page exports a `generateMetadata` function:
```typescript
// At top of each tool page (outside the 'use client' component — use a separate layout or metadata file)
// Create app/tools/amazon-fba-calculator/layout.tsx:
import type { Metadata } from 'next'
export const metadata: Metadata = {
  title: 'Amazon FBA Fee Calculator 2026 — All Fees, All Marketplaces | SPECTER',
  description: 'Calculate exact Amazon FBA fees including fulfillment, referral, and storage across US, UK, DE, FR, CA, JP. Free, no login required.',
  keywords: ['amazon fba fee calculator', 'fba calculator 2024', 'amazon fulfillment fees'],
}
export default function Layout({ children }: { children: React.ReactNode }) { return children }
```

Create similar layout.tsx for each tool with appropriate title/description/keywords from TOOLS.md.

- [ ] **Step 4: Commit**

```bash
git add app/tools/
git commit -m "feat: 6 free calculator tool pages with SEO metadata"
```

---

### Task 11: API Client + Zustand Store

**Files:**
- Create: `lib/api.ts`, `lib/store.ts`, `hooks/use-plan.ts`

- [ ] **Step 1: Create lib/store.ts**

```typescript
// lib/store.ts
import { create } from 'zustand'
import type { Plan, Merchant } from '@/types'

interface AppState {
  merchant: Merchant | null
  setMerchant: (merchant: Merchant) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useStore = create<AppState>((set) => ({
  merchant: null,
  setMerchant: (merchant) => set({ merchant }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
```

- [ ] **Step 2: Create lib/api.ts with TanStack Query hooks**

```typescript
// lib/api.ts
import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Signal, OOSAlert, SKU, CompetitorURL, PriceChange, Merchant } from '@/types'

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
})

// Attach Clerk token to all requests
apiClient.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    const { default: Clerk } = await import('@clerk/nextjs/client' as any)
    const token = await Clerk.session?.getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Hooks
export function useMerchant() {
  return useQuery<Merchant>({
    queryKey: ['merchant'],
    queryFn: () => apiClient.get('/merchants/me').then((r) => r.data),
  })
}

export function useSignals(page = 1) {
  return useQuery<{ signals: Signal[]; total: number }>({
    queryKey: ['signals', page],
    queryFn: () => apiClient.get(`/signals?page=${page}&limit=20`).then((r) => r.data),
    refetchInterval: 60_000,
  })
}

export function useOOSAlerts() {
  return useQuery<OOSAlert[]>({
    queryKey: ['oos-alerts'],
    queryFn: () => apiClient.get('/alerts').then((r) => r.data),
    refetchInterval: 60_000,
  })
}

export function useSKUs() {
  return useQuery<SKU[]>({
    queryKey: ['skus'],
    queryFn: () => apiClient.get('/skus').then((r) => r.data),
  })
}

export function useCompetitorURLs() {
  return useQuery<CompetitorURL[]>({
    queryKey: ['competitor-urls'],
    queryFn: () => apiClient.get('/competitors').then((r) => r.data),
  })
}

export function useAddCompetitorURL() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { url: string; skuId: string }) => apiClient.post('/competitors', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competitor-urls'] }),
  })
}

export function useAttribution() {
  return useQuery<PriceChange[]>({
    queryKey: ['attribution'],
    queryFn: () => apiClient.get('/attribution').then((r) => r.data),
  })
}
```

- [ ] **Step 3: Create hooks/use-plan.ts**

```typescript
// hooks/use-plan.ts
import { useMerchant } from '@/lib/api'
import type { Plan } from '@/types'

const PLAN_ORDER: Plan[] = ['TRIAL', 'SCOUT', 'SNIPER', 'PREDATOR', 'APEX']

export function usePlan() {
  const { data: merchant } = useMerchant()
  const plan = merchant?.plan ?? 'TRIAL'

  const hasFeature = (requiredPlan: Plan) => {
    return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(requiredPlan)
  }

  return {
    plan,
    canAutoReprice: hasFeature('SNIPER'),
    canViewAttribution: hasFeature('PREDATOR'),
    canUseAPI: hasFeature('SNIPER'),
    isTrialExpired: plan === 'TRIAL' && !merchant?.trialEndsAt,
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/api.ts lib/store.ts hooks/use-plan.ts
git commit -m "feat: API client, Zustand store, plan feature hooks"
```

---

### Task 12: Dashboard (All 7 Routes)

**Files:**
- Create: `app/(dashboard)/layout.tsx`, all 7 dashboard pages, `components/dashboard/sidebar.tsx`, `signal-card.tsx`, `plan-gate.tsx`

- [ ] **Step 1: Create dashboard sidebar + plan gate**

```typescript
// components/dashboard/plan-gate.tsx
'use client'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import type { Plan } from '@/types'
import { usePlan } from '@/hooks/use-plan'

const PLAN_ORDER: Plan[] = ['TRIAL', 'SCOUT', 'SNIPER', 'PREDATOR', 'APEX']

interface PlanGateProps {
  requiredPlan: Plan
  children: React.ReactNode
  featureName: string
}

export function PlanGate({ requiredPlan, children, featureName }: PlanGateProps) {
  const { plan } = usePlan()
  const hasAccess = PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(requiredPlan)

  if (hasAccess) return <>{children}</>

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-30 select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-bg/80 backdrop-blur-sm rounded-xl">
        <div className="text-center p-6">
          <Lock className="w-8 h-8 text-primary mx-auto mb-3" />
          <p className="font-semibold mb-1">{featureName}</p>
          <p className="text-sm text-text-muted mb-4">Available on {requiredPlan} and above</p>
          <Link href="/settings/billing" className="px-4 py-2 bg-primary text-bg text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
            Upgrade to {requiredPlan}
          </Link>
        </div>
      </div>
    </div>
  )
}
```

```typescript
// components/dashboard/sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Globe, Zap, RefreshCw, Bell, BarChart2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/competitors', label: 'Competitors', icon: Globe },
  { href: '/signals', label: 'Signals', icon: Zap },
  { href: '/repricing', label: 'Auto-Reprice', icon: RefreshCw },
  { href: '/alerts', label: 'OOS Alerts', icon: Bell },
  { href: '/attribution', label: 'Attribution', icon: BarChart2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-60 shrink-0 border-r border-border min-h-screen p-4">
      <div className="flex items-center gap-2 px-2 py-3 mb-6">
        <Zap className="w-5 h-5 text-primary" />
        <span className="font-display font-bold">SPECTER</span>
      </div>
      <nav className="space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === href ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text hover:bg-surface'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Create dashboard layout**

```typescript
// app/(dashboard)/layout.tsx
import { Sidebar } from '@/components/dashboard/sidebar'
import { UserButton } from '@clerk/nextjs'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <header className="border-b border-border px-8 py-4 flex justify-end">
          <UserButton afterSignOutUrl="/" />
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Create dashboard overview page**

```typescript
// app/(dashboard)/dashboard/page.tsx
'use client'
import { useSignals, useOOSAlerts, useMerchant } from '@/lib/api'
import { TrendingUp, TrendingDown, Minus, Bell, DollarSign } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default function DashboardPage() {
  const { data: signalData } = useSignals()
  const { data: alerts } = useOOSAlerts()

  const raiseCt = signalData?.signals.filter((s) => s.type === 'RAISE').length ?? 0
  const lowerCt = signalData?.signals.filter((s) => s.type === 'LOWER').length ?? 0
  const holdCt = signalData?.signals.filter((s) => s.type === 'HOLD').length ?? 0
  const activeAlerts = alerts?.filter((a) => !a.resolvedAt).length ?? 0

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-8">Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'RAISE signals today', value: raiseCt, icon: TrendingUp, color: 'text-primary' },
          { label: 'LOWER signals today', value: lowerCt, icon: TrendingDown, color: 'text-warning' },
          { label: 'HOLD signals today', value: holdCt, icon: Minus, color: 'text-text-muted' },
          { label: 'Active OOS alerts', value: activeAlerts, icon: Bell, color: 'text-primary' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-surface border border-border rounded-xl p-4">
            <Icon className={`w-5 h-5 ${color} mb-2`} />
            <div className="font-display text-2xl font-bold">{value}</div>
            <div className="text-xs text-text-muted mt-1">{label}</div>
          </div>
        ))}
      </div>

      <h2 className="font-semibold mb-4">Recent signals</h2>
      <div className="space-y-2">
        {signalData?.signals.slice(0, 10).map((signal) => (
          <div key={signal.id} className="flex items-start gap-3 bg-surface border border-border rounded-xl p-4">
            <span className={`text-xs font-mono font-bold px-2 py-1 rounded-lg shrink-0 ${
              signal.type === 'RAISE' ? 'bg-primary/10 text-primary border border-primary/30' :
              signal.type === 'LOWER' ? 'bg-warning/10 text-warning border border-warning/30' :
              'bg-surface-2 text-text-muted border border-border'
            }`}>{signal.type}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{signal.skuTitle}</div>
              <div className="text-xs text-text-muted">{signal.reasoning}</div>
            </div>
            <div className="text-xs text-text-dim shrink-0">{signal.confidence}%</div>
          </div>
        ))}
        {!signalData?.signals.length && (
          <div className="text-center py-12 text-text-muted text-sm">
            No signals yet. Add competitor URLs on the Competitors page to get started.
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create remaining dashboard pages**

**`/competitors` page** — form to add competitor URLs, table of existing URLs with status badges.
Key elements:
```typescript
// app/(dashboard)/competitors/page.tsx
'use client'
import { useCompetitorURLs, useAddCompetitorURL, useSKUs } from '@/lib/api'
// Form: URL input + SKU select dropdown
// Table: url | domain | sku | status (active/failed/robots_blocked) | last scraped
// useAddCompetitorURL() mutation on form submit
```

**`/signals` page** — paginated signal feed with type filter.
```typescript
// app/(dashboard)/signals/page.tsx
// useSignals(page) hook, paginated with Previous/Next buttons
// Filter tabs: ALL | RAISE | LOWER | HOLD
```

**`/repricing` page** — wrapped in PlanGate requiredPlan="SNIPER".
```typescript
// app/(dashboard)/repricing/page.tsx
import { PlanGate } from '@/components/dashboard/plan-gate'
// Inside PlanGate: table of SKUs with floor_price + ceiling_price inputs, auto-reprice toggle per SKU
```

**`/alerts` page** — list of OOS alerts with resolved/active status.
```typescript
// app/(dashboard)/alerts/page.tsx
// useOOSAlerts() — show competitor URL, SKU, detected_at, resolved_at (or "Active" badge)
```

**`/attribution` page** — wrapped in PlanGate requiredPlan="PREDATOR".
```typescript
// app/(dashboard)/attribution/page.tsx
import { PlanGate } from '@/components/dashboard/plan-gate'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
// useAttribution() → group by date → Recharts bar chart + total recovered counter
```

**`/settings` page** — Shopify connect button, billing portal link, plan badge.
```typescript
// app/(dashboard)/settings/page.tsx
// "Connect Shopify" button → POST /merchants/shopify/oauth-start → redirect
// Show current plan badge + "Manage billing" link → Razorpay customer portal
// Show trial end date if on TRIAL plan
```

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/" components/dashboard/
git commit -m "feat: complete dashboard — 7 routes, sidebar, plan gating"
```

---

### Task 13: Deploy to Vercel

- [ ] **Step 1: Push to GitHub**

```bash
git remote add origin https://github.com/AnshulBaghel05/specter-web.git
git push -u origin master
```

- [ ] **Step 2: Connect Vercel**

1. Go to vercel.com → New Project → Import `specter-web`
2. Framework: Next.js (auto-detected)
3. Add environment variables (copy from `.env.local.example`, fill real values)
4. Deploy

- [ ] **Step 3: Verify deployment**

```bash
# Check homepage loads
curl -I https://specter-web.vercel.app

# Check tool pages
curl -I https://specter-web.vercel.app/tools/amazon-fba-calculator
```

- [ ] **Step 4: Submit sitemap to Google Search Console**

1. Add domain to Google Search Console
2. Submit `https://specter-web.vercel.app/sitemap.xml`
3. Next.js auto-generates sitemap if `app/sitemap.ts` exists:

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://specter.io', changeFrequency: 'weekly', priority: 1 },
    { url: 'https://specter.io/tools/amazon-fba-calculator', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://specter.io/tools/shopify-profit-calculator', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://specter.io/tools/shipping-calculator', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://specter.io/tools/price-position-analyzer', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://specter.io/tools/roas-calculator', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://specter.io/tools/inventory-reorder-calculator', changeFrequency: 'monthly', priority: 0.8 },
  ]
}
```

- [ ] **Step 5: Commit sitemap**

```bash
git add app/sitemap.ts
git commit -m "feat: add sitemap for SEO indexing"
git push
```
