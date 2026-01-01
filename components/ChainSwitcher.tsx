/**
 * ChainSwitcher Component
 * 
 * Multi-chain network selector with:
 * - Current chain display
 * - Chain switching dropdown
 * - Gas price indicator
 * - Testnet warning badge
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, AlertTriangle, Fuel, Check, Loader2 } from 'lucide-react'
import { useEthereumChain } from '@/hooks/useEthereumChain'
import { ChainId, ChainConfig } from '@/lib/chains'

// ============ Types ============

interface ChainSwitcherProps {
  className?: string
  showGasPrice?: boolean
  compact?: boolean
}

// ============ Chain Icons ============

const ChainIcon = ({ chainId, size = 20 }: { chainId: ChainId; size?: number }) => {
  const iconMap: Record<ChainId, string> = {
    1043: '🔷', // BlockDAG
    1: '⟠',     // Ethereum
    11155111: '🧪', // Sepolia
    137: '🟣',  // Polygon
    8453: '🔵', // Base
  }
  
  return (
    <span style={{ fontSize: size }} data-testid={`chain-icon-${chainId}`}>
      {iconMap[chainId] || '🔗'}
    </span>
  )
}

// ============ Gas Badge ============

const GasBadge = ({ price, isHigh }: { price: number | null; isHigh: boolean }) => {
  if (price === null) return null
  
  return (
    <div 
      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
        isHigh 
          ? 'bg-red-500/20 text-red-400' 
          : 'bg-green-500/20 text-green-400'
      }`}
      data-testid="gas-badge"
    >
      <Fuel size={12} />
      <span>{price.toFixed(0)} gwei</span>
    </div>
  )
}

// ============ Chain Option ============

const ChainOption = ({ 
  chain, 
  isSelected, 
  onSelect,
  disabled 
}: { 
  chain: ChainConfig
  isSelected: boolean
  onSelect: () => void
  disabled?: boolean
}) => (
  <button
    onClick={onSelect}
    disabled={disabled}
    className={`
      w-full flex items-center gap-3 px-3 py-2 text-left
      hover:bg-white/10 transition-colors
      ${isSelected ? 'bg-white/5' : ''}
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    `}
    data-testid={`chain-option-${chain.chainId}`}
  >
    <ChainIcon chainId={chain.chainId} />
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <span className="font-medium">{chain.name}</span>
        {chain.isTestnet && (
          <span className="px-1.5 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded">
            Testnet
          </span>
        )}
      </div>
      <span className="text-xs text-gray-400">{chain.nativeCurrency.symbol}</span>
    </div>
    {isSelected && <Check size={16} className="text-green-400" />}
  </button>
)

// ============ Main Component ============

export function ChainSwitcher({ 
  className = '', 
  showGasPrice = true,
  compact = false 
}: ChainSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const {
    wallet,
    currentChain,
    supportedChains,
    isTestnet,
    gasPrice,
    isGasHigh,
    isSwitching,
    switchToChain,
  } = useEthereumChain()
  
  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // Handle chain switch
  const handleChainSelect = async (chainId: ChainId) => {
    if (chainId === wallet.chainId) {
      setIsOpen(false)
      return
    }
    
    const success = await switchToChain(chainId)
    if (success) {
      setIsOpen(false)
    }
  }
  
  // Not connected state
  if (!wallet.connected) {
    return null
  }
  
  // Unknown chain state
  if (!currentChain) {
    return (
      <div 
        className={`flex items-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 rounded-lg ${className}`}
        data-testid="chain-switcher-unknown"
      >
        <AlertTriangle size={16} />
        <span className="text-sm">Unsupported Network</span>
      </div>
    )
  }
  
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className={`
          flex items-center gap-2 px-3 py-2 
          bg-white/5 hover:bg-white/10 
          border border-white/10 rounded-lg
          transition-colors
          ${isSwitching ? 'opacity-50' : ''}
        `}
        data-testid="chain-switcher-trigger"
      >
        {isSwitching ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <ChainIcon chainId={currentChain.chainId} />
        )}
        
        {!compact && (
          <>
            <span className="font-medium">{currentChain.shortName}</span>
            {isTestnet && (
              <span className="px-1.5 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded">
                Test
              </span>
            )}
          </>
        )}
        
        {showGasPrice && !compact && (
          <GasBadge price={gasPrice} isHigh={isGasHigh} />
        )}
        
        <ChevronDown 
          size={16} 
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
      
      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute right-0 top-full mt-2 w-64 bg-gray-900 border border-white/10 rounded-lg shadow-xl overflow-hidden z-50"
          data-testid="chain-switcher-dropdown"
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-white/10">
            <span className="text-xs text-gray-400 uppercase tracking-wider">
              Select Network
            </span>
          </div>
          
          {/* Chain List */}
          <div className="py-1">
            {supportedChains.map((chain) => (
              <ChainOption
                key={chain.chainId}
                chain={chain}
                isSelected={chain.chainId === wallet.chainId}
                onSelect={() => handleChainSelect(chain.chainId)}
                disabled={isSwitching}
              />
            ))}
          </div>
          
          {/* Gas Info Footer */}
          {showGasPrice && gasPrice !== null && (
            <div className="px-3 py-2 border-t border-white/10 bg-white/5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Current Gas</span>
                <GasBadge price={gasPrice} isHigh={isGasHigh} />
              </div>
              {isGasHigh && (
                <p className="text-xs text-yellow-400 mt-1">
                  <AlertTriangle size={12} className="inline mr-1" />
                  Gas prices are elevated. Consider waiting.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ChainSwitcher
