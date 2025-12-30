import { test, expect } from '@playwright/test'

test.describe('Theme Toggle', () => {
  test('theme toggle button is visible', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    const themeToggle = page.getByTestId('theme-toggle-btn')
    await expect(themeToggle).toBeVisible()
  })

  test('clicking theme toggle changes theme', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    const themeToggle = page.getByTestId('theme-toggle-btn')
    
    // Get initial theme
    const initialIsDark = await page.evaluate(() => 
      document.documentElement.classList.contains('dark')
    )
    
    // Click toggle
    await themeToggle.click()
    await page.waitForTimeout(300) // Wait for theme transition
    
    // Theme should change
    const newIsDark = await page.evaluate(() => 
      document.documentElement.classList.contains('dark')
    )
    
    expect(newIsDark).not.toBe(initialIsDark)
  })

  test('theme persists across page navigation', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    const themeToggle = page.getByTestId('theme-toggle-btn')
    
    // Set to light mode
    const isDark = await page.evaluate(() => 
      document.documentElement.classList.contains('dark')
    )
    
    if (isDark) {
      await themeToggle.click()
      await page.waitForTimeout(300)
    }
    
    // Navigate to another page
    await page.goto('/marketplace')
    await page.waitForLoadState('networkidle')
    
    // Theme should still be light
    const stillLight = await page.evaluate(() => 
      !document.documentElement.classList.contains('dark')
    )
    
    expect(stillLight).toBe(true)
  })
})
