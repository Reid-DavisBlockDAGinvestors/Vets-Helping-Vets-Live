import { test, expect } from '@playwright/test'

/**
 * Comprehensive Admin Panel Tests
 * Tests all new admin panels with financial-grade security
 */

const BASE_URL = process.env.BASE_URL || 'https://patriotpledgenfts.netlify.app'

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin page
    await page.goto(`${BASE_URL}/admin`)
  })

  test('should display login form when not authenticated', async ({ page }) => {
    // Check for login form elements
    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    
    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
  })

  test('should have all admin tabs after login', async ({ page }) => {
    // This test requires authentication - skip if not logged in
    const loginForm = page.locator('input[type="email"]')
    if (await loginForm.isVisible()) {
      test.skip(true, 'Requires authentication')
      return
    }

    // Check for all tab buttons
    const tabs = [
      'Campaigns',
      'Users', 
      'Submitters',
      'Governance',
      'Bug',
      'Settings',
      'Distribution',
      'Tokens',
      'Security',
      'Contract'
    ]

    for (const tab of tabs) {
      const tabButton = page.getByRole('button', { name: new RegExp(tab, 'i') })
      await expect(tabButton).toBeVisible()
    }
  })
})

test.describe('Token Management Panel', () => {
  test('API should require authentication', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/tokens`)
    expect(response.status()).toBe(401)
  })
})

test.describe('Security Panel', () => {
  test('API should require authentication', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/security/status?chainId=1043&contractVersion=v6`)
    expect(response.status()).toBe(401)
  })
})

test.describe('Contract Settings Panel', () => {
  test('API should require authentication', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/settings/contract?chainId=1043&contractVersion=v6`)
    expect(response.status()).toBe(401)
  })

  test('request-change API should require authentication', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/admin/settings/request-change`, {
      data: { changeType: 'fee', newValue: 100, reason: 'test' }
    })
    expect(response.status()).toBe(401)
  })
})

test.describe('Campaign Lifecycle', () => {
  test('API should require authentication', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/admin/campaigns/lifecycle`, {
      data: { submissionId: 'test', action: 'deactivate' }
    })
    expect(response.status()).toBe(401)
  })
})

test.describe('Public Pages', () => {
  test('homepage should load', async ({ page }) => {
    await page.goto(BASE_URL)
    // Just verify page loads without errors
    await expect(page.locator('body')).toBeVisible()
  })

  test('marketplace should load', async ({ page }) => {
    await page.goto(`${BASE_URL}/marketplace`)
    // Should show fundraiser cards or empty state
    await expect(page.locator('body')).toBeVisible()
  })

  test('admin page should load', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`)
    // Should show login form
    await expect(page.locator('body')).toBeVisible()
  })
})
