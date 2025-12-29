import { test, expect } from '@playwright/test'

test.describe('Submit Story', () => {
  test('loads submit page successfully', async ({ page }) => {
    await page.goto('/submit')
    
    // Page should load without errors
    await expect(page).toHaveTitle(/PatriotPledge/i)
    
    // Form should be visible
    await expect(page.locator('form')).toBeVisible()
  })

  test('shows campaign type heading', async ({ page }) => {
    await page.goto('/submit')
    
    // Campaign Type heading should be visible
    await expect(page.getByRole('heading', { name: /Campaign Type/i })).toBeVisible()
  })

  test('shows story section heading', async ({ page }) => {
    await page.goto('/submit')
    
    // Your Story section heading should be visible
    await expect(page.getByRole('heading', { name: /Your Story/i })).toBeVisible()
  })
})
