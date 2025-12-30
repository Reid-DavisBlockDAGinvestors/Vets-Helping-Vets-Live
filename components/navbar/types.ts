/**
 * NavBar Types
 * 
 * TypeScript interfaces and constants for navigation
 * Following ISP - small, focused interfaces
 */

export interface NavLink {
  href: string
  label: string
  emoji?: string
}

export const NAV_LINKS: NavLink[] = [
  { href: '/marketplace', label: 'Marketplace', emoji: '🏪' },
  { href: '/community', label: 'Community', emoji: '🏛️' },
  { href: '/submit', label: 'Submit Story', emoji: '📝' },
  { href: '/dashboard', label: 'Dashboard', emoji: '📊' },
  { href: '/governance', label: 'Governance', emoji: '🗳️' },
  { href: '/admin', label: 'Admin', emoji: '⚙️' },
]

export interface WalletState {
  address: string | null
  isConnected: boolean
  isConnecting: boolean
  isOnBlockDAG: boolean
  balance: string | null
  error: string | null
}

export interface NavBarUIState {
  mobileMenuOpen: boolean
  walletDropdownOpen: boolean
  walletModalOpen: boolean
  mounted: boolean
}

/**
 * Format wallet balance for display
 */
export function formatBalance(bal: string | null): string {
  if (!bal) return '0.00'
  const num = parseFloat(bal)
  if (num < 0.01) return '<0.01'
  return num.toFixed(2)
}

/**
 * Check if a link is currently active
 */
export function isActiveLink(href: string, pathname: string): boolean {
  return pathname === href
}
