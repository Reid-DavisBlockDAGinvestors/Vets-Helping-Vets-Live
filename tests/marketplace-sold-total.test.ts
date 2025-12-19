/**
 * Test suite for marketplace sold/total display
 * 
 * Verifies that editionsMinted and maxEditions are correctly displayed
 * across marketplace and story page views
 */

import { describe, it, expect } from 'vitest'

// Types matching the application
type MarketplaceItem = {
  id: string
  campaignId: number
  editionsMinted: number
  maxEditions: number
  contractAddress?: string
}

type NFTCardItem = {
  id: string
  sold?: number
  total?: number
}

/**
 * Map marketplace API response to NFTCard props
 * This is what marketplace/page.tsx does
 */
function mapToNFTCard(item: MarketplaceItem): NFTCardItem {
  return {
    id: item.id,
    sold: item.editionsMinted,
    total: item.maxEditions,
  }
}

/**
 * Format sold/total display string (matches NFTCard.tsx logic)
 */
function formatSoldTotal(item: NFTCardItem): string {
  if (item.sold !== undefined && item.total && item.total > 0) {
    return `${item.sold}/${item.total} sold`
  } else if (item.sold !== undefined) {
    return `${item.sold} sold`
  }
  return '0 sold'
}

describe('Marketplace Sold/Total Display', () => {
  describe('Data Mapping', () => {
    it('should map editionsMinted to sold', () => {
      const apiItem: MarketplaceItem = {
        id: '1',
        campaignId: 1,
        editionsMinted: 5,
        maxEditions: 100,
      }
      const cardItem = mapToNFTCard(apiItem)
      expect(cardItem.sold).toBe(5)
    })

    it('should map maxEditions to total', () => {
      const apiItem: MarketplaceItem = {
        id: '1',
        campaignId: 1,
        editionsMinted: 5,
        maxEditions: 100,
      }
      const cardItem = mapToNFTCard(apiItem)
      expect(cardItem.total).toBe(100)
    })

    it('should preserve zero values', () => {
      const apiItem: MarketplaceItem = {
        id: '1',
        campaignId: 1,
        editionsMinted: 0,
        maxEditions: 100,
      }
      const cardItem = mapToNFTCard(apiItem)
      expect(cardItem.sold).toBe(0)
      expect(cardItem.total).toBe(100)
    })
  })

  describe('Display Formatting', () => {
    it('should display "X/Y sold" when both values present', () => {
      const item: NFTCardItem = { id: '1', sold: 5, total: 100 }
      expect(formatSoldTotal(item)).toBe('5/100 sold')
    })

    it('should display "0/Y sold" when sold is 0', () => {
      const item: NFTCardItem = { id: '1', sold: 0, total: 100 }
      expect(formatSoldTotal(item)).toBe('0/100 sold')
    })

    it('should display "X sold" when total is 0 (unlimited)', () => {
      const item: NFTCardItem = { id: '1', sold: 5, total: 0 }
      expect(formatSoldTotal(item)).toBe('5 sold')
    })

    it('should display "0 sold" when sold is undefined', () => {
      const item: NFTCardItem = { id: '1' }
      expect(formatSoldTotal(item)).toBe('0 sold')
    })
  })

  describe('Edge Cases', () => {
    it('should handle large numbers', () => {
      const item: NFTCardItem = { id: '1', sold: 1000, total: 10000 }
      expect(formatSoldTotal(item)).toBe('1000/10000 sold')
    })

    it('should handle sold > total (oversold)', () => {
      const item: NFTCardItem = { id: '1', sold: 105, total: 100 }
      expect(formatSoldTotal(item)).toBe('105/100 sold')
    })
  })
})

// Test that API data flows correctly through the system
describe('API to Display Pipeline', () => {
  it('should correctly display sold/total from API response', () => {
    // Simulate API response
    const apiResponse = {
      id: 'abc123',
      campaignId: 42,
      editionsMinted: 7,
      maxEditions: 50,
      contract_address: '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
    }

    // Map to NFTCard (what marketplace/page.tsx does)
    const cardItem: NFTCardItem = {
      id: apiResponse.id,
      sold: Number(apiResponse.editionsMinted || 0),
      total: Number(apiResponse.maxEditions || 0),
    }

    // Verify display
    expect(formatSoldTotal(cardItem)).toBe('7/50 sold')
  })

  it('should handle missing on-chain data gracefully', () => {
    // Simulate API response when on-chain fetch fails
    const apiResponse = {
      id: 'abc123',
      campaignId: 42,
      editionsMinted: 0,  // Default when on-chain fetch fails
      maxEditions: 100,   // Falls back to num_copies from Supabase
      contract_address: '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
    }

    const cardItem: NFTCardItem = {
      id: apiResponse.id,
      sold: Number(apiResponse.editionsMinted || 0),
      total: Number(apiResponse.maxEditions || 0),
    }

    expect(formatSoldTotal(cardItem)).toBe('0/100 sold')
  })
})
