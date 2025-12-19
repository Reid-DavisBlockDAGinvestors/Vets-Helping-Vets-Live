/**
 * Test suite for multi-contract routing
 * 
 * Problem: Explorer links use hardcoded CONTRACT_ADDRESS instead of NFT's actual contract
 * - V5 NFTs should link to V5 contract: 0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890
 * - V6 NFTs should link to V6 contract: 0xaE54e4E8A75a81780361570c17b8660CEaD27053
 * 
 * This test suite verifies correct contract routing throughout the application
 */

import { describe, it, expect } from 'vitest'

// Contract addresses
const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const V6_CONTRACT = '0xaE54e4E8A75a81780361570c17b8660CEaD27053'
const EXPLORER_URL = 'https://awakening.bdagscan.com'

// Types matching the application
type OwnedNFT = {
  tokenId: number
  campaignId: number
  contractAddress: string
  contractVersion: string
}

type Campaign = {
  id: string
  campaignId: number | null
  contractAddress?: string
  contractVersion?: string
}

type Submission = {
  id: string
  campaign_id: number | null
  contract_address?: string
  contract_version?: string
}

/**
 * Get the correct explorer URL for an NFT based on its contract address
 */
function getExplorerUrl(nft: OwnedNFT): string {
  return `${EXPLORER_URL}/address/${nft.contractAddress}`
}

/**
 * Get the correct explorer URL for a campaign based on its contract address
 */
function getCampaignExplorerUrl(campaign: Campaign): string {
  // Use campaign's contract address, fall back to V5 for legacy
  const contractAddress = campaign.contractAddress || V5_CONTRACT
  return `${EXPLORER_URL}/address/${contractAddress}`
}

/**
 * Get the correct explorer URL for a submission based on its contract address
 */
function getSubmissionExplorerUrl(submission: Submission): string {
  // Use submission's contract address, fall back to V5 for legacy
  const contractAddress = submission.contract_address || V5_CONTRACT
  return `${EXPLORER_URL}/address/${contractAddress}`
}

/**
 * Determine which contract to use for new campaign creation
 */
function getActiveContractForNewCampaigns(): string {
  return V6_CONTRACT // New campaigns always go to V6
}

/**
 * Determine which contract to use for minting based on submission
 */
function getContractForMinting(submission: Submission): string {
  // Use the contract where the campaign was created
  return submission.contract_address || V5_CONTRACT
}

describe('Multi-Contract Routing', () => {
  describe('Explorer URL Generation', () => {
    it('should generate V5 explorer URL for V5 NFTs', () => {
      const v5Nft: OwnedNFT = {
        tokenId: 1,
        campaignId: 1,
        contractAddress: V5_CONTRACT,
        contractVersion: 'v5'
      }
      
      const url = getExplorerUrl(v5Nft)
      expect(url).toBe(`${EXPLORER_URL}/address/${V5_CONTRACT}`)
      expect(url).toContain('0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890')
    })

    it('should generate V6 explorer URL for V6 NFTs', () => {
      const v6Nft: OwnedNFT = {
        tokenId: 1,
        campaignId: 1,
        contractAddress: V6_CONTRACT,
        contractVersion: 'v6'
      }
      
      const url = getExplorerUrl(v6Nft)
      expect(url).toBe(`${EXPLORER_URL}/address/${V6_CONTRACT}`)
      expect(url).toContain('0xaE54e4E8A75a81780361570c17b8660CEaD27053')
    })

    it('should NOT generate same URL for V5 and V6 NFTs with same tokenId', () => {
      const v5Nft: OwnedNFT = {
        tokenId: 1,
        campaignId: 1,
        contractAddress: V5_CONTRACT,
        contractVersion: 'v5'
      }
      const v6Nft: OwnedNFT = {
        tokenId: 1,
        campaignId: 1,
        contractAddress: V6_CONTRACT,
        contractVersion: 'v6'
      }
      
      expect(getExplorerUrl(v5Nft)).not.toBe(getExplorerUrl(v6Nft))
    })
  })

  describe('Campaign Explorer URL', () => {
    it('should use campaign contract address when available', () => {
      const campaign: Campaign = {
        id: '123',
        campaignId: 1,
        contractAddress: V6_CONTRACT,
        contractVersion: 'v6'
      }
      
      const url = getCampaignExplorerUrl(campaign)
      expect(url).toContain(V6_CONTRACT)
    })

    it('should fall back to V5 for legacy campaigns without contract address', () => {
      const legacyCampaign: Campaign = {
        id: '123',
        campaignId: 1
        // No contractAddress - legacy campaign
      }
      
      const url = getCampaignExplorerUrl(legacyCampaign)
      expect(url).toContain(V5_CONTRACT)
    })
  })

  describe('Submission Explorer URL', () => {
    it('should use submission contract address when available', () => {
      const submission: Submission = {
        id: '123',
        campaign_id: 1,
        contract_address: V6_CONTRACT,
        contract_version: 'v6'
      }
      
      const url = getSubmissionExplorerUrl(submission)
      expect(url).toContain(V6_CONTRACT)
    })

    it('should fall back to V5 for legacy submissions without contract address', () => {
      const legacySubmission: Submission = {
        id: '123',
        campaign_id: 1
        // No contract_address - legacy submission
      }
      
      const url = getSubmissionExplorerUrl(legacySubmission)
      expect(url).toContain(V5_CONTRACT)
    })
  })

  describe('New Campaign Routing', () => {
    it('should route new campaigns to V6', () => {
      expect(getActiveContractForNewCampaigns()).toBe(V6_CONTRACT)
    })
  })

  describe('Minting Contract Selection', () => {
    it('should mint on V5 for V5 campaigns', () => {
      const v5Submission: Submission = {
        id: '123',
        campaign_id: 1,
        contract_address: V5_CONTRACT,
        contract_version: 'v5'
      }
      
      expect(getContractForMinting(v5Submission)).toBe(V5_CONTRACT)
    })

    it('should mint on V6 for V6 campaigns', () => {
      const v6Submission: Submission = {
        id: '123',
        campaign_id: 1,
        contract_address: V6_CONTRACT,
        contract_version: 'v6'
      }
      
      expect(getContractForMinting(v6Submission)).toBe(V6_CONTRACT)
    })

    it('should fall back to V5 for legacy submissions', () => {
      const legacySubmission: Submission = {
        id: '123',
        campaign_id: 1
      }
      
      expect(getContractForMinting(legacySubmission)).toBe(V5_CONTRACT)
    })
  })
})

