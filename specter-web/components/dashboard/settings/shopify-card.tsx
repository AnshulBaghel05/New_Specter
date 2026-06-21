'use client'

import { useState } from 'react'
import { Store, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useDisconnectShopify, shopifyOAuthUrl, type Merchant } from '@/lib/api'
import { toast } from '@/lib/toast'
import SettingsCard from './settings-card'

export default function ShopifyCard({ merchant }: { merchant: Merchant }) {
  const disconnect = useDisconnectShopify()
  const [shop, setShop] = useState('')

  async function connect() {
    const trimmed = shop.trim().replace(/^https?:\/\//, '')
    if (!trimmed) return
    const url = await shopifyOAuthUrl(trimmed)
    if (url) window.location.href = url
    else toast.error('Your session expired — sign in again to connect Shopify.')
  }

  if (merchant.shopify_connected && !merchant.shopify_reconnect_required) {
    return (
      <SettingsCard title="Shopify">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <CheckCircle2 size={20} className="text-primary shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-body text-sm text-text truncate">{merchant.shopify_domain ?? 'Connected'}</p>
              <p className="font-body text-xs text-muted">Store connected</p>
            </div>
          </div>
          <button
            onClick={() =>
              disconnect.mutate(undefined, {
                onSuccess: () => toast.success('Shopify store disconnected'),
              })
            }
            disabled={disconnect.isPending}
            className="font-body text-sm text-rose-400 hover:text-rose-300 disabled:opacity-40 shrink-0"
          >
            {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
        {disconnect.isError && <p className="font-body text-xs text-rose-400">{"Couldn’t disconnect. Try again."}</p>}
      </SettingsCard>
    )
  }

  if (merchant.shopify_connected && merchant.shopify_reconnect_required) {
    return (
      <SettingsCard title="Shopify">
        <div className="flex items-start gap-3 rounded-xl bg-amber-400/10 border border-amber-400/20 px-4 py-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-body text-sm text-text">Reconnect required</p>
            <p className="font-body text-xs text-muted mt-0.5">
              Your Shopify access token expired or was revoked. Auto-repricing is paused until you reconnect{' '}
              {merchant.shopify_domain ?? 'your store'}.
            </p>
          </div>
        </div>
        <button
          onClick={async () => {
            if (!merchant.shopify_domain) return
            const url = await shopifyOAuthUrl(merchant.shopify_domain)
            if (url) window.location.href = url
            else toast.error('Your session expired — sign in again to reconnect.')
          }}
          className="gradient-primary-cta btn-ripple self-start px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200"
        >
          Reconnect Shopify
        </button>
      </SettingsCard>
    )
  }

  return (
    <SettingsCard title="Shopify">
      <div className="flex items-center gap-3">
        <Store size={20} className="text-muted shrink-0" aria-hidden="true" />
        <p className="font-body text-sm text-muted">Connect your store to import products and enable auto-repricing.</p>
      </div>
      <div className="flex items-stretch gap-2">
        <input
          type="text"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && connect()}
          placeholder="your-store.myshopify.com"
          className="flex-1 bg-bg border border-border rounded-xl px-3.5 py-2.5 font-mono text-sm text-text placeholder:text-muted focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
        />
        <button
          onClick={connect}
          disabled={!shop.trim()}
          className="gradient-primary-cta btn-ripple px-5 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
        >
          Connect
        </button>
      </div>
    </SettingsCard>
  )
}
