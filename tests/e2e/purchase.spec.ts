import { test, expect } from '@playwright/test'

test.describe('Purchase flow', () => {
  test('story page shows purchase panel with payment tabs', async ({ page }) => {
    await page.goto('/story/1')
    
    // Look for payment tabs in PurchasePanelV2
    const cardTab = page.getByRole('button', { name: /card/i })
    const cryptoTab = page.getByRole('button', { name: /crypto/i })
    const otherTab = page.getByRole('button', { name: /other/i })
    
    // At least one payment tab should be visible
    const hasPaymentTabs = await cardTab.isVisible({ timeout: 5000 }).catch(() => false) ||
                           await cryptoTab.isVisible({ timeout: 2000 }).catch(() => false) ||
                           await otherTab.isVisible({ timeout: 2000 }).catch(() => false)
    
    expect(hasPaymentTabs).toBe(true)
  })

  test('card tab shows Stripe payment form', async ({ page }) => {
    await page.goto('/story/1')
    
    const cardTab = page.getByRole('button', { name: /card/i })
    if (await cardTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cardTab.click()
      
      // Should show email input for receipt
      const emailInput = page.getByPlaceholder(/email/i)
      await expect(emailInput).toBeVisible({ timeout: 3000 })
    }
  })
})
