'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})

type FormData = z.infer<typeof schema>

const ease = [0.22, 1, 0.36, 1] as const

export default function ForgotPasswordPage() {
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
    // The reset link lands on /auth/callback, which exchanges the recovery code
    // for a session and forwards to /reset-password to set the new password.
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    })
    if (error) {
      setAuthError(error.message)
      return
    }
    // Supabase does not reveal whether the email exists (anti-enumeration), so we
    // always show the same confirmation on success.
    setSubmittedEmail(data.email)
    setEmailSent(true)
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

      {/* Back to sign in */}
      <Link
        href="/sign-in"
        className="absolute top-6 left-6 flex items-center gap-1.5 text-muted hover:text-text transition-colors text-sm font-body"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to sign in
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
            {emailSent ? 'Check your email' : 'Reset your password'}
          </h1>
          <p className="font-body text-sm text-muted">
            {emailSent
              ? 'A reset link is on its way'
              : 'Enter your email and we’ll send you a reset link'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-[0_0_40px_rgba(0,0,0,0.4)]">
          {emailSent ? (
            <div className="text-center">
              <div className="flex justify-center mb-5">
                <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <CheckCircle2 size={28} className="text-primary" aria-hidden="true" />
                </div>
              </div>
              <p className="font-body text-sm text-muted mb-1">
                If an account exists for
              </p>
              <p className="font-body text-sm font-medium text-text mb-5 break-all">
                {submittedEmail}
              </p>
              <p className="font-body text-xs text-muted leading-relaxed">
                you’ll receive an email with a link to reset your password. The
                link expires in 1 hour. Check your spam folder if you don’t see it.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
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

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="font-body text-sm font-medium text-text">
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
                    Sending…
                  </>
                ) : (
                  'Send reset link'
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer link */}
        <p className="text-center font-body text-sm text-muted mt-6">
          Remember your password?{' '}
          <Link href="/sign-in" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </motion.div>
    </main>
  )
}
