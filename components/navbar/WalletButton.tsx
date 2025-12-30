'use client'

/**
 * WalletButton Component
 * 
 * Wallet connection button with dropdown for connected state
 * Following ISP - focused on wallet UI only
 */

import { formatBalance } from './types'

interface WalletButtonProps {
  address: string | null
  isConnected: boolean
  isConnecting: boolean
  isOnBlockDAG: boolean
  balance: string | null
  error: string | null
  walletDropdownOpen: boolean
  walletDropdownRef: React.RefObject<HTMLDivElement | null>
  onToggleDropdown: () => void
  onConnect: () => void
  onDisconnect: () => void
  onSwitchNetwork: () => void
}

export default function WalletButton({
  address,
  isConnected,
  isConnecting,
  isOnBlockDAG,
  balance,
  error,
  walletDropdownOpen,
  walletDropdownRef,
  onToggleDropdown,
  onConnect,
  onDisconnect,
  onSwitchNetwork
}: WalletButtonProps) {
  return (
    <div className="relative" ref={walletDropdownRef}>
      {isConnected && address ? (
        <>
          <button
            onClick={onToggleDropdown}
            data-testid="wallet-connected-btn"
            aria-label="Wallet options"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              isOnBlockDAG 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30' 
                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30'
            }`}
          >
            <span className="hidden sm:inline">{formatBalance(balance)} BDAG</span>
            <span className="font-mono">{address.slice(0, 4)}...{address.slice(-4)}</span>
            <svg className={`w-4 h-4 transition-transform ${walletDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Wallet Dropdown */}
          {walletDropdownOpen && (
            <div data-testid="wallet-dropdown" className="absolute right-0 mt-2 w-64 bg-gray-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
              <div className="p-4 border-b border-white/10">
                <div className="text-xs text-white/50 mb-1">Connected Wallet</div>
                <div className="font-mono text-sm text-white break-all">{address}</div>
              </div>
              
              <div className="p-4 border-b border-white/10">
                <div className="text-xs text-white/50 mb-1">Balance</div>
                <div className="text-lg font-bold text-white">{formatBalance(balance)} BDAG</div>
              </div>

              <div className="p-4 border-b border-white/10">
                <div className="text-xs text-white/50 mb-1">Network</div>
                <div className={`flex items-center gap-2 ${isOnBlockDAG ? 'text-green-400' : 'text-yellow-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${isOnBlockDAG ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
                  {isOnBlockDAG ? 'BlockDAG Testnet' : 'Wrong Network'}
                </div>
                {!isOnBlockDAG && (
                  <button onClick={onSwitchNetwork} data-testid="switch-network-btn"
                    className="mt-2 w-full px-3 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-sm font-medium transition-colors">
                    Switch to BlockDAG
                  </button>
                )}
              </div>

              <div className="p-2">
                <button onClick={onDisconnect} data-testid="disconnect-wallet-btn"
                  className="w-full px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-colors text-left">
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <button onClick={onConnect} disabled={isConnecting} data-testid="connect-wallet-btn" aria-label="Connect wallet"
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-patriotic-red hover:bg-red-600 disabled:bg-red-800 text-white rounded-lg text-sm font-medium transition-all disabled:cursor-wait">
          {isConnecting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="hidden sm:inline">Connecting...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="hidden sm:inline">Connect Wallet</span>
              <span className="sm:hidden">Connect</span>
            </>
          )}
        </button>
      )}
      
      {/* Error Toast */}
      {error && (
        <div className="absolute right-0 mt-2 w-64 bg-red-900/90 border border-red-500/30 rounded-lg p-3 text-sm text-red-200 z-50" data-testid="wallet-error">
          {error}
        </div>
      )}
    </div>
  )
}
