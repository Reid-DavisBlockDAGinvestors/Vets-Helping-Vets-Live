'use client'

import { useState, useCallback } from 'react'
import { useCampaignBalances } from '../hooks/useCampaignBalances'
import { CampaignBalanceCard } from './CampaignBalanceCard'
import { TipSplitModal } from './TipSplitModal'
import { DistributionHistory } from './DistributionHistory'
import { supabase } from '@/lib/supabase'
import type { BalanceFilters, CampaignBalance } from '../types'

/**
 * FundDistributionPanel - Main orchestrator for fund distribution UI
 * Single responsibility: Orchestrate child components and manage filtering
 */
export function FundDistributionPanel() {
  const [filters, setFilters] = useState<BalanceFilters>({})
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [activeModal, setActiveModal] = useState<'funds' | 'gifts' | 'combined' | 'history' | 'giftSplit' | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [distributionResult, setDistributionResult] = useState<{ success: boolean; message: string } | null>(null)

  const { balances, isLoading, error, refresh } = useCampaignBalances(filters)

  // Calculate summary stats
  const testnetBalances = balances.filter(b => b.isTestnet)
  const mainnetBalances = balances.filter(b => !b.isTestnet)
  const totalPendingFunds = balances.reduce((sum, b) => sum + b.pendingDistributionNative, 0)
  const totalPendingGifts = balances.reduce((sum, b) => sum + b.pendingTipsNative, 0)

  // Handlers
  const handleDistributeFunds = useCallback((campaignId: string) => {
    setSelectedCampaign(campaignId)
    setActiveModal('funds')
  }, [])

  const handleDistributeGifts = useCallback((campaignId: string) => {
    setSelectedCampaign(campaignId)
    setActiveModal('gifts')
  }, [])

  const handleDistributeAll = useCallback((campaignId: string) => {
    setSelectedCampaign(campaignId)
    setActiveModal('combined')
  }, [])

  const handleViewHistory = useCallback((campaignId: string) => {
    setSelectedCampaign(campaignId)
    setActiveModal('history')
  }, [])

  const handleEditGiftSplit = useCallback((campaignId: string) => {
    setSelectedCampaign(campaignId)
    setActiveModal('giftSplit')
  }, [])

  const closeModal = useCallback(() => {
    setSelectedCampaign(null)
    setActiveModal(null)
    setDistributionResult(null)
  }, [])

  // Execute distribution API call
  const executeDistribution = useCallback(async (type: 'funds' | 'gifts' | 'combined') => {
    if (!selectedCampaign) return

    setIsExecuting(true)
    setDistributionResult(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const selectedBalance = balances.find(b => b.campaignId === selectedCampaign)
      
      if (type === 'combined') {
        // Execute both funds and gifts distribution sequentially
        const fundsAmount = selectedBalance?.pendingDistributionNative || 0
        const giftsAmount = selectedBalance?.pendingTipsNative || 0
        
        let fundsSuccess = true
        let giftsSuccess = true
        let fundsMessage = ''
        let giftsMessage = ''
        
        // Distribute funds first
        if (fundsAmount > 0) {
          const fundsResponse = await fetch('/api/admin/distributions/execute', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              type: 'funds',
              campaignId: selectedCampaign,
              amount: fundsAmount
            })
          })
          const fundsData = await fundsResponse.json()
          fundsSuccess = fundsResponse.ok
          fundsMessage = fundsData.message || fundsData.error || ''
        }
        
        // Then distribute gifts
        if (giftsAmount > 0) {
          const giftsResponse = await fetch('/api/admin/distributions/execute', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              type: 'tips', // API still uses 'tips' internally
              campaignId: selectedCampaign,
              tipSplit: { submitterPercent: selectedBalance?.tipSplitSubmitterPct || 100, nonprofitPercent: selectedBalance?.tipSplitNonprofitPct || 0 }
            })
          })
          const giftsData = await giftsResponse.json()
          giftsSuccess = giftsResponse.ok
          giftsMessage = giftsData.message || giftsData.error || ''
        }
        
        if (fundsSuccess && giftsSuccess) {
          setDistributionResult({ success: true, message: '✅ Both funds and gifts distributed successfully!' })
        } else {
          setDistributionResult({ 
            success: false, 
            message: `Funds: ${fundsSuccess ? '✅' : '❌ ' + fundsMessage} | Gifts: ${giftsSuccess ? '✅' : '❌ ' + giftsMessage}` 
          })
        }
      } else {
        // Single distribution (funds or gifts)
        const amount = type === 'funds' 
          ? selectedBalance?.pendingDistributionNative 
          : selectedBalance?.pendingTipsNative

        const response = await fetch('/api/admin/distributions/execute', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: type === 'gifts' ? 'tips' : type, // API still uses 'tips' internally
            campaignId: selectedCampaign,
            amount,
            tipSplit: type === 'gifts' ? { submitterPercent: selectedBalance?.tipSplitSubmitterPct || 100, nonprofitPercent: selectedBalance?.tipSplitNonprofitPct || 0 } : undefined
          })
        })

        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error || 'Distribution failed')
        }

        setDistributionResult({ success: true, message: data.message })
      }
      
      refresh() // Refresh balances after successful distribution
    } catch (err: any) {
      setDistributionResult({ success: false, message: err.message || 'Distribution failed' })
    } finally {
      setIsExecuting(false)
    }
  }, [selectedCampaign, balances, refresh])

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
          Has Pending Gifts
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
          <p className="text-xs text-white/50">Pending Gifts</p>
          <p className="text-xl font-bold text-purple-400">{totalPendingGifts.toFixed(4)}</p>
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
            onDistributeGifts={handleDistributeGifts}
            onDistributeAll={handleDistributeAll}
            onViewHistory={handleViewHistory}
            onEditGiftSplit={handleEditGiftSplit}
          />
        ))}
      </div>

      {/* Gift Split Modal */}
      {activeModal === 'giftSplit' && selectedCampaign && (
        <TipSplitModal
          isOpen={true}
          balance={balances.find(b => b.campaignId === selectedCampaign) as CampaignBalance}
          onClose={closeModal}
          onSaved={refresh}
        />
      )}

      {/* Distribution History Modal */}
      {activeModal === 'history' && selectedCampaign && (
        <DistributionHistory
          campaignId={selectedCampaign}
          campaignTitle={balances.find(b => b.campaignId === selectedCampaign)?.title || ''}
          isOpen={true}
          onClose={closeModal}
        />
      )}

      {/* Distribution execution modal */}
      {activeModal && ['funds', 'gifts', 'combined'].includes(activeModal) && selectedCampaign && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl max-w-lg w-full p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-4">
              {activeModal === 'funds' && '💸 Distribute Funds'}
              {activeModal === 'gifts' && '🎁 Distribute Gifts'}
              {activeModal === 'combined' && '🚀 Distribute All (Funds + Gifts)'}
            </h3>
            
            {/* Show campaign details */}
            {(() => {
              const campaign = balances.find(b => b.campaignId === selectedCampaign)
              if (!campaign) return <p className="text-white/60">Campaign not found</p>
              
              const fundsAmount = campaign.pendingDistributionNative
              const giftsAmount = campaign.pendingTipsNative
              const currency = campaign.nativeCurrency
              
              return (
                <div className="space-y-4">
                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-white/60 text-sm">Campaign</p>
                    <p className="text-white font-medium">{campaign.title}</p>
                  </div>
                  
                  {activeModal === 'combined' ? (
                    <>
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                        <p className="text-green-400 text-sm font-medium">💸 Funds to Distribute</p>
                        <p className="text-white font-medium text-lg">{fundsAmount.toFixed(4)} {currency}</p>
                      </div>
                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                        <p className="text-purple-400 text-sm font-medium">🎁 Gifts to Distribute</p>
                        <p className="text-white font-medium text-lg">{giftsAmount.toFixed(4)} {currency}</p>
                        <p className="text-white/50 text-xs mt-1">Split: {campaign.tipSplitSubmitterPct}% Submitter / {campaign.tipSplitNonprofitPct}% Nonprofit</p>
                      </div>
                      <div className="bg-gradient-to-r from-green-500/10 to-purple-500/10 border border-white/20 rounded-lg p-4">
                        <p className="text-white/70 text-sm font-medium">Total to Distribute</p>
                        <p className="text-white font-bold text-xl">{(fundsAmount + giftsAmount).toFixed(4)} {currency}</p>
                      </div>
                    </>
                  ) : (
                    <div className="bg-white/5 rounded-lg p-4">
                      <p className="text-white/60 text-sm">Amount to Distribute</p>
                      <p className="text-white font-medium text-lg">
                        {(activeModal === 'funds' ? fundsAmount : giftsAmount).toFixed(4)} {currency}
                      </p>
                      {activeModal === 'gifts' && (
                        <p className="text-white/50 text-xs mt-1">Split: {campaign.tipSplitSubmitterPct}% Submitter / {campaign.tipSplitNonprofitPct}% Nonprofit</p>
                      )}
                    </div>
                  )}
                  
                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-white/60 text-sm">Recipient (Submitter)</p>
                    <p className="text-white font-mono text-sm">{campaign.submitterWallet || 'Not set'}</p>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <p className="text-blue-400 text-sm">
                      🔗 <strong>On-Chain Distribution:</strong> This will call the contract's withdraw function 
                      to transfer funds directly from the contract to the submitter wallet. 
                      {activeModal === 'combined' && ' Two transactions will be submitted sequentially.'}
                    </p>
                  </div>
                </div>
              )
            })()}

            {/* Result message */}
            {distributionResult && (
              <div className={`mt-4 p-4 rounded-lg ${distributionResult.success ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                <p className={distributionResult.success ? 'text-green-400' : 'text-red-400'}>
                  {distributionResult.message}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                disabled={isExecuting}
              >
                {distributionResult?.success ? 'Done' : 'Cancel'}
              </button>
              {!distributionResult?.success && (
                <button
                  onClick={() => executeDistribution(activeModal as 'funds' | 'gifts' | 'combined')}
                  disabled={isExecuting}
                  className={`flex-1 px-4 py-2 rounded-lg text-white disabled:opacity-50 ${
                    activeModal === 'combined' 
                      ? 'bg-gradient-to-r from-green-600 to-purple-600 hover:from-green-500 hover:to-purple-500'
                      : 'bg-green-600 hover:bg-green-500'
                  }`}
                >
                  {isExecuting ? '⏳ Processing...' : activeModal === 'combined' ? '🚀 Distribute All' : '✅ Confirm Distribution'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FundDistributionPanel
