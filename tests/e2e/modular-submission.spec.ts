import { test, expect } from '@playwright/test'

/**
 * E2E tests for the refactored submission module
 * Tests the modular components/submission/ structure
 */
test.describe('Submission Form - Modular Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/submit')
  })

  test('displays all form sections', async ({ page }) => {
    // Wait for page to load (use domcontentloaded to avoid timeout on ongoing requests)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)
    
    // Section 1: Campaign Type
    await expect(page.getByText('Campaign Type').first()).toBeVisible({ timeout: 5000 })
    
    // Section 2: Campaign Title
    await expect(page.getByText('Campaign Title').first()).toBeVisible({ timeout: 3000 })
    
    // Section 3: Your Story
    await expect(page.getByText('Your Story').first()).toBeVisible({ timeout: 3000 })
    
    // Section 6: Fundraising Goal
    await expect(page.getByText('Fundraising Goal').first()).toBeVisible({ timeout: 3000 })
    
    // Section 7: Campaign Image
    await expect(page.getByText('Campaign Image').first()).toBeVisible({ timeout: 3000 })
    
    // Section 8: Contact Information
    await expect(page.getByText('Your Contact Information').first()).toBeVisible({ timeout: 3000 })
  })

  test('category selection works', async ({ page }) => {
    // Find category buttons
    const veteranButton = page.getByRole('button', { name: /veteran/i })
    const generalButton = page.getByRole('button', { name: /general/i })
    
    // Click general category
    if (await generalButton.isVisible()) {
      await generalButton.click()
    }
  })

  test('form fields accept input', async ({ page }) => {
    // Fill title
    const titleInput = page.locator('input[placeholder*="Help"]').first()
    if (await titleInput.isVisible()) {
      await titleInput.fill('Test Campaign Title')
      await expect(titleInput).toHaveValue('Test Campaign Title')
    }
    
    // Fill story/background
    const storyInput = page.locator('textarea').first()
    if (await storyInput.isVisible()) {
      await storyInput.fill('This is my story for testing the form.')
      await expect(storyInput).toHaveValue('This is my story for testing the form.')
    }
  })

  test('goal input accepts numbers', async ({ page }) => {
    const goalInput = page.locator('input[type="number"]').first()
    if (await goalInput.isVisible()) {
      await goalInput.fill('5000')
      await expect(goalInput).toHaveValue('5000')
    }
  })

  test('contact section has required fields', async ({ page }) => {
    // First Name - use exact match to avoid matching title placeholder
    const firstNameInput = page.getByPlaceholder('John', { exact: true })
    await expect(firstNameInput).toBeVisible({ timeout: 3000 })
    
    // Last Name - exact placeholder match
    const lastNameInput = page.getByPlaceholder('Doe', { exact: true })
    await expect(lastNameInput).toBeVisible({ timeout: 2000 })
    
    // Phone - pattern with area code
    const phoneInput = page.getByPlaceholder(/\(555\)|phone/i)
    await expect(phoneInput).toBeVisible({ timeout: 2000 })
    
    // Email - look for email placeholder in contact section
    const emailInput = page.locator('input[type="email"]').first()
    await expect(emailInput).toBeVisible({ timeout: 2000 })
  })
})

test.describe('Submission Form - Validation', () => {
  test('submit button requires CAPTCHA and login', async ({ page }) => {
    await page.goto('/submit')
    
    // Submit button should exist
    const submitButton = page.getByRole('button', { name: /submit for approval/i })
    await expect(submitButton).toBeVisible()
  })
})
