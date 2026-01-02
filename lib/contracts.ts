/**
 * Multi-contract registry for PatriotPledge NFT platform
 * Supports infinite contract versions with dynamic loading
 * 
 * @version 2.0 - Enhanced for infinite version support
 */

import { ethers } from 'ethers'
import { getProvider } from './onchain'
import { logger } from './logger'

// Contract version type - now supports any vN format
export type ContractVersion = `v${number}`

// Helper to create version string
export function createVersion(n: number): ContractVersion {
  return `v${n}` as ContractVersion
}

// Contract info interface
export interface ContractInfo {
  version: ContractVersion
  address: string
  name: string
  chainId: number
  isActive: boolean      // Can create new campaigns
  isMintable: boolean    // Can mint from existing campaigns
  features: ContractFeatures
  abi: string[]
}

// Feature flags for each contract version
export interface ContractFeatures {
  batchMint: boolean
  royalties: boolean
  pausable: boolean
  burnable: boolean
  setTokenURI: boolean
  freezable: boolean
  blacklist: boolean
  soulbound: boolean
  immediatePayout?: boolean  // V7+ feature: funds sent directly to submitter on mint
}

// V5 ABI - Edition-based fundraiser NFTs
export const V5_ABI = [
  // Campaign management
  'function createCampaign(string category, string baseURI, uint256 goal, uint256 maxEditions, uint256 pricePerEdition, uint256 feeRate, address submitter) external returns (uint256)',
  'function totalCampaigns() view returns (uint256)',
  'function getCampaign(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
  'function campaigns(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 tipsReceived, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, uint256 nonprofitFeeRate, address nonprofit, address submitter, bool active, bool closed)',
  
  // Edition minting
  'function mintEditionToDonor(uint256 campaignId, address donor, uint256 amountPaid) external returns (uint256)',
  'function mintWithBDAG(uint256 campaignId) external payable returns (uint256)',
  'function mintWithBDAGAndTip(uint256 campaignId, uint256 tipAmount) external payable returns (uint256)',
  
  // Living NFT - metadata updates
  'function updateCampaignMetadata(uint256 campaignId, string newBaseURI) external',
  
  // Financial recording (for off-chain payments)
  'function recordContribution(uint256 campaignId, uint256 gross, uint256 net, uint256 tip, bool isOnchain) external',
  
  // Campaign lifecycle
  'function deactivateCampaign(uint256 campaignId) external',
  'function reactivateCampaign(uint256 campaignId) external',
  'function closeCampaign(uint256 campaignId) external',
  
  // Edition info
  'function getEditionInfo(uint256 tokenId) view returns (uint256 campaignId, uint256 editionNumber, uint256 totalEditions)',
  'function getCampaignEditions(uint256 campaignId) view returns (uint256[])',
  'function tokenToCampaign(uint256 tokenId) view returns (uint256)',
  'function tokenEditionNumber(uint256 tokenId) view returns (uint256)',
  
  // Standard ERC721 + Enumerable
  'function totalSupply() view returns (uint256)',
  'function tokenByIndex(uint256 index) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  
  // Withdraw
  'function withdraw(address to, uint256 amount) external'
]

