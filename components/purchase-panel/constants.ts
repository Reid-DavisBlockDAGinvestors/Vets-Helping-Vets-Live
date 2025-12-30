/**
 * PurchasePanel Constants
 * Contract addresses, ABIs, and configuration
 */

// Contract addresses
export const CONTRACT_ADDRESS_V5 = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_V5 || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
export const CONTRACT_ADDRESS_V6 = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0xaE54e4E8A75a81780361570c17b8660CEaD27053'
export const DEFAULT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''

// Mint edition ABI for V5/V6 contracts
export const MINT_EDITION_ABI = [
  'function mintWithBDAG(uint256 campaignId) external payable returns (uint256)',
  'function mintWithBDAGAndTip(uint256 campaignId, uint256 tipAmount) external payable returns (uint256)',
  'function getCampaign(uint256 campaignId) external view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
  'function totalCampaigns() external view returns (uint256)',
  'event EditionMinted(uint256 indexed campaignId, uint256 indexed tokenId, address indexed buyer, uint256 editionNumber, uint256 amount)',
]

// Preset donation amounts
export const PRESET_AMOUNTS = [10, 25, 50, 100, 250]

// Tip options
export const TIP_OPTIONS = [0, 5, 10, 25, 50]

// Gas limit for mint transactions
export const DEFAULT_GAS_LIMIT = 600000n

// Get effective contract address based on version
export function getEffectiveContractAddress(
  contractAddress?: string,
  contractVersion?: 'v5' | 'v6'
): string {
  if (contractAddress) return contractAddress
  if (contractVersion === 'v5') return CONTRACT_ADDRESS_V5
  if (contractVersion === 'v6') return CONTRACT_ADDRESS_V6
  return DEFAULT_CONTRACT_ADDRESS
}
