'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
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
  const [showPassword, setShowPassword] = useState(false)
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
        data: { full_name: data.full_name },
        emailRedirectTo: `${origin}/auth/callback`,
      },
    })
    if (error) {
      setAuthError(
        error.message === 'User already registered'
          ? 'An account with this email already exists. Sign in instead.'
          : error.message
      )
      return
    }
    setSubmittedEmail(data.email)
    setEmailSent(true)
  }

  if (emailSent) {
    return (
      <main className="min-h-screen bg-bg flex items-center justify-center px-6 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 50% 50%, rgba(0,232,122,0.06) 0%, transparent 70%)',
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
          className="w-full max-w-md text-center"
        >
          <div className="bg-surface border border-border rounded-2xl p-10 shadow-[0_0_40px_rgba(0,0,0,0.4)]">
            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-primary" />
              </div>
            </div>
            <h2 className="font-display font-bold text-text mb-2" style={{ fontSize: '1.35rem' }}>
              Check your inbox
            </h2>
            <p className="font-body text-sm text-muted mb-1">
              We sent a confirmation link to
            </p>
            <p className="font-body text-sm font-medium text-text mb-6 break-all">
              {submittedEmail}
            </p>
            <p className="font-body text-xs text-muted">
              Click the link in the email to activate your account. Check your spam folder if you don&apos;t see it.
            </p>
          </div>
          <p className="text-center font-body text-sm text-muted mt-6">
            Already confirmed?{' '}
            <Link href="/sign-in" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </motion.div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-bg flex items-center justify-center px-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 50%, rgba(0,232,122,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Back to home */}
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-1.5 text-muted hover:text-text transition-colors text-sm font-body"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to home
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease }}
        className="w-full max-w-md"
      >
        {/* Branding */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-4">
            <span className="font-display text-2xl font-bold text-text tracking-tight">
              SPECTER<span className="text-primary">.</span>
            </span>
          </Link>
          <h1
            className="font-display font-bold text-text mb-2"
            style={{ fontSize: '1.45rem', letterSpacing: '-0.02em' }}
          >
            Start your free trial
          </h1>
          <p className="font-body text-sm text-muted">
            14 days free · No credit card required
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-[0_0_40px_rgba(0,0,0,0.4)]">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            noValidate
          >
            {/* Auth error */}
            {authError && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 bg-rose-400/10 border border-rose-400/20 rounded-xl px-4 py-3"
                role="alert"
              >
                <AlertCircle
                  size={15}
                  className="text-rose-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <p className="font-body text-sm text-rose-400">{authError}</p>
              </motion.div>
            )}

            {/* Full name */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="full_name"
                className="font-body text-sm font-medium text-text"
              >
                Full name
              </label>
              <input
                id="full_name"
                type="text"
                autoComplete="name"
                placeholder="Jane Smith"
                aria-invalid={!!errors.full_name}
                className={`bg-bg border rounded-xl px-4 py-3 font-body text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all ${
                  errors.full_name ? 'border-rose-400/60' : 'border-border'
                }`}
                {...register('full_name')}
              />
              {errors.full_name && (
                <p className="font-body text-xs text-rose-400" role="alert">
                  {errors.full_name.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="font-body text-sm font-medium text-text"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@yourstore.com"
                aria-invalid={!!errors.email}
                className={`bg-bg border rounded-xl px-4 py-3 font-body text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all ${
                  errors.email ? 'border-rose-400/60' : 'border-border'
                }`}
                {...register('email')}
              />
              {errors.email && (
                <p className="font-body text-xs text-rose-400" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="font-body text-sm font-medium text-text"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  aria-invalid={!!errors.password}
                  className={`w-full bg-bg border rounded-xl px-4 py-3 pr-12 font-body text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all ${
                    errors.password ? 'border-rose-400/60' : 'border-border'
                  }`}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="font-body text-xs text-rose-400" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="gradient-primary-cta btn-ripple w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-1 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span
                    className="w-4 h-4 border-2 border-bg/40 border-t-bg rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  Creating account…
                </>
              ) : (
                'Start free trial'
              )}
            </button>

            <p className="font-body text-xs text-muted text-center -mt-1">
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
        </div>

        {/* Footer link */}
        <p className="text-center font-body text-sm text-muted mt-6">
          Already have an account?{' '}
          <Link
            href="/sign-in"
            className="text-primary hover:underline font-medium"
          >
            Sign in
          </Link>
        </p>
      </motion.div>
    </main>
  )
}
