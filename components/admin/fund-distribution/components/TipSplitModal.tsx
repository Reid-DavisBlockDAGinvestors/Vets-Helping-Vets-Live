'use client'

import { useState, useEffect } from 'react'
import { TipSplitSlider } from './TipSplitSlider'
import { useTipSplit } from '../hooks/useTipSplit'
import type { CampaignBalance, TipSplit } from '../types'

interface TipSplitModalProps {
  isOpen: boolean
  balance: CampaignBalance
  onClose: () => void
  onSaved: () => void
}

/**
 * TipSplitModal - Modal for editing per-campaign tip split configuration
 */
export function TipSplitModal({ isOpen, balance, onClose, onSaved }: TipSplitModalProps) {
  const { fetchTipSplit, saveTipSplit, isLoading, isSaving, error } = useTipSplit()
  const [split, setSplit] = useState<TipSplit>({
    submitterPercent: balance.tipSplitSubmitterPct,
    nonprofitPercent: balance.tipSplitNonprofitPct
  })

  useEffect(() => {
    if (isOpen) {
      fetchTipSplit(balance.campaignId)
      setSplit({
        submitterPercent: balance.tipSplitSubmitterPct,
        nonprofitPercent: balance.tipSplitNonprofitPct
      })
    }
  }, [isOpen, balance.campaignId, balance.tipSplitSubmitterPct, balance.tipSplitNonprofitPct, fetchTipSplit])

  const handleSave = async () => {
    const success = await saveTipSplit(balance.campaignId, split)
    if (success) {
      onSaved()
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="bg-slate-800 rounded-2xl max-w-md w-full p-6 border border-white/10"
        data-testid="tip-split-modal"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">⚙️ Edit Tip Split</h3>
            <p className="text-sm text-white/50 mt-1">{balance.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white p-1"
            data-testid="close-modal-btn"
          >
            ✕
          </button>
        </div>

        {/* Network Badge */}
        <div className="mb-4">
          {balance.isTestnet ? (
            <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded">
              🧪 TESTNET - {balance.chainName}
            </span>
          ) : (
            <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded">
              💰 MAINNET - {balance.chainName}
            </span>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-8 text-white/50">
            Loading configuration...
          </div>
        )}

        {/* Slider */}
        {!isLoading && (
          <div className="mb-6">
            <TipSplitSlider
              value={split}
              onChange={setSplit}
              disabled={isSaving}
            />
          </div>
        )}

        {/* Info */}
        <div className="bg-white/5 rounded-lg p-3 mb-4 text-xs text-white/60">
          <p className="mb-1">💡 This determines how tips are split when distributing:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><span className="text-blue-400">{split.submitterPercent}%</span> goes to the submitter (fundraiser)</li>
            <li><span className="text-purple-400">{split.nonprofitPercent}%</span> goes to the nonprofit</li>
          </ul>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            data-testid="cancel-btn"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
            data-testid="save-tip-split-btn"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default TipSplitModal
