'use client'

import type { CampaignBalanceCardProps } from '../types'
import { formatCurrency, formatNativeAmount, shortenAddress } from '../utils/formatters'

/**
 * CampaignBalanceCard - Displays a single campaign's fund status
 * Single responsibility: Display balance info and action buttons
 */
export function CampaignBalanceCard({
  balance,
  onDistributeFunds,
  onDistributeTips,
  onViewHistory,
  onEditTipSplit
}: CampaignBalanceCardProps) {
  const hasPendingFunds = balance.pendingDistributionNative > 0
  const hasPendingTips = balance.pendingTipsNative > 0

  return (
    <div 
      className="bg-slate-800 rounded-xl border border-white/10 p-4"
      data-testid={`campaign-balance-card-${balance.campaignId}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate" data-testid="campaign-title">
            {balance.title}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-white/50">{balance.chainName}</span>
            {balance.isTestnet ? (
              <span className="px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded" data-testid="testnet-badge">
                🧪 TESTNET
              </span>
            ) : (
              <span className="px-1.5 py-0.5 text-xs bg-green-500/20 text-green-400 rounded" data-testid="mainnet-badge">
                💰 MAINNET
              </span>
            )}
            <span className="text-xs text-white/40">{balance.contractVersion}</span>
          </div>
        </div>
      </div>

      {/* Balance Details */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-white/60">Gross Raised:</span>
          <span className="text-white">
            {formatNativeAmount(balance.grossRaisedNative, balance.nativeCurrency)}
            <span className="text-white/40 ml-1">({formatCurrency(balance.grossRaisedUsd)})</span>
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-white/60">Tips Received:</span>
          <span className="text-white">
            {formatNativeAmount(balance.tipsReceivedNative, balance.nativeCurrency)}
            <span className="text-white/40 ml-1">({formatCurrency(balance.tipsReceivedUsd)})</span>
          </span>
        </div>

        <hr className="border-white/10" />

        <div className="flex justify-between text-sm">
          <span className="text-white/60">Distributed:</span>
          <span className="text-green-400">
            {formatNativeAmount(balance.totalDistributed, balance.nativeCurrency)}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-white/60">Pending Funds:</span>
          <span className={hasPendingFunds ? 'text-amber-400 font-medium' : 'text-white/40'} data-testid="pending-funds">
            {formatNativeAmount(balance.pendingDistributionNative, balance.nativeCurrency)}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-white/60">Pending Tips:</span>
          <span className={hasPendingTips ? 'text-purple-400 font-medium' : 'text-white/40'} data-testid="pending-tips">
            {formatNativeAmount(balance.pendingTipsNative, balance.nativeCurrency)}
          </span>
        </div>
      </div>

      {/* Tip Split */}
      <div className="mb-4 p-2 bg-white/5 rounded-lg">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/50">Tip Split:</span>
          <button
            onClick={() => onEditTipSplit(balance.campaignId)}
            className="text-blue-400 hover:text-blue-300"
            data-testid="edit-tip-split-btn"
          >
            Edit
          </button>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500" 
              style={{ width: `${balance.tipSplitSubmitterPct}%` }}
            />
          </div>
          <span className="text-xs text-white/70" data-testid="submitter-percent">
            {balance.tipSplitSubmitterPct}% Sub
          </span>
          <span className="text-xs text-white/40">/</span>
          <span className="text-xs text-white/70" data-testid="nonprofit-percent">
            {balance.tipSplitNonprofitPct}% NP
          </span>
        </div>
      </div>

      {/* Wallet Info */}
      <div className="text-xs text-white/40 mb-4">
        <p>Submitter: {balance.submitterWallet ? shortenAddress(balance.submitterWallet) : 'Not set'}</p>
        {balance.distributionCount > 0 && (
          <p className="mt-1">{balance.distributionCount} distribution(s)</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onDistributeFunds(balance.campaignId)}
          disabled={!hasPendingFunds}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-white/10 disabled:text-white/30 text-white transition-colors"
          data-testid="distribute-funds-btn"
        >
          💸 Distribute Funds
        </button>
        <button
          onClick={() => onDistributeTips(balance.campaignId)}
          disabled={!hasPendingTips}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-white/10 disabled:text-white/30 text-white transition-colors"
          data-testid="distribute-tips-btn"
        >
          💜 Distribute Tips
        </button>
        <button
          onClick={() => onViewHistory(balance.campaignId)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          data-testid="view-history-btn"
        >
          📜 History
        </button>
      </div>
    </div>
  )
}

export default CampaignBalanceCard
