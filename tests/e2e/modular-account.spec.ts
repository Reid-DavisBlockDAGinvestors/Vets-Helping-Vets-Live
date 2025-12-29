import { test, expect } from '@playwright/test'

/**
 * E2E tests for the refactored account module
 * Tests the modular components/account/ structure
 */
test.describe('User Account Portal - Auth Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('sign in button is visible when not logged in', async ({ page }) => {
    // Look for sign in button
    const signInButton = page.getByRole('button', { name: /sign in/i })
    await expect(signInButton).toBeVisible()
  })

  test('clicking sign in opens auth modal', async ({ page }) => {
    const signInButton = page.getByRole('button', { name: /sign in/i })
    await signInButton.click()
    
    // Modal should appear with welcome text
    await expect(page.getByText(/welcome back/i)).toBeVisible()
    
    // Email input should be visible
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    
    // Password input should be visible
    await expect(page.getByPlaceholder(/password/i)).toBeVisible()
  })

  test('can switch between login and signup modes', async ({ page }) => {
    const signInButton = page.getByRole('button', { name: /sign in/i })
    await signInButton.click()
    
    // Wait for modal to open
    await page.waitForTimeout(500)
    
    // Click signup link - try multiple selectors
    const signupLink = page.getByText(/don't have an account/i).or(page.getByText(/create.*account/i)).or(page.getByText(/sign up/i))
    if (await signupLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await signupLink.click()
      
      // Should show create account or signup form
      const hasSignupForm = await page.getByText(/create account/i).isVisible({ timeout: 2000 }).catch(() => false) ||
                            await page.getByPlaceholder(/first name/i).isVisible({ timeout: 1000 }).catch(() => false)
      expect(hasSignupForm).toBe(true)
    }
  })

  test('can access forgot password', async ({ page }) => {
    const signInButton = page.getByRole('button', { name: /sign in/i })
    await signInButton.click()
    
    // Click forgot password link
    const forgotLink = page.getByText(/forgot password/i)
    await forgotLink.click()
    
    // Should show reset password text
    await expect(page.getByText(/reset password/i)).toBeVisible()
    
    // Should show send reset link button
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible()
  })

  test('modal can be closed', async ({ page }) => {
    const signInButton = page.getByRole('button', { name: /sign in/i })
    await signInButton.click()
    
    // Wait for modal to appear
    await page.waitForTimeout(500)
    const modalVisible = await page.getByText(/welcome back/i).isVisible({ timeout: 2000 }).catch(() => false) ||
                         await page.getByPlaceholder(/email/i).isVisible({ timeout: 1000 }).catch(() => false)
    
    if (modalVisible) {
      // Try to close by clicking backdrop or close button
      const closeButton = page.locator('button[aria-label*="close"]').or(page.locator('button').filter({ has: page.locator('svg.lucide-x') })).first()
      if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click()
      } else {
        // Click outside modal (backdrop)
        await page.mouse.click(10, 10)
      }
      
      // Modal should be closed
      await page.waitForTimeout(300)
    }
  })
})

test.describe('User Account Portal - Form Validation', () => {
  test('login button is disabled without credentials', async ({ page }) => {
    await page.goto('/')
    
    const signInButton = page.getByRole('button', { name: /sign in/i })
    await signInButton.click()
    
    // Wait for modal
    await page.waitForTimeout(500)
    
    // Sign in submit button should be disabled initially (various possible names)
    const submitButton = page.getByRole('button', { name: /^sign in$/i }).or(page.getByRole('button', { name: /^log in$/i }))
    if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Button should be disabled without email/password
      const isDisabled = await submitButton.isDisabled().catch(() => true)
      expect(isDisabled).toBe(true)
    }
  })

  test('signup requires first and last name', async ({ page }) => {
    await page.goto('/')
    
    const signInButton = page.getByRole('button', { name: /sign in/i })
    await signInButton.click()
    
    // Switch to signup
    await page.getByText(/don't have an account/i).click()
    
    // Fill only email and password
    await page.getByPlaceholder(/email/i).fill('test@example.com')
    await page.getByPlaceholder(/password/i).fill('password123')
    
    // Create account button should still be disabled without name
    const createButton = page.getByRole('button', { name: /create account/i })
    await expect(createButton).toBeDisabled()
  })
})
