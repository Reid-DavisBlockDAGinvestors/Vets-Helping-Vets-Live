'use client'

import { Zap, Clock, AlertCircle } from 'lucide-react'

interface DistributionStatusBadgeProps {
  immediatePayoutEnabled: boolean | null
  chainId: number | null
  totalDistributed?: number | null
  lastDistributionAt?: string | null
  compact?: boolean
}

/**
 * Shows the fund distribution status for a campaign
 * - Green: Immediate payout enabled (auto-distribution)
 * - Yellow: Manual distribution required
 * - Shows total distributed if available
 */
export function DistributionStatusBadge({
  immediatePayoutEnabled,
  chainId,
  totalDistributed,
  lastDistributionAt,
  compact = false
}: DistributionStatusBadgeProps) {
  // Only show for V7/V8 compatible chains (Sepolia, Ethereum Mainnet)
  const supportsImmediatePayout = chainId === 1 || chainId === 11155111
  
  if (!supportsImmediatePayout) {
    return compact ? null : (
      <div className="flex items-center gap-1 text-xs text-white/40" data-testid="distribution-status-badge">
        <Clock className="w-3 h-3" />
        <span>Manual distribution</span>
      </div>
    )
  }

  const isEnabled = immediatePayoutEnabled === true
  const isMainnet = chainId === 1

  if (compact) {
    return (
      <span 
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
          isEnabled 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-yellow-500/20 text-yellow-400'
        }`}
        title={isEnabled ? 'Auto-distributes on each NFT purchase' : 'Requires manual distribution'}
        data-testid="distribution-status-badge"
      >
        {isEnabled ? <Zap className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
        {isEnabled ? 'Auto' : 'Manual'}
      </span>
    )
  }

  return (
    <div className="space-y-1" data-testid="distribution-status-badge">
      <div className={`flex items-center gap-2 text-sm ${
        isEnabled ? 'text-green-400' : 'text-yellow-400'
      }`}>
        {isEnabled ? (
          <>
            <Zap className="w-4 h-4" />
            <span>Immediate Payout</span>
            {isMainnet && (
              <span className="px-1.5 py-0.5 bg-green-500/20 rounded text-xs">MAINNET</span>
            )}
          </>
        ) : (
          <>
            <Clock className="w-4 h-4" />
            <span>Manual Distribution</span>
            <AlertCircle className="w-3 h-3 text-yellow-500" />
          </>
        )}
      </div>
      
      {totalDistributed !== null && totalDistributed !== undefined && totalDistributed > 0 && (
        <div className="text-xs text-white/60">
          Distributed: <span className="font-mono text-green-400">
            {totalDistributed.toFixed(4)} ETH
          </span>
        </div>
      )}
      
      {lastDistributionAt && (
        <div className="text-xs text-white/40">
          Last: {new Date(lastDistributionAt).toLocaleDateString()}
        </div>
      )}
      
      {!isEnabled && (
        <p className="text-xs text-yellow-400/60">
          ⚠️ Funds held in contract until admin distributes
        </p>
      )}
    </div>
  )
}

export default DistributionStatusBadge
