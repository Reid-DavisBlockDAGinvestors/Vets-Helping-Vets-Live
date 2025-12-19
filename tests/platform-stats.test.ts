/**
 * Test suite for Platform Statistics Aggregation
 * 
 * The platform needs to track total raised from multiple sources:
 * 1. On-chain: V5 contract (0x96bB...5890)
 * 2. On-chain: V6 contract (0xaE54...7053)
 * 3. Future on-chain: V7+ contracts
 * 4. Off-chain: Stripe, PayPal, CashApp, Venmo (future)
 * 
 * Key considerations:
 * - Track GROSS contributions, not current balance (payouts reduce balance)
 * - Each campaign tracks its own grossRaised on-chain
 * - Off-chain payments will be recorded in database
 */

import { describe, it, expect } from 'vitest'

// Contract addresses
const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const V6_CONTRACT = '0xaE54e4E8A75a81780361570c17b8660CEaD27053'
const BDAG_USD_RATE = 0.05

// Types for platform stats
type PaymentSource = 
  | 'contract_v5' 
  | 'contract_v6' 
  | 'contract_v7'
  | 'stripe' 
  | 'paypal' 
  | 'cashapp' 
  | 'venmo'
  | 'crypto_other'

type ContributionRecord = {
  id: string
  source: PaymentSource
  campaign_id: number
  amount_usd: number
  amount_native?: number  // BDAG for on-chain, currency amount for fiat
  native_currency?: string  // 'BDAG', 'USD', 'EUR', etc.
  tx_hash?: string  // For on-chain transactions
  payment_id?: string  // For fiat payments (Stripe payment_intent, PayPal order_id, etc.)
  created_at: string
  is_onchain: boolean
}

type PlatformStats = {
  total_raised_usd: number
  total_campaigns: number
  total_nfts_minted: number
  breakdown_by_source: Record<PaymentSource, number>
  last_updated: string
}

/**
 * Aggregate on-chain contributions from a single contract
 * Returns total grossRaised in USD for all campaigns on that contract
 */
function aggregateContractContributions(
  campaigns: Array<{ campaignId: number; grossRaisedBDAG: number }>,
  bdagUsdRate: number
): number {
  return campaigns.reduce((total, c) => {
    return total + (c.grossRaisedBDAG * bdagUsdRate)
  }, 0)
}

/**
 * Aggregate off-chain contributions from database records
 */
function aggregateOffchainContributions(
  records: ContributionRecord[]
): Record<PaymentSource, number> {
  const totals: Record<string, number> = {}
  
  for (const record of records) {
    if (!record.is_onchain) {
      totals[record.source] = (totals[record.source] || 0) + record.amount_usd
    }
  }
  
  return totals as Record<PaymentSource, number>
}

/**
 * Calculate total platform stats from all sources
 */
function calculatePlatformStats(
  v5Campaigns: Array<{ campaignId: number; grossRaisedBDAG: number }>,
  v6Campaigns: Array<{ campaignId: number; grossRaisedBDAG: number }>,
  offchainRecords: ContributionRecord[],
  totalNfts: { v5: number; v6: number },
  bdagUsdRate: number
): PlatformStats {
  const v5Total = aggregateContractContributions(v5Campaigns, bdagUsdRate)
  const v6Total = aggregateContractContributions(v6Campaigns, bdagUsdRate)
  const offchainTotals = aggregateOffchainContributions(offchainRecords)
  
  const breakdown: Record<PaymentSource, number> = {
    contract_v5: v5Total,
    contract_v6: v6Total,
    contract_v7: 0,
    stripe: offchainTotals.stripe || 0,
    paypal: offchainTotals.paypal || 0,
    cashapp: offchainTotals.cashapp || 0,
    venmo: offchainTotals.venmo || 0,
    crypto_other: offchainTotals.crypto_other || 0,
  }
  
  const totalRaised = Object.values(breakdown).reduce((a, b) => a + b, 0)
  const totalCampaigns = v5Campaigns.length + v6Campaigns.length
  const totalNftsMinted = totalNfts.v5 + totalNfts.v6
  
  return {
    total_raised_usd: totalRaised,
    total_campaigns: totalCampaigns,
    total_nfts_minted: totalNftsMinted,
    breakdown_by_source: breakdown,
    last_updated: new Date().toISOString()
  }
}

