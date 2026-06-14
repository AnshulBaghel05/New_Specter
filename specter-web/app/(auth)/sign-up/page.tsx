'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import {
  User,
  Building2,
  Mail,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AuthLayout } from '@/components/auth/auth-layout'
import { AuthField } from '@/components/auth/auth-field'
import { GoogleButton } from '@/components/auth/google-button'

const schema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  organization: z.string().optional(),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
})

type FormData = z.infer<typeof schema>

const ease = [0.22, 1, 0.36, 1] as const

export default function SignUpPage() {
  const [authError, setAuthError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setAuthError(null)
    const supabase = createClient()
    const origin = window.location.origin
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.full_name,
          ...(data.organization ? { organization: data.organization } : {}),
        },
        emailRedirectTo: `${origin}/auth/callback`,
      },
    })
    if (error) {
      setAuthError(
        error.message === 'User already registered'
          ? 'An account with this email already exists. Sign in instead.'
          : error.message,
      )
      return
    }
    setSubmittedEmail(data.email)
    setEmailSent(true)
  }

  if (emailSent) {
    return (
      <AuthLayout>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="text-center"
        >
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_28px_rgba(0,232,122,0.2)]">
              <CheckCircle2 size={28} className="text-primary" />
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold text-text mb-2 tracking-tight">
            Briefing Dispatched
          </h1>
          <p className="font-body text-sm text-muted mb-1">
            We sent a confirmation link to
          </p>
          <p className="font-body text-sm font-medium text-text mb-6 break-all">
            {submittedEmail}
          </p>
          <p className="font-body text-xs text-muted leading-relaxed">
            Click the link in the email to activate your account. Check your spam
            folder if you don&apos;t see it.
          </p>
          <p className="text-center font-body text-sm text-muted mt-8">
            Already confirmed?{' '}
            <Link href="/sign-in" className="text-primary hover:underline font-medium">
              Sign In Profile →
            </Link>
          </p>
        </motion.div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      {/* Heading */}
      <div className="mb-7">
        <h1 className="font-display text-3xl font-bold text-text tracking-tight">
          Register Operator<span className="text-primary">.</span>
        </h1>
        <p className="font-body text-sm text-muted mt-2">
          Initialize your profile to begin the 14-day mission briefing.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {authError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 bg-rose-400/10 border border-rose-400/20 rounded-xl px-4 py-3"
            role="alert"
          >
            <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="font-body text-sm text-rose-400">{authError}</p>
          </motion.div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AuthField
            id="full_name"
            label="Full Identity"
            icon={User}
            type="text"
            autoComplete="name"
            placeholder="John Smith"
            error={errors.full_name?.message}
            {...register('full_name')}
          />
          <AuthField
            id="organization"
            label="Organization"
            icon={Building2}
            type="text"
            autoComplete="organization"
            placeholder="Acme Corp"
            error={errors.organization?.message}
            {...register('organization')}
          />
        </div>

        <AuthField
          id="email"
          label="Deployment Email"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="operator@company.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <AuthField
          id="password"
          label="Secure Key"
          icon={KeyRound}
          passwordToggle
          autoComplete="new-password"
          placeholder="Minimum 8 characters"
          error={errors.password?.message}
          {...register('password')}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="gradient-primary-cta btn-ripple w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-1 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <span
                className="w-4 h-4 border-2 border-bg/40 border-t-bg rounded-full animate-spin"
                aria-hidden="true"
              />
              Launching…
            </>
          ) : (
            <>
              Launch Swarm Trial
              <ArrowRight size={16} aria-hidden="true" />
            </>
          )}
        </button>

        <p className="font-body text-xs text-muted text-center">
          By creating an account you agree to our{' '}
          <Link href="/terms" className="text-primary/80 hover:text-primary hover:underline">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-primary/80 hover:text-primary hover:underline">
            Privacy Policy
          </Link>
        </p>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="h-px flex-1 bg-border" />
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <GoogleButton label="Initiate Google ID" next="/dashboard" onError={setAuthError} />

      <p className="text-center font-body text-sm text-muted mt-8">
        Already part of the swarm?{' '}
        <Link href="/sign-in" className="text-primary hover:underline font-medium">
          Sign In Profile →
        </Link>
      </p>
    </AuthLayout>
  )
}
