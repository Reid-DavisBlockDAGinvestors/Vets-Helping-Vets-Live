'use client'

import { useState } from 'react'
import { Switch } from '@headlessui/react'
import { Zap, Loader2, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react'

interface ImmediatePayoutToggleProps {
  submissionId: string
  chainId: number
  contractAddress: string
  campaignId: number
  initialEnabled: boolean
  contractVersion?: string
  onSuccess?: (enabled: boolean, txHash: string) => void
  disabled?: boolean
}

export function ImmediatePayoutToggle({
  submissionId,
  chainId,
  contractAddress,
  campaignId,
  initialEnabled,
  contractVersion = 'v8',
  onSuccess,
  disabled = false
}: ImmediatePayoutToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ txHash: string } | null>(null)

  const isMainnet = chainId === 1

  const handleToggle = async (newValue: boolean) => {
    if (loading || disabled) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/admin/campaigns/${submissionId}/immediate-payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token') || ''}`
        },
        body: JSON.stringify({
          enabled: newValue,
          chainId,
          contractAddress,
          campaignId,
          contractVersion
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update')
      }

      if (data.alreadySet) {
        setEnabled(newValue)
        return
      }

      setEnabled(newValue)
      setSuccess({ txHash: data.txHash })
      onSuccess?.(newValue, data.txHash)

    } catch (err: any) {
      setError(err.message || 'Failed to update immediate payout')
      // Revert on error
      setEnabled(!newValue)
    } finally {
      setLoading(false)
    }
  }

  const getExplorerUrl = (txHash: string) => {
    switch (chainId) {
      case 1:
        return `https://etherscan.io/tx/${txHash}`
      case 11155111:
        return `https://sepolia.etherscan.io/tx/${txHash}`
      case 1043:
        return `https://awakening.bdagscan.com/tx/${txHash}`
      default:
        return null
    }
  }

  return (
    <div className="space-y-2" data-testid="immediate-payout-toggle">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className={`w-4 h-4 ${enabled ? 'text-green-400' : 'text-gray-500'}`} />
          <span className="text-sm font-medium text-white">
            Immediate Payout
          </span>
          {isMainnet && (
            <span className="px-1.5 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
              MAINNET
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
          
          <Switch
            checked={enabled}
            onChange={handleToggle}
            disabled={loading || disabled}
            className={`${
              enabled ? 'bg-green-500' : 'bg-gray-600'
            } relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            ${loading || disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-900`}
            data-testid="immediate-payout-switch"
          >
            <span
              className={`${
                enabled ? 'translate-x-6' : 'translate-x-1'
              } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
            />
          </Switch>
        </div>
      </div>

      <p className="text-xs text-white/60">
        {enabled 
          ? 'Funds are automatically sent to submitter on each NFT purchase'
          : 'Funds accumulate in contract until manually distributed'
        }
      </p>

      {error && (
        <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400" data-testid="immediate-payout-error">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/30 rounded text-sm text-green-400" data-testid="immediate-payout-success">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>Updated successfully!</span>
          {success.txHash && getExplorerUrl(success.txHash) && (
            <a
              href={getExplorerUrl(success.txHash)!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-green-300 hover:text-green-200 underline"
            >
              View tx <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export default ImmediatePayoutToggle
