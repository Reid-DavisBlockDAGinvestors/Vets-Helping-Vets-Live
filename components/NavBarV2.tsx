'use client'

/**
 * NavBarV2 - Modular Navigation Bar
 * 
 * Orchestrator component using navbar modules
 * Following ISP - delegates to focused hooks and components
 * 
 * Original NavBar: 464 lines
 * Refactored NavBarV2: ~180 lines (orchestrator pattern)
 */

import Link from 'next/link'
import { useWallet } from '@/hooks/useWallet'
import UserAccountPortal from './UserAccountPortalV2'
import ThemeToggle from './ThemeToggle'
import { useNavbarState } from './navbar/hooks/useNavbarState'
import { NAV_LINKS, isActiveLink } from './navbar/types'
import WalletButton from './navbar/WalletButton'
import WalletModal from './navbar/WalletModal'
import MobileMenu from './navbar/MobileMenu'

export default function NavBarV2() {
  const nav = useNavbarState()
  const wallet = useWallet()

  const handleConnect = async () => {
    // On mobile without injected wallet, directly open MetaMask app
    if (wallet.isMobile && !wallet.hasInjectedWallet) {
      wallet.openInMetaMaskBrowser()
      return
    }
    
    // On desktop without wallet, show options modal
    if (!wallet.hasInjectedWallet) {
      nav.setWalletModalOpen(true)
      return
    }
    
    // Has injected wallet, connect normally
    await wallet.connectAuto()
  }

  const handleDisconnect = () => {
    wallet.disconnect()
    nav.setWalletDropdownOpen(false)
  }

  const handleSwitchNetwork = () => {
    wallet.switchToBlockDAG()
    nav.setWalletDropdownOpen(false)
  }

  return (
    <>
      <header data-testid="main-header" className="sticky top-0 z-50 border-b border-white/10 bg-patriotic-navy/95 backdrop-blur-lg">
        <div className="container">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <Link href="/" data-testid="logo-link"
              className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 hover:opacity-90 transition-opacity">
              <span className="text-2xl">🎖️</span>
              <span className="hidden xs:inline">PatriotPledge</span>
              <span className="xs:hidden">PP</span>
              <span className="text-patriotic-red hidden sm:inline">NFTs</span>
            </Link>

            {/* Desktop Navigation */}
            <nav data-testid="desktop-nav" className="hidden lg:flex items-center gap-1">
              {NAV_LINKS.map(link => (
                <Link key={link.href} href={link.href} data-testid={`nav-link-${link.href.replace('/', '')}`}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActiveLink(link.href, nav.pathname)
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}>
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right Side - Theme, Account, Wallet & Mobile Menu */}
            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <UserAccountPortal />
              
              <WalletButton
                address={wallet.address}
                isConnected={wallet.isConnected}
                isConnecting={wallet.isConnecting}
                isOnBlockDAG={wallet.isOnBlockDAG}
                balance={wallet.balance}
                error={wallet.error}
                walletDropdownOpen={nav.walletDropdownOpen}
                walletDropdownRef={nav.walletDropdownRef}
                onToggleDropdown={nav.toggleWalletDropdown}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onSwitchNetwork={handleSwitchNetwork}
              />

              {/* Mobile Menu Button */}
              <button ref={nav.hamburgerButtonRef} onClick={nav.toggleMobileMenu} data-testid="mobile-menu-btn"
                className="lg:hidden p-3 -mr-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors touch-manipulation select-none"
                aria-label="Toggle menu" aria-expanded={nav.mobileMenuOpen} type="button">
                {nav.mobileMenuOpen ? (
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

      {/* Mobile Menu Portal */}
      <MobileMenu
        isOpen={nav.mobileMenuOpen}
        mounted={nav.mounted}
        pathname={nav.pathname}
        mobileMenuRef={nav.mobileMenuRef}
        onClose={() => nav.setMobileMenuOpen(false)}
        address={wallet.address}
        isConnected={wallet.isConnected}
        isConnecting={wallet.isConnecting}
        isOnBlockDAG={wallet.isOnBlockDAG}
        balance={wallet.balance}
        onConnect={wallet.connectAuto}
        onSwitchNetwork={wallet.switchToBlockDAG}
      />

      {/* Wallet Options Modal */}
      <WalletModal
        isOpen={nav.walletModalOpen && nav.mounted}
        onClose={() => nav.setWalletModalOpen(false)}
        onOpenMetaMask={() => { nav.setWalletModalOpen(false); wallet.openInMetaMaskBrowser() }}
        onInstallMetaMask={() => { nav.setWalletModalOpen(false); window.open('https://metamask.io/download/', '_blank') }}
        onWalletConnect={() => { nav.setWalletModalOpen(false); wallet.connectWalletConnect() }}
      />
    </>
  )
}
