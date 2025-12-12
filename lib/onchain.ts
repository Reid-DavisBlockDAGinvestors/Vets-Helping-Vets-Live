import { ethers } from 'ethers'

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

export function getProvider() {
  const rpc = process.env.BLOCKDAG_RPC || process.env.BLOCKDAG_RPC_FALLBACK || process.env.BLOCKDAG_RELAYER_RPC
  if (!rpc) throw new Error('Missing BLOCKDAG RPC url')
  
  // Check if using NowNodes and add API key header
  const nowNodesKey = process.env.NOWNODES_API_KEY
  if (rpc.includes('nownodes.io') && nowNodesKey) {
    const fetchReq = new ethers.FetchRequest(rpc)
    fetchReq.setHeader('api-key', nowNodesKey)
    return new ethers.JsonRpcProvider(fetchReq, undefined, { staticNetwork: true })
  }
  
  return new ethers.JsonRpcProvider(rpc)
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
