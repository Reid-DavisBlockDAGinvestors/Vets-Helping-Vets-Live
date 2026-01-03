'use client'

import { useState } from 'react'
import { useContractSettings } from './hooks/useContractSettings'
import { SECURITY_THRESHOLDS, type SettingsTab } from './types'

const CHAIN_OPTIONS = [
  { value: '1043', label: 'BlockDAG (1043)', version: 'v6' },
  { value: '11155111', label: 'Sepolia (11155111)', version: 'v8' },
  { value: '1', label: 'Ethereum (1)', version: 'v8' },
]

export function ContractSettingsPanel() {
  const [selectedChain, setSelectedChain] = useState(CHAIN_OPTIONS[0])
  const [activeTab, setActiveTab] = useState<SettingsTab>('fees')
  
  // Fee change form
  const [newFeeBps, setNewFeeBps] = useState('')
  const [feeReason, setFeeReason] = useState('')
  const [feeLoading, setFeeLoading] = useState(false)
  
  // Treasury change form
  const [newTreasury, setNewTreasury] = useState('')
  const [treasuryReason, setTreasuryReason] = useState('')
  const [treasuryLoading, setTreasuryLoading] = useState(false)
  
  // Royalty change form
  const [newRoyaltyBps, setNewRoyaltyBps] = useState('')
  const [royaltyReason, setRoyaltyReason] = useState('')
  const [royaltyLoading, setRoyaltyLoading] = useState(false)
  
  // Confirmation modal
  const [confirmModal, setConfirmModal] = useState<{
    type: 'fee' | 'treasury' | 'royalty' | 'execute' | null
    message: string
    onConfirm: () => void
  }>({ type: null, message: '', onConfirm: () => {} })

  const {
    settings,
    pendingChanges,
    isLoading,
    error,
    canMakeChange,
    refresh,
    requestFeeChange,
    requestTreasuryChange,
    requestRoyaltyChange,
    toggleImmediatePayout,
    executeChange,
    cancelChange
  } = useContractSettings(parseInt(selectedChain.value), selectedChain.version)

  // Handle fee change request with confirmation
  const handleFeeChangeRequest = () => {
    const feeBps = parseInt(newFeeBps)
    if (isNaN(feeBps) || feeBps < 0 || feeBps > SECURITY_THRESHOLDS.MAX_PLATFORM_FEE_BPS) {
      alert(`Fee must be between 0 and ${SECURITY_THRESHOLDS.MAX_PLATFORM_FEE_BPS} basis points (${SECURITY_THRESHOLDS.MAX_PLATFORM_FEE_BPS / 100}%)`)
      return
    }
    if (!feeReason.trim()) {
      alert('Please provide a reason for this change')
      return
    }

    const currentFee = settings?.platformFeeBps || 0
    const feeChange = Math.abs(feeBps - currentFee)
    const requiresMultiSig = feeChange > SECURITY_THRESHOLDS.FEE_CHANGE_THRESHOLD_BPS

    setConfirmModal({
      type: 'fee',
      message: `You are requesting to change the platform fee from ${currentFee / 100}% to ${feeBps / 100}%.${
        requiresMultiSig 
          ? '\n\n⚠️ This change exceeds 1% and will require multi-sig approval.' 
          : ''
      }\n\nThis change will be queued for a ${SECURITY_THRESHOLDS.FEE_CHANGE_DELAY_HOURS}-hour timelock before execution.`,
      onConfirm: async () => {
        setFeeLoading(true)
        const result = await requestFeeChange(feeBps, feeReason.trim())
        setFeeLoading(false)
        if (result.success) {
          setNewFeeBps('')
          setFeeReason('')
          alert('✅ Fee change request submitted. It will be executable after the timelock period.')
        } else {
          alert(`❌ Error: ${result.error}`)
        }
        setConfirmModal({ type: null, message: '', onConfirm: () => {} })
      }
    })
  }

  // Handle treasury change request with confirmation
  const handleTreasuryChangeRequest = () => {
    if (!newTreasury.trim() || !/^0x[a-fA-F0-9]{40}$/.test(newTreasury.trim())) {
      alert('Please enter a valid Ethereum address')
      return
    }
    if (!treasuryReason.trim()) {
      alert('Please provide a reason for this change')
      return
    }

    setConfirmModal({
      type: 'treasury',
      message: `⚠️ CRITICAL SECURITY CHANGE ⚠️\n\nYou are requesting to change the platform treasury from:\n${settings?.platformTreasury}\n\nTo:\n${newTreasury.trim()}\n\n🔐 This change REQUIRES multi-sig approval.\n⏰ This change has a ${SECURITY_THRESHOLDS.TREASURY_CHANGE_DELAY_HOURS}-hour timelock.\n\nEnsure you have verified this address multiple times before proceeding.`,
      onConfirm: async () => {
        setTreasuryLoading(true)
        const result = await requestTreasuryChange(newTreasury.trim(), treasuryReason.trim())
        setTreasuryLoading(false)
        if (result.success) {
          setNewTreasury('')
          setTreasuryReason('')
          alert('✅ Treasury change request submitted. It requires multi-sig approval and a 48-hour timelock.')
        } else {
          alert(`❌ Error: ${result.error}`)
        }
        setConfirmModal({ type: null, message: '', onConfirm: () => {} })
      }
    })
  }

  // Handle royalty change request
  const handleRoyaltyChangeRequest = () => {
    const royaltyBps = parseInt(newRoyaltyBps)
    if (isNaN(royaltyBps) || royaltyBps < 0 || royaltyBps > SECURITY_THRESHOLDS.MAX_ROYALTY_BPS) {
      alert(`Royalty must be between 0 and ${SECURITY_THRESHOLDS.MAX_ROYALTY_BPS} basis points (${SECURITY_THRESHOLDS.MAX_ROYALTY_BPS / 100}%)`)
      return
    }
    if (!royaltyReason.trim()) {
      alert('Please provide a reason for this change')
      return
    }

    setConfirmModal({
      type: 'royalty',
      message: `You are requesting to change the default royalty from ${(settings?.defaultRoyaltyBps || 0) / 100}% to ${royaltyBps / 100}%.\n\nThis affects secondary market sales on all marketplaces supporting EIP-2981.`,
      onConfirm: async () => {
        setRoyaltyLoading(true)
        const result = await requestRoyaltyChange(royaltyBps, royaltyReason.trim())
        setRoyaltyLoading(false)
        if (result.success) {
          setNewRoyaltyBps('')
          setRoyaltyReason('')
          alert('✅ Royalty change request submitted.')
        } else {
          alert(`❌ Error: ${result.error}`)
        }
        setConfirmModal({ type: null, message: '', onConfirm: () => {} })
      }
    })
  }

  // Handle execute pending change
  const handleExecuteChange = (pendingId: string, change: any) => {
    setConfirmModal({
      type: 'execute',
      message: `Execute this ${change.changeType} change?\n\nFrom: ${change.currentValue}\nTo: ${change.newValue}\n\nThis action cannot be undone.`,
      onConfirm: async () => {
        const result = await executeChange(pendingId)
        if (result.success) {
          alert(`✅ Change executed successfully!\nTx: ${result.txHash}`)
        } else {
          alert(`❌ Error: ${result.error}`)
        }
        setConfirmModal({ type: null, message: '', onConfirm: () => {} })
      }
    })
  }

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'fees', label: 'Platform Fees', icon: '💵' },
    { id: 'treasury', label: 'Treasury', icon: '🏦' },
    { id: 'royalties', label: 'Royalties', icon: '👑' },
    { id: 'advanced', label: 'Advanced', icon: '⚙️' },
  ]

  return (
    <div className="space-y-6" data-testid="contract-settings-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">⚙️ Contract Settings</h2>
          <p className="text-sm text-white/50 mt-1">
            Financial-grade security: All changes require confirmation
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50"
          data-testid="refresh-settings-btn"
        >
          {isLoading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Security Notice */}
      <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🔐</span>
          <div>
            <h3 className="font-medium text-yellow-400">Financial-Grade Security Active</h3>
            <ul className="mt-2 text-sm text-white/70 space-y-1">
              <li>• Fee changes &gt;1% require multi-sig approval</li>
              <li>• Treasury changes always require multi-sig + 48h timelock</li>
              <li>• All changes are logged to the audit trail</li>
              <li>• Rate limited: {SECURITY_THRESHOLDS.MAX_CHANGES_PER_HOUR} changes per hour</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Chain Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-white/70">Network:</label>
        <select
          value={selectedChain.value}
          onChange={(e) => {
            const chain = CHAIN_OPTIONS.find(c => c.value === e.target.value)
            if (chain) setSelectedChain(chain)
          }}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          data-testid="settings-chain-select"
        >
          {CHAIN_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-slate-800">
              {opt.label} ({opt.version})
            </option>
          ))}
        </select>
        {!canMakeChange && (
          <span className="text-sm text-orange-400">
            ⏳ Cooldown active - wait before making changes
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
          ⚠️ {error}
        </div>
      )}

      {/* Current Settings Summary */}
      {settings && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-4">
            <div className="text-2xl font-bold text-green-400">
              {(settings.platformFeeBps / 100).toFixed(2)}%
            </div>
            <div className="text-sm text-white/50">Platform Fee</div>
          </div>
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/30 p-4">
            <div className="text-2xl font-bold text-blue-400">
              {(settings.defaultRoyaltyBps / 100).toFixed(2)}%
            </div>
            <div className="text-sm text-white/50">Royalty</div>
          </div>
          <div className="rounded-xl bg-purple-500/10 border border-purple-500/30 p-4">
            <div className="text-lg font-mono text-purple-400 truncate">
              {settings.platformTreasury?.slice(0, 10)}...
            </div>
            <div className="text-sm text-white/50">Treasury</div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="text-2xl font-bold text-white">
              {settings.totalCampaigns}
            </div>
            <div className="text-sm text-white/50">Campaigns</div>
          </div>
        </div>
      )}

      {/* Pending Changes Alert */}
      {pendingChanges.length > 0 && (
        <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30">
          <h3 className="font-medium text-orange-400 mb-3">
            ⏳ {pendingChanges.length} Pending Change{pendingChanges.length !== 1 ? 's' : ''}
          </h3>
          <div className="space-y-2">
            {pendingChanges.map(change => (
              <div key={change.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <div>
                  <div className="text-sm text-white">
                    <span className="font-medium capitalize">{change.changeType}</span>: {change.currentValue} → {change.newValue}
                  </div>
                  <div className="text-xs text-white/50">
                    Expires: {new Date(change.expiresAt).toLocaleString()}
                    {change.requiresMultiSig && ` • Approvals: ${change.approvals.length}/${change.requiredApprovals}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  {change.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleExecuteChange(change.id, change)}
                        className="px-3 py-1 text-xs rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30"
                        disabled={change.requiresMultiSig && change.approvals.length < change.requiredApprovals}
                      >
                        Execute
                      </button>
                      <button
                        onClick={() => cancelChange(change.id)}
                        className="px-3 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/10 pb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'fees' && (
        <div className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-4">
          <h3 className="text-lg font-medium text-white">Platform Fee Configuration</h3>
          <p className="text-sm text-white/50">
            The platform fee is taken from each NFT purchase. Current: {(settings?.platformFeeBps || 0) / 100}%
          </p>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">New Fee (basis points)</label>
              <input
                type="number"
                value={newFeeBps}
                onChange={(e) => setNewFeeBps(e.target.value)}
                placeholder={`0-${SECURITY_THRESHOLDS.MAX_PLATFORM_FEE_BPS} (100 = 1%)`}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                data-testid="fee-input"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Reason for Change *</label>
              <input
                type="text"
                value={feeReason}
                onChange={(e) => setFeeReason(e.target.value)}
                placeholder="e.g., Adjusting for market conditions"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                data-testid="fee-reason-input"
              />
            </div>
          </div>
          
          <button
            onClick={handleFeeChangeRequest}
            disabled={feeLoading || !canMakeChange}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50"
            data-testid="request-fee-change-btn"
          >
            {feeLoading ? '⏳ Processing...' : '📝 Request Fee Change'}
          </button>
        </div>
      )}

      {activeTab === 'treasury' && (
        <div className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium text-white">Treasury Address</h3>
            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
              🔐 Multi-sig Required
            </span>
          </div>
          <p className="text-sm text-white/50">
            The treasury receives platform fees. Current: {settings?.platformTreasury}
          </p>
          
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            ⚠️ <strong>Critical Security Notice:</strong> Changing the treasury address is a high-risk operation. 
            Verify the new address multiple times before submitting. This change requires multi-sig approval 
            and has a 48-hour timelock.
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">New Treasury Address</label>
              <input
                type="text"
                value={newTreasury}
                onChange={(e) => setNewTreasury(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-mono"
                data-testid="treasury-input"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Reason for Change *</label>
              <textarea
                value={treasuryReason}
                onChange={(e) => setTreasuryReason(e.target.value)}
                placeholder="Detailed reason for this treasury change..."
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white min-h-[80px]"
                data-testid="treasury-reason-input"
              />
            </div>
          </div>
          
          <button
            onClick={handleTreasuryChangeRequest}
            disabled={treasuryLoading || !canMakeChange}
            className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-500 disabled:opacity-50"
            data-testid="request-treasury-change-btn"
          >
            {treasuryLoading ? '⏳ Processing...' : '🔐 Request Treasury Change'}
          </button>
        </div>
      )}

      {activeTab === 'royalties' && (
        <div className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-4">
          <h3 className="text-lg font-medium text-white">Default Royalty (EIP-2981)</h3>
          <p className="text-sm text-white/50">
            Royalties are paid on secondary market sales. Current: {(settings?.defaultRoyaltyBps || 0) / 100}%
          </p>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">New Royalty (basis points)</label>
              <input
                type="number"
                value={newRoyaltyBps}
                onChange={(e) => setNewRoyaltyBps(e.target.value)}
                placeholder={`0-${SECURITY_THRESHOLDS.MAX_ROYALTY_BPS} (250 = 2.5%)`}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                data-testid="royalty-input"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Reason for Change *</label>
              <input
                type="text"
                value={royaltyReason}
                onChange={(e) => setRoyaltyReason(e.target.value)}
                placeholder="e.g., Aligning with marketplace standards"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                data-testid="royalty-reason-input"
              />
            </div>
          </div>
          
          <button
            onClick={handleRoyaltyChangeRequest}
            disabled={royaltyLoading || !canMakeChange}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:opacity-50"
            data-testid="request-royalty-change-btn"
          >
            {royaltyLoading ? '⏳ Processing...' : '👑 Request Royalty Change'}
          </button>
        </div>
      )}

      {activeTab === 'advanced' && (
        <div className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-6">
          <h3 className="text-lg font-medium text-white">Advanced Settings</h3>
          
          {/* Immediate Payout Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
            <div>
              <div className="font-medium text-white">Immediate Payout</div>
              <div className="text-sm text-white/50">
                When enabled, funds are sent to submitters immediately on mint
              </div>
            </div>
            <button
              onClick={() => {
                const newState = !settings?.immediatePayoutEnabled
                toggleImmediatePayout(newState, `Toggle immediate payout to ${newState ? 'enabled' : 'disabled'}`)
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                settings?.immediatePayoutEnabled
                  ? 'bg-green-500 text-white'
                  : 'bg-white/10 text-white/70'
              }`}
              data-testid="immediate-payout-toggle"
            >
              {settings?.immediatePayoutEnabled ? '✅ Enabled' : '❌ Disabled'}
            </button>
          </div>
          
          {/* Contract Info */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white/70">Contract Information</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-white/50">Address:</div>
              <div className="font-mono text-white truncate">{settings?.contractAddress}</div>
              <div className="text-white/50">Owner:</div>
              <div className="font-mono text-white truncate">{settings?.owner}</div>
              <div className="text-white/50">Balance:</div>
              <div className="text-white">{settings?.contractBalance} (native)</div>
              <div className="text-white/50">Bug Bounty Pool:</div>
              <div className="text-white">{settings?.bugBountyPool} (native)</div>
              <div className="text-white/50">Status:</div>
              <div className={settings?.isPaused ? 'text-red-400' : 'text-green-400'}>
                {settings?.isPaused ? '⏸️ Paused' : '✅ Active'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white mb-4">
              {confirmModal.type === 'treasury' ? '🔐 Confirm Critical Change' : '✅ Confirm Change'}
            </h3>
            <pre className="whitespace-pre-wrap text-sm text-white/70 bg-white/5 p-4 rounded-lg mb-4">
              {confirmModal.message}
            </pre>
            <div className="flex gap-3">
              <button
                onClick={confirmModal.onConfirm}
                className={`flex-1 py-2 rounded-lg font-medium ${
                  confirmModal.type === 'treasury'
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmModal({ type: null, message: '', onConfirm: () => {} })}
                className="flex-1 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
