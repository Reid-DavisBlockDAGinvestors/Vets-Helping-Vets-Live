import { test, expect } from '@playwright/test'

/**
 * Admin Fund Distribution E2E Tests
 * Financial-Grade Security Testing
 * 
 * These tests verify the fund distribution UI works correctly
 * with proper access controls and data display.
 */

test.describe('Admin Fund Distribution', () => {
  
  test.describe('Access Control', () => {
    test('should require admin authentication', async ({ page }) => {
      // Try to access distributions without login
      await page.goto('/admin')
      
      // Should show login screen
      await expect(page.getByText('Admin Login')).toBeVisible()
    })

    test('should show distributions tab after admin login', async ({ page }) => {
      // Login as admin
      await page.goto('/admin')
      await page.getByPlaceholder('Email').fill(process.env.TEST_ADMIN_EMAIL || 'admin@test.com')
      await page.getByPlaceholder('Password').fill(process.env.TEST_ADMIN_PASSWORD || 'testpass123')
      await page.getByRole('button', { name: 'Login' }).click()

      // Wait for dashboard to load
      await page.waitForSelector('[data-testid="fund-distribution-tab"]', { timeout: 10000 })
      
      // Distributions tab should be visible
      await expect(page.getByTestId('fund-distribution-tab')).toBeVisible()
    })
  })

  test.describe('Fund Distribution Panel', () => {
    test.beforeEach(async ({ page }) => {
      // Login as admin first
      await page.goto('/admin')
      await page.getByPlaceholder('Email').fill(process.env.TEST_ADMIN_EMAIL || 'admin@test.com')
      await page.getByPlaceholder('Password').fill(process.env.TEST_ADMIN_PASSWORD || 'testpass123')
      await page.getByRole('button', { name: 'Login' }).click()
      
      // Navigate to distributions tab
      await page.waitForSelector('[data-testid="fund-distribution-tab"]', { timeout: 10000 })
      await page.getByTestId('fund-distribution-tab').click()
    })

    test('should display fund distribution panel', async ({ page }) => {
      await expect(page.getByTestId('fund-distribution-panel')).toBeVisible()
      await expect(page.getByText('💰 Fund Distribution')).toBeVisible()
    })

    test('should show network filter dropdown', async ({ page }) => {
      await expect(page.getByTestId('network-filter')).toBeVisible()
      
      // Check filter options exist
      const select = page.getByTestId('network-filter')
      await expect(select).toContainText('All Networks')
    })

    test('should show testnet/mainnet filter', async ({ page }) => {
      await expect(page.getByTestId('testnet-filter')).toBeVisible()
    })

    test('should show refresh button', async ({ page }) => {
      await expect(page.getByTestId('refresh-btn')).toBeVisible()
    })

    test('should filter by network', async ({ page }) => {
      // Select Sepolia network
      await page.getByTestId('network-filter').selectOption('11155111')
      
      // Wait for refresh
      await page.waitForTimeout(500)
      
      // All visible cards should be Sepolia (if any)
      const cards = page.locator('[data-testid^="campaign-balance-card-"]')
      const count = await cards.count()
      
      if (count > 0) {
        // Each card should mention Sepolia
        for (let i = 0; i < count; i++) {
          await expect(cards.nth(i)).toContainText('Sepolia')
        }
      }
    })

    test('should filter testnet only', async ({ page }) => {
      // Select testnet only
      await page.getByTestId('testnet-filter').selectOption('true')
      
      await page.waitForTimeout(500)
      
      // All visible cards should have TESTNET badge
      const cards = page.locator('[data-testid^="campaign-balance-card-"]')
      const count = await cards.count()
      
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          await expect(cards.nth(i).getByTestId('testnet-badge')).toBeVisible()
        }
      }
    })
  })

  test.describe('Campaign Balance Cards', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/admin')
      await page.getByPlaceholder('Email').fill(process.env.TEST_ADMIN_EMAIL || 'admin@test.com')
      await page.getByPlaceholder('Password').fill(process.env.TEST_ADMIN_PASSWORD || 'testpass123')
      await page.getByRole('button', { name: 'Login' }).click()
      await page.waitForSelector('[data-testid="fund-distribution-tab"]', { timeout: 10000 })
      await page.getByTestId('fund-distribution-tab').click()
    })

    test('should display campaign balance list', async ({ page }) => {
      await expect(page.getByTestId('campaign-balance-list')).toBeVisible()
    })

    test('should show campaign title on cards', async ({ page }) => {
      const cards = page.locator('[data-testid^="campaign-balance-card-"]')
      const count = await cards.count()
      
      if (count > 0) {
        // First card should have a title
        await expect(cards.first().getByTestId('campaign-title')).toBeVisible()
      }
    })

    test('should show distribute funds button', async ({ page }) => {
      const cards = page.locator('[data-testid^="campaign-balance-card-"]')
      const count = await cards.count()
      
      if (count > 0) {
        await expect(cards.first().getByTestId('distribute-funds-btn')).toBeVisible()
      }
    })

    test('should show distribute tips button', async ({ page }) => {
      const cards = page.locator('[data-testid^="campaign-balance-card-"]')
      const count = await cards.count()
      
      if (count > 0) {
        await expect(cards.first().getByTestId('distribute-tips-btn')).toBeVisible()
      }
    })

    test('should show view history button', async ({ page }) => {
      const cards = page.locator('[data-testid^="campaign-balance-card-"]')
      const count = await cards.count()
      
      if (count > 0) {
        await expect(cards.first().getByTestId('view-history-btn')).toBeVisible()
      }
    })

    test('should show tip split percentages', async ({ page }) => {
      const cards = page.locator('[data-testid^="campaign-balance-card-"]')
      const count = await cards.count()
      
      if (count > 0) {
        await expect(cards.first().getByTestId('submitter-percent')).toBeVisible()
        await expect(cards.first().getByTestId('nonprofit-percent')).toBeVisible()
      }
    })

    test('should show edit tip split button', async ({ page }) => {
      const cards = page.locator('[data-testid^="campaign-balance-card-"]')
      const count = await cards.count()
      
      if (count > 0) {
        await expect(cards.first().getByTestId('edit-tip-split-btn')).toBeVisible()
      }
    })
  })

  test.describe('Testnet/Mainnet Safety', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/admin')
      await page.getByPlaceholder('Email').fill(process.env.TEST_ADMIN_EMAIL || 'admin@test.com')
      await page.getByPlaceholder('Password').fill(process.env.TEST_ADMIN_PASSWORD || 'testpass123')
      await page.getByRole('button', { name: 'Login' }).click()
      await page.waitForSelector('[data-testid="fund-distribution-tab"]', { timeout: 10000 })
      await page.getByTestId('fund-distribution-tab').click()
    })

    test('should clearly label testnet campaigns', async ({ page }) => {
      // Filter to testnet
      await page.getByTestId('testnet-filter').selectOption('true')
      await page.waitForTimeout(500)
      
      const cards = page.locator('[data-testid^="campaign-balance-card-"]')
      const count = await cards.count()
      
      if (count > 0) {
        // Should have TESTNET badge
        await expect(cards.first().getByTestId('testnet-badge')).toContainText('TESTNET')
      }
    })

    test('should clearly label mainnet campaigns', async ({ page }) => {
      // Filter to mainnet
      await page.getByTestId('testnet-filter').selectOption('false')
      await page.waitForTimeout(500)
      
      const cards = page.locator('[data-testid^="campaign-balance-card-"]')
      const count = await cards.count()
      
      if (count > 0) {
        // Should have MAINNET badge
        await expect(cards.first().getByTestId('mainnet-badge')).toContainText('MAINNET')
      }
    })
  })

  test.describe('API Security', () => {
    test('should reject unauthenticated API requests', async ({ request }) => {
      const response = await request.get('/api/admin/distributions/balances')
      expect(response.status()).toBe(401)
    })

    test('should reject requests with invalid token', async ({ request }) => {
      const response = await request.get('/api/admin/distributions/balances', {
        headers: {
          'Authorization': 'Bearer invalid-token-123'
        }
      })
      expect(response.status()).toBe(401)
    })
  })
})
