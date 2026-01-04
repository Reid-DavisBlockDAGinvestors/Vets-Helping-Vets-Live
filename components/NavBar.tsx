'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useWalletV2 } from '@/hooks/useWalletV2'
import { useAppKit } from '@reown/appkit/react'
import { supabase } from '@/lib/supabase'
import UserAccountPortal from './UserAccountPortalV2'
import ThemeToggle from './ThemeToggle'
import { NotificationCenter } from './notifications'

const NAV_LINKS = [
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/community', label: 'Community' },
  { href: '/submit', label: 'Submit Story' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/bug-bounty', label: '🐛 Bug Bounty' },
  { href: '/governance', label: 'Governance' },
  { href: '/admin', label: 'Admin' },
]

export default function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false)
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const pathname = usePathname()
  const walletDropdownRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const hamburgerButtonRef = useRef<HTMLButtonElement>(null)
  
  const { 
    address, 
    chainId,
    balance,
    isConnected, 
    isConnecting, 
    isOnBlockDAG, 
    isOnSepolia,
    isOnEthereum,
    isOnSupportedChain,
    error,
    connect,
    connectAuto,
    disconnect, 
    switchToBlockDAG,
    switchToSepolia,
    switchToEthereum,
    openAccountModal,
    openNetworkModal,
    hasInjectedWallet,
    isMobile
  } = useWalletV2()
  
  // AppKit modal control
  const { open: openAppKit } = useAppKit()

  // Network info helper
  const getNetworkName = (id: number | null) => {
    if (!id) return 'Unknown'
    const networks: Record<number, string> = {
      1043: 'BlockDAG',
      11155111: 'Sepolia',
      1: 'Ethereum',
      137: 'Polygon',
      8453: 'Base'
    }
    return networks[id] || `Chain ${id}`
  }
  const networkName = getNetworkName(typeof chainId === 'number' ? chainId : null)

  // Track client-side mounting for portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Get auth token for notifications
  useEffect(() => {
    const getToken = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setAuthToken(session?.access_token || null)
    }
    getToken()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthToken(session?.access_token || null)
    })
    
    return () => subscription.unsubscribe()
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

  const handleConnect = () => {
    // Use AppKit modal for all wallet connections
    // AppKit handles mobile deep links, QR codes, and 300+ wallets automatically
    openAppKit({ view: 'Connect' })
  }

  
  const formatBalance = (bal: string | null) => {
    if (!bal) return '0.00'
    const num = parseFloat(bal)
    if (num < 0.01) return '<0.01'
    return num.toFixed(2)
  }

  const isActiveLink = (href: string) => pathname === href

  const headerContent = (
    <header data-testid="main-header" className="sticky top-0 z-50 border-b border-white/10 bg-patriotic-navy/95 backdrop-blur-lg">
      <div className="container">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <Link 
            href="/" 
            data-testid="logo-link"
            className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <span className="text-2xl">🎖️</span>
            <span className="hidden xs:inline">PatriotPledge</span>
            <span className="xs:hidden">PP</span>
            <span className="text-patriotic-red hidden sm:inline">NFTs</span>
          </Link>

          {/* Desktop Navigation */}
          <nav data-testid="desktop-nav" className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                data-testid={`nav-link-${link.href.replace('/', '')}`}
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

          {/* Right Side - Theme, Account, Wallet & Mobile Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle */}
            <ThemeToggle />
            
            {/* Notifications - Only show when logged in */}
            {authToken && <NotificationCenter token={authToken} />}
            
            {/* User Account */}
            <UserAccountPortal />
            
            {/* Wallet Button */}
            <div className="relative" ref={walletDropdownRef}>
              {isConnected && address ? (
                <>
                  <button
                    onClick={() => setWalletDropdownOpen(!walletDropdownOpen)}
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
                        <div className="text-xs text-white/50 mb-1">Current Network</div>
                        <div className={`flex items-center gap-2 ${isOnSupportedChain ? 'text-green-400' : 'text-red-400'}`}>
                          <span className={`w-2 h-2 rounded-full ${isOnSupportedChain ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`}></span>
                          {networkName}
                          {isOnSepolia && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">Testnet</span>}
                        </div>
                        
                        {/* Network Switch Buttons */}
                        <div className="mt-3 space-y-2">
                          <div className="text-xs text-white/50">Switch Network</div>
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={() => { switchToBlockDAG(); setWalletDropdownOpen(false); }}
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
                              onClick={() => { switchToSepolia(); setWalletDropdownOpen(false); }}
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
                        {!isOnSupportedChain && (
                          <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <div className="text-xs text-red-400 flex items-center gap-1">
                              ⚠️ Unsupported network. Please switch.
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-2">
                        <button
                          onClick={() => { disconnect(); setWalletDropdownOpen(false); }}
                          data-testid="disconnect-wallet-btn"
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
                  data-testid="connect-wallet-btn"
                  aria-label="Connect wallet"
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
              data-testid="mobile-menu-btn"
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
              onClick={() => { openAppKit({ view: 'Connect' }); setMobileMenuOpen(false); }}
              disabled={isConnecting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-patriotic-red hover:bg-red-600 text-white rounded-xl text-base font-medium transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Connect Wallet
            </button>
            <p className="text-xs text-white/40 text-center mt-2">
              300+ wallets supported via WalletConnect
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
          {/* All wallet options now handled by AppKit modal */}
          <button
            onClick={() => {
              setWalletModalOpen(false)
              openAppKit({ view: 'Connect' })
            }}
            className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 border border-blue-500/30 rounded-xl transition-colors"
          >
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🔗</span>
            </div>
            <div className="text-left">
              <div className="font-semibold text-white">Connect Wallet</div>
              <div className="text-xs text-white/50">300+ wallets supported</div>
            </div>
          </button>

          <p className="text-xs text-white/50 text-center mt-2">
            MetaMask, Trust Wallet, Coinbase, Rainbow, and more
          </p>
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