// V7 ABI - Different createCampaign signature with immediate payout
export const V7_ABI = [
  // V7 Campaign management - DIFFERENT SIGNATURE than V5/V6
  'function createCampaign(string category, string baseURI, uint256 goal, uint256 maxEditions, uint256 pricePerEdition, address nonprofit, address submitter, bool immediatePayoutEnabled) external returns (uint256)',
  'function totalCampaigns() view returns (uint256)',
  'function getCampaign(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
  'function campaigns(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 tipsReceived, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, address nonprofit, address submitter, bool active, bool closed, bool refunded, bool immediatePayoutEnabled)',
  
  // Edition minting - uses ETH on Sepolia/Mainnet
  'function mintEdition(uint256 campaignId) external payable returns (uint256)',
  'function mintEditionWithTip(uint256 campaignId, uint256 tipAmount) external payable returns (uint256)',
  'function mintBatchEditions(uint256 campaignId, uint256 quantity) external payable returns (uint256[])',
  
  // Living NFT - metadata updates
  'function updateCampaignMetadata(uint256 campaignId, string newBaseURI) external',
  
  // Campaign lifecycle
  'function deactivateCampaign(uint256 campaignId) external',
  'function reactivateCampaign(uint256 campaignId) external',
  'function closeCampaign(uint256 campaignId) external',
  
  // Edition info
  'function getEditionInfo(uint256 tokenId) view returns (uint256 campaignId, uint256 editionNumber, uint256 totalEditions)',
  'function getCampaignEditions(uint256 campaignId) view returns (uint256[])',
  'function tokenToCampaign(uint256 tokenId) view returns (uint256)',
  'function tokenEditionNumber(uint256 tokenId) view returns (uint256)',
  
  // Standard ERC721 + Enumerable
  'function totalSupply() view returns (uint256)',
  'function tokenByIndex(uint256 index) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  
  // Admin token URI fix
  'function setTokenURI(uint256 tokenId, string uri) external',
  
  // Token freezing
  'function freezeToken(uint256 tokenId) external',
  'function unfreezeToken(uint256 tokenId) external',
  'function isTokenFrozen(uint256 tokenId) view returns (bool)',
  
  // Blacklist
  'function blacklistAddress(address account) external',
  'function unblacklistAddress(address account) external',
  'function isBlacklisted(address account) view returns (bool)',
  
  // Soulbound
  'function setSoulbound(uint256 tokenId, bool isSoulbound) external',
  'function isTokenSoulbound(uint256 tokenId) view returns (bool)',
  
  // Burn
  'function burn(uint256 tokenId) external',
  'function adminBurn(uint256 tokenId) external',
  
  // Pausable
  'function pause() external',
  'function unpause() external',
  'function paused() view returns (bool)',
  
  // Treasury and owner
  'function platformTreasury() view returns (address)',
  'function owner() view returns (address)',
  
  // Royalties (EIP-2981)
  'function royaltyInfo(uint256 tokenId, uint256 salePrice) view returns (address receiver, uint256 royaltyAmount)',
  'function setDefaultRoyalty(address receiver, uint96 feeNumerator) external',
]

// V6 ABI - Extended with new features
export const V6_ABI = [
  ...V5_ABI,
  
  // Batch minting
  'function mintBatchWithBDAG(uint256 campaignId, uint256 quantity) external payable returns (uint256[])',
  'function mintBatchWithBDAGAndTip(uint256 campaignId, uint256 quantity, uint256 tipAmount) external payable returns (uint256[])',
  
  // Admin token URI fix
  'function setTokenURI(uint256 tokenId, string uri) external',
  'function batchSetTokenURI(uint256[] tokenIds, string[] uris) external',
  
  // Campaign editing
  'function editCampaignGoal(uint256 campaignId, uint256 newGoal) external',
  'function editCampaignPrice(uint256 campaignId, uint256 newPrice) external',
  'function editCampaignMaxEditions(uint256 campaignId, uint256 newMax) external',
  'function editCampaignSubmitter(uint256 campaignId, address newSubmitter) external',
  'function editCampaignCategory(uint256 campaignId, string newCategory) external',
  'function editCampaignFeeRate(uint256 campaignId, uint256 newFeeRate) external',
  
  // Pausable
  'function pause() external',
  'function unpause() external',
  'function paused() view returns (bool)',
  
  // Token freezing
  'function freezeToken(uint256 tokenId) external',
  'function unfreezeToken(uint256 tokenId) external',
  'function isTokenFrozen(uint256 tokenId) view returns (bool)',
  
  // Blacklist
  'function blacklistAddress(address account) external',
  'function unblacklistAddress(address account) external',
  'function isBlacklisted(address account) view returns (bool)',
  
  // Soulbound
  'function setSoulbound(uint256 tokenId, bool isSoulbound) external',
  'function isTokenSoulbound(uint256 tokenId) view returns (bool)',
  
  // Burn
  'function burn(uint256 tokenId) external',
  'function adminBurn(uint256 tokenId) external',
  
  // Royalties (EIP-2981)
  'function royaltyInfo(uint256 tokenId, uint256 salePrice) view returns (address receiver, uint256 royaltyAmount)',
  'function setDefaultRoyalty(address receiver, uint96 feeNumerator) external',
  'function setTokenRoyalty(uint256 tokenId, address receiver, uint96 feeNumerator) external',
  
  // Treasury
  'function setTreasury(address newTreasury) external',
  'function treasury() view returns (address)',
  
  // Emergency
  'function emergencyWithdraw() external',
  
  // Campaign refund
  'function refundCampaign(uint256 campaignId) external'
]

// Dynamic contract registry - supports infinite versions
const contractRegistry = new Map<ContractVersion, ContractInfo>()

