'use client'

import { formatNativeAmount, shortenAddress } from '../utils/formatters'
import { calculateTipSplitAmounts } from '../utils/validators'
import type { DistributionConfirmModalProps, TipDistributionParams, DistributionParams } from '../types'

/**
 * DistributionConfirmModal - Final confirmation before executing distribution
 * Shows full details and requires explicit confirmation
 */
export function DistributionConfirmModal({
  isOpen,
  balance,
  params,
  onConfirm,
  onCancel,
  isProcessing
}: DistributionConfirmModalProps) {
  if (!isOpen) return null

  const isTipDistribution = 'tipSplit' in params
  const tipParams = params as TipDistributionParams
  const fundParams = params as DistributionParams

  const amount = isTipDistribution 
    ? balance.pendingTipsNative 
    : fundParams.amount

  const splitAmounts = isTipDistribution 
    ? calculateTipSplitAmounts(amount, tipParams.tipSplit)
    : null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="bg-slate-800 rounded-2xl max-w-lg w-full p-6 border border-white/10"
        data-testid="distribution-confirm-modal"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">
            {isTipDistribution ? '💜' : '💸'}
          </div>
          <h3 className="text-xl font-bold text-white">
            Confirm {isTipDistribution ? 'Tip' : 'Fund'} Distribution
          </h3>
          <p className="text-white/50 text-sm mt-1">{balance.title}</p>
        </div>

        {/* Network Badge */}
        <div className="flex justify-center mb-4">
          {balance.isTestnet ? (
            <span className="px-3 py-1.5 text-sm bg-yellow-500/20 text-yellow-400 rounded-full">
              🧪 TESTNET - {balance.chainName}
            </span>
          ) : (
            <span className="px-3 py-1.5 text-sm bg-red-500/20 text-red-400 rounded-full font-bold">
              ⚠️ MAINNET - REAL MONEY
            </span>
          )}
        </div>

        {/* Distribution Details */}
        <div className="bg-white/5 rounded-xl p-4 space-y-3 mb-4">
          <h4 className="text-sm font-medium text-white/70">Distribution Summary</h4>

          {isTipDistribution && splitAmounts ? (
            <>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <div>
                  <p className="text-blue-400 font-medium">Submitter ({tipParams.tipSplit.submitterPercent}%)</p>
                  <p className="text-xs text-white/40">{shortenAddress(balance.submitterWallet || '')}</p>
                </div>
                <p className="text-white font-mono text-lg">
                  {formatNativeAmount(splitAmounts.submitterAmount, balance.nativeCurrency)}
                </p>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <div>
                  <p className="text-purple-400 font-medium">Nonprofit ({tipParams.tipSplit.nonprofitPercent}%)</p>
                  <p className="text-xs text-white/40">{shortenAddress(balance.nonprofitWallet || '')}</p>
                </div>
                <p className="text-white font-mono text-lg">
                  {formatNativeAmount(splitAmounts.nonprofitAmount, balance.nativeCurrency)}
                </p>
              </div>
            </>
          ) : (
            <div className="flex justify-between items-center py-2 border-b border-white/10">
              <div>
                <p className="text-green-400 font-medium">Submitter</p>
                <p className="text-xs text-white/40">{shortenAddress(balance.submitterWallet || '')}</p>
              </div>
              <p className="text-white font-mono text-lg">
                {formatNativeAmount(amount, balance.nativeCurrency)}
              </p>
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <p className="text-white font-medium">Total</p>
            <p className="text-white font-mono text-xl font-bold">
              {formatNativeAmount(amount, balance.nativeCurrency)}
            </p>
          </div>
        </div>

        {/* Warning */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-6 text-sm text-amber-400">
          <p className="font-medium mb-1">⚠️ This action cannot be undone</p>
          <p className="text-amber-400/70">
            Funds will be sent to the blockchain addresses shown above. 
            Please verify all details are correct before confirming.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50"
            data-testid="cancel-confirm-btn"
          >
            Go Back
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 ${
              balance.isTestnet
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-red-600 hover:bg-red-500 text-white'
            }`}
            data-testid="confirm-distribution-btn"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                Processing...
              </span>
            ) : (
              `✅ Confirm Distribution`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DistributionConfirmModal