describe('Contract Address Validation', () => {
  it('V5 and V6 addresses should be different', () => {
    expect(V5_CONTRACT).not.toBe(V6_CONTRACT)
  })

  it('both addresses should be valid Ethereum addresses', () => {
    expect(V5_CONTRACT).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(V6_CONTRACT).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })
})

// NFTCard/Marketplace item type with contract address
type MarketplaceItem = {
  id: string
  campaignId: number
  title: string
  contractAddress?: string
}

// Function to generate explorer URL for marketplace items (matches NFTCard.tsx logic)
function getMarketplaceExplorerUrl(item: MarketplaceItem): string {
  // Must use item's contractAddress, fall back to V5 for legacy items
  const address = item.contractAddress || V5_CONTRACT
  return `${EXPLORER_URL}/address/${address}`
}

describe('Marketplace Explorer URL', () => {
  it('should use V5 contract for V5 marketplace items', () => {
    const item: MarketplaceItem = {
      id: '1',
      campaignId: 1,
      title: 'V5 Campaign',
      contractAddress: V5_CONTRACT
    }
    const url = getMarketplaceExplorerUrl(item)
    expect(url).toBe(`${EXPLORER_URL}/address/${V5_CONTRACT}`)
    expect(url).toContain('5890') // V5 ends in 5890
  })

  it('should use V6 contract for V6 marketplace items', () => {
    const item: MarketplaceItem = {
      id: '2',
      campaignId: 2,
      title: 'V6 Campaign',
      contractAddress: V6_CONTRACT
    }
    const url = getMarketplaceExplorerUrl(item)
    expect(url).toBe(`${EXPLORER_URL}/address/${V6_CONTRACT}`)
    expect(url).toContain('7053') // V6 ends in 7053
  })

  it('should fall back to V5 for legacy items without contract address', () => {
    const item: MarketplaceItem = {
      id: '3',
      campaignId: 3,
      title: 'Legacy Campaign'
      // no contractAddress
    }
    const url = getMarketplaceExplorerUrl(item)
    expect(url).toBe(`${EXPLORER_URL}/address/${V5_CONTRACT}`)
  })

  it('V5 and V6 items should generate different URLs', () => {
    const v5Item: MarketplaceItem = { id: '1', campaignId: 1, title: 'V5', contractAddress: V5_CONTRACT }
    const v6Item: MarketplaceItem = { id: '2', campaignId: 1, title: 'V6', contractAddress: V6_CONTRACT }
    
    const v5Url = getMarketplaceExplorerUrl(v5Item)
    const v6Url = getMarketplaceExplorerUrl(v6Item)
    
    expect(v5Url).not.toBe(v6Url)
  })
})
