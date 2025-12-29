/**
 * User Account Module
 * 
 * Refactored from the monolithic UserAccountPortal.tsx (33KB, 793 lines)
 * into a modular structure following ISP principles.
 * 
 * Structure:
 * - types.ts - All TypeScript interfaces and role badge config
 * - hooks/ - Account auth, profile editing
 * - AuthModal.tsx - Login/Signup/Forgot password modal
 * - WalletSection.tsx - Wallet display in dropdown
 * - UserAvatar.tsx - Avatar with fallback
 * - RoleBadge.tsx - Role display badge
 * 
 * Usage:
 * ```typescript
 * import { useAccountAuth, AuthModal, UserAvatar } from '@/components/account'
 * ```
 */

// Types
export * from './types'

// Hooks
export { useAccountAuth } from './hooks/useAccountAuth'
export { useProfileEditor } from './hooks/useProfileEditor'

// Components
export { AuthModal } from './AuthModal'
export { WalletSection } from './WalletSection'
export { UserAvatar } from './UserAvatar'
export { RoleBadge } from './RoleBadge'
