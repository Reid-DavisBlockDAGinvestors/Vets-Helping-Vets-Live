import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
  test('loads and shows demo video + success carousel', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Empowering Donors/i })).toBeVisible()
    await expect(page.getByTestId('demo-video')).toBeVisible()
    await expect(page.getByTestId('success-carousel')).toBeVisible()
    const main = page.getByRole('main')
    await expect(main.getByRole('link', { name: /Submit Story/i })).toBeVisible()
    await expect(main.getByRole('link', { name: /Browse Marketplace/i })).toBeVisible()
  })
})
