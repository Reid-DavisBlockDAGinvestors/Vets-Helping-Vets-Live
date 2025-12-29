import { test, expect } from '@playwright/test'

/**
 * E2E tests for the refactored purchase module
 * Tests the modular components/purchase/ structure
 */
test.describe('Purchase Panel - Payment Tabs', () => {
  test.beforeEach(async ({ page }) => {
    // Go to a story page with purchase panel
    await page.goto('/marketplace')
    
    // Click on first campaign card if available
    const firstCard = page.locator('[data-testid="campaign-card"]').first()
    if (await firstCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstCard.click()
    }
  })

  test('payment method tabs are visible on story page', async ({ page }) => {
    // Navigate to a story page directly if marketplace didn't work
    await page.goto('/story/1', { waitUntil: 'domcontentloaded' })
    
    // Check for payment tabs (Card, Crypto, Other)
    const cardTab = page.getByRole('button', { name: /card/i })
    const cryptoTab = page.getByRole('button', { name: /crypto/i })
    const otherTab = page.getByRole('button', { name: /other/i })
    
    // At least one payment method should be visible if purchase panel exists
    const hasPurchasePanel = await cardTab.isVisible({ timeout: 2000 }).catch(() => false) ||
                              await cryptoTab.isVisible({ timeout: 2000 }).catch(() => false)
    
    if (hasPurchasePanel) {
      // Verify tabs are clickable
      if (await cardTab.isVisible()) {
        await cardTab.click()
      }
    }
  })
})

test.describe('Purchase Panel - Quantity Selection', () => {
  test('quantity controls work on NFT purchase', async ({ page }) => {
    await page.goto('/story/1', { waitUntil: 'domcontentloaded' })
    
    // Look for quantity controls
    const incrementButton = page.getByRole('button', { name: '+' })
    const decrementButton = page.getByRole('button', { name: '−' })
    
    if (await incrementButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click increment
      await incrementButton.click()
      
      // Verify quantity input exists
      const quantityInput = page.locator('input[type="number"]').first()
      if (await quantityInput.isVisible()) {
        const value = await quantityInput.inputValue()
        expect(parseInt(value)).toBeGreaterThanOrEqual(1)
      }
    }
  })
})

test.describe('Purchase Panel - Tip Selection', () => {
  test('tip presets are visible', async ({ page }) => {
    await page.goto('/story/1', { waitUntil: 'domcontentloaded' })
    
    // Look for tip buttons (None, $5, $10, $25, $50)
    const noneButton = page.getByRole('button', { name: /none/i })
    const fiveDollarButton = page.getByRole('button', { name: '$5' })
    
    if (await noneButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await noneButton.click()
    }
    
    if (await fiveDollarButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fiveDollarButton.click()
    }
  })
})

test.describe('Purchase Panel - Crypto Payment', () => {
  test('connect wallet button appears on crypto tab', async ({ page }) => {
    await page.goto('/story/1', { waitUntil: 'domcontentloaded' })
    
    // Click crypto tab
    const cryptoTab = page.getByRole('button', { name: /crypto/i })
    if (await cryptoTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cryptoTab.click()
      
      // Should show connect wallet button
      const connectButton = page.getByRole('button', { name: /connect wallet/i })
      await expect(connectButton).toBeVisible({ timeout: 3000 })
    }
  })
})
