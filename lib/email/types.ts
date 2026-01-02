/**
 * Email Types - All email payload interfaces
 * Follows ISP - each interface focused on a single email type
 */

export interface EmailPayload {
  to: string
  subject: string
  html: string
}

export interface PurchaseReceiptData {
  email: string
  campaignTitle: string
  campaignId: number
  tokenId?: number
  editionNumber?: number
  amountCrypto: number
  amountUSD?: number
  txHash: string
  walletAddress: string
  imageUrl?: string
  chainId?: number
  /** @deprecated Use amountCrypto instead */
  amountBDAG?: number
}

export interface SubmissionConfirmData {
  email: string
  submissionId: string
  title: string
  creatorName?: string
}

export interface CampaignApprovedData {
  email: string
  title: string
  campaignId: number
  creatorName?: string
  imageUrl?: string
  txHash?: string
}

export interface CampaignRejectedData {
  email: string
  title: string
  creatorName?: string
  reason: string
}

export interface ProposalVotingOpenData {
  email: string
  proposalId: string
  proposalTitle: string
  proposalDescription: string
  recipientName?: string
}

export interface VoteConfirmationData {
  email: string
  proposalTitle: string
  votedYes: boolean
  voterName?: string
}

export interface ProposalSubmittedData {
  email: string
  proposalId: string
  proposalTitle: string
  submitterName?: string
}

export interface AdminNewSubmissionData {
  submissionId: string
  title: string
  creatorName?: string
  creatorEmail: string
  category: string
  goal?: number
  adminEmails?: string[]
}

export interface CreatorPurchaseNotificationData {
  creatorEmail: string
  creatorName?: string
  campaignTitle: string
  campaignId: number
  donorWallet: string
  amountBDAG: number
  amountUSD?: number
  tokenId?: number
  editionNumber?: number
  totalRaised?: number
  goalAmount?: number
  txHash: string
}

export interface PasswordResetData {
  email: string
  resetLink: string
  displayName?: string
}

export interface BugReportStatusData {
  email: string
  reportId: string
  reportTitle: string
  oldStatus: string
  newStatus: string
  resolutionNotes?: string
  adminMessage?: string
}

export interface BugReportMessageData {
  email: string
  reportId: string
  reportTitle: string
  senderName: string
  message: string
}

export interface UpdateApprovedData {
  email: string
  campaignTitle: string
  campaignId: number
  updateTitle: string
  creatorName?: string
}
