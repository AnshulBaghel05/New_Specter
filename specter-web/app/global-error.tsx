'use client'

import { useEffect } from 'react'

// Catches errors thrown inside the root layout itself (e.g. webpack module failures)
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[SPECTER] Global error:', error)
  }, [error])

  return (
    <html lang="en" style={{ background: '#06070D', color: '#E8EAF0' }}>
      <body
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: '0.75rem', color: '#00E87A', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '1rem' }}>
          Something went wrong
        </p>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Page failed to load
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#6B7280', maxWidth: '28rem', marginBottom: '2rem', lineHeight: 1.6 }}>
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <button
          onClick={reset}
          style={{
            background: 'linear-gradient(135deg,#00FF94 0%,#00CC76 100%)',
            color: '#06070D',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.75rem 1.5rem',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
