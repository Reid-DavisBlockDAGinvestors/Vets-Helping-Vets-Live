/**
 * Email Module
 * 
 * Refactored from the monolithic mailer.ts (35KB, 749 lines)
 * into a modular structure following ISP principles.
 * 
 * Structure:
 * - types.ts - All TypeScript interfaces
 * - config.ts - Centralized configuration
 * - wrapper.ts - Email HTML wrapper
 * - sender.ts - Core sending functionality
 * - templates/ - Individual email templates
 * 
 * Usage:
 * ```typescript
 * import { sendPurchaseReceipt, sendCampaignApproved } from '@/lib/email'
 * 
 * await sendPurchaseReceipt({ ... })
 * ```
 */

// Types
export * from './types'

// Config
export { EMAIL_CONFIG, STATUS_LABELS } from './config'

// Core
export { sendEmail } from './sender'
export { wrapEmail } from './wrapper'

// Templates
export {
  sendPurchaseReceipt,
  sendSubmissionConfirmation,
  sendCampaignApproved,
  sendCampaignRejected,
  sendProposalVotingOpen,
  sendVoteConfirmation,
  sendProposalSubmitted,
} from './templates'