describe('Platform Stats Aggregation', () => {
  describe('On-Chain Aggregation', () => {
    it('should aggregate V5 contract contributions', () => {
      const v5Campaigns = [
        { campaignId: 1, grossRaisedBDAG: 1000 },
        { campaignId: 2, grossRaisedBDAG: 2000 },
        { campaignId: 3, grossRaisedBDAG: 500 },
      ]
      
      const total = aggregateContractContributions(v5Campaigns, BDAG_USD_RATE)
      expect(total).toBe(175) // 3500 BDAG * 0.05 = $175
    })

    it('should aggregate V6 contract contributions', () => {
      const v6Campaigns = [
        { campaignId: 1, grossRaisedBDAG: 5000 },
        { campaignId: 2, grossRaisedBDAG: 10000 },
      ]
      
      const total = aggregateContractContributions(v6Campaigns, BDAG_USD_RATE)
      expect(total).toBe(750) // 15000 BDAG * 0.05 = $750
    })

    it('should handle empty campaign list', () => {
      const total = aggregateContractContributions([], BDAG_USD_RATE)
      expect(total).toBe(0)
    })

    it('should handle large BDAG amounts correctly', () => {
      // V5 contract has 283,100 BDAG from the screenshot
      const v5Campaigns = [
        { campaignId: 1, grossRaisedBDAG: 283100 },
      ]
      
      const total = aggregateContractContributions(v5Campaigns, BDAG_USD_RATE)
      expect(total).toBe(14155) // 283100 * 0.05 = $14,155
    })
  })

  describe('Off-Chain Aggregation', () => {
    it('should aggregate Stripe payments', () => {
      const records: ContributionRecord[] = [
        { id: '1', source: 'stripe', campaign_id: 1, amount_usd: 100, created_at: '', is_onchain: false },
        { id: '2', source: 'stripe', campaign_id: 2, amount_usd: 50, created_at: '', is_onchain: false },
      ]
      
      const totals = aggregateOffchainContributions(records)
      expect(totals.stripe).toBe(150)
    })

    it('should aggregate multiple payment sources', () => {
      const records: ContributionRecord[] = [
        { id: '1', source: 'stripe', campaign_id: 1, amount_usd: 100, created_at: '', is_onchain: false },
        { id: '2', source: 'paypal', campaign_id: 1, amount_usd: 75, created_at: '', is_onchain: false },
        { id: '3', source: 'cashapp', campaign_id: 2, amount_usd: 25, created_at: '', is_onchain: false },
        { id: '4', source: 'venmo', campaign_id: 2, amount_usd: 50, created_at: '', is_onchain: false },
      ]
      
      const totals = aggregateOffchainContributions(records)
      expect(totals.stripe).toBe(100)
      expect(totals.paypal).toBe(75)
      expect(totals.cashapp).toBe(25)
      expect(totals.venmo).toBe(50)
    })

    it('should NOT include on-chain records in off-chain totals', () => {
      const records: ContributionRecord[] = [
        { id: '1', source: 'contract_v5', campaign_id: 1, amount_usd: 1000, created_at: '', is_onchain: true },
        { id: '2', source: 'stripe', campaign_id: 1, amount_usd: 100, created_at: '', is_onchain: false },
      ]
      
      const totals = aggregateOffchainContributions(records)
      expect(totals.stripe).toBe(100)
      expect(totals.contract_v5).toBeUndefined()
    })
  })

  describe('Total Platform Stats', () => {
    it('should calculate total raised from all sources', () => {
      const v5Campaigns = [{ campaignId: 1, grossRaisedBDAG: 100000 }] // $5,000
      const v6Campaigns = [{ campaignId: 1, grossRaisedBDAG: 50000 }]  // $2,500
      const offchainRecords: ContributionRecord[] = [
        { id: '1', source: 'stripe', campaign_id: 1, amount_usd: 500, created_at: '', is_onchain: false },
      ]
      const totalNfts = { v5: 100, v6: 50 }
      
      const stats = calculatePlatformStats(v5Campaigns, v6Campaigns, offchainRecords, totalNfts, BDAG_USD_RATE)
      
      expect(stats.total_raised_usd).toBe(8000) // $5000 + $2500 + $500
      expect(stats.breakdown_by_source.contract_v5).toBe(5000)
      expect(stats.breakdown_by_source.contract_v6).toBe(2500)
      expect(stats.breakdown_by_source.stripe).toBe(500)
    })

    it('should count campaigns from both contracts', () => {
      const v5Campaigns = [
        { campaignId: 1, grossRaisedBDAG: 1000 },
        { campaignId: 2, grossRaisedBDAG: 2000 },
      ]
      const v6Campaigns = [
        { campaignId: 1, grossRaisedBDAG: 500 },
      ]
      
      const stats = calculatePlatformStats(v5Campaigns, v6Campaigns, [], { v5: 10, v6: 5 }, BDAG_USD_RATE)
      
      expect(stats.total_campaigns).toBe(3)
    })

    it('should count NFTs from both contracts', () => {
      const stats = calculatePlatformStats([], [], [], { v5: 150, v6: 213 }, BDAG_USD_RATE)
      
      expect(stats.total_nfts_minted).toBe(363)
    })

    it('should provide breakdown by source', () => {
      const v5Campaigns = [{ campaignId: 1, grossRaisedBDAG: 20000 }]
      const v6Campaigns = [{ campaignId: 1, grossRaisedBDAG: 10000 }]
      const offchainRecords: ContributionRecord[] = [
        { id: '1', source: 'stripe', campaign_id: 1, amount_usd: 200, created_at: '', is_onchain: false },
        { id: '2', source: 'paypal', campaign_id: 1, amount_usd: 100, created_at: '', is_onchain: false },
      ]
      
      const stats = calculatePlatformStats(v5Campaigns, v6Campaigns, offchainRecords, { v5: 0, v6: 0 }, BDAG_USD_RATE)
      
      expect(stats.breakdown_by_source.contract_v5).toBe(1000)  // 20000 * 0.05
      expect(stats.breakdown_by_source.contract_v6).toBe(500)   // 10000 * 0.05
      expect(stats.breakdown_by_source.stripe).toBe(200)
      expect(stats.breakdown_by_source.paypal).toBe(100)
      expect(stats.breakdown_by_source.cashapp).toBe(0)
      expect(stats.breakdown_by_source.venmo).toBe(0)
    })
  })

  describe('Real-World Scenario', () => {
    it('should match the blockchain explorer data', () => {
      // From screenshot: V5 contract has 283,100 BDAG = $14,155
      // V6 contract may have additional funds
      const v5Campaigns = [
        // Assuming all V5 campaigns total to 283,100 BDAG
        { campaignId: 1, grossRaisedBDAG: 283100 },
      ]
      const v6Campaigns: Array<{ campaignId: number; grossRaisedBDAG: number }> = []
      
      const stats = calculatePlatformStats(v5Campaigns, v6Campaigns, [], { v5: 172, v6: 0 }, BDAG_USD_RATE)
      
      expect(stats.total_raised_usd).toBeCloseTo(14155, 0)
      expect(stats.breakdown_by_source.contract_v5).toBeCloseTo(14155, 0)
    })

    it('should handle future expansion with new payment sources', () => {
      const v5Campaigns = [{ campaignId: 1, grossRaisedBDAG: 10000 }]
      const v6Campaigns = [{ campaignId: 1, grossRaisedBDAG: 5000 }]
      const offchainRecords: ContributionRecord[] = [
        { id: '1', source: 'stripe', campaign_id: 1, amount_usd: 1000, created_at: '', is_onchain: false },
        { id: '2', source: 'paypal', campaign_id: 1, amount_usd: 500, created_at: '', is_onchain: false },
        { id: '3', source: 'cashapp', campaign_id: 2, amount_usd: 250, created_at: '', is_onchain: false },
        { id: '4', source: 'venmo', campaign_id: 2, amount_usd: 100, created_at: '', is_onchain: false },
      ]
      
      const stats = calculatePlatformStats(v5Campaigns, v6Campaigns, offchainRecords, { v5: 50, v6: 25 }, BDAG_USD_RATE)
      
      // On-chain: 10000 * 0.05 + 5000 * 0.05 = $500 + $250 = $750
      // Off-chain: $1000 + $500 + $250 + $100 = $1850
      // Total: $2600
      expect(stats.total_raised_usd).toBe(2600)
      expect(stats.total_nfts_minted).toBe(75)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero contributions', () => {
      const stats = calculatePlatformStats([], [], [], { v5: 0, v6: 0 }, BDAG_USD_RATE)
      
      expect(stats.total_raised_usd).toBe(0)
      expect(stats.total_campaigns).toBe(0)
      expect(stats.total_nfts_minted).toBe(0)
    })

    it('should handle campaigns with zero raised', () => {
      const v5Campaigns = [
        { campaignId: 1, grossRaisedBDAG: 0 },
        { campaignId: 2, grossRaisedBDAG: 0 },
      ]
      
      const stats = calculatePlatformStats(v5Campaigns, [], [], { v5: 0, v6: 0 }, BDAG_USD_RATE)
      
      expect(stats.total_raised_usd).toBe(0)
      expect(stats.total_campaigns).toBe(2)
    })
  })
})
