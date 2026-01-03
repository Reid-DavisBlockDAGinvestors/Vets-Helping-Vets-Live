/**
 * Multi-Chain Configuration
 * 
 * Centralized chain configuration for PatriotPledge multi-chain deployment.
 * Supports BlockDAG (current), Ethereum Mainnet, Polygon, and Base.
 */

import { ethers } from 'ethers'

export type ChainId = 1043 | 1 | 11155111 | 137 | 8453

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
  // BlockDAG Testnet (Awakening Phase - uses test BDAG)
  1043: {
    chainId: 1043,
    name: 'BlockDAG Testnet',
    shortName: 'BDAG',
    // Use public RPC as default (more reliable), NowNodes as fallback
    rpcUrl: process.env.BLOCKDAG_RPC || process.env.NEXT_PUBLIC_BLOCKDAG_RPC || 'https://rpc.awakening.bdagscan.com',
    rpcUrlFallback: 'https://bdag.nownodes.io',
    explorerUrl: 'https://awakening.bdagscan.com',
    nativeCurrency: {
      name: 'BlockDAG',
      symbol: 'BDAG',
      decimals: 18
    },
    contracts: {
      v5: '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890',
      v6: '0xaE54e4E8A75a81780361570c17b8660CEaD27053',
    },
    gasEstimate: 'low',
    avgBlockTime: 10,
    confirmations: 1,
    immediatePayoutSupported: false, // V5 doesn't support
    isTestnet: true, // IMPORTANT: Awakening is testnet phase
    isActive: true,
    iconUrl: '/images/chains/bdag.png'
  },

  // Ethereum Mainnet (Production - V7)
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
      v7: process.env.NEXT_PUBLIC_V7_CONTRACT_ETHEREUM || ''
    },
    gasEstimate: 'high',
    avgBlockTime: 12,
    confirmations: 3,
    immediatePayoutSupported: true,
    isTestnet: false,
    isActive: false, // Activate when V7 is deployed and verified
    iconUrl: '/images/chains/eth.png'
  },

  // Ethereum Sepolia Testnet (V7 Testing)
  11155111: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    shortName: 'SEP',
    rpcUrl: process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
    explorerApiUrl: 'https://api-sepolia.etherscan.io/api',
    nativeCurrency: {
      name: 'Sepolia ETH',
      symbol: 'ETH',
      decimals: 18
    },
    contracts: {
      // V7 deployed Jan 1, 2026 - hardcoded as fallback since env vars may not load on client
      v7: process.env.NEXT_PUBLIC_V7_CONTRACT_SEPOLIA || '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e'
    },
    gasEstimate: 'medium',
    avgBlockTime: 12,
    confirmations: 2,
    immediatePayoutSupported: true,
    isTestnet: true,
    isActive: true, // Active for testing
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

// ============ Testnet/Mainnet Helpers ============

/**
 * Check if a chain is a testnet
 */
export function isTestnetChain(chainId: ChainId): boolean {
  return CHAIN_CONFIGS[chainId]?.isTestnet ?? true
}

/**
 * Get all active testnet chains
 */
export function getTestnetChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter(c => c.isTestnet && c.isActive)
}

/**
 * Get all active mainnet chains
 */
export function getMainnetChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter(c => !c.isTestnet && c.isActive)
}

/**
 * Validate if a purchase can be made on a campaign
 * Campaigns must be purchased on the same network they were created on
 */
export function canPurchaseWith(campaignChainId: ChainId, paymentChainId: ChainId): boolean {
  return campaignChainId === paymentChainId
}

/**
 * Get network type label for display
 */
export function getNetworkTypeLabel(chainId: ChainId): 'Testnet' | 'Mainnet' {
  return isTestnetChain(chainId) ? 'Testnet' : 'Mainnet'
}

/**
 * Get testnet warning message for a chain
 */
export function getTestnetWarning(chainId: ChainId): string | null {
  const config = CHAIN_CONFIGS[chainId]
  if (!config?.isTestnet) return null
  
  return `⚠️ ${config.name} is a testnet - uses test ${config.nativeCurrency.symbol} only`
}

/**
 * Get available networks for a campaign based on its type
 */
export function getCompatiblePaymentNetworks(campaignChainId: ChainId): ChainConfig[] {
  const campaignConfig = CHAIN_CONFIGS[campaignChainId]
  if (!campaignConfig) return []
  
  // For now, only the exact same network is compatible
  // This ensures testnet campaigns can only be purchased with testnet tokens
  return [campaignConfig]
}

// ============ Provider & Signer Functions ============

// Cache providers to avoid recreating on every call
const providerCache = new Map<ChainId, ethers.JsonRpcProvider>()

/**
 * Get a provider for a specific chain
 * Uses cached providers when possible
 */
