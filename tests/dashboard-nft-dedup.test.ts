/**
 * Test suite for dashboard NFT deduplication
 * 
 * Problem: NFTs are duplicated in the dashboard because:
 * 1. tokenId is used as React key, but tokenIds are contract-local
 * 2. Same tokenId can exist on V5 and V6 contracts
 * 
 * Solution: Use composite key (contractAddress-tokenId) for unique identification
 */

import { describe, it, expect } from 'vitest'

// Type matching the API response
type OwnedNFT = {
  tokenId: number
  campaignId: number
  contractAddress: string
  contractVersion: string
  editionNumber: number
  totalEditions: number
  title: string
  image: string
}

/**
 * Generate a unique key for an NFT
 * This is what the dashboard SHOULD use as the React key
 */
function getNftUniqueKey(nft: OwnedNFT): string {
  return `${nft.contractAddress}-${nft.tokenId}`
}

/**
 * Check if an array of NFTs has duplicate keys
 */
function hasDuplicateKeys(nfts: OwnedNFT[], keyFn: (nft: OwnedNFT) => string | number): boolean {
  const keys = nfts.map(keyFn)
  const uniqueKeys = new Set(keys)
  return keys.length !== uniqueKeys.size
}

/**
 * Deduplicate NFTs by unique key
 */
function deduplicateNfts(nfts: OwnedNFT[]): OwnedNFT[] {
  const seen = new Set<string>()
  return nfts.filter(nft => {
    const key = getNftUniqueKey(nft)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

describe('Dashboard NFT Deduplication', () => {
  // Mock data simulating NFTs from multiple contracts with same tokenId
  const mockNftsWithDuplicateTokenIds: OwnedNFT[] = [
    {
      tokenId: 1,
      campaignId: 1,
      contractAddress: '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890', // V5
      contractVersion: 'v5',
      editionNumber: 1,
      totalEditions: 100,
      title: 'Campaign 1 on V5',
      image: 'ipfs://image1'
    },
    {
      tokenId: 1, // SAME tokenId but different contract!
      campaignId: 1,
      contractAddress: '0xaE54e4E8A75a81780361570c17b8660CEaD27053', // V6
      contractVersion: 'v6',
      editionNumber: 1,
      totalEditions: 100,
      title: 'Campaign 1 on V6',
      image: 'ipfs://image2'
    },
    {
      tokenId: 2,
      campaignId: 1,
      contractAddress: '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890', // V5
      contractVersion: 'v5',
      editionNumber: 2,
      totalEditions: 100,
      title: 'Campaign 1 Edition 2 on V5',
      image: 'ipfs://image3'
    }
  ]

  describe('Bug: Using tokenId alone as key', () => {
    it('should detect duplicates when using tokenId as key', () => {
      // This test documents the bug - using tokenId alone causes duplicates
      const hasDupes = hasDuplicateKeys(mockNftsWithDuplicateTokenIds, nft => nft.tokenId)
      expect(hasDupes).toBe(true) // Bug: tokenId 1 appears twice
    })
  })

  describe('Fix: Using composite key (contractAddress-tokenId)', () => {
    it('should NOT have duplicates when using composite key', () => {
      const hasDupes = hasDuplicateKeys(mockNftsWithDuplicateTokenIds, getNftUniqueKey)
      expect(hasDupes).toBe(false) // Each NFT is unique by contract+tokenId
    })

    it('should generate unique keys for NFTs with same tokenId on different contracts', () => {
      const key1 = getNftUniqueKey(mockNftsWithDuplicateTokenIds[0])
      const key2 = getNftUniqueKey(mockNftsWithDuplicateTokenIds[1])
      
      expect(key1).toBe('0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890-1')
      expect(key2).toBe('0xaE54e4E8A75a81780361570c17b8660CEaD27053-1')
      expect(key1).not.toBe(key2)
    })
  })

  describe('Deduplication utility', () => {
    it('should remove true duplicates (same contract + tokenId)', () => {
      const nftsWithTrueDuplicates: OwnedNFT[] = [
        ...mockNftsWithDuplicateTokenIds,
        // Add an actual duplicate (same contract AND tokenId)
        {
          tokenId: 1,
          campaignId: 1,
          contractAddress: '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890', // V5 again
          contractVersion: 'v5',
          editionNumber: 1,
          totalEditions: 100,
          title: 'Duplicate entry',
          image: 'ipfs://image1'
        }
      ]

      expect(nftsWithTrueDuplicates.length).toBe(4)
      
      const deduped = deduplicateNfts(nftsWithTrueDuplicates)
      expect(deduped.length).toBe(3) // Should remove 1 true duplicate
    })

    it('should preserve all NFTs when no true duplicates exist', () => {
      const deduped = deduplicateNfts(mockNftsWithDuplicateTokenIds)
      expect(deduped.length).toBe(3) // All 3 are unique by contract+tokenId
    })
  })

  describe('React key generation', () => {
    it('should produce stable keys for the same NFT', () => {
      const nft = mockNftsWithDuplicateTokenIds[0]
      const key1 = getNftUniqueKey(nft)
      const key2 = getNftUniqueKey(nft)
      expect(key1).toBe(key2)
    })

    it('should produce string keys suitable for React', () => {
      for (const nft of mockNftsWithDuplicateTokenIds) {
        const key = getNftUniqueKey(nft)
        expect(typeof key).toBe('string')
        expect(key.length).toBeGreaterThan(0)
      }
    })
  })
})
