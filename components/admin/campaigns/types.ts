/**
 * Admin Campaign Types - Following ISP principles
 * Each interface is focused on a single responsibility
 */

export type CampaignStatus = 'pending' | 'approved' | 'minted' | 'rejected' | 'pending_onchain'
export type UpdateStatus = 'pending' | 'approved' | 'rejected'
export type SortOption = 'recent' | 'updates' | 'pending' | 'goal'
export type StatusFilter = 'all' | CampaignStatus

/**
 * Campaign update from Living NFT
 */
export interface CampaignUpdate {
  id: string
  title: string | null
  story_update: string | null
  funds_utilization: string | null
  benefits: string | null
  still_needed: string | null
  media_uris: string[] | null
  status: UpdateStatus
  reviewer_notes: string | null
  reviewed_at: string | null
  created_at: string
}

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
 * On-chain campaign statistics
 */
export interface OnchainStats {
  editionsMinted: number
  maxEditions: number
  remainingEditions: number | null
  progressPercent: number
  nftSalesUSD: number
  tipsUSD: number
  totalRaisedUSD: number
  netRaisedUSD: number
}

/**
 * Full campaign data structure
 */
export interface Campaign {
  id: string
  campaign_id: number | null
  title: string
  story: string | null
  image_uri: string
  category: string
  goal: number
  creator_wallet: string
  creator_email: string | null
  creator_name: string | null
  creator_phone: string | null
  creator_address: CreatorAddress | null
  status: CampaignStatus
  created_at: string
  metadata_uri: string | null
  verification_status: string | null
  verification_selfie: string | null
  verification_id_front: string | null
  verification_id_back: string | null
  verification_documents: any[] | null
  admin_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  nft_price: number | null
  nft_editions: number | null
  num_copies: number | null
  tx_hash: string | null
  contract_address: string | null
  contract_version: string | null
  onchainStats: OnchainStats | null
  updates: CampaignUpdate[]
  pendingUpdates: number
  approvedUpdates: number
}

/**
 * Campaign filter state
 */
export interface CampaignFilters {
  searchQuery: string
  statusFilter: StatusFilter
  sortBy: SortOption
  hasUpdatesOnly: boolean
}

/**
 * Approval form data
 */
export interface ApprovalFormData {
  goal: number
  nft_editions: number
  nft_price: number
  creator_wallet: string
  benchmarks: string
}

/**
 * Edit form data
 */
export interface EditFormData {
  title: string
  story: string
  category: string
  goal: number
  status: string
  creator_name: string
  creator_email: string
  creator_phone: string
  creator_wallet: string
  creator_address: CreatorAddress
  verification_status: string
  nft_price: number
  nft_editions: number
}

/**
 * Campaign stats summary
 */
export interface CampaignStats {
  total: number
  minted: number
  pendingCampaigns: number
  withUpdates: number
  pendingUpdates: number
  totalUpdates: number
}

/**
 * Props interfaces following ISP
 */
export interface CampaignCardProps {
  campaign: Campaign
  isExpanded: boolean
  onToggle: () => void
  onApprove: () => void
  onReject: () => void
  onEdit: () => void
  onDelete: () => void
  onVerify: () => void
  onFix: () => void
  isApproving: boolean
  isVerifying: boolean
  isFixing: boolean
}

export interface CampaignFiltersProps {
  filters: CampaignFilters
  onFiltersChange: (filters: Partial<CampaignFilters>) => void
  resultCount: number
  totalCount: number
}

export interface CampaignStatsGridProps {
  stats: CampaignStats
}

export interface CampaignListProps {
  campaigns: Campaign[]
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
  onApprove: (campaign: Campaign) => void
  onReject: (campaign: Campaign) => void
  onEdit: (campaign: Campaign) => void
  onDelete: (campaign: Campaign) => void
  onVerify: (campaign: Campaign) => void
  onFix: (campaign: Campaign) => void
  approvingId: string | null
  verifyingId: string | null
  fixingId: string | null
}

export interface EditModalProps {
  campaign: Campaign | null
  isOpen: boolean
  onClose: () => void
  onSave: (data: EditFormData) => Promise<void>
  isSaving: boolean
}

export interface ApprovalModalProps {
  campaign: Campaign | null
  isOpen: boolean
  onClose: () => void
  onApprove: (data: ApprovalFormData) => Promise<void>
  isApproving: boolean
}

export interface RejectModalProps {
  campaign: Campaign | null
  isOpen: boolean
  onClose: () => void
  onReject: (reason: string) => Promise<void>
  isRejecting: boolean
}

export interface DeleteModalProps {
  campaign: Campaign | null
  isOpen: boolean
  onClose: () => void
  onDelete: () => Promise<void>
  isDeleting: boolean
}
