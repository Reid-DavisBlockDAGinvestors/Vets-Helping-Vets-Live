'use client'

import { isMainnet, formatChainAmount, getFundsLabel, getChainBadge } from '@/lib/chains/classification'
import { ChainBadge } from './ChainBadge'

interface FundsDisplayProps {
  amount: number
  chainId: number | string | null | undefined
  showBadge?: boolean
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function FundsDisplay({ 
  amount, 
  chainId, 
  showBadge = false,
  showLabel = true,
  size = 'md',
  className = ''
}: FundsDisplayProps) {
  const mainnet = isMainnet(chainId)
  const badge = getChainBadge(chainId)
  const formattedAmount = formatChainAmount(amount, chainId)
  const label = getFundsLabel(chainId)
  
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  }

  return (
    <div 
      className={`inline-flex items-center gap-2 ${className}`} 
      data-testid="funds-display"
      data-chain-type={mainnet ? 'mainnet' : 'testnet'}
    >
      <span className={`font-bold ${badge.textClass} ${sizeClasses[size]}`}>
        {formattedAmount}
      </span>
      {showLabel && (
        <span className="text-white/60">{label}</span>
      )}
      {showBadge && <ChainBadge chainId={chainId} size="sm" />}
    </div>
  )
}

interface FundsBreakdownProps {
  nftAmount: number
  giftAmount: number
  chainId: number | string | null | undefined
  className?: string
}

export function FundsBreakdown({ 
  nftAmount, 
  giftAmount, 
  chainId,
  className = ''
}: FundsBreakdownProps) {
  const mainnet = isMainnet(chainId)
  const badge = getChainBadge(chainId)
  const total = nftAmount + giftAmount
  const formattedTotal = formatChainAmount(total, chainId)
  
  return (
    <div className={`flex flex-col ${className}`} data-testid="funds-breakdown">
      <div className="flex items-center gap-2">
        <span className={`text-xl font-bold ${badge.textClass}`}>
          {formattedTotal}
        </span>
        <span className="text-white/60">{getFundsLabel(chainId)}</span>
      </div>
      <div className="flex gap-3 text-sm text-white/50">
        <span>NFT: {formatChainAmount(nftAmount, chainId)}</span>
        <span>Gifts: {formatChainAmount(giftAmount, chainId)}</span>
      </div>
    </div>
  )
}

interface ProgressBarProps {
  current: number
  goal: number
  chainId: number | string | null | undefined
  showPercentage?: boolean
  className?: string
}

export function ChainProgressBar({ 
  current, 
  goal, 
  chainId,
  showPercentage = true,
  className = ''
}: ProgressBarProps) {
  const mainnet = isMainnet(chainId)
  const percentage = goal > 0 ? Math.min((current / goal) * 100, 100) : 0
  
  const barColor = mainnet ? 'bg-green-500' : 'bg-orange-500'
  const bgColor = mainnet ? 'bg-green-500/20' : 'bg-orange-500/20'
  const textColor = mainnet ? 'text-green-400' : 'text-orange-400'
  
  return (
    <div className={`w-full ${className}`} data-testid="chain-progress-bar">
      <div className={`h-2 rounded-full ${bgColor} overflow-hidden`}>
        <div 
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showPercentage && (
        <div className={`mt-1 text-sm ${textColor}`}>
          {percentage.toFixed(0)}% complete
        </div>
      )}
    </div>
  )
}

interface StatsCardProps {
  label: string
  amount: number
  chainId?: number | string | null
  showIcon?: boolean
  className?: string
}

export function ChainStatsCard({ 
  label, 
  amount, 
  chainId,
  showIcon = true,
  className = ''
}: StatsCardProps) {
  const mainnet = chainId !== undefined ? isMainnet(chainId) : null
  const badge = chainId !== undefined ? getChainBadge(chainId) : null
  
  return (
    <div 
      className={`flex flex-col ${className}`}
      data-testid="chain-stats-card"
    >
      <div className="flex items-center gap-2">
        {showIcon && badge && <span>{badge.icon}</span>}
        <span className={`text-2xl font-bold ${badge?.textClass || 'text-white'}`}>
          {chainId !== undefined ? formatChainAmount(amount, chainId) : `$${amount.toLocaleString()}`}
        </span>
      </div>
      <span className="text-sm text-white/60">{label}</span>
    </div>
  )
}
