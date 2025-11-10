import { test, expect } from '@playwright/test'

test.describe('Purchase flow', () => {
  test('one-time donate shows fee breakdown', async ({ page }) => {
    await page.goto('/story/1')
    await expect(page.getByRole('heading', { name: /Story/i })).toBeVisible({ timeout: 5000 }).catch(()=>{})
    const donateBtn = page.getByRole('button', { name: /Donate/i })
    await expect(donateBtn).toBeVisible()
    await donateBtn.click()
    await expect(page.getByText(/Nonprofit fee/i)).toBeVisible({ timeout: 10000 })
  })
})
