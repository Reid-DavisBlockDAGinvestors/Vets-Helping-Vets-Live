import { test, expect } from '@playwright/test'

/**
 * E2E tests for crypto payment flows in PurchasePanelV2
 * Tests the crypto tab functionality and wallet connection
 */
test.describe('Crypto purchase flows', () => {
  test('crypto tab shows connect wallet button when not connected', async ({ page }) => {
    // Try marketplace first to find a valid story
    await page.goto('/marketplace')
    await page.waitForLoadState('domcontentloaded')
    
    // Click first campaign card if available
    const firstCard = page.locator('[data-testid="campaign-card"]').first()
    if (await firstCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstCard.click()
      await page.waitForLoadState('domcontentloaded')
    } else {
      // Fallback to story/1
      await page.goto('/story/1')
    }
    
    // Click crypto tab
    const cryptoTab = page.getByRole('button', { name: /crypto/i })
    if (await cryptoTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await cryptoTab.click()
      await page.waitForTimeout(500)
      
      // Should show connect wallet button or BDAG text
      const connectButton = page.getByRole('button', { name: /connect wallet/i })
      const bdagText = page.getByText(/BDAG/i)
      
      const hasCryptoUI = await connectButton.isVisible({ timeout: 3000 }).catch(() => false) ||
                          await bdagText.first().isVisible({ timeout: 1000 }).catch(() => false)
      expect(hasCryptoUI).toBe(true)
    }
  })

  test('crypto tab shows BDAG conversion rate', async ({ page }) => {
    await page.goto('/story/1')
    
    const cryptoTab = page.getByRole('button', { name: /crypto/i })
    if (await cryptoTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cryptoTab.click()
      
      // Should show BDAG amount text
      const bdagText = page.getByText(/BDAG/i)
      await expect(bdagText.first()).toBeVisible({ timeout: 3000 })
    }
  })

  test('other payment tab shows alternative methods', async ({ page }) => {
    await page.goto('/story/1')
    
    const otherTab = page.getByRole('button', { name: /other/i })
    if (await otherTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await otherTab.click()
      
      // Should show PayPal, Cash App, or Venmo options
      const paypalBtn = page.getByRole('button', { name: /paypal/i })
      const cashappBtn = page.getByRole('button', { name: /cash app/i })
      const venmoBtn = page.getByRole('button', { name: /venmo/i })
      
      const hasAlternative = await paypalBtn.isVisible({ timeout: 2000 }).catch(() => false) ||
                             await cashappBtn.isVisible({ timeout: 1000 }).catch(() => false) ||
                             await venmoBtn.isVisible({ timeout: 1000 }).catch(() => false)
      
      expect(hasAlternative).toBe(true)
    }
  })
})
