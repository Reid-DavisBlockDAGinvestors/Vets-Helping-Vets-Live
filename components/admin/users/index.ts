/**
 * Admin Users Module
 * 
 * Refactored from the monolithic AdminUsers.tsx (652 lines)
 * into a modular structure following ISP principles.
 * 
 * Structure:
 * - types.ts - All TypeScript interfaces
 * - hooks/ - Users fetching, user details
 * - UserTable.tsx - Desktop table view
 * - UserCard.tsx - Mobile card view
 * - UserDetailModal.tsx - User detail modal with tabs
 * 
 * Usage:
 * ```typescript
 * import { useUsers, useUserDetails, UserTable, UserCard } from '@/components/admin/users'
 * ```
 */

// Types
export * from './types'

// Hooks
export { useUsers } from './hooks/useUsers'
export { useUserDetails } from './hooks/useUserDetails'

// Components
export { UserTable } from './UserTable'
export { UserCard } from './UserCard'
export { UserDetailModal } from './UserDetailModal'
