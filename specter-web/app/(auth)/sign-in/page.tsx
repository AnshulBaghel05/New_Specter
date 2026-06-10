'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, ArrowLeft, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

const ease = [0.22, 1, 0.36, 1] as const

// Isolated so useSearchParams is inside a Suspense boundary (Next.js 14 requirement)
function UrlErrorReader({ onError }: { onError: (msg: string) => void }) {
  const searchParams = useSearchParams()
  useEffect(() => {
    const err = searchParams.get('error')
    if (err) onError(decodeURIComponent(err))
  }, [searchParams, onError])
  return null
}

export default function SignInPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setAuthError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (error) {
      setAuthError(
        error.message === 'Invalid login credentials'
          ? 'Incorrect email or password. Please try again.'
          : error.message
      )
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-bg flex items-center justify-center px-6 relative overflow-hidden">
      {/* Read ?error= from URL without blocking render */}
      <Suspense fallback={null}>
        <UrlErrorReader onError={setAuthError} />
      </Suspense>

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
            Welcome back
          </h1>
          <p className="font-body text-sm text-muted">
            Sign in to your SPECTER account
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
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="font-body text-sm font-medium text-text"
                >
                  Password
                </label>
                <span className="font-body text-xs text-muted">
                  Forgot?{' '}
                  <Link
                    href="/sign-up"
                    className="text-primary hover:underline"
                    tabIndex={-1}
                  >
                    Create new account
                  </Link>
                </span>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
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
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <p className="text-center font-body text-sm text-muted mt-6">
          Don&apos;t have an account?{' '}
          <Link
            href="/sign-up"
            className="text-primary hover:underline font-medium"
          >
            Start 14-day free trial
          </Link>
        </p>
      </motion.div>
    </main>
  )
}
