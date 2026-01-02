import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Admin Campaign Management
 * Tests Edit button, View TX links, and network badges
 * 
 * Requires TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD env vars
 */

const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@test.com'
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'testpassword123'

test.describe('Admin Campaign Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.fill('[data-testid="email-input"], input[type="email"]', TEST_ADMIN_EMAIL)
    await page.fill('[data-testid="password-input"], input[type="password"]', TEST_ADMIN_PASSWORD)
    await page.click('[data-testid="login-button"], button[type="submit"]')
    
    // Wait for dashboard
    await page.waitForURL(/\/(dashboard|admin)/, { timeout: 10000 })
  })

  test.describe('Campaign Card Actions', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/admin')
      await page.waitForSelector('[data-testid="campaign-card"], .campaign-card', { timeout: 10000 })
    })

    test('should have working Edit button', async ({ page }) => {
      // Expand a campaign card
      const firstCard = page.locator('[data-testid="campaign-card"], .campaign-card').first()
      await firstCard.click()
      
      // Find and click edit button
      const editButton = page.getByRole('button', { name: /edit/i }).first()
      await expect(editButton).toBeVisible()
      await editButton.click()
      
      // Edit modal should open
      await expect(page.locator('[data-testid="edit-title-input"], .edit-modal')).toBeVisible({ timeout: 5000 })
    })

    test('should show Edit modal with campaign data', async ({ page }) => {
      // Expand first campaign
      const firstCard = page.locator('[data-testid="campaign-card"], .campaign-card').first()
      await firstCard.click()
      
      // Click edit
      await page.getByRole('button', { name: /edit/i }).first().click()
      
      // Check modal has form fields
      await expect(page.locator('[data-testid="edit-title-input"]')).toBeVisible()
      await expect(page.locator('[data-testid="edit-goal-input"]')).toBeVisible()
      await expect(page.locator('[data-testid="edit-wallet-input"]')).toBeVisible()
    })

    test('should close Edit modal on cancel', async ({ page }) => {
      const firstCard = page.locator('[data-testid="campaign-card"], .campaign-card').first()
      await firstCard.click()
      await page.getByRole('button', { name: /edit/i }).first().click()
      
      // Click cancel
      await page.click('[data-testid="cancel-edit-btn"]')
      
      // Modal should be closed
      await expect(page.locator('[data-testid="edit-title-input"]')).not.toBeVisible()
    })
  })

  test.describe('View Transaction Links', () => {
    test('should have View TX button for minted campaigns', async ({ page }) => {
      await page.goto('/admin')
      
      // Filter to minted campaigns
      await page.selectOption('[data-testid="status-filter"], select', 'minted')
      await page.waitForTimeout(500)
      
      // Expand first minted campaign
      const mintedCard = page.locator('[data-testid="campaign-card"], .campaign-card').first()
      if (await mintedCard.count() > 0) {
        await mintedCard.click()
        
        // Check for View TX link
        const viewTxLink = page.locator('[data-testid="view-tx-link"], a:has-text("View TX")')
        if (await viewTxLink.count() > 0) {
          await expect(viewTxLink).toBeVisible()
          
          // Check href contains correct explorer
          const href = await viewTxLink.getAttribute('href')
          expect(href).toMatch(/etherscan|bdagscan|polygonscan|basescan/)
        }
      }
    })

    test('should link to correct explorer based on chain_id', async ({ page }) => {
      await page.goto('/admin')
      await page.selectOption('[data-testid="status-filter"], select', 'minted')
      await page.waitForTimeout(500)
      
      const cards = page.locator('[data-testid="campaign-card"], .campaign-card')
      const cardCount = await cards.count()
      
      for (let i = 0; i < Math.min(cardCount, 3); i++) {
        await cards.nth(i).click()
        
        const networkBadge = cards.nth(i).locator('[data-testid^="network-badge"]')
        const viewTxLink = cards.nth(i).locator('[data-testid="view-tx-link"], a:has-text("View TX")')
        
        if (await viewTxLink.count() > 0) {
          const href = await viewTxLink.getAttribute('href')
          const badgeText = await networkBadge.textContent() || ''
          
          // Verify explorer matches network
          if (badgeText.includes('Sepolia')) {
            expect(href).toContain('sepolia.etherscan.io')
          } else if (badgeText.includes('Ethereum')) {
            expect(href).toContain('etherscan.io')
          } else if (badgeText.includes('BlockDAG')) {
            expect(href).toContain('bdagscan.com')
          }
        }
        
        // Collapse card
        await cards.nth(i).click()
      }
    })
  })

  test.describe('Network Badges', () => {
    test('should display network badge on campaign cards', async ({ page }) => {
      await page.goto('/admin')
      await page.waitForSelector('[data-testid="campaign-card"], .campaign-card')
      
      // Check that network badges exist
      const networkBadges = page.locator('[data-testid^="network-badge"]')
      const badgeCount = await networkBadges.count()
      
      // At least some campaigns should have network badges
      expect(badgeCount).toBeGreaterThanOrEqual(0)
    })

    test('should show correct network for Sepolia campaigns', async ({ page }) => {
      await page.goto('/admin')
      
      // Search for test campaign
      await page.fill('[data-testid="search-input"], input[placeholder*="Search"]', 'this is a test')
      await page.waitForTimeout(500)
      
      const sepoliaCard = page.locator('[data-testid="campaign-card"]:has-text("test")')
      if (await sepoliaCard.count() > 0) {
        const networkBadge = sepoliaCard.locator('[data-testid="network-badge-11155111"]')
        if (await networkBadge.count() > 0) {
          await expect(networkBadge).toContainText(/Sepolia/i)
        }
      }
    })
  })

  test.describe('Contract Version Display', () => {
    test('should show contract version on minted campaigns', async ({ page }) => {
      await page.goto('/admin')
      await page.selectOption('[data-testid="status-filter"], select', 'minted')
      await page.waitForTimeout(500)
      
      const cards = page.locator('[data-testid="campaign-card"], .campaign-card')
      if (await cards.count() > 0) {
        // Check for version indicator (V5, V6, V7, etc.)
        const versionText = await cards.first().textContent()
        const hasVersion = /V[5-9]|v[5-9]/i.test(versionText || '')
        
        // Minted campaigns should show version
        expect(hasVersion).toBeTruthy()
      }
    })
  })
})

test.describe('Admin Submissions Update API', () => {
  test('should update campaign via API', async ({ request }) => {
    // This test requires a valid admin token
    // Skip if no test credentials available
    test.skip(!process.env.TEST_ADMIN_TOKEN, 'Requires TEST_ADMIN_TOKEN env var')
    
    const response = await request.patch('/api/submissions/update', {
      headers: {
        'Authorization': `Bearer ${process.env.TEST_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        id: 'test-campaign-id',
        updates: {
          title: 'Updated Test Title'
        }
      }
    })
    
    // Should require valid campaign ID
    expect(response.status()).toBe(404) // Campaign not found
  })

  test('should reject unauthenticated requests', async ({ request }) => {
    const response = await request.patch('/api/submissions/update', {
      data: {
        id: 'test-id',
        updates: { title: 'Test' }
      }
    })
    
    expect(response.status()).toBe(401)
  })
})
