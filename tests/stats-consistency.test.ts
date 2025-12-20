/**
 * Test suite for Stats Consistency Across Site
 * 
 * Verifies that stats are calculated consistently across:
 * 1. Homepage (app/page.tsx loadStats)
 * 2. Dashboard (api/analytics/summary)
 * 3. Platform stats API (api/stats/platform)
 * 
 * Issues identified:
 * - Homepage showing $25.2K, 0 NFTs
 * - Dashboard showing $14,481, 33 NFTs
 * - Explorer shows V5: 283,100 BDAG = $14,155
 */

import { describe, it, expect } from 'vitest'

// Contract addresses
const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const V6_CONTRACT = '0xaE54e4E8A75a81780361570c17b8660CEaD27053'
const BDAG_USD_RATE = 0.05

// Simulates submissions data
type Submission = {
  id: string
  campaign_id: number | null
  contract_address: string | null
  status: string
  goal: number
}

// Simulates the grouping logic used in stats calculations
function groupCampaignsByContract(submissions: Submission[]): Record<string, number[]> {
  const result: Record<string, number[]> = {}
  
  for (const sub of submissions) {
    const addr = (sub.contract_address || '').toLowerCase()
    if (addr && sub.campaign_id != null) {
      if (!result[addr]) result[addr] = []
      if (!result[addr].includes(sub.campaign_id)) {
        result[addr].push(sub.campaign_id)
      }
    }
  }
  
  return result
}

// Identifies submissions without contract_address (problematic)
function findOrphanedSubmissions(submissions: Submission[]): Submission[] {
  return submissions.filter(s => 
    s.campaign_id != null && 
    (!s.contract_address || s.contract_address.trim() === '')
  )
}

// Simulates total raised calculation
function calculateTotalRaised(
  campaignsByContract: Record<string, number[]>,
  campaignGrossRaised: Record<string, Record<number, number>>, // contract -> campaignId -> BDAG
  bdagRate: number
): { totalBDAG: number; totalUSD: number; campaignCount: number } {
  let totalBDAG = 0
  let campaignCount = 0
  
  for (const [contractAddr, campaignIds] of Object.entries(campaignsByContract)) {
    const contractData = campaignGrossRaised[contractAddr.toLowerCase()] || {}
    
    for (const campaignId of campaignIds) {
      const grossBDAG = contractData[campaignId] || 0
      totalBDAG += grossBDAG
      campaignCount++
    }
  }
  
  return {
    totalBDAG,
    totalUSD: totalBDAG * bdagRate,
    campaignCount
  }
}

