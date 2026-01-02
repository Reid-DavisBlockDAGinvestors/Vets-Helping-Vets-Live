'use client'

import { useState, useEffect } from 'react'
import { formatNativeAmount, formatCurrency, shortenAddress, formatDate } from '../utils/formatters'
import type { NativeCurrency } from '../types'

// Chain explorer URLs for tx links
const CHAIN_EXPLORERS: Record<number, string> = {
  1043: 'https://awakening.bdagscan.com',
  1: 'https://etherscan.io',
  11155111: 'https://sepolia.etherscan.io',
  137: 'https://polygonscan.com',
  8453: 'https://basescan.org',
}

interface Distribution {
  id: string
  campaign_id: string
  chain_id: number
  tx_hash: string | null
  distribution_type: 'funds' | 'tips' | 'refund' | 'combined'
  total_amount: number
  submitter_amount: number
  nonprofit_amount: number
  platform_fee: number
  tip_split_submitter_pct: number
  tip_split_nonprofit_pct: number
  submitter_wallet: string | null
  nonprofit_wallet: string | null
  status: 'pending' | 'processing' | 'confirmed' | 'failed'
  initiated_at: string
  confirmed_at: string | null
  error_message: string | null
  native_currency: NativeCurrency
}

interface DistributionHistoryProps {
  campaignId: string
  campaignTitle: string
  isOpen: boolean
  onClose: () => void
}

/**
 * DistributionHistory - Shows all past distributions for a campaign
 * With transaction verification and explorer links
 */
export function DistributionHistory({
  campaignId,
  campaignTitle,
  isOpen,
  onClose
}: DistributionHistoryProps) {
  const [distributions, setDistributions] = useState<Distribution[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && campaignId) {
      fetchHistory()
    }
  }, [isOpen, campaignId])

  const fetchHistory = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/distributions/history?campaignId=${campaignId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch distribution history')
      }
      const data = await response.json()
      setDistributions(data.distributions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: Distribution['status']) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      processing: 'bg-blue-500/20 text-blue-400',
      confirmed: 'bg-green-500/20 text-green-400',
      failed: 'bg-red-500/20 text-red-400'
    }
    const icons: Record<string, string> = {
      pending: '⏳',
      processing: '🔄',
      confirmed: '✅',
      failed: '❌'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${styles[status]}`}>
        {icons[status]} {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const getTypeBadge = (type: Distribution['distribution_type']) => {
    const styles: Record<string, string> = {
      funds: 'bg-green-500/20 text-green-400',
      tips: 'bg-purple-500/20 text-purple-400',
      refund: 'bg-orange-500/20 text-orange-400',
      combined: 'bg-blue-500/20 text-blue-400'
    }
    const icons: Record<string, string> = {
      funds: '💸',
      tips: '💜',
      refund: '↩️',
      combined: '📦'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${styles[type]}`}>
        {icons[type]} {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    )
  }

  const getExplorerUrl = (chainId: number, txHash: string) => {
    const baseUrl = CHAIN_EXPLORERS[chainId] || CHAIN_EXPLORERS[1043]
    return `${baseUrl}/tx/${txHash}`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="bg-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden border border-white/10"
        data-testid="distribution-history-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">📜 Distribution History</h2>
            <p className="text-sm text-white/50 mt-1">{campaignTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white p-2"
            data-testid="close-history-btn"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
          {isLoading && (
            <div className="text-center py-12 text-white/50">
              <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white rounded-full mx-auto mb-3" />
              Loading distribution history...
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-center">
              {error}
            </div>
          )}

          {!isLoading && !error && distributions.length === 0 && (
            <div className="text-center py-12 text-white/50">
              <div className="text-4xl mb-3">📭</div>
              <p>No distributions yet</p>
              <p className="text-sm mt-1">Distributions will appear here after you process them</p>
            </div>
          )}

          {!isLoading && !error && distributions.length > 0 && (
            <div className="space-y-4">
              {distributions.map((dist) => (
                <div 
                  key={dist.id}
                  className="rounded-xl bg-white/5 border border-white/10 p-4"
                  data-testid={`distribution-${dist.id}`}
                >
                  {/* Header Row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getTypeBadge(dist.distribution_type)}
                      {getStatusBadge(dist.status)}
                    </div>
                    <span className="text-xs text-white/50">
                      {formatDate(dist.initiated_at)}
                    </span>
                  </div>

                  {/* Amounts */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-white/50">Total</p>
                      <p className="text-white font-mono">
                        {formatNativeAmount(dist.total_amount, dist.native_currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-400">Submitter ({dist.tip_split_submitter_pct}%)</p>
                      <p className="text-white font-mono">
                        {formatNativeAmount(dist.submitter_amount, dist.native_currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-purple-400">Nonprofit ({dist.tip_split_nonprofit_pct}%)</p>
                      <p className="text-white font-mono">
                        {formatNativeAmount(dist.nonprofit_amount, dist.native_currency)}
                      </p>
                    </div>
                  </div>

                  {/* Recipients */}
                  <div className="text-xs text-white/40 space-y-1">
                    {dist.submitter_wallet && (
                      <p>Submitter: <span className="font-mono">{shortenAddress(dist.submitter_wallet)}</span></p>
                    )}
                    {dist.nonprofit_wallet && (
                      <p>Nonprofit: <span className="font-mono">{shortenAddress(dist.nonprofit_wallet)}</span></p>
                    )}
                  </div>

                  {/* TX Link */}
                  {dist.tx_hash && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <a
                        href={getExplorerUrl(dist.chain_id, dist.tx_hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                        data-testid={`tx-link-${dist.id}`}
                      >
                        🔗 View on Explorer
                        <span className="font-mono text-xs">{shortenAddress(dist.tx_hash)}</span>
                      </a>
                    </div>
                  )}

                  {/* Error Message */}
                  {dist.status === 'failed' && dist.error_message && (
                    <div className="mt-3 p-2 rounded-lg bg-red-500/10 text-red-400 text-xs">
                      ❌ {dist.error_message}
                    </div>
                  )}

                  {/* Confirmed At */}
                  {dist.confirmed_at && (
                    <p className="text-xs text-green-400 mt-2">
                      ✅ Confirmed at {formatDate(dist.confirmed_at)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={fetchHistory}
            disabled={isLoading}
            className="w-full px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50"
          >
            🔄 Refresh History
          </button>
        </div>
      </div>
    </div>
  )
}

export default DistributionHistory
