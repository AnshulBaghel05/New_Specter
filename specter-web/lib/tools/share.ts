'use client'

// ── URL state encoding ─────────────────────────────────────────────────────

export function encodeShareState(state: Record<string, unknown>): string {
  try {
    const json = JSON.stringify(state)
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  } catch {
    return ''
  }
}

export function decodeShareState<T = Record<string, unknown>>(encoded: string): T | null {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const pad = padded.length % 4
    const base64 = pad ? padded + '='.repeat(4 - pad) : padded
    return JSON.parse(decodeURIComponent(escape(atob(base64)))) as T
  } catch {
    return null
  }
}

export function buildShareUrl(path: string, state: Record<string, unknown>): string {
  const encoded = encodeShareState(state)
  if (!encoded) return path
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://specterapp.io'
  return `${base}${path}?s=${encoded}`
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for browsers without clipboard API
    try {
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      return true
    } catch {
      return false
    }
  }
}

// ── Per-tool share state builders ─────────────────────────────────────────

export interface PricePositionShareState {
  p: number // my_price
  c: { n: string; p: number }[] // competitors
}

export interface FbaShareState {
  sp: number  // selling_price
  pc: number  // product_cost
  wo: number  // weight_oz
  li: number  // length_in
  wi: number  // width_in
  hi: number  // height_in
  ca: string  // category
}

export interface RoasShareState {
  sp: number  // ad_spend
  rv: number  // revenue
  cg: number  // cogs
  fl: number  // fulfillment
}

export interface ShopifyShareState {
  rv: number  // monthly_revenue
  pl: string  // plan
  cg: number  // cogs
  or: number  // orders
  as: number  // ad_spend
}

export interface ShippingShareState {
  wt: number  // weight_lb
  zm: string  // zone_mode: 'domestic' | 'international'
  zn: number  // zone (1-8 or country code index)
  ln: number  // length_in
  wd: number  // width_in
  ht: number  // height_in
}

export interface InventoryShareState {
  dd: number  // daily_demand
  oc: number  // order_cost
  hc: number  // holding_cost_pct
  up: number  // unit_price
  lt: number  // lead_time_days
}
