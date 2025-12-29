import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
  test('loads hero section with main CTAs', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Empowering Veterans/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Submit Your Story/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Browse Campaigns/i })).toBeVisible()
  })

  test('shows demo video tutorial section', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('demo-video')).toBeVisible()
  })

  test('shows Why PatriotPledge section', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Why PatriotPledge/i })).toBeVisible()
  })

  test('shows trust indicators', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Verified Recipients/i)).toBeVisible()
    await expect(page.getByText(/Blockchain Transparency/i)).toBeVisible()
    await expect(page.getByText(/1% Platform Fee/i)).toBeVisible()
  })
})
