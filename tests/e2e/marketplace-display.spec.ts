/**
 * Tests for Marketplace Display
 * TDD: Verify campaigns display correctly on marketplace
 */

import { test, expect } from '@playwright/test'

test.describe('Marketplace Display', () => {
  
  test('marketplace API should return campaigns', async ({ request }) => {
    const response = await request.get('/api/marketplace/fundraisers?limit=5')
    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.items).toBeDefined()
    expect(Array.isArray(data.items)).toBe(true)
    console.log(`Marketplace API returned ${data.items?.length || 0} items, total: ${data.total}`)
    
    // Verify each item has required fields
    if (data.items && data.items.length > 0) {
      const item = data.items[0]
      expect(item.campaignId).toBeDefined()
      expect(item.title).toBeDefined()
      console.log(`First item: campaignId=${item.campaignId}, title="${item.title}"`)
    }
  })

  test('marketplace page should load and display campaigns', async ({ page }) => {
    // Go to marketplace
    await page.goto('/marketplace')
    
    // Wait for loading to complete
    await page.waitForLoadState('networkidle')
    
    // Check for error state
    const errorElement = page.locator('.text-red-400')
    if (await errorElement.isVisible()) {
      const errorText = await errorElement.textContent()
      console.log(`Error displayed: ${errorText}`)
    }
    
    // Check for empty state
    const emptyState = page.locator('text=No fundraisers found')
    if (await emptyState.isVisible()) {
      console.log('Empty state shown - no fundraisers found')
      // Take screenshot for debugging
      await page.screenshot({ path: 'test-results/marketplace-empty.png' })
    }
    
    // Check for NFT cards
    const nftCards = page.locator('.group.block') // NFTCard uses group block class
    const cardCount = await nftCards.count()
    console.log(`Found ${cardCount} NFT cards on marketplace page`)
    
    // Should have at least some cards if API returns data
    expect(cardCount).toBeGreaterThan(0)
  })

  test('NFTCard should render with correct link', async ({ page }) => {
    await page.goto('/marketplace')
    await page.waitForLoadState('networkidle')
    
    // Find first NFT card link
    const firstCard = page.locator('a[href^="/story/"]').first()
    if (await firstCard.isVisible()) {
      const href = await firstCard.getAttribute('href')
      console.log(`First card links to: ${href}`)
      expect(href).toMatch(/^\/story\/\d+$/)
    }
  })
})
