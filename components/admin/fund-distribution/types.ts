/**
 * Fund Distribution Types
 * Following Interface Segregation Principle (ISP)
 * Each interface is small, focused, and serves a single purpose
 */

// ============ Core Data Types ============

export type DistributionType = 'funds' | 'gifts' | 'refund' | 'combined'
export type DistributionStatus = 'pending' | 'processing' | 'confirmed' | 'failed'
export type NativeCurrency = 'BDAG' | 'ETH' | 'MATIC'

export interface TipSplit {
  submitterPercent: number  // 0-100
  nonprofitPercent: number  // 0-100
}

export interface CampaignBalance {
  campaignId: string
  title: string
  status: string
  chainId: number
  chainName: string
  isTestnet: boolean
  contractVersion: string
  immediatePayoutEnabled: boolean
  // Wallets
  submitterWallet: string | null
  nonprofitWallet: string | null
  // Tip split config
  tipSplitSubmitterPct: number
  tipSplitNonprofitPct: number
  // Gross amounts
  grossRaisedUsd: number
  grossRaisedNative: number
  // Tips
  tipsReceivedUsd: number
  tipsReceivedNative: number
  // Distribution status
  totalDistributed: number
  tipsDistributed: number
  lastDistributionAt: string | null
  // Pending
  pendingDistributionNative: number
  pendingTipsNative: number
  // Currency
  nativeCurrency: NativeCurrency
  // Stats
  distributionCount: number
}

export interface Distribution {
  id: string
  campaignId: string
  chainId: number
  txHash: string | null
  distributionType: DistributionType
  // Amounts
  totalAmount: number
  submitterAmount: number
  nonprofitAmount: number
  platformFee: number
  // USD
  totalAmountUsd: number | null
  submitterAmountUsd: number | null
  nonprofitAmountUsd: number | null
  // Split used
  tipSplitSubmitterPct: number
  tipSplitNonprofitPct: number
  // Addresses
  submitterWallet: string | null
  nonprofitWallet: string | null
  // Status
  status: DistributionStatus
  initiatedBy: string | null
  initiatedAt: string
  confirmedAt: string | null
  errorMessage: string | null
  notes: string | null
  nativeCurrency: NativeCurrency
}

export interface TipSplitConfig {
  campaignId: string
  submitterPercent: number
  nonprofitPercent: number
  updatedAt: string
  updatedBy: string | null
}

// ============ ISP Interfaces ============

/** Interface for reading campaign balances */
export interface ICampaignBalanceReader {
  getCampaignBalance(campaignId: string): Promise<CampaignBalance | null>
  getAllCampaignBalances(filters?: BalanceFilters): Promise<CampaignBalance[]>
}

/** Interface for distributing funds */
export interface IFundDistributor {
  distributeFunds(params: DistributionParams): Promise<DistributionResult>
  distributeTips(params: TipDistributionParams): Promise<DistributionResult>
}

/** Interface for reading distribution history */
export interface IDistributionHistoryReader {
  getDistributionHistory(campaignId: string): Promise<Distribution[]>
  getAllDistributions(filters?: HistoryFilters): Promise<Distribution[]>
}

/** Interface for tip split configuration */
export interface ITipSplitManager {
  getTipSplit(campaignId: string): Promise<TipSplit>
  setTipSplit(campaignId: string, split: TipSplit): Promise<void>
}

// ============ Request/Response Types ============

export interface BalanceFilters {
  chainId?: number
  isTestnet?: boolean
  hasPendingFunds?: boolean
  hasPendingTips?: boolean
}

export interface HistoryFilters {
  campaignId?: string
  chainId?: number
  status?: DistributionStatus
  type?: DistributionType
  limit?: number
}

export interface DistributionParams {
  campaignId: string
  amount: number
  recipient: 'submitter' | 'nonprofit' | 'both'
}

export interface TipDistributionParams {
  campaignId: string
  tipSplit: TipSplit
}

export interface DistributionResult {
  success: boolean
  distributionId?: string
  txHash?: string
  error?: string
}

// ============ Component Props (following ISP) ============

export interface CampaignBalanceCardProps {
  balance: CampaignBalance
  onDistributeFunds: (campaignId: string) => void
  onDistributeGifts: (campaignId: string) => void
  onDistributeAll: (campaignId: string) => void
  onViewHistory: (campaignId: string) => void
  onEditGiftSplit: (campaignId: string) => void
}

export interface CampaignBalanceListProps {
  balances: CampaignBalance[]
  isLoading: boolean
  onDistributeFunds: (campaignId: string) => void
  onDistributeGifts: (campaignId: string) => void
  onDistributeAll: (campaignId: string) => void
  onViewHistory: (campaignId: string) => void
  onEditGiftSplit: (campaignId: string) => void
}

export interface TipSplitSliderProps {
  value: TipSplit
  onChange: (split: TipSplit) => void
  disabled?: boolean
}

export interface DistributionFormProps {
  balance: CampaignBalance
  type: 'funds' | 'gifts' | 'combined'
  onSubmit: (params: DistributionParams | TipDistributionParams) => void
  onCancel: () => void
  isSubmitting: boolean
}

export interface DistributionConfirmModalProps {
  isOpen: boolean
  balance: CampaignBalance
  params: DistributionParams | TipDistributionParams
  onConfirm: () => void
  onCancel: () => void
  isProcessing: boolean
}

export interface DistributionHistoryProps {
  distributions: Distribution[]
  isLoading: boolean
  chainId?: number
}

export interface NetworkSelectorProps {
  value: number | 'all'
  onChange: (chainId: number | 'all') => void
  includeAll?: boolean
}
