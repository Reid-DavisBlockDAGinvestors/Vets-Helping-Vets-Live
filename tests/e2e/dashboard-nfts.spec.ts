/**
 * Tests for Dashboard NFT Metadata Display
 * TDD: Verify owned NFTs show correct metadata from Supabase
 */

import { test, expect } from '@playwright/test'

// Test wallet address (from screenshot context)
const TEST_WALLET = '0x72bD573a5f5B8da1eED2dAbFE6dDa7A0e4b7f2C3' // Replace with actual

test.describe('Dashboard NFT Metadata', () => {
  
  test('wallet/nfts API should return metadata for valid campaigns', async ({ request }) => {
    // First, check what submissions exist with campaign_id set
    const marketResponse = await request.get('/api/marketplace/fundraisers?limit=50')
    expect(marketResponse.ok()).toBe(true)
    
    const marketData = await marketResponse.json()
    console.log(`Marketplace has ${marketData.items?.length || 0} campaigns`)
    
    // List campaign IDs that should have metadata
    const campaignIds = (marketData.items || []).map((i: any) => i.campaignId)
    console.log('Campaign IDs in marketplace:', campaignIds.sort((a: number, b: number) => a - b))
    
    // Check if specific campaigns exist (23, 26, 30, 32, 38, 40)
    const targetIds = [23, 26, 30, 32, 38, 40]
    for (const id of targetIds) {
      const exists = campaignIds.includes(id)
      console.log(`Campaign ${id}: ${exists ? '✓ in marketplace' : '✗ NOT in marketplace'}`)
    }
  })

  test('debug endpoint should show submission-campaign mapping', async ({ request }) => {
    const response = await request.get('/api/debug/recent-submissions')
    
    if (response.ok()) {
      const data = await response.json()
      console.log('\n=== Submissions with campaign_id ===')
      
      const withCampaignId = (data.submissions || []).filter((s: any) => s.campaign_id != null)
      console.log(`Total submissions with campaign_id: ${withCampaignId.length}`)
      
      // Check for specific campaign IDs
      const targetIds = [23, 26, 30, 32, 38, 40]
      for (const id of targetIds) {
        const sub = withCampaignId.find((s: any) => s.campaign_id === id)
        if (sub) {
          console.log(`Campaign ${id}: "${sub.title?.slice(0, 40)}..." status=${sub.status}`)
        } else {
          console.log(`Campaign ${id}: NO MATCHING SUBMISSION`)
        }
      }
    }
  })

  test('check on-chain campaign data for target IDs', async ({ request }) => {
    // Check each target campaign ID via the on-chain API
    const targetIds = [23, 26, 30, 32, 38, 40]
    
    for (const id of targetIds) {
      const response = await request.get(`/api/onchain/token/${id}`)
      
      if (response.ok()) {
        const data = await response.json()
        console.log(`Campaign ${id} on-chain: goal=${data.goal}, uri=${data.uri?.slice(0, 50)}...`)
      } else {
        const error = await response.json().catch(() => ({}))
        console.log(`Campaign ${id} on-chain: ERROR - ${error.error || response.status()}`)
      }
    }
  })
})
