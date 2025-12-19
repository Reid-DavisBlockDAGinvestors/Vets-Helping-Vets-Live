/**
 * Multi-contract registry for PatriotPledge NFT platform
 * Supports V5, V6, and future contract versions
 */

import { ethers } from 'ethers'
import { getProvider } from './onchain'

// Contract version type
export type ContractVersion = 'v5' | 'v6' | 'v7' | 'v8' | 'v9' | 'v10'

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

// Contract registry
export const CONTRACT_REGISTRY: Record<ContractVersion, ContractInfo> = {
  v5: {
    version: 'v5',
    address: process.env.CONTRACT_ADDRESS_V5 || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_V5 || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890',
    name: 'PatriotPledgeNFTV5',
    chainId: 1043,
    isActive: false,    // No new campaigns on V5
    isMintable: true,   // Can still mint existing campaigns
    features: {
      batchMint: false,
      royalties: false,
      pausable: false,
      burnable: false,
      setTokenURI: false,
      freezable: false,
      blacklist: false,
      soulbound: false
    },
    abi: V5_ABI
  },
  v6: {
    version: 'v6',
    address: process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0xaE54e4E8A75a81780361570c17b8660CEaD27053',
    name: 'PatriotPledgeNFTV6',
    chainId: 1043,
    isActive: true,     // New campaigns go here
    isMintable: true,
    features: {
      batchMint: true,
      royalties: true,
      pausable: true,
      burnable: true,
      setTokenURI: true,
      freezable: true,
      blacklist: true,
      soulbound: true
    },
    abi: V6_ABI
  },
  // Placeholder for future versions
  v7: { version: 'v7', address: '', name: '', chainId: 1043, isActive: false, isMintable: false, features: { batchMint: false, royalties: false, pausable: false, burnable: false, setTokenURI: false, freezable: false, blacklist: false, soulbound: false }, abi: [] },
  v8: { version: 'v8', address: '', name: '', chainId: 1043, isActive: false, isMintable: false, features: { batchMint: false, royalties: false, pausable: false, burnable: false, setTokenURI: false, freezable: false, blacklist: false, soulbound: false }, abi: [] },
  v9: { version: 'v9', address: '', name: '', chainId: 1043, isActive: false, isMintable: false, features: { batchMint: false, royalties: false, pausable: false, burnable: false, setTokenURI: false, freezable: false, blacklist: false, soulbound: false }, abi: [] },
  v10: { version: 'v10', address: '', name: '', chainId: 1043, isActive: false, isMintable: false, features: { batchMint: false, royalties: false, pausable: false, burnable: false, setTokenURI: false, freezable: false, blacklist: false, soulbound: false }, abi: [] }
}

/**
 * Get the currently active contract version for new campaigns
 */
export function getActiveContractVersion(): ContractVersion {
  for (const [version, info] of Object.entries(CONTRACT_REGISTRY)) {
    if (info.isActive && info.address) {
      return version as ContractVersion
    }
  }
  return 'v6' // Default to v6
}

/**
 * Get contract info by version
 */
export function getContractInfo(version: ContractVersion): ContractInfo {
  return CONTRACT_REGISTRY[version]
}

/**
 * Get contract address by version
 */
export function getContractAddress(version: ContractVersion): string {
  return CONTRACT_REGISTRY[version]?.address || ''
}

/**
 * Get all deployed contracts (with addresses)
 */
export function getAllDeployedContracts(): ContractInfo[] {
  return Object.values(CONTRACT_REGISTRY).filter(c => c.address && c.address.length === 42)
}

/**
 * Get all mintable contracts
 */
export function getMintableContracts(): ContractInfo[] {
  return getAllDeployedContracts().filter(c => c.isMintable)
}

/**
 * Create an ethers Contract instance for a specific version
 */
export function getContractByVersion(version: ContractVersion, signerOrProvider?: ethers.Signer | ethers.Provider): ethers.Contract {
  const info = getContractInfo(version)
  if (!info.address) {
    throw new Error(`Contract ${version} not deployed`)
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
