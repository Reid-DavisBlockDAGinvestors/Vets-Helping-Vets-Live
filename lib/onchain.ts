import { ethers } from 'ethers'

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''

// Minimal ABI needed by our server (PatriotPledgeNFTV3)
export const PatriotPledgeV2ABI = [
  'function mint(address to, string uri, string category, uint256 goal, uint256 feeRate) external returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function tokenByIndex(uint256 index) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function campaigns(uint256 tokenId) view returns (string category, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 payoutEligible, uint256 payoutReleased, uint256 nonprofitFeeRate, address nonprofit, address submitter, bool closed)',
  'function recordContribution(uint256 tokenId, uint256 gross, uint256 net, uint256 cardFees, uint256 nonprofitFee, bool isOnchain) external',
  'function adjustPayoutEligible(uint256 tokenId, uint256 newEligible) external',
  'function markPayoutReleased(uint256 tokenId, uint256 amount, address recipient, bool onchain) external',
  'function closeCampaign(uint256 tokenId) external',
  'function withdrawToCentral(uint256 amount, address recipient) external',
  'function transferNFT(uint256 tokenId, address newOwner) external',
  'function addRaised(uint256 tokenId, uint256 amount) external',
  'function updateTokenURI(uint256 tokenId, string newUri) external',
  'function burn(uint256 tokenId) external'
]

export function getProvider() {
  const rpc = process.env.BLOCKDAG_RELAYER_RPC || process.env.BLOCKDAG_RPC || process.env.BLOCKDAG_RPC_FALLBACK
  if (!rpc) throw new Error('Missing BLOCKDAG RPC url')
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
