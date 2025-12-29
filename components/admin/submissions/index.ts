/**
 * Admin Submissions Module
 * 
 * Refactored from the monolithic AdminSubmissions.tsx (654 lines)
 * into a modular structure following ISP principles.
 * 
 * Structure:
 * - types.ts - All TypeScript interfaces
 * - hooks/ - Submissions fetching, actions (save, reject, approve, delete)
 * - SubmissionCard.tsx - Individual submission card
 * - KYCSection.tsx - KYC verification status display
 * - VerificationDocsSection.tsx - Verification documents display
 * - ContactInfoSection.tsx - Contact information display
 * 
 * Usage:
 * ```typescript
 * import { useSubmissions, useSubmissionActions, SubmissionCard } from '@/components/admin/submissions'
 * ```
 */

// Types
export * from './types'

// Hooks
export { useSubmissions } from './hooks/useSubmissions'
export { useSubmissionActions } from './hooks/useSubmissionActions'

// Components
export { SubmissionCard } from './SubmissionCard'
export { KYCSection } from './KYCSection'
export { VerificationDocsSection } from './VerificationDocsSection'
export { ContactInfoSection } from './ContactInfoSection'
