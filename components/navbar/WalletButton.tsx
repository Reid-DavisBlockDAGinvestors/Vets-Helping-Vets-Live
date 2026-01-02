'use client'

/**
 * WalletButton Component
 * 
 * Wallet connection button with dropdown for connected state
 * Following ISP - focused on wallet UI only
 */

import { formatBalance } from './types'

// Network configurations for display
const NETWORK_INFO: Record<number, { name: string; symbol: string; color: string; isTestnet: boolean }> = {
  1043: { name: 'BlockDAG', symbol: 'BDAG', color: 'green', isTestnet: false },
  11155111: { name: 'Sepolia', symbol: 'ETH', color: 'purple', isTestnet: true },
  1: { name: 'Ethereum', symbol: 'ETH', color: 'blue', isTestnet: false },
  137: { name: 'Polygon', symbol: 'MATIC', color: 'purple', isTestnet: false },
  8453: { name: 'Base', symbol: 'ETH', color: 'blue', isTestnet: false },
}

function getNetworkInfo(chainId: number | null) {
  if (!chainId) return null
  return NETWORK_INFO[chainId] || { name: `Chain ${chainId}`, symbol: '?', color: 'gray', isTestnet: false }
}

interface WalletButtonProps {
  address: string | null
  chainId: number | null
  isConnected: boolean
  isConnecting: boolean
  isOnBlockDAG: boolean
  isOnSepolia?: boolean
  isOnSupportedChain?: boolean
  balance: string | null
  error: string | null
  walletDropdownOpen: boolean
  walletDropdownRef: React.RefObject<HTMLDivElement | null>
  onToggleDropdown: () => void
  onConnect: () => void
  onDisconnect: () => void
  onSwitchToBlockDAG: () => void
  onSwitchToSepolia: () => void
}

export default function WalletButton({
  address,
  chainId,
  isConnected,
  isConnecting,
  isOnBlockDAG,
  isOnSepolia,
  isOnSupportedChain,
  balance,
  error,
  walletDropdownOpen,
  walletDropdownRef,
  onToggleDropdown,
  onConnect,
  onDisconnect,
  onSwitchToBlockDAG,
  onSwitchToSepolia,
}: WalletButtonProps) {
  const networkInfo = getNetworkInfo(chainId)
  const isSupported = isOnBlockDAG || isOnSepolia || isOnSupportedChain
  return (
    <div className="relative" ref={walletDropdownRef}>
      {isConnected && address ? (
        <>
          <button
            onClick={onToggleDropdown}
            data-testid="wallet-connected-btn"
            aria-label="Wallet options"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              isSupported
                ? `bg-${networkInfo?.color || 'green'}-500/20 text-${networkInfo?.color || 'green'}-400 border border-${networkInfo?.color || 'green'}-500/30 hover:bg-${networkInfo?.color || 'green'}-500/30`
                : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
            }`}
          >
            {/* Network indicator */}
            <span className={`w-2 h-2 rounded-full ${isSupported ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`}></span>
            <span className="hidden sm:inline text-xs opacity-75">{networkInfo?.name || 'Unknown'}</span>
            <span className="hidden sm:inline">{formatBalance(balance)} {networkInfo?.symbol || 'ETH'}</span>
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
                <div className="text-xs text-white/50 mb-1">Current Network</div>
                <div className={`flex items-center gap-2 ${isSupported ? 'text-green-400' : 'text-red-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${isSupported ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`}></span>
                  {networkInfo?.name || 'Unknown Network'}
                  {networkInfo?.isTestnet && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">Testnet</span>}
                </div>
                
                {/* Network Switch Buttons */}
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-white/50 mb-1">Switch Network</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={onSwitchToBlockDAG} 
                      data-testid="switch-to-blockdag-btn"
                      disabled={isOnBlockDAG}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isOnBlockDAG 
                          ? 'bg-green-500/30 text-green-400 cursor-default' 
                          : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                      }`}
                    >
                      {isOnBlockDAG && '✓ '}BlockDAG
                    </button>
                    <button 
                      onClick={onSwitchToSepolia} 
                      data-testid="switch-to-sepolia-btn"
                      disabled={isOnSepolia}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isOnSepolia 
                          ? 'bg-purple-500/30 text-purple-400 cursor-default' 
                          : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                      }`}
                    >
                      {isOnSepolia && '✓ '}Sepolia 🧪
                    </button>
                  </div>
                </div>
                
                {/* Warning if on unsupported network */}
                {!isSupported && (
                  <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="text-xs text-red-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Unsupported network. Please switch.
                    </div>
                  </div>
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
