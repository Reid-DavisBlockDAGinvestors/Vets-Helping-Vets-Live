/**
 * BugReport Module
 * 
 * Modular structure for bug reporting functionality
 * Following ISP principles - small, focused components
 * 
 * Structure:
 * - types.ts - TypeScript interfaces, constants, and event emitter
 * - hooks/useBugReportForm.ts - Form state and submission logic
 */

// Types and utilities
export * from './types'

// Hooks
export { useBugReportForm } from './hooks'
export type { UseBugReportFormReturn } from './hooks'
