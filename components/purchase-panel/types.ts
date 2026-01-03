/**
 * PurchasePanel Types
 * 
 * TypeScript interfaces for the purchase flow
 * Following ISP - small, focused interfaces
 */

export type PaymentTab = 'card' | 'crypto' | 'other'
export type CryptoAsset = 'BDAG' | 'ETH' | 'BTC' | 'SOL' | 'XRP'

export interface PurchasePanelProps {
  campaignId: string
  tokenId?: string
  pricePerNft?: number | null
  remainingCopies?: number | null
  isPendingOnchain?: boolean
  contractVersion?: string
  contractAddress?: string
  chainId?: number
}

export interface PurchaseState {
  quantity: number
  tipAmount: number
  customAmount: number
  loading: boolean
  result: PurchaseResult | null
}

export interface PurchaseResult {
  success: boolean
  txHash?: string
  txHashes?: string[]
  quantity?: number
  mintedTokenIds?: number[]
  error?: string
}

export interface PaymentConfig {
  hasNftPrice: boolean
  pricePerNft: number | null
  nftSubtotal: number
  totalAmount: number
  bdagAmount: number
  bdagTipAmount: number
  isSoldOut: boolean
  maxQuantity: number
}

export interface WalletState {
  isConnected: boolean
  address: string | null
  balance: string | null
  isOnBlockDAG: boolean
  isConnecting: boolean
  error: string | null
}

export interface AuthState {
  isLoggedIn: boolean
  userEmail: string | null
  userId: string | null
  isEmailVerified: boolean
}

export interface CryptoPaymentProps {
  totalAmount: number
  bdagAmount: number
  tipAmount: number
  bdagTipAmount: number
  campaignId: string
  quantity: number
  pricePerNft: number | null
  hasNftPrice: boolean
  contractVersion?: string
  contractAddress: string
  isPendingOnchain?: boolean
  onSuccess: (result: PurchaseResult) => void
  onError: (message: string) => void
}

export interface CardPaymentProps {
  totalAmount: number
  tokenId?: string
  email: string
  onEmailChange: (email: string) => void
  isMonthly: boolean
  onMonthlyChange: (isMonthly: boolean) => void
  hasNftPrice: boolean
  quantity: number
  onSuccess: (result: PurchaseResult) => void
  onError: (message: string) => void
}

export interface QuantitySelectorProps {
  quantity: number
  onChange: (quantity: number) => void
  maxQuantity: number
  pricePerNft: number
  isSoldOut: boolean
}

export interface TipSelectorProps {
  tipAmount: number
  onChange: (tip: number) => void
  presets?: number[]
}

export interface AmountSelectorProps {
  amount: number
  onChange: (amount: number) => void
  presets?: number[]
}
