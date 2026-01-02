/**
 * Admin Campaigns Module
 * 
 * Refactored from the monolithic AdminCampaignHub.tsx (111KB)
 * into smaller, focused components following ISP principles.
 * 
 * Structure:
 * - types.ts - All TypeScript interfaces
 * - hooks/ - Data fetching and actions
 * - modals/ - Modal components
 * - UI components - Stats, Filters, StatusBadge, Card, List
 */

// Types
export * from './types'

// Hooks
export { useCampaigns, useCampaignActions } from './hooks'

// UI Components
export { CampaignStatsGrid } from './CampaignStatsGrid'
export { CampaignFilters } from './CampaignFilters'
export { StatusBadge, UpdateStatusBadge } from './StatusBadge'
export { CampaignCard } from './CampaignCard'
export { CampaignList } from './CampaignList'

// Modals
export { ApprovalModal, RejectModal, DeleteModal } from './modals'
export { EditModal } from './EditModal'
