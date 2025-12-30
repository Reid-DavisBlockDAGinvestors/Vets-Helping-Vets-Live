'use client'

/**
 * MobileMenu Component
 * 
 * Mobile navigation menu portal
 * Following ISP - focused on mobile nav only
 */

import { createPortal } from 'react-dom'
import Link from 'next/link'
import { NAV_LINKS, isActiveLink, formatBalance } from './types'

interface MobileMenuProps {
  isOpen: boolean
  mounted: boolean
  pathname: string
  mobileMenuRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
  // Wallet props
  address: string | null
  isConnected: boolean
  isConnecting: boolean
  isOnBlockDAG: boolean
  balance: string | null
  onConnect: () => void
  onSwitchNetwork: () => void
}

export default function MobileMenu({
  isOpen,
  mounted,
  pathname,
  mobileMenuRef,
  onClose,
  address,
  isConnected,
  isConnecting,
  isOnBlockDAG,
  balance,
  onConnect,
  onSwitchNetwork
}: MobileMenuProps) {
  if (!mounted || !isOpen) return null

  return createPortal(
    <div className="lg:hidden" role="dialog" aria-modal="true" data-testid="mobile-menu">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70"
        style={{ zIndex: 9998, top: '56px' }}
        onClick={onClose}
        aria-label="Close menu"
      />
      
      {/* Menu Panel */}
      <div 
        ref={mobileMenuRef}
        className="fixed right-0 bottom-0 w-72 max-w-[85vw] bg-gray-900 border-l border-white/10 shadow-2xl overflow-y-auto"
        style={{ zIndex: 9999, top: '56px' }}
      >
        <nav className="p-4 space-y-1">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              data-testid={`mobile-nav-${link.href.replace('/', '')}`}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all ${
                isActiveLink(link.href, pathname)
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              {link.emoji}
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Wallet Info */}
        {isConnected && address && (
          <div className="mx-4 mt-4 p-4 bg-white/5 rounded-xl border border-white/10" data-testid="mobile-wallet-info">
            <div className="text-xs text-white/50 mb-2">Wallet</div>
            <div className="font-mono text-sm text-white mb-2 break-all">{address}</div>
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">{formatBalance(balance)} BDAG</span>
              <span className={`flex items-center gap-1 text-xs ${isOnBlockDAG ? 'text-green-400' : 'text-yellow-400'}`}>
                <span className={`w-2 h-2 rounded-full ${isOnBlockDAG ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
                {isOnBlockDAG ? 'Connected' : 'Wrong Network'}
              </span>
            </div>
            {!isOnBlockDAG && (
              <button onClick={() => { onSwitchNetwork(); onClose(); }} data-testid="mobile-switch-network-btn"
                className="w-full mt-3 px-3 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-sm font-medium transition-colors">
                Switch to BlockDAG
              </button>
            )}
          </div>
        )}

        {/* Mobile Connect Button */}
        {!isConnected && (
          <div className="mx-4 mt-4 pb-4">
            <button onClick={() => { onConnect(); onClose(); }} disabled={isConnecting} data-testid="mobile-connect-btn"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-patriotic-red hover:bg-red-600 text-white rounded-xl text-base font-medium transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Connect Wallet
            </button>
            <p className="text-xs text-white/40 text-center mt-2">Use MetaMask or any Web3 wallet</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
