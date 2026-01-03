'use client'

/**
 * CryptoPaymentSection Component
 * 
 * Cryptocurrency payment UI for BDAG and ETH purchases
 * Following ISP - focused on crypto payment display only
 */

import { openBugReport } from '@/components/BugReportButton'
import { useLivePrice, formatPrice } from '@/hooks/useLivePrice'

export interface CryptoPaymentSectionProps {
  wallet: {
    isConnected: boolean
    isConnecting: boolean
    address: string | null
    balance: string | null
    isOnBlockDAG: boolean
    isOnSepolia?: boolean
    error: string | null
    connectAuto: () => Promise<void>
    disconnect: () => void
    switchToBlockDAG: () => Promise<void>
    switchToSepolia?: () => Promise<void>
  }
  bdagAmount: number
  totalAmount: number
  cryptoMsg: string
  txHash: string | null
  loading: boolean
  onPurchase: () => Promise<void>
  network?: 'bdag' | 'sepolia'
}

export function CryptoPaymentSection({
  wallet,
  bdagAmount,
  totalAmount,
  cryptoMsg,
  txHash,
  loading,
  onPurchase,
  network = 'bdag'
}: CryptoPaymentSectionProps) {
  // Get live price for ETH (Sepolia uses mainnet ETH price)
  const chainId = network === 'sepolia' ? 11155111 : 1043
  const { price: livePrice, loading: priceLoading, refresh: refreshPrice } = useLivePrice(chainId, {
    refreshInterval: 60000, // Refresh every minute
    enabled: network === 'sepolia', // Only fetch live price for ETH networks
  })
  
  const isOnCorrectNetwork = network === 'sepolia' ? wallet.isOnSepolia : wallet.isOnBlockDAG
  const networkName = network === 'sepolia' ? 'Sepolia' : 'BlockDAG'
  const currencySymbol = network === 'sepolia' ? 'ETH' : 'BDAG'
  const explorerUrl = network === 'sepolia' 
    ? 'https://sepolia.etherscan.io/tx/' 
    : 'https://awakening.bdagscan.com/tx/'
  if (!wallet.isConnected) {
    return (
      <div className="space-y-3" data-testid="crypto-connect-section">
        <p className="text-sm text-white/70">Connect your wallet to pay with {currencySymbol}</p>
        <button 
          onClick={wallet.connectAuto} 
          disabled={wallet.isConnecting}
          data-testid="crypto-connect-wallet-btn"
          className="w-full rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 px-6 py-4 font-semibold text-white shadow-lg disabled:opacity-50"
        >
          {wallet.isConnecting ? 'Connecting...' : '🔗 Connect Wallet'}
        </button>
        {wallet.error && <p className="text-sm text-red-400">{wallet.error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-4" data-testid="crypto-payment-section">
      {/* Wallet Info */}
      <div className="rounded-lg bg-white/5 border border-white/10 p-3" data-testid="wallet-info">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-white/70">Connected</span>
          </div>
          <button 
            onClick={wallet.disconnect} 
            data-testid="wallet-disconnect-btn"
            className="text-xs text-white/50 hover:text-white/70"
          >
            Disconnect
          </button>
        </div>
        <p className="text-white font-mono text-sm mt-1" data-testid="wallet-address">
          {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
        </p>
        {wallet.balance && (
          <p className="text-white/50 text-xs mt-1" data-testid="wallet-balance">
            Balance: {parseFloat(wallet.balance).toFixed(4)} {currencySymbol}
          </p>
        )}
        {!isOnCorrectNetwork && (
          <button 
            onClick={network === 'sepolia' ? wallet.switchToSepolia : wallet.switchToBlockDAG} 
            data-testid="switch-network-btn"
            className="mt-2 text-xs text-amber-400 hover:text-amber-300"
          >
            ⚠️ Switch to {networkName} Network
          </button>
        )}
      </div>

      {/* Crypto Amount */}
      <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3" data-testid="crypto-amount">
        <div className="flex justify-between items-center">
          <span className="text-white/70 text-sm">Amount in {currencySymbol}</span>
          <span className="text-white font-bold">
            {network === 'sepolia' ? bdagAmount.toFixed(6) : bdagAmount.toLocaleString()} {currencySymbol}
          </span>
        </div>
        <p className="text-xs text-white/40 mt-1">≈ ${totalAmount} USD</p>
        
        {/* Live Rate Display for ETH */}
        {network === 'sepolia' && livePrice && (
          <div className="mt-2 pt-2 border-t border-purple-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">Live Rate:</span>
              <span className="text-xs text-emerald-400 font-medium">
                {formatPrice(livePrice.priceUsd, 'ETH')}
              </span>
              {livePrice.source === 'coingecko' && (
                <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                  CoinGecko
                </span>
              )}
            </div>
            <button
              onClick={refreshPrice}
              disabled={priceLoading}
              className="text-xs text-white/40 hover:text-white/60 transition-colors"
              title="Refresh price"
            >
              {priceLoading ? '⏳' : '🔄'}
            </button>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {cryptoMsg && (
        <div 
          data-testid="crypto-status-message"
          className={`rounded-lg p-3 ${
            cryptoMsg.includes('🎉') ? 'bg-green-500/10 border border-green-500/30' :
            cryptoMsg.includes('❌') || cryptoMsg.includes('failed') ? 'bg-red-500/10 border border-red-500/30' :
            'bg-white/5 border border-white/10'
          }`}
        >
          <p className={`text-sm ${
            cryptoMsg.includes('🎉') ? 'text-green-400' :
            cryptoMsg.includes('❌') ? 'text-red-400' : 'text-white/70'
          }`}>{cryptoMsg}</p>
          {(cryptoMsg.includes('❌') || cryptoMsg.includes('failed')) && (
            <button 
              onClick={() => openBugReport({ title: 'Crypto Purchase Error', errorMessage: cryptoMsg, category: 'purchase' })}
              className="mt-2 text-xs text-red-300 hover:text-red-200 underline"
            >
              🐛 Report issue
            </button>
          )}
        </div>
      )}

      <button 
        onClick={onPurchase} 
        disabled={loading || !isOnCorrectNetwork}
        data-testid="crypto-purchase-btn"
        className={`w-full rounded-lg bg-gradient-to-r ${network === 'sepolia' ? 'from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500' : 'from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500'} px-6 py-4 font-semibold text-white shadow-lg disabled:opacity-50`}
      >
        {loading ? 'Processing...' : `Pay ${network === 'sepolia' ? bdagAmount.toFixed(6) : bdagAmount.toLocaleString()} ${currencySymbol}`}
      </button>

      {txHash && (
        <a 
          href={`${explorerUrl}${txHash}`} 
          target="_blank" 
          rel="noopener noreferrer"
          data-testid="tx-link"
          className="block text-center text-sm text-blue-400 hover:underline"
        >
          View transaction on {networkName} →
        </a>
      )}
    </div>
  )
}
