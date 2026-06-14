'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirm: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })

type FormData = z.infer<typeof schema>

const ease = [0.22, 1, 0.36, 1] as const

type Status = 'checking' | 'ready' | 'invalid' | 'done'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('checking')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  // The /auth/callback route exchanges the recovery code for a session before
  // redirecting here. If there is no session, the link was invalid, expired, or
  // already used — show the recovery prompt instead of the form.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setStatus(data.user ? 'ready' : 'invalid')
    })
  }, [])

  async function onSubmit(data: FormData) {
    setAuthError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) {
      setAuthError(error.message)
      return
    }
    // Invalidate every existing session (this device + any others) so a stolen
    // old session can't outlive the reset; the user re-authenticates fresh.
    await supabase.auth.signOut({ scope: 'global' })
    setStatus('done')
    setTimeout(() => {
      router.push('/sign-in')
      router.refresh()
    }, 2000)
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
            {status === 'done' ? 'Password updated' : 'Set a new password'}
          </h1>
          <p className="font-body text-sm text-muted">
            {status === 'done'
              ? 'Redirecting you to sign in…'
              : 'Choose a strong password for your account'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-[0_0_40px_rgba(0,0,0,0.4)]">
          {status === 'checking' && (
            <div className="flex items-center justify-center py-6">
              <span
                className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin"
                aria-hidden="true"
              />
            </div>
          )}

          {status === 'invalid' && (
            <div className="text-center">
              <div className="flex justify-center mb-5">
                <div className="w-14 h-14 rounded-full bg-rose-400/10 border border-rose-400/20 flex items-center justify-center">
                  <AlertCircle size={28} className="text-rose-400" aria-hidden="true" />
                </div>
              </div>
              <p className="font-body text-sm text-text mb-2 font-medium">
                This reset link is invalid or has expired
              </p>
              <p className="font-body text-xs text-muted leading-relaxed mb-6">
                Reset links can only be used once and expire after 1 hour. Request
                a new one to continue.
              </p>
              <Link
                href="/forgot-password"
                className="gradient-primary-cta btn-ripple inline-flex w-full items-center justify-center py-3 rounded-xl font-semibold text-sm transition-all duration-200"
              >
                Request a new link
              </Link>
            </div>
          )}

          {status === 'done' && (
            <div className="text-center py-2">
              <div className="flex justify-center mb-5">
                <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <CheckCircle2 size={28} className="text-primary" aria-hidden="true" />
                </div>
              </div>
              <p className="font-body text-sm text-text mb-2 font-medium">
                Your password has been reset
              </p>
              <p className="font-body text-xs text-muted leading-relaxed">
                Sign in with your new password to continue.
              </p>
            </div>
          )}

          {status === 'ready' && (
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

              {/* New password */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="font-body text-sm font-medium text-text">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
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

              {/* Confirm password */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm" className="font-body text-sm font-medium text-text">
                  Confirm new password
                </label>
                <input
                  id="confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  aria-invalid={!!errors.confirm}
                  className={`bg-bg border rounded-xl px-4 py-3 font-body text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all ${
                    errors.confirm ? 'border-rose-400/60' : 'border-border'
                  }`}
                  {...register('confirm')}
                />
                {errors.confirm && (
                  <p className="font-body text-xs text-rose-400" role="alert">
                    {errors.confirm.message}
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
                    Updating…
                  </>
                ) : (
                  'Update password'
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
