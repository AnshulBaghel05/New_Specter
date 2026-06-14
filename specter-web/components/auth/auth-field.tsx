'use client'

import { forwardRef, useState } from 'react'
import { Eye, EyeOff, type LucideIcon } from 'lucide-react'

type AuthFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
  icon: LucideIcon
  error?: string
  /** Renders a show/hide toggle and manages the input type. */
  passwordToggle?: boolean
}

/**
 * Labelled auth input with a leading icon, error state, and an optional
 * password-reveal toggle. Styled on the Dark Intelligence tokens.
 */
export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(
  function AuthField({ label, icon: Icon, error, passwordToggle, id, type, ...props }, ref) {
    const [reveal, setReveal] = useState(false)
    const inputType = passwordToggle ? (reveal ? 'text' : 'password') : type

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={id}
          className="font-mono text-[11px] font-medium tracking-[0.12em] uppercase text-muted"
        >
          {label}
        </label>
        <div className="relative">
          <Icon
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            aria-hidden="true"
          />
          <input
            id={id}
            ref={ref}
            type={inputType}
            aria-invalid={!!error}
            className={`w-full bg-bg border rounded-xl pl-10 ${
              passwordToggle ? 'pr-11' : 'pr-4'
            } py-3 font-body text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all ${
              error ? 'border-rose-400/60' : 'border-border'
            }`}
            {...props}
          />
          {passwordToggle && (
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors"
              aria-label={reveal ? 'Hide password' : 'Show password'}
            >
              {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
        {error && (
          <p className="font-body text-xs text-rose-400" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  },
)
