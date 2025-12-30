'use client'

/**
 * WalletModal Component
 * 
 * Modal for wallet connection options when no wallet is detected
 * Following ISP - focused on wallet options modal only
 */

import { createPortal } from 'react-dom'

interface WalletModalProps {
  isOpen: boolean
  onClose: () => void
  onOpenMetaMask: () => void
  onInstallMetaMask: () => void
  onWalletConnect: () => void
}

export default function WalletModal({ isOpen, onClose, onOpenMetaMask, onInstallMetaMask, onWalletConnect }: WalletModalProps) {
  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" data-testid="wallet-modal">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <button onClick={onClose} data-testid="close-wallet-modal-btn" aria-label="Close modal"
          className="absolute top-4 right-4 text-white/50 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🔗</div>
          <h2 className="text-xl font-bold text-white">Connect Your Wallet</h2>
          <p className="text-white/60 text-sm mt-2">Choose how you'd like to connect</p>
        </div>

        <div className="space-y-3">
          {/* MetaMask Browser */}
          <button onClick={onOpenMetaMask} data-testid="metamask-browser-btn"
            className="w-full flex items-center gap-4 p-4 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-xl transition-colors">
            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🦊</span>
            </div>
            <div className="text-left">
              <div className="font-semibold text-white">Open in MetaMask</div>
              <div className="text-xs text-white/50">Use MetaMask's built-in browser</div>
            </div>
          </button>

          {/* Install MetaMask */}
          <button onClick={onInstallMetaMask} data-testid="install-metamask-btn"
            className="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <span className="text-2xl">📲</span>
            </div>
            <div className="text-left">
              <div className="font-semibold text-white">Install MetaMask</div>
              <div className="text-xs text-white/50">Download the MetaMask app</div>
            </div>
          </button>

          {/* WalletConnect */}
          <button onClick={onWalletConnect} data-testid="walletconnect-btn"
            className="w-full flex items-center gap-4 p-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl transition-colors">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🔗</span>
            </div>
            <div className="text-left">
              <div className="font-semibold text-white">WalletConnect</div>
              <div className="text-xs text-white/50">Stay in your browser ✨</div>
            </div>
          </button>
        </div>

        <p className="text-center text-xs text-white/40 mt-4">MetaMask is the recommended wallet for PatriotPledge NFTs</p>
      </div>
    </div>,
    document.body
  )
}
