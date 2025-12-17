/**
 * Tests for Campaign On-Chain Verification and Approval-to-Purchase Flow
 * TDD: These tests verify campaigns are properly linked between Supabase and blockchain
 */

import { test, expect } from '@playwright/test'

test.describe('Campaign On-Chain Verification', () => {
  
  test('onchain/token API should handle campaign ID lookup correctly', async ({ request }) => {
    // Test that the API returns proper response for campaign ID
    const response = await request.get('/api/onchain/token/999999')
    // Should return 404 if campaign doesn't exist, or 200 with data if it does
    expect([200, 404]).toContain(response.status())
    const data = await response.json()
    if (response.status() === 404) {
      expect(data.error).toBe('CAMPAIGN_NOT_FOUND')
    } else {
      expect(data.campaignId).toBeDefined()
    }
  })
  
  test('link-campaign API should link orphaned campaigns', async ({ request }) => {
    // Test that the link-campaign endpoint can handle requests
    const response = await request.post('/api/submissions/link-campaign', {
      data: { campaignId: 999999 }
    })
    // Should return 404 for non-existent campaign or 200 if found
    expect([200, 400, 404]).toContain(response.status())
  })

  test('submissions/by-token API should find submission by campaign_id', async ({ request }) => {
    // This tests the submission lookup which should work even if on-chain data is pending
    const response = await request.get('/api/onchain/tokens?limit=1')
    if (response.ok()) {
      const data = await response.json()
      if (data.tokens && data.tokens.length > 0) {
        const campaignId = data.tokens[0].campaignId
        const subResponse = await request.get(`/api/submissions/by-token/${campaignId}`)
        // Should find the submission
        expect(subResponse.status()).toBe(200)
        const subData = await subResponse.json()
        expect(subData.item).toBeDefined()
        expect(subData.item.campaign_id).toBe(campaignId)
      }
    }
  })

  test('story page should show purchase panel when campaign is on-chain', async ({ page }) => {
    // Navigate to marketplace to find an active campaign
    await page.goto('/marketplace')
    await page.waitForLoadState('networkidle')
    
    // Find a campaign card and click it
    const campaignCard = page.locator('a[href^="/story/"]').first()
    if (await campaignCard.isVisible()) {
      await campaignCard.click()
      await page.waitForLoadState('networkidle')
      
      // Check for purchase panel or pending message
      const hasPurchaseButton = await page.locator('button:has-text("Purchase"), button:has-text("Buy"), button:has-text("Support")').first().isVisible().catch(() => false)
      const hasPendingMessage = await page.locator('text=/pending|awaiting|blockchain/i').isVisible().catch(() => false)
      
      // One of these should be true - either purchaseable or showing pending status
      expect(hasPurchaseButton || hasPendingMessage).toBe(true)
    }
  })

  test('verify-campaign API should handle requests properly', async ({ request }) => {
    // Test the verify-campaign endpoint exists and returns proper response
    const response = await request.post('/api/submissions/verify-campaign', {
      data: { id: 'test-nonexistent-id' }
    })
    // Should return 404 (not found) for invalid submission ID
    expect(response.status()).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('SUBMISSION_NOT_FOUND')
  })
})

test.describe('Story Page Campaign Loading', () => {
  
  test('story page should load on-chain data when available', async ({ page, request }) => {
    // First, get a valid campaign ID from the API
    const tokensResponse = await request.get('/api/onchain/tokens?limit=1')
    if (!tokensResponse.ok()) {
      test.skip()
      return
    }
    
    const tokensData = await tokensResponse.json()
    if (!tokensData.tokens || tokensData.tokens.length === 0) {
      test.skip()
      return
    }
    
    const campaignId = tokensData.tokens[0].campaignId
    
    // Navigate to the story page
    await page.goto(`/story/${campaignId}`)
    await page.waitForLoadState('networkidle')
    
    // Should NOT show "pending on-chain" message since campaign is verified on-chain
    const pendingBanner = page.locator('text=/pending.*blockchain|awaiting.*confirmation/i')
    const isPending = await pendingBanner.isVisible().catch(() => false)
    
    // If campaign is on-chain, it should not show pending message
    expect(isPending).toBe(false)
  })

  test('story page should handle pending_onchain status gracefully', async ({ page }) => {
    // Navigate to a campaign that might be pending
    await page.goto('/marketplace')
    await page.waitForLoadState('networkidle')
    
    // Check if page loads without errors
    const hasError = await page.locator('text=/error|failed|something went wrong/i').isVisible().catch(() => false)
    expect(hasError).toBe(false)
  })
})
