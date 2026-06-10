'use client'

import { useState, useEffect, useRef } from 'react'

interface UseCountUpOptions {
  end: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  startOnMount?: boolean
}

export function useCountUp({
  end,
  duration = 2000,
  decimals = 0,
  prefix = '',
  suffix = '',
  startOnMount = false,
}: UseCountUpOptions) {
  const [value, setValue] = useState(startOnMount ? 0 : end)
  const [started, setStarted] = useState(startOnMount)
  const frameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  const start = () => setStarted(true)

  useEffect(() => {
    if (!started) return

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

    function tick(timestamp: number) {
      if (!startTimeRef.current) startTimeRef.current = timestamp
      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      const current = easeOut(progress) * end

      setValue(parseFloat(current.toFixed(decimals)))

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        setValue(end)
      }
    }

    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      startTimeRef.current = null
    }
  }, [started, end, duration, decimals])

  const display = `${prefix}${value.toLocaleString()}${suffix}`
  return { display, value, start }
}
