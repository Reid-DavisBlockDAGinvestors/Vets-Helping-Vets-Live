/**
 * CampaignUpdate Module
 * 
 * Modular structure for campaign update forms
 * Following ISP principles - small, focused components
 * 
 * Structure:
 * - types.ts - TypeScript interfaces, constants, and utilities
 * - hooks/useMediaUpload.ts - Media file handling
 * - hooks/useCampaignUpdateForm.ts - Form state and submission
 * - MediaPreview.tsx - Media preview grid component
 */

// Types and utilities
export * from './types'

// Hooks
export { useMediaUpload, useCampaignUpdateForm } from './hooks'
export type { UseMediaUploadReturn, UseCampaignUpdateFormReturn } from './hooks'

// Components
export { default as MediaPreview } from './MediaPreview'
