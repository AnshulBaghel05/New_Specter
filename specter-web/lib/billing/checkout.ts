'use client'

/**
 * Razorpay checkout launcher: embedded checkout.js modal with a hosted
 * short_url fallback. The pure decision (`chooseCheckoutMode`) is unit-tested;
 * the side-effecting loader/opener are thin wrappers around the SDK.
 */
const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? ''
const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

export type CheckoutMode = 'embedded' | 'hosted' | 'none'

export function chooseCheckoutMode(opts: {
  keyId: string
  scriptLoaded: boolean
  shortUrl: string | null
}): CheckoutMode {
  if (opts.keyId && opts.scriptLoaded) return 'embedded'
  if (opts.shortUrl) return 'hosted'
  return 'none'
}

/** Inject checkout.js once; resolves true on load, false on error/timeout. */
export function loadCheckoutScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  const w = window as unknown as { Razorpay?: unknown }
  if (w.Razorpay) return Promise.resolve(true)
  return new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(true))
      existing.addEventListener('error', () => resolve(false))
      return
    }
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

export interface OpenCheckoutArgs {
  subscriptionId: string
  shortUrl: string | null
  onDismiss?: () => void
}

/**
 * Open the best available checkout for a created subscription. Returns the mode
 * actually used. Both embedded success and hosted redirect land on
 * /dashboard/billing/success (embedded via callback_url; hosted is the page).
 */
export async function openCheckout(args: OpenCheckoutArgs): Promise<CheckoutMode> {
  const scriptLoaded = RAZORPAY_KEY_ID ? await loadCheckoutScript() : false
  const mode = chooseCheckoutMode({
    keyId: RAZORPAY_KEY_ID,
    scriptLoaded,
    shortUrl: args.shortUrl,
  })

  if (mode === 'embedded') {
    const w = window as unknown as { Razorpay: new (o: unknown) => { open: () => void } }
    const rzp = new w.Razorpay({
      key: RAZORPAY_KEY_ID,
      subscription_id: args.subscriptionId,
      callback_url: `${window.location.origin}/dashboard/billing/success`,
      redirect: true,
      modal: { ondismiss: args.onDismiss },
    })
    rzp.open()
  } else if (mode === 'hosted' && args.shortUrl) {
    window.location.href = args.shortUrl
  }
  return mode
}
