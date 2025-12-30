/**
 * StoryForm Module
 * Barrel export for story form components and hooks
 * 
 * Modular structure for story submission form
 * Following ISP principles - small, focused components
 * 
 * Structure:
 * - types.ts - All TypeScript interfaces
 * - hooks/ - Form state and submission logic
 */

// Types
export * from './types'

// Hooks
export { useStoryForm } from './hooks/useStoryForm'
export { useSubmission } from './hooks/useSubmission'

// Components
export { FormSection } from './FormSection'
export { AIButtons } from './AIButtons'
