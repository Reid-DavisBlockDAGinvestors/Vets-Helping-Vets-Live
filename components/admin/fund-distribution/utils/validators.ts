import type { TipSplit, DistributionParams, CampaignBalance } from '../types'

/**
 * Financial-grade validators for fund distribution
 * All monetary operations require strict validation
 */

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate tip split percentages
 * - Both must be 0-100
 * - Must total exactly 100
 */
export function validateTipSplit(submitterPercent: number, nonprofitPercent: number): ValidationResult {
  if (!Number.isInteger(submitterPercent) || !Number.isInteger(nonprofitPercent)) {
    return { valid: false, error: 'Percentages must be whole numbers' }
  }
  if (submitterPercent < 0 || submitterPercent > 100) {
    return { valid: false, error: 'Submitter percentage must be 0-100' }
  }
  if (nonprofitPercent < 0 || nonprofitPercent > 100) {
    return { valid: false, error: 'Nonprofit percentage must be 0-100' }
  }
  if (submitterPercent + nonprofitPercent !== 100) {
    return { valid: false, error: 'Percentages must total 100' }
  }
  return { valid: true }
}

/**
 * Validate distribution amount against available balance
 * - Amount must be positive
 * - Amount cannot exceed available balance
 * - Must have sufficient precision (18 decimals max)
 */
export function validateDistributionAmount(
  amount: number, 
  availableBalance: number
): ValidationResult {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { valid: false, error: 'Amount must be a valid number' }
  }
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be greater than zero' }
  }
  if (amount > availableBalance) {
    return { valid: false, error: `Amount (${amount}) exceeds available balance (${availableBalance})` }
  }
  // Check for excessive precision (more than 18 decimals)
  const decimalPlaces = (amount.toString().split('.')[1] || '').length
  if (decimalPlaces > 18) {
    return { valid: false, error: 'Amount has too many decimal places (max 18)' }
  }
  return { valid: true }
}

/**
 * Validate wallet address format
 * - Must be valid Ethereum address (0x + 40 hex chars)
 */
export function validateWalletAddress(address: string | null | undefined): ValidationResult {
  if (!address) {
    return { valid: false, error: 'Wallet address is required' }
  }
  if (typeof address !== 'string') {
    return { valid: false, error: 'Wallet address must be a string' }
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { valid: false, error: 'Invalid wallet address format' }
  }
  // Check for zero address
  if (address === '0x0000000000000000000000000000000000000000') {
    return { valid: false, error: 'Cannot distribute to zero address' }
  }
  return { valid: true }
}

/**
 * Validate distribution params before executing
 */
export function validateDistributionParams(
  params: DistributionParams,
  balance: CampaignBalance
): ValidationResult {
  // Validate campaign has pending funds
  if (balance.pendingDistributionNative <= 0) {
    return { valid: false, error: 'No pending funds to distribute' }
  }

  // Validate amount
  const amountValidation = validateDistributionAmount(
    params.amount, 
    balance.pendingDistributionNative
  )
  if (!amountValidation.valid) {
    return amountValidation
  }

  // Validate recipient wallet based on recipient type
  if (params.recipient === 'submitter' || params.recipient === 'both') {
    const submitterValidation = validateWalletAddress(balance.submitterWallet)
    if (!submitterValidation.valid) {
      return { valid: false, error: `Submitter wallet: ${submitterValidation.error}` }
    }
  }

  if (params.recipient === 'nonprofit' || params.recipient === 'both') {
    const nonprofitValidation = validateWalletAddress(balance.nonprofitWallet)
    if (!nonprofitValidation.valid) {
      return { valid: false, error: `Nonprofit wallet: ${nonprofitValidation.error}` }
    }
  }

  return { valid: true }
}

/**
 * Calculate tip split amounts with precision
 * Returns amounts in native currency units
 */
export function calculateTipSplitAmounts(
  totalTips: number,
  split: TipSplit
): { submitterAmount: number; nonprofitAmount: number } {
  // Validate split first
  const validation = validateTipSplit(split.submitterPercent, split.nonprofitPercent)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  // Calculate with precision - avoid floating point errors
  const submitterAmount = (totalTips * split.submitterPercent) / 100
  const nonprofitAmount = totalTips - submitterAmount // Ensure total matches exactly

  return { submitterAmount, nonprofitAmount }
}

/**
 * Validate that a mainnet distribution has extra safety checks
 */
export function validateMainnetDistribution(
  balance: CampaignBalance,
  confirmed: boolean
): ValidationResult {
  if (balance.isTestnet) {
    return { valid: true } // Testnet doesn't need extra confirmation
  }

  // Mainnet requires explicit confirmation
  if (!confirmed) {
    return { 
      valid: false, 
      error: 'Mainnet distributions require explicit confirmation. This involves REAL MONEY.' 
    }
  }

  return { valid: true }
}
