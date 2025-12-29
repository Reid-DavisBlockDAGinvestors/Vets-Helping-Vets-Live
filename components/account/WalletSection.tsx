'use client'

import type { WalletSectionProps } from './types'

/**
 * Format wallet balance for display
 */
function formatBalance(bal: string | null): string {
  if (!bal) return '0.00'
  const num = parseFloat(bal)
  if (num < 0.01) return '<0.01'
  return num.toFixed(2)
}

/**
 * Wallet section in user dropdown
 */
export function WalletSection({
  address,
  isConnected,
  balance,
  isOnBlockDAG,
  onDisconnect,
  onSwitchNetwork,
}: WalletSectionProps) {
  return (
    <div className="p-4 border-b border-white/10">
      <div className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wide">Wallet</div>
      {isConnected && address ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-white">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
            <span className={`flex items-center gap-1 text-xs ${isOnBlockDAG ? 'text-green-400' : 'text-yellow-400'}`}>
              <span className={`w-2 h-2 rounded-full ${isOnBlockDAG ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
              {isOnBlockDAG ? 'BlockDAG' : 'Wrong Network'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-white">{formatBalance(balance)} BDAG</span>
            <button
              onClick={onDisconnect}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Disconnect
            </button>
          </div>
          {!isOnBlockDAG && (
            <button
              onClick={onSwitchNetwork}
              className="w-full mt-1 px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-xs font-medium transition-colors"
            >
              Switch to BlockDAG
            </button>
          )}
        </div>
      ) : (
        <div className="text-center text-white/50 text-sm py-2">
          <p>Use the <span className="text-patriotic-red font-medium">Connect Wallet</span> button in the header</p>
        </div>
      )}
    </div>
  )
}

export default WalletSection
