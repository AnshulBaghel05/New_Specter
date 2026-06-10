'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, LogOut, LifeBuoy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import SettingsCard from './settings-card'

export default function AccountCard() {
  const router = useRouter()
  const [email, setEmail] = useState('—')
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    // createClient() throws synchronously when Supabase env is unconfigured
    // (e.g. local preview), so guard it — the card degrades to "—".
    try {
      const supabase = createClient()
      supabase.auth
        .getUser()
        .then(({ data }) => {
          if (data.user?.email) setEmail(data.user.email)
        })
        .catch(() => {})
    } catch {
      /* Supabase not configured — leave email as "—" */
    }
  }, [])

  async function signOut() {
    setSigningOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {
      /* Supabase not configured — fall through to redirect */
    }
    router.push('/sign-in')
  }

  return (
    <SettingsCard title="Account">
      <div className="flex items-center gap-3 min-w-0">
        <Mail size={18} className="text-muted shrink-0" aria-hidden="true" />
        <p className="font-body text-sm text-text truncate">{email}</p>
      </div>
      <div className="flex items-center justify-between gap-4">
        <a
          href="mailto:support@specterapp.io"
          className="font-body text-sm text-primary hover:underline inline-flex items-center gap-2"
        >
          <LifeBuoy size={16} aria-hidden="true" /> Contact support
        </a>
        <button
          onClick={signOut}
          disabled={signingOut}
          className="font-body text-sm text-rose-400 hover:text-rose-300 disabled:opacity-40 inline-flex items-center gap-2 shrink-0"
        >
          <LogOut size={16} aria-hidden="true" /> {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </SettingsCard>
  )
}
