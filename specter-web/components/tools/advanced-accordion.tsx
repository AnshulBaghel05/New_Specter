'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface AdvancedAccordionProps {
  label?: string
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
}

export default function AdvancedAccordion({
  label = 'Advanced options',
  children,
  defaultOpen = false,
  className,
}: AdvancedAccordionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={cn('border border-border rounded-xl overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 text-left',
          'font-mono text-xs text-muted hover:text-text transition-colors',
          open && 'border-b border-border',
        )}
        aria-expanded={open}
      >
        <span className="uppercase tracking-wider">{label}</span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={cn('transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="accordion-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="p-4 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
