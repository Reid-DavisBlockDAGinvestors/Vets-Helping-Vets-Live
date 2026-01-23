'use client'

import { useState } from 'react'
import { TipSplitSlider } from './TipSplitSlider'
import { formatNativeAmount, formatCurrency } from '../utils/formatters'
import { validateDistributionAmount, validateMainnetDistribution, calculateTipSplitAmounts } from '../utils/validators'
import type { DistributionFormProps, TipSplit } from '../types'

/**
 * DistributionForm - Form for configuring fund/tip distribution
 * Single responsibility: Collect distribution parameters before confirmation
 */
export function DistributionForm({
  balance,
  type,
  onSubmit,
  onCancel,
  isSubmitting
}: DistributionFormProps) {
  const isGiftDistribution = type === 'gifts'
  const availableAmount = isGiftDistribution 
    ? balance.pendingTipsNative 
    : balance.pendingDistributionNative

  const [amount, setAmount] = useState(availableAmount)
  const [tipSplit, setTipSplit] = useState<TipSplit>({
    submitterPercent: balance.tipSplitSubmitterPct,
    nonprofitPercent: balance.tipSplitNonprofitPct
  })
  const [mainnetConfirmed, setMainnetConfirmed] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleAmountChange = (value: string) => {
    const parsed = parseFloat(value)
    if (!isNaN(parsed)) {
      setAmount(parsed)
      const validation = validateDistributionAmount(parsed, availableAmount)
      setValidationError(validation.valid ? null : validation.error || null)
    }
  }

  const handleSubmit = () => {
    // Validate amount
    const amountValidation = validateDistributionAmount(amount, availableAmount)
    if (!amountValidation.valid) {
      setValidationError(amountValidation.error || 'Invalid amount')
      return
    }

    // Validate mainnet confirmation
    const mainnetValidation = validateMainnetDistribution(balance, mainnetConfirmed)
    if (!mainnetValidation.valid) {
      setValidationError(mainnetValidation.error || 'Mainnet confirmation required')
      return
    }

    setValidationError(null)

    if (isGiftDistribution) {
      onSubmit({ campaignId: balance.campaignId, tipSplit })
    } else {
      onSubmit({
        campaignId: balance.campaignId,
        amount,
        recipient: 'submitter' // Default to submitter for funds
      })
    }
  }

  // Calculate split amounts for preview
  const splitAmounts = isGiftDistribution 
    ? calculateTipSplitAmounts(amount, tipSplit)
    : null

  return (
    <div className="space-y-4" data-testid="distribution-form">
      {/* Amount Section */}
      <div>
        <label className="block text-sm text-white/70 mb-2">
          {isGiftDistribution ? 'Tips to Distribute' : 'Funds to Distribute'}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.0001"
            min="0"
            max={availableAmount}
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-lg font-mono focus:border-blue-500 focus:outline-none disabled:opacity-50"
            data-testid="amount-input"
          />
          <span className="text-white/70 font-medium">{balance.nativeCurrency}</span>
        </div>
        <div className="flex justify-between mt-1 text-xs">
          <span className="text-white/50">
            Available: {formatNativeAmount(availableAmount, balance.nativeCurrency)}
          </span>
          <button
            onClick={() => setAmount(availableAmount)}
            className="text-blue-400 hover:text-blue-300"
            data-testid="max-btn"
          >
            Max
          </button>
        </div>
      </div>

      {/* Tip Split Section (only for tips) */}
      {isGiftDistribution && (
        <div className="bg-white/5 rounded-lg p-4">
          <h4 className="text-sm font-medium text-white mb-3">Tip Split Configuration</h4>
          <TipSplitSlider
            value={tipSplit}
            onChange={setTipSplit}
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* Distribution Preview */}
      <div className="bg-white/5 rounded-lg p-4 space-y-2">
        <h4 className="text-sm font-medium text-white mb-2">Distribution Preview</h4>
        
        {isGiftDistribution && splitAmounts ? (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-blue-400">→ Submitter ({tipSplit.submitterPercent}%):</span>
              <span className="text-white font-mono">
                {formatNativeAmount(splitAmounts.submitterAmount, balance.nativeCurrency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-purple-400">→ Nonprofit ({tipSplit.nonprofitPercent}%):</span>
              <span className="text-white font-mono">
                {formatNativeAmount(splitAmounts.nonprofitAmount, balance.nativeCurrency)}
              </span>
            </div>
          </>
        ) : (
          <div className="flex justify-between text-sm">
            <span className="text-green-400">→ Submitter (funds):</span>
            <span className="text-white font-mono">
              {formatNativeAmount(amount, balance.nativeCurrency)}
            </span>
          </div>
        )}

        <hr className="border-white/10 my-2" />
        
        <div className="flex justify-between text-sm">
          <span className="text-white/50">Total:</span>
          <span className="text-white font-medium">
            {formatNativeAmount(amount, balance.nativeCurrency)}
          </span>
        </div>
      </div>

      {/* Wallet Addresses */}
      <div className="text-xs text-white/50 space-y-1">
        <p>Submitter: {balance.submitterWallet || 'Not set ⚠️'}</p>
        {isGiftDistribution && tipSplit.nonprofitPercent > 0 && (
          <p>Nonprofit: {balance.nonprofitWallet || 'Not set ⚠️'}</p>
        )}
      </div>

      {/* Mainnet Warning */}
      {!balance.isTestnet && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={mainnetConfirmed}
              onChange={(e) => setMainnetConfirmed(e.target.checked)}
              className="mt-1 rounded border-red-500/50 bg-transparent"
              data-testid="mainnet-confirm-checkbox"
            />
            <span className="text-sm text-red-400">
              <strong>⚠️ MAINNET - REAL MONEY</strong>
              <br />
              I confirm this distribution involves real funds and the recipient addresses are correct.
            </span>
          </label>
        </div>
      )}

      {/* Validation Error */}
      {validationError && (
        <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-sm" data-testid="validation-error">
          {validationError}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50"
          data-testid="cancel-btn"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || amount <= 0 || (!balance.isTestnet && !mainnetConfirmed)}
          className="flex-1 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="review-distribution-btn"
        >
          {isSubmitting ? 'Processing...' : 'Review Distribution'}
        </button>
      </div>
    </div>
  )
}

export default DistributionForm
