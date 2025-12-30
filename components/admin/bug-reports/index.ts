/**
 * AdminBugReports Module
 * 
 * Modular structure for bug report management
 * Following ISP principles - small, focused components
 * 
 * Structure:
 * - types.ts - TypeScript interfaces and constants
 * - hooks/useBugReports.ts - Data fetching and CRUD operations
 * - BugReportCard.tsx - Individual report card UI
 * - BugReportStats.tsx - Stats grid UI
 */

// Types and utilities
export * from './types'

// Hooks
export { useBugReports } from './hooks'
export type { UseBugReportsReturn } from './hooks'

// Components
export { BugReportCard } from './BugReportCard'
export { BugReportStats } from './BugReportStats'
