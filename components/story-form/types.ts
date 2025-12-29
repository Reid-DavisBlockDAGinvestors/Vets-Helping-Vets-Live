/**
 * StoryForm Types
 * 
 * TypeScript interfaces for the story submission form
 * Following ISP - small, focused interfaces
 */

import type { CategoryId } from '@/lib/categories'

export interface VerificationDocs {
  selfie?: { path: string; filename: string }
  idFront?: { path: string; filename: string }
  idBack?: { path: string; filename: string }
  supporting: { path: string; filename: string; category: string }[]
}

export interface ContactInfo {
  firstName: string
  lastName: string
  company: string
  phone: string
  email: string
  wallet: string
}

export interface AddressInfo {
  streetAddress: string
  city: string
  stateProvince: string
  zipCode: string
  country: string
}

export interface StoryContent {
  title: string
  background: string
  need: string
  fundsUsage: string
  goal: number
  category: CategoryId
}

export interface MediaState {
  image: string | null
  mediaMime: string | null
  imageLoading: boolean
}

export interface PreviewState {
  previewUri: string | null
  previewBackend: string | null
  previewImageUri: string | null
}

export interface SubmissionState {
  isSubmitted: boolean
  submittedId: string | null
  isSubmitting: boolean
}

export interface VerificationState {
  verificationDocs: VerificationDocs
  verificationComplete: boolean
  diditSessionId: string | null
  diditStatus: string
}

export interface FormDraft {
  category: CategoryId
  title: string
  background: string
  need: string
  fundsUsage: string
  goal: number
  firstName: string
  lastName: string
  company: string
  phone: string
  streetAddress: string
  city: string
  stateProvince: string
  zipCode: string
  country: string
  wallet: string
  email: string
  image: string | null
  mediaMime: string | null
  diditSessionId: string | null
  diditStatus: string
  verificationComplete: boolean
}

export interface StoryFormProps {
  editSubmissionId?: string
}

export interface FormSectionProps {
  sectionNumber: number
  title: string
  subtitle: string
  children: React.ReactNode
  variant?: 'default' | 'orange'
}

export interface AIAssistButtonsProps {
  fieldValue: string
  fieldName: 'background' | 'need' | 'fundsUsage' | 'title'
  titleValue: string
  aiBusy: boolean
  onAICall: (field: string, mode: 'improve' | 'expand' | 'generate') => void
}

export type MessageType = 'success' | 'error' | 'info'

export interface FormMessage {
  text: string
  type: MessageType
}
