/**
 * Campaign Submission Types - Following ISP principles
 * Each interface is focused on a single responsibility
 */

import { CategoryId } from '@/lib/categories'

/**
 * Verification document structure
 */
export interface VerificationDoc {
  path: string
  filename: string
  category?: string
}

export interface VerificationDocs {
  selfie?: VerificationDoc
  idFront?: VerificationDoc
  idBack?: VerificationDoc
  supporting: (VerificationDoc & { category: string })[]
}

/**
 * Contact information
 */
export interface ContactInfo {
  firstName: string
  lastName: string
  company: string
  phone: string
  email: string
  wallet: string
}

/**
 * Address information
 */
export interface AddressInfo {
  streetAddress: string
  city: string
  stateProvince: string
  zipCode: string
  country: string
}

/**
 * Campaign story sections
 */
export interface StoryContent {
  background: string
  need: string
  fundsUsage: string
}

/**
 * Campaign basic info
 */
export interface CampaignInfo {
  category: CategoryId
  title: string
  goal: number
}

/**
 * Media/image state
 */
export interface MediaState {
  image: string | null
  mediaMime: string | null
  imageLoading: boolean
}

/**
 * Preview state
 */
export interface PreviewState {
  previewUri: string | null
  previewBackend: string | null
  previewImageUri: string | null
}

/**
 * Verification/KYC state
 */
export interface VerificationState {
  verificationComplete: boolean
  diditSessionId: string | null
  diditStatus: string
  verificationDocs: VerificationDocs
}

/**
 * Message state for user feedback
 */
export interface MessageState {
  message: string
  type: 'success' | 'error' | 'info'
}

/**
 * Complete form state
 */
export interface SubmissionFormState {
  campaign: CampaignInfo
  story: StoryContent
  contact: ContactInfo
  address: AddressInfo
  media: MediaState
  preview: PreviewState
  verification: VerificationState
}

/**
 * Form section props interface
 */
export interface FormSectionProps {
  sectionNumber: number
  title: string
  description: string
  children: React.ReactNode
}

/**
 * AI assist field types
 */
export type AIFieldType = 'background' | 'need' | 'fundsUsage' | 'title'
export type AIMode = 'improve' | 'expand' | 'generate'

/**
 * Draft data for localStorage persistence
 */
export interface DraftData {
  category?: CategoryId
  title?: string
  background?: string
  need?: string
  fundsUsage?: string
  goal?: number
  firstName?: string
  lastName?: string
  company?: string
  phone?: string
  email?: string
  wallet?: string
  streetAddress?: string
  city?: string
  stateProvince?: string
  zipCode?: string
  country?: string
  image?: string
  mediaMime?: string
  diditSessionId?: string
  diditStatus?: string
  verificationComplete?: boolean
}

/**
 * Submission payload
 */
export interface SubmissionPayload {
  title: string
  story: string
  category: CategoryId
  goal: number
  creator_wallet: string
  creator_email: string
  creator_name: string
  creator_first_name: string
  creator_last_name: string
  company: string | null
  creator_phone: string
  creator_address: {
    street: string
    city: string
    state: string
    zip: string
    country: string
  } | null
  image_uri: string
  metadata_uri: string
  verification_selfie: string | null
  verification_id_front: string | null
  verification_id_back: string | null
  verification_documents: { url: string; type: string; name: string }[]
  didit_session_id: string | null
  didit_status: string
}
