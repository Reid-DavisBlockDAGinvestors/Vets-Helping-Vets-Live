/**
 * Contract Settings Types
 * Financial-grade security: All sensitive operations require confirmation
 */

export interface ContractSettings {
  chainId: number
  chainName: string
  contractVersion: string
  contractAddress: string
  
  // Fee configuration
  platformFeeBps: number      // Basis points (100 = 1%)
  maxFeeBps: number           // Contract maximum (usually 3000 = 30%)
  
  // Treasury
  platformTreasury: string
  owner: string
  
  // Royalties
  defaultRoyaltyBps: number   // EIP-2981 royalty (250 = 2.5%)
  
  // State
  isPaused: boolean
  immediatePayoutEnabled: boolean
  
  // Stats
  totalCampaigns: number
  contractBalance: string     // In native currency
  bugBountyPool: string       // In native currency
}

export interface PendingSettingsChange {
  id: string
  chainId: number
  contractVersion: string
  changeType: 'fee' | 'treasury' | 'royalty' | 'payout'
  currentValue: string
  newValue: string
  requestedBy: string
  requestedAt: string
  expiresAt: string
  status: 'pending' | 'executed' | 'expired' | 'cancelled'
  requiresMultiSig: boolean
  approvals: string[]
  requiredApprovals: number
}

export interface SettingsChangeRequest {
  chainId: number
  contractVersion: string
  changeType: 'fee' | 'treasury' | 'royalty' | 'payout'
  newValue: string | number | boolean
  reason: string
}

// Financial-grade security thresholds
export const SECURITY_THRESHOLDS = {
  // Changes above these thresholds require multi-sig
  FEE_CHANGE_THRESHOLD_BPS: 100,        // 1% fee change requires multi-sig
  TREASURY_CHANGE: true,                 // Treasury changes always require multi-sig
  
  // Rate limiting
  MAX_CHANGES_PER_HOUR: 3,
  CHANGE_COOLDOWN_MINUTES: 15,
  
  // Confirmation delays
  FEE_CHANGE_DELAY_HOURS: 24,
  TREASURY_CHANGE_DELAY_HOURS: 48,
  
  // Maximum allowed values
  MAX_PLATFORM_FEE_BPS: 1000,           // 10% max platform fee
  MAX_ROYALTY_BPS: 1000,                // 10% max royalty
} as const

export type SettingsTab = 'fees' | 'treasury' | 'royalties' | 'advanced'
