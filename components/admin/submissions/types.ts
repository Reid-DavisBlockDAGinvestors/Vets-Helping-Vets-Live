/**
 * Admin Submissions Module Types - Following ISP principles
 */

/**
 * Submission status
 */
export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'minted'

/**
 * Creator address structure
 */
export interface CreatorAddress {
  street?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}

/**
 * Verification document
 */
export interface VerificationDocument {
  path: string
  filename: string
  category?: string
}

/**
 * Submission data structure
 */
export interface Submission {
  id: string
  created_at?: string
  title?: string
  story?: string
  category: string
  goal?: number
  creator_wallet: string
  creator_email: string
  creator_name?: string
  creator_phone?: string
  creator_address?: CreatorAddress
  image_uri?: string
  metadata_uri: string
  status: SubmissionStatus
  reviewer_notes?: string
  token_id?: number
  campaign_id?: number
  tx_hash?: string
  price_per_copy?: number | null
  num_copies?: number | null
  benchmarks?: string[] | null
  contract_address?: string | null
  visible_on_marketplace?: boolean
  verification_selfie?: string | null
  verification_id_front?: string | null
  verification_id_back?: string | null
  verification_documents?: VerificationDocument[] | null
  verification_status?: string
  didit_session_id?: string | null
  didit_status?: string | null
}

/**
 * Submissions filter state
 */
export interface SubmissionsFilter {
  contractAddress: string | 'all'
}

/**
 * Submission list props
 */
export interface SubmissionListProps {
  submissions: Submission[]
  usernames: Record<string, string>
  selected: Submission | null
  onSelect: (submission: Submission) => void
  title: string
  emptyMessage: string
}

/**
 * Submission card props
 */
export interface SubmissionCardProps {
  submission: Submission
  username: string
  isSelected: boolean
  onClick: () => void
}

/**
 * Submission detail props
 */
export interface SubmissionDetailProps {
  submission: Submission
  benchmarksText: string
  onBenchmarksChange: (text: string) => void
  onSubmissionChange: (updates: Partial<Submission>) => void
  onSave: () => void
  onReject: () => void
  onApprove: () => void
  onDelete: () => void
  busy: boolean
  message: string
}

/**
 * KYC section props
 */
export interface KYCSectionProps {
  diditStatus: string | null
  diditSessionId: string | null
}

/**
 * Verification docs section props
 */
export interface VerificationDocsSectionProps {
  selfie: string | null
  idFront: string | null
  idBack: string | null
  documents: VerificationDocument[] | null
}

/**
 * Contact info section props
 */
export interface ContactInfoSectionProps {
  name: string | undefined
  phone: string | undefined
  address: CreatorAddress | undefined
}
