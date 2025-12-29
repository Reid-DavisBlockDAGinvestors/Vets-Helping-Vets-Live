/**
 * Campaign Submission Module
 * 
 * Refactored from the monolithic StoryForm.tsx (54KB, 1233 lines)
 * into a modular structure following ISP principles.
 * 
 * Structure:
 * - types.ts - All TypeScript interfaces
 * - hooks/ - Form state, draft persistence, image upload, AI assist
 * - FormSection.tsx - Reusable section wrapper
 * - AIAssistButtons.tsx - AI writing assist buttons
 * 
 * Usage:
 * ```typescript
 * import { useSubmissionForm, FormSection } from '@/components/submission'
 * ```
 */

// Types
export * from './types'

// Hooks
export {
  useSubmissionForm,
  useDraftPersistence,
  useImageUpload,
  useAIAssist,
  clearDraft,
} from './hooks'
export type { UseSubmissionFormReturn } from './hooks'

// Components
export { FormSection } from './FormSection'
export { AIAssistButtons } from './AIAssistButtons'
