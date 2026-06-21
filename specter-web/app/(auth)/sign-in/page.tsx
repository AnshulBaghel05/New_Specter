'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AuthLayout } from '@/components/auth/auth-layout'
import { AuthField } from '@/components/auth/auth-field'
import { GoogleButton } from '@/components/auth/google-button'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

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
          : error.message,
      )
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <AuthLayout>
      <Suspense fallback={null}>
        <UrlErrorReader onError={setAuthError} />
      </Suspense>

      {/* Heading */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-text tracking-tight">
          Welcome back<span className="text-primary">.</span>
        </h1>
        <p className="font-body text-sm text-muted mt-2">
          Sign in to your SPECTER dashboard.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
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

        <AuthField
          id="email"
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <div>
          <AuthField
            id="password"
            label="Password"
            icon={Lock}
            passwordToggle
            autoComplete="current-password"
            placeholder="••••••••••"
            error={errors.password?.message}
            {...register('password')}
          />
          <div className="flex justify-end mt-2">
            <Link
              href="/forgot-password"
              className="font-mono text-[11px] tracking-[0.1em] uppercase text-primary/80 hover:text-primary transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="gradient-primary-cta btn-ripple w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            <>
              Sign in
              <ArrowRight size={16} aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="h-px flex-1 bg-border" />
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <GoogleButton label="Continue with Google" next="/dashboard" onError={setAuthError} />

      <p className="text-center font-body text-sm text-muted mt-8">
        New to SPECTER?{' '}
        <Link href="/sign-up" className="text-primary hover:underline font-medium">
          Create an account →
        </Link>
      </p>
    </AuthLayout>
  )
}
