/**
 * Multi-Chain Configuration
 * 
 * Centralized chain configuration for PatriotPledge multi-chain deployment.
 * Supports BlockDAG (current), Ethereum Mainnet, Polygon, and Base.
 */

export type ChainId = 1043 | 1 | 137 | 8453

export type ContractVersion = 'v5' | 'v6' | 'v7'

export interface ChainConfig {
  chainId: ChainId
  name: string
  shortName: string
  rpcUrl: string
  rpcUrlFallback?: string
  explorerUrl: string
  explorerApiUrl?: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  contracts: Partial<Record<ContractVersion, string>>
  gasEstimate: 'low' | 'medium' | 'high'
  avgBlockTime: number // seconds
  confirmations: number // recommended confirmations
  immediatePayoutSupported: boolean
  isTestnet: boolean
  isActive: boolean
  iconUrl?: string
}

export const CHAIN_CONFIGS: Record<ChainId, ChainConfig> = {
  // BlockDAG Mainnet (Current Production)
  1043: {
    chainId: 1043,
    name: 'BlockDAG Mainnet',
    shortName: 'BDAG',
    rpcUrl: process.env.NEXT_PUBLIC_BLOCKDAG_RPC || 'https://bdag.nownodes.io',
    rpcUrlFallback: 'https://rpc.awakening.bdagscan.com',
    explorerUrl: 'https://awakening.bdagscan.com',
    nativeCurrency: {
      name: 'BlockDAG',
      symbol: 'BDAG',
      decimals: 18
    },
    contracts: {
      v5: '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890',
      // v6: 'TBD - Deploy when needed',
      // v7: 'TBD - Deploy when needed'
    },
    gasEstimate: 'low',
    avgBlockTime: 10,
    confirmations: 1,
    immediatePayoutSupported: false, // V5 doesn't support
    isTestnet: false,
    isActive: true,
    iconUrl: '/images/chains/bdag.png'
  },

  // Ethereum Mainnet (NEW - Production Ready)
  1: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    shortName: 'ETH',
    rpcUrl: process.env.NEXT_PUBLIC_ETHEREUM_RPC || '',
    explorerUrl: 'https://etherscan.io',
    explorerApiUrl: 'https://api.etherscan.io/api',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    contracts: {
      // v7: 'TBD - Deploy to mainnet'
    },
    gasEstimate: 'high',
    avgBlockTime: 12,
    confirmations: 3,
    immediatePayoutSupported: true,
    isTestnet: false,
    isActive: false, // Activate when V7 is deployed
    iconUrl: '/images/chains/eth.png'
  },

  // Polygon Mainnet (Future)
  137: {
    chainId: 137,
    name: 'Polygon',
    shortName: 'MATIC',
    rpcUrl: process.env.NEXT_PUBLIC_POLYGON_RPC || 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    explorerApiUrl: 'https://api.polygonscan.com/api',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    },
    contracts: {
      // v7: 'TBD'
    },
    gasEstimate: 'low',
    avgBlockTime: 2,
    confirmations: 5,
    immediatePayoutSupported: true,
    isTestnet: false,
    isActive: false,
    iconUrl: '/images/chains/polygon.png'
  },

  // Base Mainnet (Future - Coinbase L2)
  8453: {
    chainId: 8453,
    name: 'Base',
    shortName: 'BASE',
    rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    explorerApiUrl: 'https://api.basescan.org/api',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    contracts: {
      // v7: 'TBD'
    },
    gasEstimate: 'low',
    avgBlockTime: 2,
    confirmations: 3,
    immediatePayoutSupported: true,
    isTestnet: false,
    isActive: false,
    iconUrl: '/images/chains/base.png'
  }
}

// ============ Helper Functions ============

/**
 * Get chain config by chain ID
 */
export function getChainConfig(chainId: ChainId): ChainConfig {
  const config = CHAIN_CONFIGS[chainId]
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }
  return config
}

