import { test, expect } from '@playwright/test'

test.describe('Submit Story', () => {
  test('toggle to General and create preview', async ({ page }) => {
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toMatch(/Preview TokenURI/i)
      await dialog.dismiss()
    })

    await page.goto('/submit')
    await expect(page.getByTestId('category-toggle')).toBeVisible()

    await page.getByTestId('category-toggle').getByRole('button', { name: /General/i }).click()
    await page.getByTestId('input-title').fill('Community Clean Water')
    await page.getByTestId('input-story').fill('We are raising funds to install clean water systems for a rural community.')

    await page.getByTestId('btn-preview').click()
  })
})
