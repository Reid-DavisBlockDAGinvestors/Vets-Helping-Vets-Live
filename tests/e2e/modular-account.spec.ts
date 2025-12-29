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
    
    // Click signup link
    const signupLink = page.getByText(/don't have an account/i)
    await signupLink.click()
    
    // Should show create account
    await expect(page.getByText(/create account/i)).toBeVisible()
    
    // First/Last name fields should appear
    await expect(page.getByPlaceholder(/first name/i)).toBeVisible()
    await expect(page.getByPlaceholder(/last name/i)).toBeVisible()
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
    
    // Wait for modal
    await expect(page.getByText(/welcome back/i)).toBeVisible()
    
    // Click close button (X)
    const closeButton = page.locator('button').filter({ has: page.locator('svg') }).first()
    await closeButton.click()
    
    // Modal should be closed (welcome text no longer visible)
    await expect(page.getByText(/welcome back/i)).not.toBeVisible()
  })
})

test.describe('User Account Portal - Form Validation', () => {
  test('login button is disabled without credentials', async ({ page }) => {
    await page.goto('/')
    
    const signInButton = page.getByRole('button', { name: /sign in/i })
    await signInButton.click()
    
    // Sign in submit button should be disabled initially
    const submitButton = page.getByRole('button', { name: /^sign in$/i })
    await expect(submitButton).toBeDisabled()
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
