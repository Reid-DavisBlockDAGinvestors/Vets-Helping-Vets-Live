import { ethers } from 'ethers'
import { logger } from './logger'

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''

// V5 ABI - Edition-based fundraiser NFTs
export const PatriotPledgeV5ABI = [
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

// Alias for backwards compatibility
export const PatriotPledgeV2ABI = PatriotPledgeV5ABI

// Cache provider to avoid recreating on every call
let cachedProvider: ethers.JsonRpcProvider | null = null
let cachedProviderRpc: string | null = null

/**
 * Get blockchain provider with automatic fallback
 * Priority: Standard BlockDAG RPC first, NowNodes as backup
 */
export function getProvider(): ethers.JsonRpcProvider {
  // Primary RPC (standard BlockDAG)
  const primaryRpc = process.env.BLOCKDAG_RPC || 'https://rpc.awakening.bdagscan.com'
  // Fallback RPC (NowNodes - paid service, use sparingly)
  const fallbackRpc = process.env.BLOCKDAG_RPC_FALLBACK || 'https://bdag.nownodes.io'
  const nowNodesKey = process.env.NOWNODES_API_KEY
  
  // Use cached provider if available and same RPC
  if (cachedProvider && cachedProviderRpc === primaryRpc) {
    return cachedProvider
  }
  
  // Create provider for primary RPC
  cachedProviderRpc = primaryRpc
  cachedProvider = new ethers.JsonRpcProvider(primaryRpc, undefined, { staticNetwork: true })
  
  return cachedProvider
}

/**
 * Get provider with NowNodes (for when standard RPC fails)
 * Only use this when you know the standard RPC is down
 */
export function getNowNodesProvider(): ethers.JsonRpcProvider {
  const nowNodesRpc = process.env.BLOCKDAG_RPC_FALLBACK || 'https://bdag.nownodes.io'
  const nowNodesKey = process.env.NOWNODES_API_KEY
  
  if (nowNodesKey) {
    const fetchReq = new ethers.FetchRequest(nowNodesRpc)
    fetchReq.setHeader('api-key', nowNodesKey)
    return new ethers.JsonRpcProvider(fetchReq, undefined, { staticNetwork: true })
  }
  
  return new ethers.JsonRpcProvider(nowNodesRpc, undefined, { staticNetwork: true })
}

// V5 Contract address for testing RPC connectivity
const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'

/**
 * Smart provider that tries primary first, falls back to NowNodes on failure
 * Tests actual contract data read to ensure RPC is working properly
 */
export async function getProviderWithFallback(): Promise<ethers.JsonRpcProvider> {
  const primaryProvider = getProvider()
  
  try {
    // Test if primary RPC can actually read contract data
    // This is more reliable than just checking block number
    const contract = new ethers.Contract(V5_CONTRACT, ['function totalSupply() view returns (uint256)'], primaryProvider)
    const supply = await contract.totalSupply()
    
    // If we get a valid response, primary RPC is working
    if (supply !== undefined && supply !== null) {
      logger.blockchain(`Primary RPC working (V5 supply: ${supply})`)
      return primaryProvider
    }
    
    throw new Error('Contract returned empty data')
  } catch (e: any) {
    logger.blockchain(`Primary RPC failed: ${e?.message?.slice(0, 50)}... Falling back to NowNodes.`)
    return getNowNodesProvider()
  }
}

export function getRelayerSigner() {
  const pk = process.env.BDAG_RELAYER_KEY
  if (!pk) throw new Error('Missing BDAG_RELAYER_KEY')
  return new ethers.Wallet(pk, getProvider())
}

export function getContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  const sp = signerOrProvider || getProvider()
  if (!CONTRACT_ADDRESS) throw new Error('Missing CONTRACT_ADDRESS/NEXT_PUBLIC_CONTRACT_ADDRESS')
  return new ethers.Contract(CONTRACT_ADDRESS, PatriotPledgeV2ABI, sp)
}