// Default feature set for new contracts (V6+ baseline)
const DEFAULT_FEATURES: ContractFeatures = {
  batchMint: true,
  royalties: true,
  pausable: true,
  burnable: true,
  setTokenURI: true,
  freezable: true,
  blacklist: true,
  soulbound: true
}

// Empty feature set for legacy or basic contracts
const EMPTY_FEATURES: ContractFeatures = {
  batchMint: false,
  royalties: false,
  pausable: false,
  burnable: false,
  setTokenURI: false,
  freezable: false,
  blacklist: false,
  soulbound: false
}

/**
 * Register a new contract version dynamically
 */
export function registerContract(info: ContractInfo): void {
  contractRegistry.set(info.version, info)
  logger.debug(`[ContractRegistry] Registered ${info.version} at ${info.address}`)
}

/**
 * Unregister a contract version
 */
export function unregisterContract(version: ContractVersion): boolean {
  return contractRegistry.delete(version)
}

/**
 * Load contract from environment variables
 * Format: CONTRACT_ADDRESS_V{N}, CONTRACT_NAME_V{N}, CONTRACT_ACTIVE_V{N}
 */
export function loadContractFromEnv(versionNumber: number): ContractInfo | null {
  const version = createVersion(versionNumber)
  const addressKey = `CONTRACT_ADDRESS_V${versionNumber}`
  const publicAddressKey = `NEXT_PUBLIC_CONTRACT_ADDRESS_V${versionNumber}`
  
  const address = process.env[addressKey] || process.env[publicAddressKey]
  
  if (!address) {
    return null
  }
  
  const nameKey = `CONTRACT_NAME_V${versionNumber}`
  const activeKey = `CONTRACT_ACTIVE_V${versionNumber}`
  const chainIdKey = `CONTRACT_CHAIN_ID_V${versionNumber}`
  
  // Determine which ABI to use based on version
  const abi = versionNumber >= 6 ? V6_ABI : V5_ABI
  const features = versionNumber >= 6 ? { ...DEFAULT_FEATURES } : { ...EMPTY_FEATURES }
  
  // Support multi-chain: read chain_id from env, default to 1043 (BlockDAG)
  const chainId = parseInt(process.env[chainIdKey] || '1043', 10)
  
  return {
    version,
    address,
    name: process.env[nameKey] || `PatriotPledgeNFTV${versionNumber}`,
    chainId,
    isActive: process.env[activeKey] === 'true',
    isMintable: true,
    features,
    abi
  }
}

/**
 * Initialize registry with known contracts
 */
function initializeRegistry(): void {
  // V5 - Legacy contract
  registerContract({
    version: 'v5',
    address: process.env.CONTRACT_ADDRESS_V5 || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_V5 || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890',
    name: 'PatriotPledgeNFTV5',
    chainId: 1043,
    isActive: false,
    isMintable: true,
    features: { ...EMPTY_FEATURES },
    abi: V5_ABI
  })

  // V6 - Current active contract (BlockDAG)
  registerContract({
    version: 'v6',
    address: process.env.CONTRACT_ADDRESS_V6 || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_V6 || '0xaE54e4E8A75a81780361570c17b8660CEaD27053',
    name: 'PatriotPledgeNFTV6',
    chainId: 1043,
    isActive: true,
    isMintable: true,
    features: { ...DEFAULT_FEATURES },
    abi: V6_ABI
  })

  // V7 - Sepolia testnet (deployed Jan 1, 2026)
  registerContract({
    version: 'v7',
    address: process.env.CONTRACT_ADDRESS_V7 || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_V7 || '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e',
    name: 'PatriotPledgeNFTV7',
    chainId: 11155111, // Sepolia
    isActive: true,
    isMintable: true,
    features: { ...DEFAULT_FEATURES, immediatePayout: true },
    abi: V7_ABI // V7 has different createCampaign signature
  })

  // Auto-load any additional contracts from environment (V8+)
  for (let i = 8; i <= 100; i++) {
    const contract = loadContractFromEnv(i)
    if (contract) {
      registerContract(contract)
    }
  }
}

// Initialize on module load
initializeRegistry()

// Legacy export for backwards compatibility
export const CONTRACT_REGISTRY: Record<string, ContractInfo> = Object.fromEntries(contractRegistry)

/**
 * Get the currently active contract version for new campaigns
 */
export function getActiveContractVersion(): ContractVersion {
  for (const [version, info] of contractRegistry.entries()) {
    if (info.isActive && info.address) {
      return version
    }
  }
  return 'v6' as ContractVersion // Default to v6
}

