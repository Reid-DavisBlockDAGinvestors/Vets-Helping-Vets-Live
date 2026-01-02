'use client'

import { useState, useCallback } from 'react'
import { useTokens } from './hooks/useTokens'
import { TokenCard } from './TokenCard'
import type { TokenFilters } from './types'

const CHAIN_OPTIONS = [
  { value: '', label: 'All Networks' },
  { value: '1043', label: 'BlockDAG (1043)' },
  { value: '11155111', label: 'Sepolia (11155111)' },
  { value: '1', label: 'Ethereum (1)' },
]

export function TokenManagementPanel() {
  const [filters, setFilters] = useState<TokenFilters>({})
  const [selectedTokens, setSelectedTokens] = useState<Set<number>>(new Set())
  const [isBatchActing, setIsBatchActing] = useState(false)

  const {
    tokens,
    isLoading,
    error,
    refresh,
    freezeToken,
    unfreezeToken,
    batchFreeze,
    makeSoulbound,
    removeSoulbound,
    burnToken,
    fixTokenUri
  } = useTokens(filters)

  const handleSelectToken = useCallback((tokenId: number, selected: boolean) => {
    setSelectedTokens(prev => {
      const next = new Set(prev)
      if (selected) {
        next.add(tokenId)
      } else {
        next.delete(tokenId)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedTokens(new Set(tokens.map(t => t.tokenId)))
    } else {
      setSelectedTokens(new Set())
    }
  }, [tokens])

  const handleBatchFreeze = useCallback(async (freeze: boolean) => {
    if (selectedTokens.size === 0) return
    setIsBatchActing(true)
    try {
      await batchFreeze(Array.from(selectedTokens), freeze)
      setSelectedTokens(new Set())
    } finally {
      setIsBatchActing(false)
    }
  }, [selectedTokens, batchFreeze])

  const frozenCount = tokens.filter(t => t.isFrozen).length
  const soulboundCount = tokens.filter(t => t.isSoulbound).length

  return (
    <div className="space-y-6" data-testid="token-management-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">🎫 Token Management</h2>
          <p className="text-sm text-white/50 mt-1">
            Manage NFT tokens: freeze, soulbound, burn, fix metadata
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50"
          data-testid="refresh-tokens-btn"
        >
          {isLoading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="text-2xl font-bold text-white">{tokens.length}</div>
          <div className="text-sm text-white/50">Total Tokens</div>
        </div>
        <div className="rounded-xl bg-blue-500/10 border border-blue-500/30 p-4">
          <div className="text-2xl font-bold text-blue-400">{frozenCount}</div>
          <div className="text-sm text-white/50">Frozen</div>
        </div>
        <div className="rounded-xl bg-purple-500/10 border border-purple-500/30 p-4">
          <div className="text-2xl font-bold text-purple-400">{soulboundCount}</div>
          <div className="text-sm text-white/50">Soulbound</div>
        </div>
        <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-4">
          <div className="text-2xl font-bold text-green-400">{selectedTokens.size}</div>
          <div className="text-sm text-white/50">Selected</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filters.chainId?.toString() || ''}
          onChange={(e) => setFilters(f => ({ 
            ...f, 
            chainId: e.target.value ? parseInt(e.target.value) : undefined 
          }))}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          data-testid="chain-filter"
        >
          {CHAIN_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-slate-800">
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={filters.frozen === undefined ? '' : filters.frozen.toString()}
          onChange={(e) => setFilters(f => ({ 
            ...f, 
            frozen: e.target.value === '' ? undefined : e.target.value === 'true' 
          }))}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          data-testid="frozen-filter"
        >
          <option value="" className="bg-slate-800">All Status</option>
          <option value="true" className="bg-slate-800">Frozen Only</option>
          <option value="false" className="bg-slate-800">Not Frozen</option>
        </select>

        <select
          value={filters.soulbound === undefined ? '' : filters.soulbound.toString()}
          onChange={(e) => setFilters(f => ({ 
            ...f, 
            soulbound: e.target.value === '' ? undefined : e.target.value === 'true' 
          }))}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          data-testid="soulbound-filter"
        >
          <option value="" className="bg-slate-800">All Types</option>
          <option value="true" className="bg-slate-800">Soulbound Only</option>
          <option value="false" className="bg-slate-800">Transferable</option>
        </select>

        <input
          type="text"
          placeholder="Filter by owner address..."
          value={filters.owner || ''}
          onChange={(e) => setFilters(f => ({ ...f, owner: e.target.value || undefined }))}
          className="flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono"
          data-testid="owner-filter"
        />
      </div>

      {/* Batch Actions */}
      {selectedTokens.size > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
          <span className="text-sm text-white">
            <strong>{selectedTokens.size}</strong> token{selectedTokens.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={() => handleBatchFreeze(true)}
            disabled={isBatchActing}
            className="px-3 py-1.5 text-sm rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50"
            data-testid="batch-freeze-btn"
          >
            {isBatchActing ? '⏳' : '❄️'} Freeze All
          </button>
          <button
            onClick={() => handleBatchFreeze(false)}
            disabled={isBatchActing}
            className="px-3 py-1.5 text-sm rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50"
            data-testid="batch-unfreeze-btn"
          >
            {isBatchActing ? '⏳' : '🔓'} Unfreeze All
          </button>
          <button
            onClick={() => setSelectedTokens(new Set())}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/10 text-white/70 hover:bg-white/20"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
          ⚠️ {error}
        </div>
      )}

      {/* Token List */}
      {isLoading ? (
        <div className="text-center py-12 text-white/50">
          ⏳ Loading tokens...
        </div>
      ) : tokens.length === 0 ? (
        <div className="text-center py-12 text-white/50">
          No tokens found matching your filters
        </div>
      ) : (
        <div className="space-y-4">
          {/* Select All */}
          <div className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={selectedTokens.size === tokens.length && tokens.length > 0}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="w-4 h-4 rounded border-white/30 bg-white/5"
              data-testid="select-all-tokens"
            />
            <span>Select all {tokens.length} tokens</span>
          </div>

          {/* Token Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {tokens.map(token => (
              <TokenCard
                key={token.tokenId}
                token={token}
                onFreeze={freezeToken}
                onUnfreeze={unfreezeToken}
                onMakeSoulbound={makeSoulbound}
                onRemoveSoulbound={removeSoulbound}
                onBurn={burnToken}
                onFixUri={fixTokenUri}
                isSelected={selectedTokens.has(token.tokenId)}
                onSelect={handleSelectToken}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
