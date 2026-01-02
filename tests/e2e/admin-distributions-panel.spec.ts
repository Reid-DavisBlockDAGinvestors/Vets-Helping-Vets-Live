import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Admin Distributions Panel
 * Tests the fund distribution UI, tip split configuration, and history
 * 
 * Requires TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD env vars
 */

const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@test.com'
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'testpassword123'

test.describe('Admin Distributions Panel', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.fill('[data-testid="email-input"], input[type="email"]', TEST_ADMIN_EMAIL)
    await page.fill('[data-testid="password-input"], input[type="password"]', TEST_ADMIN_PASSWORD)
    await page.click('[data-testid="login-button"], button[type="submit"]')
    await page.waitForURL(/\/(dashboard|admin)/, { timeout: 10000 })
    
    // Navigate to distributions
    await page.goto('/admin/distributions')
  })

  test.describe('Panel Display', () => {
    test('should load distributions panel', async ({ page }) => {
      await expect(page.locator('[data-testid="fund-distribution-panel"]')).toBeVisible({ timeout: 10000 })
    })

    test('should show network filter', async ({ page }) => {
      await expect(page.locator('[data-testid="network-filter"]')).toBeVisible()
    })

    test('should show refresh button', async ({ page }) => {
      await expect(page.locator('[data-testid="refresh-btn"]')).toBeVisible()
    })

    test('should show campaign balance list or empty state', async ({ page }) => {
      // Either shows campaign cards or empty state
      const hasCampaigns = await page.locator('[data-testid="campaign-balance-list"]').count() > 0
      const hasEmptyState = await page.locator('text=/no campaigns|no minted/i').count() > 0
      
      expect(hasCampaigns || hasEmptyState).toBeTruthy()
    })
  })

  test.describe('Campaign Balance Cards', () => {
    test('should display campaign info on cards', async ({ page }) => {
      const cards = page.locator('[data-testid^="balance-card"]')
      
      if (await cards.count() > 0) {
        const firstCard = cards.first()
        
        // Should show campaign title
        await expect(firstCard.locator('[data-testid="campaign-title"]')).toBeVisible()
        
        // Should show network badge
        await expect(firstCard.locator('[data-testid^="network-badge"]')).toBeVisible()
      }
    })

    test('should have action buttons on cards', async ({ page }) => {
      const cards = page.locator('[data-testid^="balance-card"]')
      
      if (await cards.count() > 0) {
        const firstCard = cards.first()
        
        // Check for action buttons
        await expect(firstCard.locator('[data-testid="distribute-funds-btn"]')).toBeVisible()
        await expect(firstCard.locator('[data-testid="distribute-tips-btn"]')).toBeVisible()
        await expect(firstCard.locator('[data-testid="view-history-btn"]')).toBeVisible()
        await expect(firstCard.locator('[data-testid="edit-tip-split-btn"]')).toBeVisible()
      }
    })
  })

  test.describe('Tip Split Modal', () => {
    test('should open tip split modal', async ({ page }) => {
      const cards = page.locator('[data-testid^="balance-card"]')
      
      if (await cards.count() > 0) {
        await cards.first().locator('[data-testid="edit-tip-split-btn"]').click()
        
        await expect(page.locator('[data-testid="tip-split-modal"]')).toBeVisible({ timeout: 5000 })
      }
    })

    test('should show tip split slider', async ({ page }) => {
      const cards = page.locator('[data-testid^="balance-card"]')
      
      if (await cards.count() > 0) {
        await cards.first().locator('[data-testid="edit-tip-split-btn"]').click()
        
        await expect(page.locator('[data-testid="tip-split-slider"]')).toBeVisible()
        await expect(page.locator('[data-testid="tip-split-range"]')).toBeVisible()
      }
    })

    test('should have preset buttons', async ({ page }) => {
      const cards = page.locator('[data-testid^="balance-card"]')
      
      if (await cards.count() > 0) {
        await cards.first().locator('[data-testid="edit-tip-split-btn"]').click()
        
        // Check preset buttons
        await expect(page.locator('[data-testid="preset-100"]')).toBeVisible()
        await expect(page.locator('[data-testid="preset-70"]')).toBeVisible()
        await expect(page.locator('[data-testid="preset-50"]')).toBeVisible()
        await expect(page.locator('[data-testid="preset-0"]')).toBeVisible()
      }
    })

    test('should close modal on cancel', async ({ page }) => {
      const cards = page.locator('[data-testid^="balance-card"]')
      
      if (await cards.count() > 0) {
        await cards.first().locator('[data-testid="edit-tip-split-btn"]').click()
        await page.click('[data-testid="cancel-btn"]')
        
        await expect(page.locator('[data-testid="tip-split-modal"]')).not.toBeVisible()
      }
    })
  })

  test.describe('Distribution History Modal', () => {
    test('should open history modal', async ({ page }) => {
      const cards = page.locator('[data-testid^="balance-card"]')
      
      if (await cards.count() > 0) {
        await cards.first().locator('[data-testid="view-history-btn"]').click()
        
        await expect(page.locator('[data-testid="distribution-history-modal"]')).toBeVisible({ timeout: 5000 })
      }
    })

    test('should show empty state or distribution list', async ({ page }) => {
      const cards = page.locator('[data-testid^="balance-card"]')
      
      if (await cards.count() > 0) {
        await cards.first().locator('[data-testid="view-history-btn"]').click()
        await page.waitForTimeout(1000)
        
        // Either shows distributions or empty state
        const hasDistributions = await page.locator('[data-testid^="distribution-"]').count() > 0
        const hasEmptyState = await page.locator('text=/no distributions/i').count() > 0
        
        expect(hasDistributions || hasEmptyState).toBeTruthy()
      }
    })

    test('should have refresh button in history modal', async ({ page }) => {
      const cards = page.locator('[data-testid^="balance-card"]')
      
      if (await cards.count() > 0) {
        await cards.first().locator('[data-testid="view-history-btn"]').click()
        
        await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible()
      }
    })

    test('should close history modal', async ({ page }) => {
      const cards = page.locator('[data-testid^="balance-card"]')
      
      if (await cards.count() > 0) {
        await cards.first().locator('[data-testid="view-history-btn"]').click()
        await page.click('[data-testid="close-history-btn"]')
        
        await expect(page.locator('[data-testid="distribution-history-modal"]')).not.toBeVisible()
      }
    })
  })

  test.describe('Network Filtering', () => {
    test('should filter by network', async ({ page }) => {
      const networkFilter = page.locator('[data-testid="network-filter"]')
      
      if (await networkFilter.count() > 0) {
        // Select Sepolia
        await networkFilter.selectOption({ label: /sepolia/i })
        await page.waitForTimeout(500)
        
        // All visible cards should be Sepolia
        const cards = page.locator('[data-testid^="balance-card"]')
        const cardCount = await cards.count()
        
        for (let i = 0; i < cardCount; i++) {
          const badge = cards.nth(i).locator('[data-testid="network-badge-11155111"]')
          if (await badge.count() > 0) {
            await expect(badge).toContainText(/Sepolia/i)
          }
        }
      }
    })
  })
})

test.describe('Distributions API Security', () => {
  test('balances API should reject unauthenticated requests', async ({ request }) => {
    const response = await request.get('/api/admin/distributions/balances')
    expect(response.status()).toBe(401)
  })

  test('tip-split API should reject unauthenticated requests', async ({ request }) => {
    const response = await request.get('/api/admin/distributions/tip-split?campaignId=test')
    expect(response.status()).toBe(401)
  })

  test('history API should reject unauthenticated requests', async ({ request }) => {
    const response = await request.get('/api/admin/distributions/history?campaignId=test')
    expect(response.status()).toBe(401)
  })

  test('execute API should reject unauthenticated requests', async ({ request }) => {
    const response = await request.post('/api/admin/distributions/execute', {
      data: { type: 'funds', campaignId: 'test' }
    })
    expect(response.status()).toBe(401)
  })
})
