'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const TOOLS = [
  { label: 'Amazon FBA Calculator', href: '/tools/amazon-fba-calculator' },
  { label: 'Shopify Profit Calculator', href: '/tools/shopify-profit-calculator' },
  { label: 'Shipping Rate Estimator', href: '/tools/shipping-calculator' },
  { label: 'Price Position Analyzer', href: '/tools/price-position-analyzer' },
  { label: 'Ad ROAS Calculator', href: '/tools/roas-calculator' },
  { label: 'Inventory Reorder Calculator', href: '/tools/inventory-reorder-calculator' },
]

const NAV_LINKS = [
  { label: 'Features', href: '/features' },
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
