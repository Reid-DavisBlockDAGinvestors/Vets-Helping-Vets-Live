import { test, expect } from '@playwright/test'

test.describe('Accessibility', () => {
  test('skip link is present and works', async ({ page }) => {
    await page.goto('/')
    
    // Skip link should be hidden initially
    const skipLink = page.getByTestId('skip-to-content-link')
    await expect(skipLink).toBeHidden()
    
    // Focus skip link via keyboard
    await page.keyboard.press('Tab')
    
    // Skip link should be visible when focused
    await expect(skipLink).toBeVisible()
    
    // Click skip link
    await skipLink.click()
    
    // Should navigate to main content
    const mainContent = page.locator('#main-content')
    await expect(mainContent).toBeFocused()
  })

  test('theme toggle has proper aria-label', async ({ page }) => {
    await page.goto('/')
    
    const themeToggle = page.getByTestId('theme-toggle-btn')
    await expect(themeToggle).toHaveAttribute('aria-label', /Switch to (light|dark) mode/)
  })

  test('all interactive elements have accessible names', async ({ page }) => {
    await page.goto('/')
    
    // Check buttons have accessible names
    const buttons = page.locator('button')
    const count = await buttons.count()
    
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i)
      const ariaLabel = await button.getAttribute('aria-label')
      const text = await button.textContent()
      const title = await button.getAttribute('title')
      
      // Button should have some accessible name
      expect(ariaLabel || text?.trim() || title).toBeTruthy()
    }
  })

  test('images have alt text', async ({ page }) => {
    await page.goto('/marketplace')
    await page.waitForLoadState('networkidle')
    
    const images = page.locator('img')
    const count = await images.count()
    
    for (let i = 0; i < count; i++) {
      const img = images.nth(i)
      const alt = await img.getAttribute('alt')
      expect(alt).toBeTruthy()
    }
  })

  test('form inputs have labels', async ({ page }) => {
    await page.goto('/submit')
    await page.waitForLoadState('networkidle')
    
    // Check that inputs are properly labeled
    const inputs = page.locator('input:not([type="hidden"]), textarea, select')
    const count = await inputs.count()
    
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i)
      const id = await input.getAttribute('id')
      const ariaLabel = await input.getAttribute('aria-label')
      const ariaLabelledBy = await input.getAttribute('aria-labelledby')
      const placeholder = await input.getAttribute('placeholder')
      
      // Input should have some form of label
      const hasLabel = id ? await page.locator(`label[for="${id}"]`).count() > 0 : false
      expect(hasLabel || ariaLabel || ariaLabelledBy || placeholder).toBeTruthy()
    }
  })
})

test.describe('Keyboard Navigation', () => {
  test('can navigate with Tab key', async ({ page }) => {
    await page.goto('/')
    
    // Tab through focusable elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      const focused = await page.evaluate(() => document.activeElement?.tagName)
      expect(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(focused)
    }
  })

  test('Enter activates buttons', async ({ page }) => {
    await page.goto('/')
    
    // Find theme toggle and focus it
    const themeToggle = page.getByTestId('theme-toggle-btn')
    await themeToggle.focus()
    
    // Get initial theme
    const initialTheme = await page.evaluate(() => 
      document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    )
    
    // Press Enter to toggle
    await page.keyboard.press('Enter')
    
    // Theme should change
    await page.waitForTimeout(100) // Wait for theme change
    const newTheme = await page.evaluate(() => 
      document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    )
    
    expect(newTheme).not.toBe(initialTheme)
  })

  test('Escape closes modals', async ({ page }) => {
    await page.goto('/')
    
    // Open bug report modal
    const bugReportBtn = page.getByTestId('bug-report-fab-btn')
    if (await bugReportBtn.isVisible()) {
      await bugReportBtn.click()
      
      // Modal should be open
      const modal = page.getByRole('dialog')
      await expect(modal).toBeVisible()
      
      // Press Escape
      await page.keyboard.press('Escape')
      
      // Modal should be closed
      await expect(modal).toBeHidden()
    }
  })
})
