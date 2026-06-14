'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}

/**
 * Google OAuth button. Uses Supabase's PKCE flow — the redirect lands on the
 * existing /auth/callback route which exchanges the code for a session.
 */
export function GoogleButton({
  label = 'Continue with Google',
  next = '/dashboard',
  onError,
}: {
  label?: string
  next?: string
  onError?: (msg: string) => void
}) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (error) {
      setLoading(false)
      onError?.(error.message)
    }
    // On success the browser is redirected to Google; no state to reset.
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 bg-white text-[#1f1f1f] rounded-xl py-3 font-body text-sm font-medium border border-transparent transition-all duration-200 hover:shadow-[0_0_24px_rgba(255,255,255,0.12)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
    >
      {loading ? (
        <span
          className="w-4 h-4 border-2 border-[#1f1f1f]/30 border-t-[#1f1f1f] rounded-full animate-spin"
          aria-hidden="true"
        />
      ) : (
        <GoogleGlyph />
      )}
      {label}
    </button>
  )
}
