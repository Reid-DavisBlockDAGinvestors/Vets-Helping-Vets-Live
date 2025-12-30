/**
 * NavBar Module
 * 
 * Modular structure for navigation bar
 * Following ISP principles - small, focused components
 * 
 * Structure:
 * - types.ts - TypeScript interfaces, constants, and utilities
 * - hooks/useNavbarState.ts - UI state management
 * - WalletButton.tsx - Wallet connection button and dropdown
 * - WalletModal.tsx - Wallet options modal
 * - MobileMenu.tsx - Mobile navigation menu
 */

// Types and utilities
export { NAV_LINKS, formatBalance, isActiveLink } from './types'
export type { NavLink, WalletState, NavBarUIState } from './types'

// Hooks
export { useNavbarState } from './hooks/useNavbarState'
export type { UseNavbarStateReturn } from './hooks/useNavbarState'

// Components
import WalletButton from './WalletButton'
import WalletModal from './WalletModal'
import MobileMenu from './MobileMenu'
export { WalletButton, WalletModal, MobileMenu }