/**
 * Get all active chains
 */
export function getActiveChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter(c => c.isActive)
}

/**
 * Get all chains that support immediate payout
 */
export function getImmediatePayoutChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter(c => c.isActive && c.immediatePayoutSupported)
}

/**
 * Get contract address for a specific chain and version
 */
export function getContractAddress(chainId: ChainId, version: ContractVersion): string | undefined {
  return CHAIN_CONFIGS[chainId]?.contracts[version]
}

/**
 * Get the latest contract version for a chain
 */
export function getLatestContractVersion(chainId: ChainId): ContractVersion | undefined {
  const contracts = CHAIN_CONFIGS[chainId]?.contracts
  if (!contracts) return undefined
  
  const versions: ContractVersion[] = ['v7', 'v6', 'v5']
  return versions.find(v => contracts[v] !== undefined)
}

/**
 * Check if a chain supports a specific contract version
 */
export function chainSupportsVersion(chainId: ChainId, version: ContractVersion): boolean {
  return !!getContractAddress(chainId, version)
}

/**
 * Get explorer URL for a transaction
 */
export function getExplorerTxUrl(chainId: ChainId, txHash: string): string {
  const config = CHAIN_CONFIGS[chainId]
  if (!config) return ''
  return `${config.explorerUrl}/tx/${txHash}`
}

/**
 * Get explorer URL for an address
 */
export function getExplorerAddressUrl(chainId: ChainId, address: string): string {
  const config = CHAIN_CONFIGS[chainId]
  if (!config) return ''
  return `${config.explorerUrl}/address/${address}`
}

/**
 * Get explorer URL for a token
 */
export function getExplorerTokenUrl(chainId: ChainId, tokenId: string, contractAddress: string): string {
  const config = CHAIN_CONFIGS[chainId]
  if (!config) return ''
  return `${config.explorerUrl}/token/${contractAddress}?a=${tokenId}`
}

/**
 * Format native currency amount
 */
export function formatNativeAmount(chainId: ChainId, amount: bigint): string {
  const config = CHAIN_CONFIGS[chainId]
  if (!config) return '0'
  
  const divisor = BigInt(10 ** config.nativeCurrency.decimals)
  const whole = amount / divisor
  const fraction = amount % divisor
  
  const fractionStr = fraction.toString().padStart(config.nativeCurrency.decimals, '0').slice(0, 4)
  return `${whole}.${fractionStr} ${config.nativeCurrency.symbol}`
}

/**
 * Estimate gas cost in USD (rough estimate)
 */
export function estimateGasCostUSD(chainId: ChainId, gasUnits: number): { low: number; mid: number; high: number } {
  const config = CHAIN_CONFIGS[chainId]
  if (!config) return { low: 0, mid: 0, high: 0 }
  
  // Rough gas price estimates (gwei)
  const gasPrices: Record<'low' | 'medium' | 'high', { low: number; mid: number; high: number }> = {
    low: { low: 0.001, mid: 0.005, high: 0.01 },     // BlockDAG, Polygon, Base
    medium: { low: 0.05, mid: 0.10, high: 0.20 },    // Future
    high: { low: 5, mid: 15, high: 30 }              // Ethereum
  }
  
  const prices = gasPrices[config.gasEstimate]
  
  // Rough native token prices (USD)
  const tokenPrices: Record<string, number> = {
    BDAG: 0.05,
    ETH: 2300,
    MATIC: 0.80
  }
  
  const tokenPrice = tokenPrices[config.nativeCurrency.symbol] || 1
  
  // Gas cost = gasUnits * gasPrice (gwei) * tokenPrice / 1e9
  return {
    low: (gasUnits * prices.low * tokenPrice) / 1e9,
    mid: (gasUnits * prices.mid * tokenPrice) / 1e9,
    high: (gasUnits * prices.high * tokenPrice) / 1e9
  }
}

// ============ Default Export ============

export default CHAIN_CONFIGS
