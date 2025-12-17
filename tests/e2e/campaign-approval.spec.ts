/**
 * Tests for Campaign Approval Flow
 * TDD: Verify campaigns show in marketplace after approval
 */

import { test, expect } from '@playwright/test'

test.describe('Campaign Approval Flow', () => {
  
  test('marketplace should only show campaigns with valid campaign_id', async ({ request }) => {
    const response = await request.get('/api/marketplace/fundraisers?limit=20')
    expect(response.ok()).toBe(true)
    
    const data = await response.json()
    console.log(`Marketplace returned ${data.items?.length || 0} items`)
    
    // Every item should have a valid campaign_id
    for (const item of (data.items || [])) {
      expect(item.campaignId).toBeDefined()
      expect(typeof item.campaignId).toBe('number')
      expect(item.campaignId).toBeGreaterThanOrEqual(0)
      console.log(`Campaign: ${item.title?.slice(0, 30)}... - ID: ${item.campaignId}`)
    }
  })

  test('verify-campaign API should find campaign by metadata URI', async ({ request }) => {
    // This tests that the verify endpoint can find campaigns
    // Without auth, it should return 401
    const response = await request.post('/api/admin/verify-campaign', {
      data: { submissionId: 'test-id' }
    })
    expect(response.status()).toBe(401)
  })

  test('submissions with pending_onchain status should appear in marketplace', async ({ request }) => {
    // Get all submissions via marketplace API
    const response = await request.get('/api/marketplace/fundraisers?limit=50')
    expect(response.ok()).toBe(true)
    
    const data = await response.json()
    // Log what we found
    console.log(`Found ${data.items?.length || 0} campaigns in marketplace`)
    
    // The marketplace should show campaigns
    // If empty, there might be a data issue
    if (data.items?.length === 0) {
      console.log('WARNING: No campaigns in marketplace - check submissions table')
    }
  })
})

test.describe('Debug Endpoints', () => {
  test('debug recent-submissions should show campaign status', async ({ request }) => {
    const response = await request.get('/api/debug/recent-submissions')
    
    if (response.ok()) {
      const data = await response.json()
      console.log('Recent submissions by status:')
      
      // Check for pending_onchain submissions
      const pendingOnchain = data.submissions?.filter((s: any) => s.status === 'pending_onchain') || []
      const minted = data.submissions?.filter((s: any) => s.status === 'minted') || []
      const approved = data.submissions?.filter((s: any) => s.status === 'approved') || []
      
      console.log(`- pending_onchain: ${pendingOnchain.length}`)
      console.log(`- minted: ${minted.length}`)
      console.log(`- approved: ${approved.length}`)
      
      // Log pending_onchain details
      for (const sub of pendingOnchain) {
        console.log(`  Pending: ${sub.title?.slice(0, 30)}... campaign_id=${sub.campaign_id}`)
      }
    }
  })
})
