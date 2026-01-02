'use client'

import { useState, useCallback } from 'react'
import { useCampaignBalances } from '../hooks/useCampaignBalances'
import { CampaignBalanceCard } from './CampaignBalanceCard'
import { TipSplitModal } from './TipSplitModal'
import type { BalanceFilters, CampaignBalance } from '../types'

/**
 * FundDistributionPanel - Main orchestrator for fund distribution UI
 * Single responsibility: Orchestrate child components and manage filtering
 */
export function FundDistributionPanel() {
  const [filters, setFilters] = useState<BalanceFilters>({})
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [activeModal, setActiveModal] = useState<'funds' | 'tips' | 'history' | 'tipSplit' | null>(null)

  const { balances, isLoading, error, refresh } = useCampaignBalances(filters)

  // Calculate summary stats
  const testnetBalances = balances.filter(b => b.isTestnet)
  const mainnetBalances = balances.filter(b => !b.isTestnet)
  const totalPendingFunds = balances.reduce((sum, b) => sum + b.pendingDistributionNative, 0)
  const totalPendingTips = balances.reduce((sum, b) => sum + b.pendingTipsNative, 0)

  // Handlers
  const handleDistributeFunds = useCallback((campaignId: string) => {
    setSelectedCampaign(campaignId)
    setActiveModal('funds')
  }, [])

  const handleDistributeTips = useCallback((campaignId: string) => {
    setSelectedCampaign(campaignId)
    setActiveModal('tips')
  }, [])

  const handleViewHistory = useCallback((campaignId: string) => {
    setSelectedCampaign(campaignId)
    setActiveModal('history')
  }, [])

  const handleEditTipSplit = useCallback((campaignId: string) => {
    setSelectedCampaign(campaignId)
    setActiveModal('tipSplit')
  }, [])

  const closeModal = useCallback(() => {
    setSelectedCampaign(null)
    setActiveModal(null)
  }, [])

  return (
    <div className="space-y-6" data-testid="fund-distribution-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">💰 Fund Distribution</h2>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50"
          data-testid="refresh-btn"
        >
          {isLoading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.chainId || 'all'}
          onChange={(e) => setFilters(f => ({ 
            ...f, 
            chainId: e.target.value === 'all' ? undefined : parseInt(e.target.value) 
          }))}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          data-testid="network-filter"
        >
          <option value="all" className="bg-slate-800">All Networks</option>
          <option value="1043" className="bg-slate-800">BlockDAG (1043)</option>
          <option value="11155111" className="bg-slate-800">Sepolia (11155111)</option>
          <option value="1" className="bg-slate-800">Ethereum (1)</option>
        </select>

        <select
          value={filters.isTestnet === undefined ? 'all' : filters.isTestnet.toString()}
          onChange={(e) => setFilters(f => ({ 
            ...f, 
            isTestnet: e.target.value === 'all' ? undefined : e.target.value === 'true' 
          }))}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          data-testid="testnet-filter"
        >
          <option value="all" className="bg-slate-800">All (Testnet & Mainnet)</option>
          <option value="true" className="bg-slate-800">🧪 Testnet Only</option>
          <option value="false" className="bg-slate-800">💰 Mainnet Only</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={filters.hasPendingFunds || false}
            onChange={(e) => setFilters(f => ({ ...f, hasPendingFunds: e.target.checked || undefined }))}
            className="rounded border-white/20 bg-white/5"
          />
          Has Pending Funds
        </label>

        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={filters.hasPendingTips || false}
            onChange={(e) => setFilters(f => ({ ...f, hasPendingTips: e.target.checked || undefined }))}
            className="rounded border-white/20 bg-white/5"
          />
          Has Pending Tips
        </label>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-4 border border-white/10">
          <p className="text-xs text-white/50">Total Campaigns</p>
          <p className="text-2xl font-bold text-white">{balances.length}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4 border border-white/10">
          <p className="text-xs text-white/50">Pending Funds</p>
          <p className="text-xl font-bold text-amber-400">{totalPendingFunds.toFixed(4)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4 border border-white/10">
          <p className="text-xs text-white/50">Pending Tips</p>
          <p className="text-xl font-bold text-purple-400">{totalPendingTips.toFixed(4)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4 border border-white/10">
          <p className="text-xs text-white/50">Testnet / Mainnet</p>
          <p className="text-xl font-bold text-white">
            <span className="text-yellow-400">{testnetBalances.length}</span>
            {' / '}
            <span className="text-green-400">{mainnetBalances.length}</span>
          </p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && balances.length === 0 && (
        <div className="text-center py-12 text-white/50">
          Loading campaign balances...
        </div>
      )}

      {/* Empty State */}
      {!isLoading && balances.length === 0 && (
        <div className="text-center py-12 text-white/50">
          No campaigns with minted status found.
        </div>
      )}

      {/* Campaign Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="campaign-balance-list">
        {balances.map(balance => (
          <CampaignBalanceCard
            key={balance.campaignId}
            balance={balance}
            onDistributeFunds={handleDistributeFunds}
            onDistributeTips={handleDistributeTips}
            onViewHistory={handleViewHistory}
            onEditTipSplit={handleEditTipSplit}
          />
        ))}
      </div>

      {/* Tip Split Modal */}
      {activeModal === 'tipSplit' && selectedCampaign && (
        <TipSplitModal
          isOpen={true}
          balance={balances.find(b => b.campaignId === selectedCampaign) as CampaignBalance}
          onClose={closeModal}
          onSaved={refresh}
        />
      )}

      {/* Placeholder modals for distribution and history (Phase 3-4) */}
      {activeModal && activeModal !== 'tipSplit' && selectedCampaign && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl max-w-lg w-full p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-4">
              {activeModal === 'funds' && '💸 Distribute Funds'}
              {activeModal === 'tips' && '💜 Distribute Tips'}
              {activeModal === 'history' && '📜 Distribution History'}
            </h3>
            <p className="text-white/60 mb-4">
              This feature will be implemented in Phase {activeModal === 'history' ? '4' : '3'}.
            </p>
            <button
              onClick={closeModal}
              className="w-full px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default FundDistributionPanel
