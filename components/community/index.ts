/**
 * Community Module
 * 
 * Modular structure for community hub functionality
 * Following ISP principles - small, focused components
 * 
 * Structure:
 * - types.ts - All TypeScript interfaces
 * - hooks/ - Data fetching and state management
 * - UI components (to be added)
 */

// Types
export * from './types'

// Hooks
export { usePosts } from './hooks/usePosts'
export { useComments } from './hooks/useComments'
