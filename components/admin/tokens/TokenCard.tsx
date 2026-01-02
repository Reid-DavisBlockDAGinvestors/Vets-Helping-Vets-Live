'use client'

import { useState } from 'react'
import type { TokenInfo } from './types'

interface TokenCardProps {
  token: TokenInfo
  onFreeze: (tokenId: number) => Promise<boolean>
  onUnfreeze: (tokenId: number) => Promise<boolean>
  onMakeSoulbound: (tokenId: number) => Promise<boolean>
  onRemoveSoulbound: (tokenId: number) => Promise<boolean>
  onBurn: (tokenId: number) => Promise<boolean>
  onFixUri: (tokenId: number, newUri: string) => Promise<boolean>
  isSelected: boolean
  onSelect: (tokenId: number, selected: boolean) => void
}

const CHAIN_INFO: Record<number, { name: string; color: string; icon: string }> = {
  1043: { name: 'BlockDAG', color: 'bg-blue-500/20 text-blue-400', icon: '🔷' },
  1: { name: 'Ethereum', color: 'bg-purple-500/20 text-purple-400', icon: '⟠' },
  11155111: { name: 'Sepolia', color: 'bg-yellow-500/20 text-yellow-400', icon: '🧪' },
  137: { name: 'Polygon', color: 'bg-violet-500/20 text-violet-400', icon: '🟣' },
  8453: { name: 'Base', color: 'bg-blue-500/20 text-blue-400', icon: '🔵' },
}

export function TokenCard({
  token,
  onFreeze,
  onUnfreeze,
  onMakeSoulbound,
  onRemoveSoulbound,
  onBurn,
  onFixUri,
  isSelected,
  onSelect
}: TokenCardProps) {
  const [isActing, setIsActing] = useState(false)
  const [showFixUri, setShowFixUri] = useState(false)
  const [newUri, setNewUri] = useState('')
  const [confirmBurn, setConfirmBurn] = useState(false)

  const chainInfo = CHAIN_INFO[token.chainId] || CHAIN_INFO[1043]

  const handleAction = async (action: () => Promise<boolean>) => {
    setIsActing(true)
    try {
      await action()
    } finally {
      setIsActing(false)
    }
  }

  const handleFixUri = async () => {
    if (!newUri.trim()) return
    setIsActing(true)
    try {
      await onFixUri(token.tokenId, newUri.trim())
      setShowFixUri(false)
      setNewUri('')
    } finally {
      setIsActing(false)
    }
  }

  const handleBurn = async () => {
    setIsActing(true)
    try {
      await onBurn(token.tokenId)
      setConfirmBurn(false)
    } finally {
      setIsActing(false)
    }
  }

  return (
    <div 
      className={`rounded-xl border p-4 transition-all ${
        isSelected 
          ? 'bg-blue-500/10 border-blue-500/50' 
          : 'bg-white/5 border-white/10 hover:border-white/20'
      }`}
      data-testid={`token-card-${token.tokenId}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(token.tokenId, e.target.checked)}
          className="mt-1 w-4 h-4 rounded border-white/30 bg-white/5"
          data-testid={`token-select-${token.tokenId}`}
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-white font-semibold">
              Token #{token.tokenId}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${chainInfo.color}`}>
              {chainInfo.icon} {chainInfo.name}
            </span>
            {token.isFrozen && (
              <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
                ❄️ Frozen
              </span>
            )}
            {token.isSoulbound && (
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs">
                🔗 Soulbound
              </span>
            )}
          </div>
          
          <div className="mt-1 text-sm text-white/70">
            <span className="font-medium">{token.campaignTitle}</span>
            <span className="mx-2">•</span>
            <span>Edition #{token.editionNumber}</span>
          </div>
          
          <div className="mt-1 text-xs text-white/50 font-mono truncate">
            Owner: {token.owner}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {/* Freeze/Unfreeze */}
        {token.isFrozen ? (
          <button
            onClick={() => handleAction(() => onUnfreeze(token.tokenId))}
            disabled={isActing}
            className="px-3 py-1.5 text-xs rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50"
            data-testid={`unfreeze-btn-${token.tokenId}`}
          >
            {isActing ? '⏳' : '🔓'} Unfreeze
          </button>
        ) : (
          <button
            onClick={() => handleAction(() => onFreeze(token.tokenId))}
            disabled={isActing}
            className="px-3 py-1.5 text-xs rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50"
            data-testid={`freeze-btn-${token.tokenId}`}
          >
            {isActing ? '⏳' : '❄️'} Freeze
          </button>
        )}

        {/* Soulbound */}
        {token.isSoulbound ? (
          <button
            onClick={() => handleAction(() => onRemoveSoulbound(token.tokenId))}
            disabled={isActing}
            className="px-3 py-1.5 text-xs rounded-lg bg-white/10 text-white/70 hover:bg-white/20 disabled:opacity-50"
            data-testid={`remove-soulbound-btn-${token.tokenId}`}
          >
            {isActing ? '⏳' : '🔗'} Remove Soulbound
          </button>
        ) : (
          <button
            onClick={() => handleAction(() => onMakeSoulbound(token.tokenId))}
            disabled={isActing}
            className="px-3 py-1.5 text-xs rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-50"
            data-testid={`soulbound-btn-${token.tokenId}`}
          >
            {isActing ? '⏳' : '🔗'} Make Soulbound
          </button>
        )}

        {/* Fix URI */}
        <button
          onClick={() => setShowFixUri(!showFixUri)}
          className="px-3 py-1.5 text-xs rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
          data-testid={`fix-uri-btn-${token.tokenId}`}
        >
          🔧 Fix URI
        </button>

        {/* Burn */}
        <button
          onClick={() => setConfirmBurn(true)}
          disabled={isActing}
          className="px-3 py-1.5 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
          data-testid={`burn-btn-${token.tokenId}`}
        >
          🔥 Burn
        </button>
      </div>

      {/* Fix URI Input */}
      {showFixUri && (
        <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10">
          <label className="block text-xs text-white/70 mb-1">New Token URI</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newUri}
              onChange={(e) => setNewUri(e.target.value)}
              placeholder="ipfs://... or https://..."
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white"
              data-testid={`new-uri-input-${token.tokenId}`}
            />
            <button
              onClick={handleFixUri}
              disabled={isActing || !newUri.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-yellow-500 text-black font-medium hover:bg-yellow-400 disabled:opacity-50"
            >
              {isActing ? '⏳' : 'Save'}
            </button>
          </div>
          <p className="mt-1 text-xs text-white/50">
            Current: {token.tokenURI?.slice(0, 50)}...
          </p>
        </div>
      )}

      {/* Burn Confirmation */}
      {confirmBurn && (
        <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-sm text-red-400 mb-2">
            ⚠️ <strong>Warning:</strong> Burning is permanent and cannot be undone!
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleBurn}
              disabled={isActing}
              className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white font-medium hover:bg-red-400 disabled:opacity-50"
              data-testid={`confirm-burn-btn-${token.tokenId}`}
            >
              {isActing ? '⏳ Burning...' : '🔥 Confirm Burn'}
            </button>
            <button
              onClick={() => setConfirmBurn(false)}
              className="px-4 py-2 text-sm rounded-lg bg-white/10 text-white hover:bg-white/20"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
