/**
 * StoryForm Module
 * 
 * Modular structure for story submission form
 * Following ISP principles - small, focused components
 * 
 * Structure:
 * - types.ts - All TypeScript interfaces
 * - hooks/ - Form state and submission logic
 * - FormSection.tsx - Reusable section wrapper
 */

// Types
export * from './types'

// Hooks
export { useStoryForm } from './hooks/useStoryForm'
export { useSubmission } from './hooks/useSubmission'

// UI Components
export { FormSection } from './FormSection'