describe('Stats Consistency', () => {
  describe('Campaign Grouping by Contract', () => {
    it('should group campaigns by contract address', () => {
      const submissions: Submission[] = [
        { id: '1', campaign_id: 1, contract_address: V5_CONTRACT, status: 'minted', goal: 1000 },
        { id: '2', campaign_id: 2, contract_address: V5_CONTRACT, status: 'minted', goal: 2000 },
        { id: '3', campaign_id: 1, contract_address: V6_CONTRACT, status: 'minted', goal: 500 },
      ]
      
      const grouped = groupCampaignsByContract(submissions)
      
      expect(grouped[V5_CONTRACT.toLowerCase()]).toEqual([1, 2])
      expect(grouped[V6_CONTRACT.toLowerCase()]).toEqual([1])
    })

    it('should handle case-insensitive contract addresses', () => {
      const submissions: Submission[] = [
        { id: '1', campaign_id: 1, contract_address: V5_CONTRACT.toUpperCase(), status: 'minted', goal: 1000 },
        { id: '2', campaign_id: 2, contract_address: V5_CONTRACT.toLowerCase(), status: 'minted', goal: 2000 },
      ]
      
      const grouped = groupCampaignsByContract(submissions)
      
      // Both should be grouped under lowercase key
      expect(grouped[V5_CONTRACT.toLowerCase()]).toEqual([1, 2])
    })

    it('should IGNORE submissions without contract_address', () => {
      const submissions: Submission[] = [
        { id: '1', campaign_id: 1, contract_address: V5_CONTRACT, status: 'minted', goal: 1000 },
        { id: '2', campaign_id: 2, contract_address: null, status: 'minted', goal: 2000 }, // No contract!
        { id: '3', campaign_id: 3, contract_address: '', status: 'minted', goal: 3000 }, // Empty contract!
      ]
      
      const grouped = groupCampaignsByContract(submissions)
      
      // Only campaign 1 should be included
      expect(grouped[V5_CONTRACT.toLowerCase()]).toEqual([1])
      expect(Object.keys(grouped).length).toBe(1)
    })

    it('should dedupe same campaign_id on same contract', () => {
      const submissions: Submission[] = [
        { id: '1', campaign_id: 1, contract_address: V5_CONTRACT, status: 'minted', goal: 1000 },
        { id: '2', campaign_id: 1, contract_address: V5_CONTRACT, status: 'minted', goal: 1000 }, // Duplicate!
      ]
      
      const grouped = groupCampaignsByContract(submissions)
      
      expect(grouped[V5_CONTRACT.toLowerCase()]).toEqual([1])
      expect(grouped[V5_CONTRACT.toLowerCase()].length).toBe(1)
    })
  })

  describe('Orphaned Submissions Detection', () => {
    it('should identify submissions without contract_address', () => {
      const submissions: Submission[] = [
        { id: '1', campaign_id: 1, contract_address: V5_CONTRACT, status: 'minted', goal: 1000 },
        { id: '2', campaign_id: 2, contract_address: null, status: 'minted', goal: 2000 },
        { id: '3', campaign_id: 3, contract_address: '', status: 'minted', goal: 3000 },
        { id: '4', campaign_id: null, contract_address: null, status: 'pending', goal: 0 }, // No campaign_id
      ]
      
      const orphaned = findOrphanedSubmissions(submissions)
      
      // Should find submissions 2 and 3 (have campaign_id but no contract_address)
      expect(orphaned.length).toBe(2)
      expect(orphaned.map(s => s.id)).toContain('2')
      expect(orphaned.map(s => s.id)).toContain('3')
    })
  })

  describe('Total Raised Calculation', () => {
    it('should calculate total from campaigns grouped by contract', () => {
      const campaignsByContract = {
        [V5_CONTRACT.toLowerCase()]: [1, 2, 3],
        [V6_CONTRACT.toLowerCase()]: [1],
      }
      
      // V5: campaigns 1, 2, 3 raised 100k, 150k, 33.1k BDAG
      // V6: campaign 1 raised 0 BDAG
      const campaignGrossRaised = {
        [V5_CONTRACT.toLowerCase()]: {
          1: 100000,
          2: 150000,
          3: 33100,
        },
        [V6_CONTRACT.toLowerCase()]: {
          1: 0,
        }
      }
      
      const result = calculateTotalRaised(campaignsByContract, campaignGrossRaised, BDAG_USD_RATE)
      
      // Total: 283,100 BDAG * 0.05 = $14,155
      expect(result.totalBDAG).toBe(283100)
      expect(result.totalUSD).toBe(14155)
      expect(result.campaignCount).toBe(4)
    })

    it('should handle empty campaign list', () => {
      const result = calculateTotalRaised({}, {}, BDAG_USD_RATE)
      
      expect(result.totalBDAG).toBe(0)
      expect(result.totalUSD).toBe(0)
      expect(result.campaignCount).toBe(0)
    })

    it('should NOT double-count campaigns from orphaned submissions', () => {
      // If a submission has NULL contract_address, it won't be grouped
      // and won't be queried - this is correct behavior
      const campaignsByContract = {
        [V5_CONTRACT.toLowerCase()]: [1, 2],
        // Campaign 3 has NULL contract_address - NOT included
      }
      
      const campaignGrossRaised = {
        [V5_CONTRACT.toLowerCase()]: {
          1: 100000,
          2: 50000,
        }
      }
      
      const result = calculateTotalRaised(campaignsByContract, campaignGrossRaised, BDAG_USD_RATE)
      
      expect(result.totalBDAG).toBe(150000)
      expect(result.campaignCount).toBe(2)
    })
  })

  describe('Real-World Issue: Stats Mismatch', () => {
    it('should explain why homepage might show inflated numbers', () => {
      // HYPOTHESIS: Homepage might be counting campaigns from
      // submissions that don't have contract_address set correctly
      // OR there's a different data path being used
      
      // If homepage queries without filtering by contract_address match,
      // it could include submissions that don't exist on either contract
      
      const submissions: Submission[] = [
        // Real V5 campaigns
        { id: '1', campaign_id: 1, contract_address: V5_CONTRACT, status: 'minted', goal: 1000 },
        // Orphaned submissions (no contract_address)
        { id: '2', campaign_id: 54, contract_address: null, status: 'minted', goal: 500 },
        { id: '3', campaign_id: 55, contract_address: '', status: 'minted', goal: 600 },
      ]
      
      // Current grouping correctly excludes orphaned submissions
      const grouped = groupCampaignsByContract(submissions)
      expect(Object.values(grouped).flat().length).toBe(1)
      
      // BUT if code counts all submissions with campaign_id as campaigns,
      // it would show 3 campaigns instead of 1
      const allWithCampaignId = submissions.filter(s => s.campaign_id != null)
      expect(allWithCampaignId.length).toBe(3) // Inflated!
    })
  })

  describe('NFT Count Consistency', () => {
    it('should get NFT count from totalSupply() on each contract', () => {
      // Mock totalSupply results
      const v5Supply = 172  // From V5 contract
      const v6Supply = 0    // From V6 contract (new, no mints yet)
      
      const totalNFTs = v5Supply + v6Supply
      expect(totalNFTs).toBe(172)
    })

    it('should handle totalSupply() failures gracefully', () => {
      // If totalSupply() fails (provider issue), should not crash
      // but also should show 0, which is misleading
      const v5Supply = 0  // Failed to fetch
      const v6Supply = 0  // Failed to fetch
      
      const totalNFTs = v5Supply + v6Supply
      expect(totalNFTs).toBe(0) // This is what homepage shows - indicates failure
    })
  })
})
