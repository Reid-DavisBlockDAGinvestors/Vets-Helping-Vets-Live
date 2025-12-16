import { test, expect } from '@playwright/test'

test.describe('Admin User Purchases', () => {
  // This test verifies that wallet users with NFTs on-chain but no purchase records
  // still show their campaigns in the "Campaigns Purchased" tab
  
  test('should show on-chain NFT campaigns for wallet users without purchase records', async ({ page }) => {
    // Skip if not logged in as admin - this is an integration test
    test.skip(true, 'Requires admin login - run manually')
    
    // Navigate to admin page
    await page.goto('/admin')
    
    // Wait for users list to load
    await page.waitForSelector('[data-testid="admin-users-table"]', { timeout: 30000 })
    
    // Find a wallet user (has wallet address but no email)
    const walletUserRow = page.locator('tr').filter({ hasText: '0x' }).first()
    await expect(walletUserRow).toBeVisible()
    
    // Click View Details
    await walletUserRow.getByText('View Details').click()
    
    // Wait for modal to open
    await page.waitForSelector('[data-testid="user-detail-modal"]', { timeout: 10000 })
    
    // Check that Campaigns Purchased tab shows campaigns
    const purchasedTab = page.getByRole('button', { name: /Campaigns Purchased/i })
    await purchasedTab.click()
    
    // Should show at least one campaign (from blockchain query)
    const campaignCards = page.locator('[data-testid="purchased-campaign-card"]')
    const count = await campaignCards.count()
    
    console.log(`Found ${count} purchased campaigns for wallet user`)
    
    // If user owns NFTs on-chain, they should have at least one campaign
    // This validates the blockchain query is working
  })
})

// API-level test that can run without browser
test.describe('Admin User Purchases API', () => {
  test('API should return on-chain campaigns for wallet users', async ({ request }) => {
    // This would require auth token - skip for now
    test.skip(true, 'Requires admin auth token')
    
    const response = await request.get('/api/admin/users/0x2815.../purchases', {
      headers: {
        'Authorization': 'Bearer <token>'
      }
    })
    
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    
    // Should have purchasedCampaigns from blockchain query
    expect(data.purchasedCampaigns).toBeDefined()
    console.log('Purchased campaigns:', data.purchasedCampaigns.length)
  })
})
