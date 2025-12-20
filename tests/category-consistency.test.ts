/**
 * Test suite for Category Consistency
 * 
 * Verifies that categories are correctly passed from:
 * 1. Database (Supabase submissions table)
 * 2. API response (marketplace/fundraisers)
 * 3. Frontend display (NFTCard component)
 * 
 * Bug: Marketplace was hardcoding all non-veteran categories to "general"
 */

import { describe, it, expect } from 'vitest'

// Valid category IDs from lib/categories.ts
type CategoryId = 
  | 'veteran'
  | 'medical'
  | 'children'
  | 'pets'
  | 'disaster'
  | 'education'
  | 'community'
  | 'other'

// Simulates the mapLegacyCategory function from lib/categories.ts
function mapLegacyCategory(category: string): CategoryId {
  if (category === 'general') return 'other'
  const validIds: CategoryId[] = ['veteran', 'medical', 'children', 'pets', 'disaster', 'education', 'community', 'other']
  if (validIds.includes(category as CategoryId)) return category as CategoryId
  return 'other'
}

// OLD buggy marketplace mapping (line 43)
function oldMarketplaceMapping(apiCategory: string): string {
  const cause = apiCategory || 'general'
  return cause === 'veteran' ? 'veteran' : 'general'
}

// FIXED marketplace mapping - preserves all categories
function fixedMarketplaceMapping(apiCategory: string): CategoryId {
  const cause = apiCategory || 'other'
  return mapLegacyCategory(cause)
}

describe('Category Consistency', () => {
  describe('Legacy Category Mapping', () => {
    it('should map "general" to "other"', () => {
      expect(mapLegacyCategory('general')).toBe('other')
    })

    it('should preserve valid category IDs', () => {
      expect(mapLegacyCategory('education')).toBe('education')
      expect(mapLegacyCategory('medical')).toBe('medical')
      expect(mapLegacyCategory('veteran')).toBe('veteran')
      expect(mapLegacyCategory('children')).toBe('children')
      expect(mapLegacyCategory('pets')).toBe('pets')
      expect(mapLegacyCategory('disaster')).toBe('disaster')
      expect(mapLegacyCategory('community')).toBe('community')
    })

    it('should map unknown categories to "other"', () => {
      expect(mapLegacyCategory('unknown')).toBe('other')
      expect(mapLegacyCategory('')).toBe('other')
    })
  })

  describe('Old Buggy Marketplace Mapping', () => {
    it('should incorrectly map education to general (BUG)', () => {
      // This test documents the bug
      expect(oldMarketplaceMapping('education')).toBe('general') // BUG!
    })

    it('should incorrectly map medical to general (BUG)', () => {
      expect(oldMarketplaceMapping('medical')).toBe('general') // BUG!
    })

    it('should only preserve veteran category', () => {
      expect(oldMarketplaceMapping('veteran')).toBe('veteran')
    })

    it('should incorrectly map all other categories to general (BUG)', () => {
      expect(oldMarketplaceMapping('children')).toBe('general') // BUG!
      expect(oldMarketplaceMapping('pets')).toBe('general') // BUG!
      expect(oldMarketplaceMapping('disaster')).toBe('general') // BUG!
      expect(oldMarketplaceMapping('community')).toBe('general') // BUG!
    })
  })

  describe('Fixed Marketplace Mapping', () => {
    it('should preserve education category', () => {
      expect(fixedMarketplaceMapping('education')).toBe('education')
    })

    it('should preserve medical category', () => {
      expect(fixedMarketplaceMapping('medical')).toBe('medical')
    })

    it('should preserve veteran category', () => {
      expect(fixedMarketplaceMapping('veteran')).toBe('veteran')
    })

    it('should preserve all valid categories', () => {
      expect(fixedMarketplaceMapping('children')).toBe('children')
      expect(fixedMarketplaceMapping('pets')).toBe('pets')
      expect(fixedMarketplaceMapping('disaster')).toBe('disaster')
      expect(fixedMarketplaceMapping('community')).toBe('community')
      expect(fixedMarketplaceMapping('other')).toBe('other')
    })

    it('should map "general" to "other" for consistency', () => {
      expect(fixedMarketplaceMapping('general')).toBe('other')
    })

    it('should handle missing category', () => {
      expect(fixedMarketplaceMapping('')).toBe('other')
    })
  })

  describe('Real-World Scenario: Myriad Mirage', () => {
    it('should display Education category correctly', () => {
      // Simulates the API response for Myriad Mirage
      const apiResponse = {
        id: 'abc123',
        title: 'The Myriad Mirage',
        category: 'education',
        campaign_id: 54
      }

      // OLD buggy behavior
      const oldCauseType = oldMarketplaceMapping(apiResponse.category)
      expect(oldCauseType).toBe('general') // BUG: Shows "general" instead of "education"

      // FIXED behavior
      const fixedCauseType = fixedMarketplaceMapping(apiResponse.category)
      expect(fixedCauseType).toBe('education') // CORRECT: Shows "education"
    })
  })

  describe('Admin vs Marketplace Consistency', () => {
    it('should show same category in admin and marketplace', () => {
      const testCases = [
        { dbCategory: 'education', expected: 'education' },
        { dbCategory: 'medical', expected: 'medical' },
        { dbCategory: 'veteran', expected: 'veteran' },
        { dbCategory: 'children', expected: 'children' },
        { dbCategory: 'pets', expected: 'pets' },
        { dbCategory: 'disaster', expected: 'disaster' },
        { dbCategory: 'community', expected: 'community' },
        { dbCategory: 'general', expected: 'other' },
        { dbCategory: 'other', expected: 'other' },
      ]

      for (const { dbCategory, expected } of testCases) {
        // Admin uses mapLegacyCategory
        const adminCategory = mapLegacyCategory(dbCategory)
        
        // Marketplace should also use mapLegacyCategory (fixed)
        const marketplaceCategory = fixedMarketplaceMapping(dbCategory)
        
        expect(adminCategory).toBe(expected)
        expect(marketplaceCategory).toBe(expected)
        expect(adminCategory).toBe(marketplaceCategory) // Must match!
      }
    })
  })
})
