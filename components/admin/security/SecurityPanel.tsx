'use client'

import { useState } from 'react'
import { useSecurity } from './hooks/useSecurity'

const CHAIN_OPTIONS = [
  { value: '1043', label: 'BlockDAG (1043)', version: 'v6' },
  { value: '11155111', label: 'Sepolia (11155111)', version: 'v7' },
  { value: '1', label: 'Ethereum (1)', version: 'v7' },
]

export function SecurityPanel() {
  const [selectedChain, setSelectedChain] = useState(CHAIN_OPTIONS[0])
  const [newBlacklistAddress, setNewBlacklistAddress] = useState('')
  const [blacklistReason, setBlacklistReason] = useState('')
  const [isBlacklisting, setIsBlacklisting] = useState(false)
  const [confirmPause, setConfirmPause] = useState(false)
  const [confirmUnpause, setConfirmUnpause] = useState(false)
  const [showEmergencyWithdraw, setShowEmergencyWithdraw] = useState(false)
  const [withdrawTo, setWithdrawTo] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')

  const {
    contractStatus,
    blacklistedAddresses,
    isLoading,
    error,
    refresh,
    blacklistAddress,
    removeBlacklist,
    pauseContract,
    unpauseContract,
    emergencyWithdraw
  } = useSecurity(parseInt(selectedChain.value), selectedChain.version)

  const handleBlacklist = async () => {
    if (!newBlacklistAddress.trim()) return
    setIsBlacklisting(true)
    try {
      await blacklistAddress(newBlacklistAddress.trim(), blacklistReason.trim() || undefined)
      setNewBlacklistAddress('')
      setBlacklistReason('')
    } finally {
      setIsBlacklisting(false)
    }
  }

  const handlePause = async () => {
    await pauseContract()
    setConfirmPause(false)
  }

  const handleUnpause = async () => {
    await unpauseContract()
    setConfirmUnpause(false)
  }

  const handleEmergencyWithdraw = async () => {
    if (!withdrawTo.trim() || !withdrawAmount.trim()) return
    await emergencyWithdraw(withdrawTo.trim(), withdrawAmount.trim())
    setWithdrawTo('')
    setWithdrawAmount('')
    setShowEmergencyWithdraw(false)
  }

  return (
    <div className="space-y-6" data-testid="security-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">🔒 Security Controls</h2>
          <p className="text-sm text-white/50 mt-1">
            Manage contract security: blacklist, pause, emergency actions
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50"
          data-testid="refresh-security-btn"
        >
          {isLoading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Chain Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-white/70">Select Network:</label>
        <select
          value={selectedChain.value}
          onChange={(e) => {
            const chain = CHAIN_OPTIONS.find(c => c.value === e.target.value)
            if (chain) setSelectedChain(chain)
          }}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          data-testid="security-chain-select"
        >
          {CHAIN_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-slate-800">
              {opt.label} ({opt.version})
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
          ⚠️ {error}
        </div>
      )}

      {/* Contract Status */}
      {contractStatus && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`rounded-xl p-4 border ${
            contractStatus.isPaused 
              ? 'bg-red-500/10 border-red-500/30' 
              : 'bg-green-500/10 border-green-500/30'
          }`}>
            <div className="text-2xl font-bold">
              {contractStatus.isPaused ? '⏸️ PAUSED' : '✅ ACTIVE'}
            </div>
            <div className="text-sm text-white/50">Contract Status</div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="text-2xl font-bold text-white">{contractStatus.totalCampaigns}</div>
            <div className="text-sm text-white/50">Total Campaigns</div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="text-lg font-mono text-white truncate">{contractStatus.platformFeeBps / 100}%</div>
            <div className="text-sm text-white/50">Platform Fee</div>
          </div>
          <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-4">
            <div className="text-lg font-mono text-yellow-400 truncate">{contractStatus.bugBountyPool}</div>
            <div className="text-sm text-white/50">Bug Bounty Pool</div>
          </div>
        </div>
      )}

      {/* Contract Info */}
      {contractStatus && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <h3 className="text-sm font-medium text-white mb-2">Contract Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-white/50">Address:</span>{' '}
              <span className="font-mono text-white">{contractStatus.contractAddress}</span>
            </div>
            <div>
              <span className="text-white/50">Owner:</span>{' '}
              <span className="font-mono text-white">{contractStatus.owner}</span>
            </div>
            <div>
              <span className="text-white/50">Treasury:</span>{' '}
              <span className="font-mono text-white">{contractStatus.platformTreasury}</span>
            </div>
            <div>
              <span className="text-white/50">Version:</span>{' '}
              <span className="text-white">{contractStatus.contractVersion}</span>
            </div>
          </div>
        </div>
      )}

      {/* Pause/Unpause Controls */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <h3 className="text-sm font-medium text-white mb-4">🚨 Emergency Controls</h3>
        <div className="flex flex-wrap gap-3">
          {contractStatus?.isPaused ? (
            <button
              onClick={() => setConfirmUnpause(true)}
              className="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 font-medium"
              data-testid="unpause-btn"
            >
              ▶️ Unpause Contract
            </button>
          ) : (
            <button
              onClick={() => setConfirmPause(true)}
              className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium"
              data-testid="pause-btn"
            >
              ⏸️ Pause Contract
            </button>
          )}
          <button
            onClick={() => setShowEmergencyWithdraw(!showEmergencyWithdraw)}
            className="px-4 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 font-medium"
            data-testid="emergency-withdraw-btn"
          >
            💸 Emergency Withdraw
          </button>
        </div>

        {/* Pause Confirmation */}
        {confirmPause && (
          <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-400 mb-3">
              ⚠️ <strong>Warning:</strong> Pausing the contract will stop all minting and transfers!
            </p>
            <div className="flex gap-2">
              <button
                onClick={handlePause}
                className="px-4 py-2 rounded-lg bg-red-500 text-white font-medium hover:bg-red-400"
                data-testid="confirm-pause-btn"
              >
                ⏸️ Confirm Pause
              </button>
              <button
                onClick={() => setConfirmPause(false)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Unpause Confirmation */}
        {confirmUnpause && (
          <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
            <p className="text-sm text-green-400 mb-3">
              Resume contract operations?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleUnpause}
                className="px-4 py-2 rounded-lg bg-green-500 text-white font-medium hover:bg-green-400"
                data-testid="confirm-unpause-btn"
              >
                ▶️ Confirm Unpause
              </button>
              <button
                onClick={() => setConfirmUnpause(false)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Emergency Withdraw Form */}
        {showEmergencyWithdraw && (
          <div className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-sm text-yellow-400 mb-3">
              ⚠️ <strong>Emergency Withdraw:</strong> Send funds to a specific address
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/70 mb-1">Recipient Address</label>
                <input
                  type="text"
                  value={withdrawTo}
                  onChange={(e) => setWithdrawTo(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-sm"
                  data-testid="withdraw-to-input"
                />
              </div>
              <div>
                <label className="block text-xs text-white/70 mb-1">Amount (in wei)</label>
                <input
                  type="text"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="1000000000000000000"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-sm"
                  data-testid="withdraw-amount-input"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleEmergencyWithdraw}
                  disabled={!withdrawTo.trim() || !withdrawAmount.trim()}
                  className="px-4 py-2 rounded-lg bg-yellow-500 text-black font-medium hover:bg-yellow-400 disabled:opacity-50"
                  data-testid="confirm-withdraw-btn"
                >
                  💸 Execute Withdraw
                </button>
                <button
                  onClick={() => setShowEmergencyWithdraw(false)}
                  className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Blacklist Management */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <h3 className="text-sm font-medium text-white mb-4">🚫 Address Blacklist</h3>
        
        {/* Add New */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <input
            type="text"
            value={newBlacklistAddress}
            onChange={(e) => setNewBlacklistAddress(e.target.value)}
            placeholder="0x... address to blacklist"
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-sm"
            data-testid="blacklist-address-input"
          />
          <input
            type="text"
            value={blacklistReason}
            onChange={(e) => setBlacklistReason(e.target.value)}
            placeholder="Reason (optional)"
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
            data-testid="blacklist-reason-input"
          />
          <button
            onClick={handleBlacklist}
            disabled={isBlacklisting || !newBlacklistAddress.trim()}
            className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium disabled:opacity-50"
            data-testid="add-blacklist-btn"
          >
            {isBlacklisting ? '⏳' : '🚫'} Add to Blacklist
          </button>
        </div>

        {/* Blacklisted List */}
        {blacklistedAddresses.length === 0 ? (
          <p className="text-sm text-white/50">No blacklisted addresses</p>
        ) : (
          <div className="space-y-2">
            {blacklistedAddresses.map((item) => (
              <div
                key={item.address}
                className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20"
              >
                <div>
                  <div className="font-mono text-sm text-white">{item.address}</div>
                  {item.reason && (
                    <div className="text-xs text-white/50">Reason: {item.reason}</div>
                  )}
                  <div className="text-xs text-white/30">Added: {item.addedAt}</div>
                </div>
                <button
                  onClick={() => removeBlacklist(item.address)}
                  className="px-3 py-1 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 text-sm"
                  data-testid={`remove-blacklist-${item.address}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