/**
 * Get contract info by version
 */
export function getContractInfo(version: ContractVersion): ContractInfo | undefined {
  return contractRegistry.get(version)
}

/**
 * Get contract address by version
 */
export function getContractAddress(version: ContractVersion): string {
  return contractRegistry.get(version)?.address || ''
}

/**
 * Get all deployed contracts (with addresses)
 */
export function getAllDeployedContracts(): ContractInfo[] {
  return Array.from(contractRegistry.values()).filter(c => c.address && c.address.length === 42)
}

/**
 * Get all mintable contracts
 */
export function getMintableContracts(): ContractInfo[] {
  return getAllDeployedContracts().filter(c => c.isMintable)
}

/**
 * Get total registered contract count
 */
export function getRegisteredContractCount(): number {
  return contractRegistry.size
}

/**
 * Get highest registered version number
 */
export function getHighestVersion(): number {
  let highest = 0
  for (const version of contractRegistry.keys()) {
    const num = parseInt(version.slice(1))
    if (num > highest) highest = num
  }
  return highest
}

/**
 * Create an ethers Contract instance for a specific version
 */
export function getContractByVersion(version: ContractVersion, signerOrProvider?: ethers.Signer | ethers.Provider): ethers.Contract {
  const info = getContractInfo(version)
  if (!info || !info.address) {
    throw new Error(`Contract ${version} not deployed or not registered`)
  }
  const sp = signerOrProvider || getProvider()
  return new ethers.Contract(info.address, info.abi, sp)
}

/**
 * Get contract instance by address (finds version automatically)
 */
export function getContractByAddress(address: string, signerOrProvider?: ethers.Signer | ethers.Provider): ethers.Contract | null {
  const normalizedAddress = address.toLowerCase()
  for (const info of Object.values(CONTRACT_REGISTRY)) {
    if (info.address.toLowerCase() === normalizedAddress) {
      const sp = signerOrProvider || getProvider()
      return new ethers.Contract(info.address, info.abi, sp)
    }
  }
  return null
}

/**
 * Get version from address
 */
export function getVersionFromAddress(address: string): ContractVersion | null {
  const normalizedAddress = address.toLowerCase()
  for (const [version, info] of Object.entries(CONTRACT_REGISTRY)) {
    if (info.address.toLowerCase() === normalizedAddress) {
      return version as ContractVersion
    }
  }
  return null
}

/**
 * Check if a feature is supported by a contract version
 */
export function hasFeature(version: ContractVersion, feature: keyof ContractFeatures): boolean {
  return CONTRACT_REGISTRY[version]?.features[feature] || false
}

/**
 * Query NFTs owned by a wallet across ALL contracts
 */
export async function getWalletNFTsAllContracts(walletAddress: string): Promise<Array<{
  tokenId: number
  contractVersion: ContractVersion
  contractAddress: string
  owner: string
  tokenURI: string
}>> {
  const provider = getProvider()
  const results: Array<{
    tokenId: number
    contractVersion: ContractVersion
    contractAddress: string
    owner: string
    tokenURI: string
  }> = []
  
  for (const info of getMintableContracts()) {
    try {
      const contract = new ethers.Contract(info.address, info.abi, provider)
      const balance = await contract.balanceOf(walletAddress)
      
      for (let i = 0; i < Number(balance); i++) {
        try {
          const tokenId = await contract.tokenOfOwnerByIndex(walletAddress, i)
          const tokenURI = await contract.tokenURI(tokenId)
          results.push({
            tokenId: Number(tokenId),
            contractVersion: info.version,
            contractAddress: info.address,
            owner: walletAddress,
            tokenURI
          })
        } catch (e) {
          // Token might have been transferred, skip
        }
      }
    } catch (e) {
      console.error(`Error querying ${info.version}:`, e)
    }
  }
  
  return results
}

/**
 * Get total supply across all contracts
 */
export async function getTotalSupplyAllContracts(): Promise<{
  total: number
  byContract: Record<ContractVersion, number>
}> {
  const provider = getProvider()
  const byContract: Record<string, number> = {}
  let total = 0
  
  for (const info of getMintableContracts()) {
    try {
      const contract = new ethers.Contract(info.address, info.abi, provider)
      const supply = await contract.totalSupply()
      byContract[info.version] = Number(supply)
      total += Number(supply)
    } catch (e) {
      byContract[info.version] = 0
    }
  }
  
  return { total, byContract: byContract as Record<ContractVersion, number> }
}