export function getProviderForChain(chainId: ChainId): ethers.JsonRpcProvider {
  // Check cache first
  if (providerCache.has(chainId)) {
    return providerCache.get(chainId)!
  }
  
  const config = CHAIN_CONFIGS[chainId]
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }
  
  if (!config.rpcUrl) {
    throw new Error(`No RPC URL configured for chain ${config.name} (${chainId})`)
  }
  
  // Create provider - use standard RPC (NowNodes handling moved to fallback)
  let provider: ethers.JsonRpcProvider
  
  // Check if using NowNodes (requires API key header)
  if (config.rpcUrl.includes('nownodes.io')) {
    const nowNodesKey = process.env.NOWNODES_API_KEY
    if (nowNodesKey) {
      const fetchReq = new ethers.FetchRequest(config.rpcUrl)
      fetchReq.setHeader('api-key', nowNodesKey)
      provider = new ethers.JsonRpcProvider(fetchReq, undefined, { staticNetwork: true })
    } else {
      // Fall back to public RPC if no API key
      provider = new ethers.JsonRpcProvider(
        config.rpcUrlFallback || config.rpcUrl, 
        undefined, 
        { staticNetwork: true }
      )
    }
  } else {
    // Standard RPC - no special headers needed
    provider = new ethers.JsonRpcProvider(config.rpcUrl, undefined, { staticNetwork: true })
  }
  
  // Cache the provider
  providerCache.set(chainId, provider)
  
  return provider
}

/**
 * Clear provider cache for a specific chain (useful after RPC errors)
 */
export function clearProviderCache(chainId?: ChainId): void {
  if (chainId) {
    providerCache.delete(chainId)
  } else {
    providerCache.clear()
  }
}

/**
 * Get environment variable name for a chain's signer key
 */
function getSignerKeyEnvVar(chainId: ChainId): string {
  switch (chainId) {
    case 1043:
      return 'BDAG_RELAYER_KEY'
    case 1:
      return 'ETH_MAINNET_KEY'
    case 11155111:
      return 'ETH_DEPLOYER_KEY'
    case 137:
      return 'POLYGON_KEY'
    case 8453:
      return 'BASE_KEY'
    default:
      throw new Error(`No signer key env var for chain ${chainId}`)
  }
}

/**
 * Get a signer for a specific chain
 * Uses the appropriate private key from environment variables
 */
export function getSignerForChain(chainId: ChainId): ethers.Wallet {
  const envVar = getSignerKeyEnvVar(chainId)
  const privateKey = process.env[envVar]
  
  if (!privateKey) {
    throw new Error(`Missing private key: ${envVar} not set for chain ${chainId}`)
  }
  
  const provider = getProviderForChain(chainId)
  return new ethers.Wallet(privateKey, provider)
}

/**
 * Get a contract instance for a specific chain and version
 * Requires an ABI to be provided
 */
export function getContractForChain(
  chainId: ChainId, 
  version: ContractVersion, 
  abi: ethers.InterfaceAbi,
  signerOrProvider?: ethers.Signer | ethers.Provider
): ethers.Contract {
  const address = getContractAddress(chainId, version)
  
  if (!address) {
    throw new Error(`No contract ${version} deployed on chain ${chainId}`)
  }
  
  const provider = signerOrProvider || getProviderForChain(chainId)
  return new ethers.Contract(address, abi, provider)
}

/**
 * Test if a chain's RPC is working
 * Useful for health checks
 */
export async function testChainConnection(chainId: ChainId): Promise<{ ok: boolean; blockNumber?: number; error?: string }> {
  try {
    const provider = getProviderForChain(chainId)
    const blockNumber = await provider.getBlockNumber()
    return { ok: true, blockNumber }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}

/**
 * Get USD to native currency conversion rate
 * Used for pricing NFTs
 */
export function getUsdToNativeRate(chainId: ChainId): number {
  const rates: Record<string, number> = {
    BDAG: Number(process.env.BDAG_USD_RATE || '0.05'),
    ETH: Number(process.env.ETH_USD_RATE || '2300'),
    MATIC: Number(process.env.MATIC_USD_RATE || '0.80'),
  }
  
  const symbol = CHAIN_CONFIGS[chainId]?.nativeCurrency.symbol
  const tokenPrice = rates[symbol] || 1
  
  // Return how many native tokens equal 1 USD
  return 1 / tokenPrice
}

/**
 * Convert USD amount to native currency wei
 */
export function usdToNativeWei(chainId: ChainId, usdAmount: number): bigint {
  const rate = getUsdToNativeRate(chainId)
  const nativeAmount = usdAmount * rate
  return BigInt(Math.floor(nativeAmount * 1e18))
}

// ============ Default Export ============

export default CHAIN_CONFIGS
