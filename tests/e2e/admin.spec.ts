import { test, expect } from '@playwright/test'

const HAS_SECRET = !!process.env.ADMIN_SECRET

test.describe('Admin UI', () => {
  test.skip(!HAS_SECRET, 'ADMIN_SECRET not set; skipping admin E2E')

  test('login with ADMIN_SECRET and see AdminStoryTools', async ({ page }) => {
    await page.goto('/admin')

    // Login screen
    await expect(page.getByRole('heading', { name: /Admin Panel/i })).toBeVisible()
    const input = page.getByPlaceholder('Admin Secret')
    await expect(input).toBeVisible()
    await input.fill(process.env.ADMIN_SECRET!)
    await page.getByRole('button', { name: /Login/i }).click()

    // Dashboard visible
    await expect(page.getByRole('heading', { name: /Admin Dashboard/i })).toBeVisible({ timeout: 10000 })

    // AdminStoryTools presence
    await expect(page.getByText(/Admin Story Tools/i)).toBeVisible()
  })
})
