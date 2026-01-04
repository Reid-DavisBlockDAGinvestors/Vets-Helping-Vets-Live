/**
 * Chain Classification Utilities
 * 
 * Distinguishes between mainnet (real funds) and testnet (test funds)
 * for accurate financial reporting and UI display.
 */

// Mainnet chains - real funds with exchange value
export const MAINNET_CHAIN_IDS = [
  1,      // Ethereum Mainnet
  137,    // Polygon
  8453,   // Base
  42161,  // Arbitrum
  10,     // Optimism
] as const

// Testnet chains - test funds with no real value
export const TESTNET_CHAIN_IDS = [
  1043,       // BlockDAG Awakening
  11155111,   // Sepolia
  80001,      // Mumbai (Polygon testnet)
  84531,      // Base Goerli
  421613,     // Arbitrum Goerli
] as const

export type MainnetChainId = typeof MAINNET_CHAIN_IDS[number]
export type TestnetChainId = typeof TESTNET_CHAIN_IDS[number]

/**
 * Check if a chain ID represents a mainnet (real funds)
 */
export function isMainnet(chainId: number | string | null | undefined): boolean {
  if (chainId === null || chainId === undefined) return false
  const id = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId
  return MAINNET_CHAIN_IDS.includes(id as MainnetChainId)
}

/**
 * Check if a chain ID represents a testnet (test funds)
 */
export function isTestnet(chainId: number | string | null | undefined): boolean {
  if (chainId === null || chainId === undefined) return true // Default to testnet for safety
  const id = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId
  return TESTNET_CHAIN_IDS.includes(id as TestnetChainId) || !isMainnet(id)
}

/**
 * Chain display information
 */
export interface ChainBadgeInfo {
  label: string
  shortLabel: string
  color: 'green' | 'orange' | 'gray'
  bgClass: string
  textClass: string
  borderClass: string
  icon: string
  tooltip: string
  chainName: string
}

/**
 * Get display information for a chain badge
 */
export function getChainBadge(chainId: number | string | null | undefined): ChainBadgeInfo {
  const id = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId
  
  if (isMainnet(id)) {
    const chainName = getChainName(id)
    return {
      label: 'LIVE',
      shortLabel: '💎',
      color: 'green',
      bgClass: 'bg-green-500/20',
      textClass: 'text-green-400',
      borderClass: 'border-green-500/30',
      icon: '💎',
      tooltip: `Real funds on ${chainName}`,
      chainName,
    }
  }
  
  const chainName = getChainName(id)
  return {
    label: 'TESTNET',
    shortLabel: '🧪',
    color: 'orange',
    bgClass: 'bg-orange-500/20',
    textClass: 'text-orange-400',
    borderClass: 'border-orange-500/30',
    icon: '🧪',
    tooltip: `Test funds on ${chainName} - not real money`,
    chainName,
  }
}

/**
 * Get human-readable chain name
 */
export function getChainName(chainId: number | string | null | undefined): string {
  const id = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId
  
  const chainNames: Record<number, string> = {
    1: 'Ethereum Mainnet',
    137: 'Polygon',
    8453: 'Base',
    42161: 'Arbitrum',
    10: 'Optimism',
    1043: 'BlockDAG',
    11155111: 'Sepolia',
    80001: 'Mumbai',
    84531: 'Base Goerli',
  }
  
  return chainNames[id ?? 0] || `Chain ${id}`
}

/**
 * Format a USD amount with appropriate prefix based on chain type
 * Mainnet: "$1,234.56"
 * Testnet: "~$1,234.56" (tilde indicates approximate/test value)
 */
export function formatChainAmount(
  amount: number, 
  chainId: number | string | null | undefined,
  options?: { showPrefix?: boolean; showCurrency?: boolean }
): string {
  const { showPrefix = true, showCurrency = true } = options ?? {}
  const formatted = amount.toLocaleString('en-US', { 
    minimumFractionDigits: 0,
    maximumFractionDigits: 2 
  })
  
  const currencySymbol = showCurrency ? '$' : ''
  
  if (isMainnet(chainId)) {
    return `${currencySymbol}${formatted}`
  }
  
  // Testnet - add tilde prefix to indicate approximate/test value
  return showPrefix ? `~${currencySymbol}${formatted}` : `${currencySymbol}${formatted}`
}

/**
 * Get the appropriate label for raised funds based on chain type
 */
export function getFundsLabel(chainId: number | string | null | undefined): string {
  return isMainnet(chainId) ? 'raised' : 'test value'
}

/**
 * Get progress bar color class based on chain type
 */
export function getProgressBarColor(chainId: number | string | null | undefined): string {
  return isMainnet(chainId) ? 'bg-green-500' : 'bg-orange-500'
}

/**
 * Get progress bar background color class based on chain type
 */
export function getProgressBarBgColor(chainId: number | string | null | undefined): string {
  return isMainnet(chainId) ? 'bg-green-500/20' : 'bg-orange-500/20'
}
