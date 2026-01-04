'use client'

import { getChainBadge, isMainnet } from '@/lib/chains/classification'

interface ChainBadgeProps {
  chainId: number | string | null | undefined
  showTooltip?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  variant?: 'full' | 'icon' | 'compact'
}

export function ChainBadge({ 
  chainId, 
  showTooltip = true, 
  size = 'md',
  variant = 'full'
}: ChainBadgeProps) {
  const badge = getChainBadge(chainId)
  
  const sizeClasses = {
    xs: 'text-[10px] px-1 py-0.5 gap-0.5',
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-sm px-2 py-1 gap-1',
    lg: 'text-base px-3 py-1.5 gap-1.5'
  }
  
  if (variant === 'icon') {
    return (
      <span 
        className={`inline-flex items-center justify-center ${badge.textClass}`}
        title={showTooltip ? badge.tooltip : undefined}
        data-testid="chain-badge-icon"
      >
        {badge.icon}
      </span>
    )
  }

  if (variant === 'compact') {
    return (
      <span 
        className={`inline-flex items-center rounded-full border font-medium ${sizeClasses[size]} ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
        title={showTooltip ? badge.tooltip : undefined}
        data-testid="chain-badge-compact"
      >
        <span>{badge.icon}</span>
      </span>
    )
  }
  
  return (
    <span 
      className={`inline-flex items-center rounded-full border font-medium ${sizeClasses[size]} ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
      title={showTooltip ? badge.tooltip : undefined}
      data-testid="chain-badge"
    >
      <span>{badge.icon}</span>
      <span>{badge.label}</span>
    </span>
  )
}

interface ChainIndicatorProps {
  chainId: number | string | null | undefined
  showChainName?: boolean
}

export function ChainIndicator({ chainId, showChainName = false }: ChainIndicatorProps) {
  const badge = getChainBadge(chainId)
  const mainnet = isMainnet(chainId)
  
  return (
    <div 
      className={`inline-flex items-center gap-1.5 text-sm ${badge.textClass}`}
      data-testid="chain-indicator"
    >
      <span>{badge.icon}</span>
      <span className="font-medium">
        {mainnet ? 'Live' : 'Testnet'}
        {showChainName && ` · ${badge.chainName}`}
      </span>
    </div>
  )
}
