'use client'

import { useEffect, useRef } from 'react'

interface UseScrollRevealOptions {
  y?: number
  duration?: number
  delay?: number
  stagger?: number
  childSelector?: string
}

/**
 * Reveal elements on scroll using IntersectionObserver + CSS transitions.
 * No GSAP/ScrollTrigger dependency — immune to Lenis timing issues.
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>(
  options: UseScrollRevealOptions = {}
) {
  const ref = useRef<T>(null)
  // Capture options at call time so the empty-dep effect reads stable values
  const optRef = useRef(options)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const {
      y = 32,
      duration = 0.7,
      delay = 0,
      stagger = 0,
      childSelector,
    } = optRef.current

    const targets: HTMLElement[] = childSelector
      ? Array.from(el.querySelectorAll<HTMLElement>(childSelector))
      : [el as HTMLElement]

    if (targets.length === 0) return

    // Don't hide elements already in the viewport on mount
    const rect = el.getBoundingClientRect()
    const alreadyInView = rect.top < window.innerHeight * 0.92

    if (!alreadyInView) {
      targets.forEach((t, i) => {
        t.style.opacity = '0'
        t.style.transform = `translateY(${y}px)`
        t.style.transition = `opacity ${duration}s cubic-bezier(0.33,1,0.68,1), transform ${duration}s cubic-bezier(0.33,1,0.68,1)`
        t.style.transitionDelay = `${delay + i * stagger}s`
        t.style.willChange = 'opacity, transform'
      })
    }

    const reveal = () => {
      targets.forEach((t) => {
        t.style.opacity = '1'
        t.style.transform = 'translateY(0)'
      })
      observer.disconnect()
    }

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) reveal() },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    )

    observer.observe(el)

    return () => {
      observer.disconnect()
      targets.forEach((t) => {
        t.style.opacity = ''
        t.style.transform = ''
        t.style.transition = ''
        t.style.transitionDelay = ''
        t.style.willChange = ''
      })
    }
  }, []) // intentionally runs once on mount

  return ref
}
