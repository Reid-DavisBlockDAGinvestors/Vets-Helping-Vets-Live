'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'
import UserAccountPortal from './UserAccountPortal'

const NAV_LINKS = [
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/community', label: 'Community' },
  { href: '/submit', label: 'Submit Story' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/governance', label: 'Governance' },
  { href: '/admin', label: 'Admin' },
]

export default function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false)
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const walletDropdownRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const hamburgerButtonRef = useRef<HTMLButtonElement>(null)
  
  const { 
    address, 
    isConnected, 
    isConnecting, 
    isOnBlockDAG, 
    balance,
    error,
    connect,
    connectAuto,
    connectWalletConnect,
    openInMetaMaskBrowser,
    disconnect, 
    switchToBlockDAG,
    hasInjectedWallet,
    isMobile
  } = useWallet()

  // Track client-side mounting for portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Close wallet dropdown when clicking outside (desktop only, simpler logic)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      
      // Close wallet dropdown if clicking outside
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(target)) {
        setWalletDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileMenuOpen])

  const handleConnect = async () => {
    // On mobile without injected wallet, directly open MetaMask app
    if (isMobile && !hasInjectedWallet) {
      openInMetaMaskBrowser()
      return
    }
    
    // On desktop without wallet, show options modal
    if (!hasInjectedWallet) {
      setWalletModalOpen(true)
      return
    }
    
    // Has injected wallet, connect normally
    await connectAuto()
  }

  
  const formatBalance = (bal: string | null) => {
    if (!bal) return '0.00'
    const num = parseFloat(bal)
    if (num < 0.01) return '<0.01'
    return num.toFixed(2)
  }

  const isActiveLink = (href: string) => pathname === href

  const headerContent = (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-patriotic-navy/95 backdrop-blur-lg">
      <div className="container">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <Link 
            href="/" 
            className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <span className="text-2xl">🎖️</span>
            <span className="hidden xs:inline">PatriotPledge</span>
            <span className="xs:hidden">PP</span>
            <span className="text-patriotic-red hidden sm:inline">NFTs</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActiveLink(link.href)
                    ? 'bg-white/10 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Side - Account, Wallet & Mobile Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* User Account */}
            <UserAccountPortal />
            
            {/* Wallet Button */}
            <div className="relative" ref={walletDropdownRef}>
              {isConnected && address ? (
                <>
                  <button
                    onClick={() => setWalletDropdownOpen(!walletDropdownOpen)}
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
                    <div className="absolute right-0 mt-2 w-64 bg-gray-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
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
                          <button
                            onClick={() => { switchToBlockDAG(); setWalletDropdownOpen(false); }}
                            className="mt-2 w-full px-3 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-sm font-medium transition-colors"
                          >
                            Switch to BlockDAG
                          </button>
                        )}
                      </div>

                      <div className="p-2">
                        <button
                          onClick={() => { disconnect(); setWalletDropdownOpen(false); }}
                          className="w-full px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-colors text-left"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-patriotic-red hover:bg-red-600 disabled:bg-red-800 text-white rounded-lg text-sm font-medium transition-all disabled:cursor-wait"
                >
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
                <div className="absolute right-0 mt-2 w-64 bg-red-900/90 border border-red-500/30 rounded-lg p-3 text-sm text-red-200 z-50">
                  {error}
                </div>
              )}
            </div>

            {/* Mobile Menu Button - larger touch target */}
            <button
              ref={hamburgerButtonRef}
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className="lg:hidden p-3 -mr-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors touch-manipulation select-none"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
              type="button"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

    </header>
  )

  // Mobile Menu Portal - rendered outside header to avoid stacking context issues
  const mobileMenu = mounted && mobileMenuOpen ? createPortal(
    <div className="lg:hidden" role="dialog" aria-modal="true">
      {/* Backdrop - full screen, tap to close */}
      <div 
        className="fixed inset-0 bg-black/70"
        style={{ zIndex: 9998, top: '56px' }}
        onClick={() => setMobileMenuOpen(false)}
        aria-label="Close menu"
      />
      
      {/* Menu Panel - slides in from right */}
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
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all ${
                isActiveLink(link.href)
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              {link.label === 'Marketplace' && '🏪'}
              {link.label === 'Community' && '🏛️'}
              {link.label === 'Submit Story' && '📝'}
              {link.label === 'Dashboard' && '📊'}
              {link.label === 'Governance' && '🗳️'}
              {link.label === 'Admin' && '⚙️'}
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Wallet Info in Mobile Menu */}
        {isConnected && address && (
          <div className="mx-4 mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
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
              <button
                onClick={() => { switchToBlockDAG(); setMobileMenuOpen(false); }}
                className="w-full mt-3 px-3 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-sm font-medium transition-colors"
              >
                Switch to BlockDAG
              </button>
            )}
          </div>
        )}

        {/* Mobile Connect Button (if not connected) */}
        {!isConnected && (
          <div className="mx-4 mt-4 pb-4">
            <button
              onClick={() => { connectAuto(); setMobileMenuOpen(false); }}
              disabled={isConnecting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-patriotic-red hover:bg-red-600 text-white rounded-xl text-base font-medium transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Connect Wallet
            </button>
            <p className="text-xs text-white/40 text-center mt-2">
              Use MetaMask or any Web3 wallet
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null

  // Wallet Options Modal - shown when no wallet is detected
  const walletModal = mounted && walletModalOpen ? createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => setWalletModalOpen(false)}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <button
          onClick={() => setWalletModalOpen(false)}
          className="absolute top-4 right-4 text-white/50 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🔗</div>
          <h2 className="text-xl font-bold text-white">Connect Your Wallet</h2>
          <p className="text-white/60 text-sm mt-2">
            Choose how you'd like to connect
          </p>
        </div>

        <div className="space-y-3">
          {/* Option 1: MetaMask Browser */}
          <button
            onClick={() => {
              setWalletModalOpen(false)
              openInMetaMaskBrowser()
            }}
            className="w-full flex items-center gap-4 p-4 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-xl transition-colors"
          >
            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🦊</span>
            </div>
            <div className="text-left">
              <div className="font-semibold text-white">Open in MetaMask</div>
              <div className="text-xs text-white/50">Use MetaMask's built-in browser</div>
            </div>
          </button>

          {/* Option 2: Install MetaMask */}
          <button
            onClick={() => {
              setWalletModalOpen(false)
              window.open('https://metamask.io/download/', '_blank')
            }}
            className="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
          >
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <span className="text-2xl">📲</span>
            </div>
            <div className="text-left">
              <div className="font-semibold text-white">Install MetaMask</div>
              <div className="text-xs text-white/50">Download the MetaMask app</div>
            </div>
          </button>

          {/* WalletConnect - Stay in browser */}
          <button
            onClick={() => {
              setWalletModalOpen(false)
              connectWalletConnect()
            }}
            className="w-full flex items-center gap-4 p-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl transition-colors"
          >
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🔗</span>
            </div>
            <div className="text-left">
              <div className="font-semibold text-white">WalletConnect</div>
              <div className="text-xs text-white/50">Stay in your browser ✨</div>
            </div>
          </button>
        </div>

        <p className="text-center text-xs text-white/40 mt-4">
          MetaMask is the recommended wallet for PatriotPledge NFTs
        </p>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      {headerContent}
      {mobileMenu}
      {walletModal}
    </>
  )
}
