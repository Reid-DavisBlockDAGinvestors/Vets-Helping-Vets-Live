/**
 * Email Configuration - Centralized email settings
 * Multi-chain aware configuration
 */

export const EMAIL_CONFIG = {
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://patriotpledgenfts.netlify.app',
  CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890',
  EXPLORER_URL: 'https://awakening.bdagscan.com',
  FROM_EMAIL: process.env.FROM_EMAIL || 'patriotpledgenfts@vetshelpingvets.life',
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  ADMIN_EMAIL: process.env.ADMIN_NOTIFICATION_EMAIL || 'reid@blockdaginvestors.com',
} as const

/**
 * Chain-specific configuration for emails
 */
export const CHAIN_CONFIG: Record<number, {
  name: string
  symbol: string
  explorerUrl: string
  explorerName: string
  contractAddress: string
  isTestnet: boolean
}> = {
  1043: {
    name: 'BlockDAG',
    symbol: 'BDAG',
    explorerUrl: 'https://awakening.bdagscan.com',
    explorerName: 'BDAGScan',
    contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890',
    isTestnet: true,
  },
  11155111: {
    name: 'Sepolia',
    symbol: 'ETH',
    explorerUrl: 'https://sepolia.etherscan.io',
    explorerName: 'Etherscan',
    contractAddress: process.env.NEXT_PUBLIC_V7_CONTRACT_SEPOLIA || '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e',
    isTestnet: true,
  },
  1: {
    name: 'Ethereum',
    symbol: 'ETH',
    explorerUrl: 'https://etherscan.io',
    explorerName: 'Etherscan',
    contractAddress: '', // To be set when mainnet deployed
    isTestnet: false,
  },
}

/**
 * Get chain config by chainId, with fallback to BlockDAG
 */
export function getChainConfig(chainId?: number) {
  if (!chainId || !CHAIN_CONFIG[chainId]) {
    return CHAIN_CONFIG[1043] // Default to BlockDAG
  }
  return CHAIN_CONFIG[chainId]
}

export const STATUS_LABELS: Record<string, string> = {
  new: '🆕 New',
  investigating: '🔍 Investigating',
  in_progress: '🔧 In Progress',
  resolved: '✅ Resolved',
  wont_fix: '❌ Won\'t Fix',
  duplicate: '📋 Duplicate',
}
