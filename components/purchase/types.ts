/**
 * Purchase Module Types - Following ISP principles
 * Strategy pattern for multiple payment methods
 */

/**
 * Payment method types
 */
export type PaymentMethod = 'card' | 'crypto' | 'other'
export type CryptoAsset = 'BDAG' | 'ETH' | 'BTC' | 'SOL' | 'XRP'
export type OtherPaymentProvider = 'paypal' | 'cashapp' | 'venmo'

/**
 * Purchase panel props
 */
export interface PurchasePanelProps {
  campaignId: string
  tokenId?: string
  pricePerNft?: number | null
  remainingCopies?: number | null
  isPendingOnchain?: boolean
  contractVersion?: string
  contractAddress?: string
}

/**
 * Purchase state
 */
export interface PurchaseState {
  quantity: number
  tipAmount: number
  customAmount: number
  email: string
  loading: boolean
  activeTab: PaymentMethod
  isMonthly: boolean
  asset: CryptoAsset
}

/**
 * Purchase result
 */
export interface PurchaseResult {
  success: boolean
  txHash?: string
  txHashes?: string[]
  quantity?: number
  mintedTokenIds?: number[]
  error?: string
}

/**
 * Crypto payment state
 */
export interface CryptoPaymentState {
  message: string
  txHash: string | null
  maxUsdAllowed: number | null
}

/**
 * Payment strategy interface - ISP pattern
 */
export interface IPaymentStrategy {
  name: string
  icon: string
  execute: (amount: number, options: PaymentOptions) => Promise<PaymentResult>
}

export interface PaymentOptions {
  email?: string
  campaignId: string
  tokenId?: string
  quantity?: number
  tipAmount?: number
  walletAddress?: string
  userId?: string
  contractAddress?: string
  contractVersion?: string
}

export interface PaymentResult {
  success: boolean
  txHash?: string
  mintedTokenIds?: number[]
  error?: string
  redirectUrl?: string
}

/**
 * Card payment specific
 */
export interface CardPaymentOptions extends PaymentOptions {
  isMonthly: boolean
}

/**
 * Crypto payment specific
 */
export interface CryptoPaymentOptions extends PaymentOptions {
  asset: CryptoAsset
  bdagAmount: number
  tipBdagAmount: number
}

/**
 * Amount calculation
 */
export interface AmountCalculation {
  nftSubtotal: number
  tipAmount: number
  totalAmount: number
  bdagAmount: number
  bdagTipAmount: number
}

/**
 * Quantity selector props
 */
export interface QuantitySelectorProps {
  quantity: number
  maxQuantity: number
  isSoldOut: boolean
  pricePerNft: number
  onQuantityChange: (quantity: number) => void
}

/**
 * Tip selector props
 */
export interface TipSelectorProps {
  tipAmount: number
  onTipChange: (amount: number) => void
}

/**
 * Payment tab props
 */
export interface PaymentTabsProps {
  activeTab: PaymentMethod
  onTabChange: (tab: PaymentMethod) => void
}

/**
 * Success display props
 */
export interface PurchaseSuccessProps {
  result: PurchaseResult
  contractAddress: string
}
