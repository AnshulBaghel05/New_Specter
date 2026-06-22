'use client'

import { useState } from 'react'
import { Store, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useDisconnectShopify, type Merchant } from '@/lib/api'
import { toast } from '@/lib/toast'
import SettingsCard from './settings-card'
import ShopifyConnectModal from './shopify-connect-modal'

export default function ShopifyCard({ merchant }: { merchant: Merchant }) {
  const disconnect = useDisconnectShopify()
  const [modalOpen, setModalOpen] = useState(false)

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
          onClick={() => setModalOpen(true)}
          className="gradient-primary-cta btn-ripple self-start px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200"
        >
          Reconnect Shopify
        </button>
        <ShopifyConnectModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Reconnect your Shopify store"
        />
      </SettingsCard>
    )
  }

  return (
    <SettingsCard title="Shopify">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <Store size={20} className="text-muted shrink-0" aria-hidden="true" />
          <p className="font-body text-sm text-text">Connect your store</p>
        </div>
        <p className="font-body text-sm text-muted pl-8">
          Import products and enable auto-repricing. You&rsquo;ll approve access securely on Shopify.
        </p>
      </div>
      <button
        onClick={() => setModalOpen(true)}
        className="gradient-primary-cta btn-ripple self-start px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 inline-flex items-center gap-2"
      >
        <Store size={16} aria-hidden="true" /> Connect Shopify
      </button>
      <ShopifyConnectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </SettingsCard>
  )
}
