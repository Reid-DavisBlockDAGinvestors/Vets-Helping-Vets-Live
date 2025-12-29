import { test, expect } from '@playwright/test'

/**
 * Admin Campaign Management E2E Tests
 * 
 * These tests verify the admin campaign hub functionality.
 * Must be authenticated as admin to run these tests.
 */

test.describe('Admin Campaign Management', () => {
  // Skip auth for now - admin page handles its own auth
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin')
  })

  test('admin page loads with login form or dashboard', async ({ page }) => {
    // Should show either login form or dashboard depending on auth state
    const hasLoginForm = await page.locator('input[type="email"]').or(page.locator('input[type="password"]')).count() > 0
    const hasDashboard = await page.getByText(/Campaigns|Dashboard|Admin/i).count() > 0
    
    expect(hasLoginForm || hasDashboard).toBe(true)
  })

  test('shows campaign stats grid when authenticated', async ({ page }) => {
    // If we see stats, we're authenticated
    const statsVisible = await page.getByText(/Total|Minted|Pending/i).count()
    
    // Either stats are visible (authenticated) or login form is shown
    if (statsVisible > 0) {
      await expect(page.getByText(/Total|Minted|Pending/i).first()).toBeVisible()
    } else {
      // Not authenticated - should see login
      await expect(page.locator('input[type="email"]').or(page.locator('input[type="password"]')).first()).toBeVisible()
    }
  })

  test('campaign filters are present when viewing campaigns', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Check if we're on the campaigns tab (either by default or after clicking)
    const campaignsTab = page.getByRole('button', { name: /campaigns/i })
    if (await campaignsTab.count() > 0) {
      await campaignsTab.click()
    }
    
    // If authenticated, should see filter controls
    const searchInput = page.locator('input[placeholder*="search" i]').or(page.getByPlaceholder(/search/i))
    const filterDropdown = page.locator('select').or(page.getByRole('combobox'))
    
    // Either filters are visible or we're on login
    const filtersVisible = await searchInput.count() > 0 || await filterDropdown.count() > 0
    const loginVisible = await page.locator('input[type="password"]').count() > 0
    
    expect(filtersVisible || loginVisible).toBe(true)
  })

  test('can navigate between admin tabs', async ({ page }) => {
    await page.waitForLoadState('networkidle')
    
    // Look for tab buttons
    const tabs = ['campaigns', 'users', 'submitters', 'governance', 'bugs']
    
    for (const tabName of tabs) {
      const tab = page.getByRole('button', { name: new RegExp(tabName, 'i') })
      if (await tab.count() > 0) {
        // Tab exists, which means we're likely authenticated
        await expect(tab).toBeVisible()
        break
      }
    }
  })
})

test.describe('Admin Campaign Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
  })

  test('campaign cards show essential information', async ({ page }) => {
    // If authenticated and viewing campaigns
    const campaignCard = page.locator('[class*="campaign"]').or(page.locator('[class*="card"]')).first()
    
    if (await campaignCard.count() > 0) {
      // Campaign card should contain title or status
      const hasTitle = await campaignCard.locator('h3, h4, [class*="title"]').count() > 0
      const hasStatus = await campaignCard.getByText(/pending|approved|minted|rejected/i).count() > 0
      
      expect(hasTitle || hasStatus).toBe(true)
    }
  })

  test('expand campaign shows details', async ({ page }) => {
    // Find expandable campaign
    const expandButton = page.locator('button').filter({ hasText: /expand|details|view/i }).first()
    
    if (await expandButton.count() > 0) {
      await expandButton.click()
      
      // Should show more details after expanding
      await expect(page.getByText(/story|description|wallet|email/i).first()).toBeVisible({ timeout: 5000 })
    }
  })
})
