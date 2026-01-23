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
  onDistributeGifts,
  onDistributeAll,
  onViewHistory,
  onEditGiftSplit
}: CampaignBalanceCardProps) {
  const hasPendingFunds = balance.pendingDistributionNative > 0
  const hasPendingGifts = balance.pendingTipsNative > 0
  const hasBothPending = hasPendingFunds && hasPendingGifts

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
          <div className="flex items-center gap-2 mt-1 flex-wrap">
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
            {balance.immediatePayoutEnabled ? (
              <span className="px-1.5 py-0.5 text-xs bg-cyan-500/20 text-cyan-400 rounded border border-cyan-500/30" data-testid="auto-distributed-badge">
                ⚡ AUTO-DISTRIBUTED
              </span>
            ) : (
              <span className="px-1.5 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded border border-orange-500/30" data-testid="manual-distribution-badge">
                🔒 HELD FOR DISTRIBUTION
              </span>
            )}
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
          <span className="text-white/60">Gifts Received:</span>
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
          <span className="text-white/60">
            {balance.immediatePayoutEnabled ? 'Auto-Distributed:' : 'Pending Funds:'}
          </span>
          {balance.immediatePayoutEnabled ? (
            <span className="text-cyan-400 font-medium" data-testid="auto-distributed-amount">
              ✅ {formatNativeAmount(balance.grossRaisedNative, balance.nativeCurrency)}
            </span>
          ) : (
            <span className={hasPendingFunds ? 'text-amber-400 font-medium' : 'text-white/40'} data-testid="pending-funds">
              {formatNativeAmount(balance.pendingDistributionNative, balance.nativeCurrency)}
            </span>
          )}
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-white/60">Pending Gifts:</span>
          <span className={hasPendingGifts ? 'text-purple-400 font-medium' : 'text-white/40'} data-testid="pending-gifts">
            {formatNativeAmount(balance.pendingTipsNative, balance.nativeCurrency)}
          </span>
        </div>
      </div>

      {/* Gift Split */}
      <div className="mb-4 p-2 bg-white/5 rounded-lg">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/50">Gift Split:</span>
          <button
            onClick={() => onEditGiftSplit(balance.campaignId)}
            className="text-blue-400 hover:text-blue-300"
            data-testid="edit-gift-split-btn"
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
        {balance.immediatePayoutEnabled && !balance.isTestnet && (
          <p className="mt-1 text-cyan-400/70">
            💡 View internal txs on Etherscan to see auto-distributions
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {balance.immediatePayoutEnabled ? (
          <button
            disabled={true}
            className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-600/30 text-cyan-300 cursor-not-allowed"
            data-testid="distribute-funds-btn"
            title="Funds auto-distributed to submitter on purchase"
          >
            ⚡ Auto-Distributed
          </button>
        ) : (
          <button
            onClick={() => onDistributeFunds(balance.campaignId)}
            disabled={!hasPendingFunds}
            className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-white/10 disabled:text-white/30 text-white transition-colors"
            data-testid="distribute-funds-btn"
          >
            💸 Distribute Funds
          </button>
        )}
        <button
          onClick={() => onDistributeGifts(balance.campaignId)}
          disabled={!hasPendingGifts}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-white/10 disabled:text-white/30 text-white transition-colors"
          data-testid="distribute-gifts-btn"
        >
          🎁 Distribute Gifts
        </button>
        {/* Distribute All button - only show when both funds and gifts are pending */}
        {!balance.immediatePayoutEnabled && hasBothPending && (
          <button
            onClick={() => onDistributeAll(balance.campaignId)}
            className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-green-600 to-purple-600 hover:from-green-500 hover:to-purple-500 text-white transition-colors"
            data-testid="distribute-all-btn"
          >
            🚀 Distribute All
          </button>
        )}
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
