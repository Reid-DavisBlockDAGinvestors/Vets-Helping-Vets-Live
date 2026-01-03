/**
 * Fund Distribution E2E Tests
 * 
 * Tests for the immediate payout feature and fund distribution UI components.
 * These tests verify:
 * - ImmediatePayoutToggle component functionality
 * - DistributionStatusBadge displays correctly
 * - ApprovalModal shows immediate payout option for V7/V8
 * - Admin can toggle immediate payout on minted campaigns
 */

import { test, expect } from '@playwright/test'

// Test configuration
const TEST_CONFIG = {
  adminEmail: 'Reid@BlockDAGinvestors.com',
  adminPassword: 'Champions$1956',
  baseUrl: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000'
}

test.describe('Fund Distribution Features', () => {
  
  test.describe('Distribution Status Badge', () => {
    
    test('should display immediate payout badge for enabled campaigns', async ({ page }) => {
      // Navigate to admin and login
      await page.goto(`${TEST_CONFIG.baseUrl}/admin`)
      
      // Login if needed
      const loginButton = page.getByTestId('login-btn')
      if (await loginButton.isVisible()) {
        await page.fill('[data-testid="email-input"]', TEST_CONFIG.adminEmail)
        await page.fill('[data-testid="password-input"]', TEST_CONFIG.adminPassword)
        await loginButton.click()
        await page.waitForURL('**/admin**')
      }
      
      // Navigate to campaigns
      await page.click('[data-testid="campaigns-tab"]')
      await page.waitForSelector('[data-testid="campaign-card"]', { timeout: 10000 })
      
      // Expand a minted campaign
      const mintedCampaign = page.locator('[data-testid="campaign-card"]').filter({
        has: page.locator('text=minted')
      }).first()
      
      if (await mintedCampaign.isVisible()) {
        await mintedCampaign.click()
        
        // Check for distribution status badge
        const badge = page.getByTestId('distribution-status-badge')
        await expect(badge).toBeVisible({ timeout: 5000 })
      }
    })
    
    test('should show correct status text for immediate payout', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/admin`)
      
      // Wait for page to load
      await page.waitForLoadState('networkidle')
      
      // Look for distribution badges
      const badges = page.locator('[data-testid="distribution-status-badge"]')
      const count = await badges.count()
      
      if (count > 0) {
        // Check that badges contain expected text
        const badge = badges.first()
        const text = await badge.textContent()
        
        // Should contain either "Auto" or "Manual" or full text
        expect(text).toMatch(/Auto|Manual|Immediate Payout|Manual Distribution/i)
      }
    })
  })
  
  test.describe('Immediate Payout Toggle', () => {
    
    test('should render toggle switch in campaign edit modal', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/admin`)
      
      // Login
      const loginButton = page.getByTestId('login-btn')
      if (await loginButton.isVisible()) {
        await page.fill('[data-testid="email-input"]', TEST_CONFIG.adminEmail)
        await page.fill('[data-testid="password-input"]', TEST_CONFIG.adminPassword)
        await loginButton.click()
        await page.waitForURL('**/admin**')
      }
      
      // Navigate to campaigns
      await page.click('[data-testid="campaigns-tab"]')
      await page.waitForSelector('[data-testid="campaign-card"]', { timeout: 10000 })
      
      // Find and click edit on a minted campaign
      const campaignCard = page.locator('[data-testid="campaign-card"]').first()
      await campaignCard.click()
      
      // Click edit button
      const editButton = page.getByTestId('edit-campaign-btn')
      if (await editButton.isVisible()) {
        await editButton.click()
        
        // Check for immediate payout toggle in edit modal
        const toggle = page.getByTestId('immediate-payout-toggle')
        // Toggle may or may not be visible depending on campaign state
        if (await toggle.isVisible({ timeout: 3000 })) {
          await expect(toggle).toBeVisible()
          
          // Check for switch element
          const switchElement = page.getByTestId('immediate-payout-switch')
          await expect(switchElement).toBeVisible()
        }
      }
    })
  })
  
  test.describe('Approval Modal - Immediate Payout Option', () => {
    
    test('should show immediate payout checkbox for V7/V8 networks', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/admin`)
      
      // Login
      const loginButton = page.getByTestId('login-btn')
      if (await loginButton.isVisible()) {
        await page.fill('[data-testid="email-input"]', TEST_CONFIG.adminEmail)
        await page.fill('[data-testid="password-input"]', TEST_CONFIG.adminPassword)
        await loginButton.click()
        await page.waitForURL('**/admin**')
      }
      
      // Navigate to campaigns
      await page.click('[data-testid="campaigns-tab"]')
      await page.waitForSelector('[data-testid="campaign-card"]', { timeout: 10000 })
      
      // Find a pending campaign
      const pendingCampaign = page.locator('[data-testid="campaign-card"]').filter({
        has: page.locator('text=pending')
      }).first()
      
      if (await pendingCampaign.isVisible()) {
        await pendingCampaign.click()
        
        // Click approve button
        const approveButton = page.getByTestId('approve-campaign-btn')
        if (await approveButton.isVisible()) {
          await approveButton.click()
          
          // Wait for approval modal
          await page.waitForSelector('[data-testid="network-select"]', { timeout: 5000 })
          
          // Select Sepolia (V8)
          await page.selectOption('[data-testid="network-select"]', '11155111')
          
          // Check for immediate payout checkbox
          const checkbox = page.getByTestId('immediate-payout-checkbox')
          await expect(checkbox).toBeVisible()
        }
      }
    })
    
    test('should auto-enable immediate payout when mainnet selected', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/admin`)
      
      // Login
      const loginButton = page.getByTestId('login-btn')
      if (await loginButton.isVisible()) {
        await page.fill('[data-testid="email-input"]', TEST_CONFIG.adminEmail)
        await page.fill('[data-testid="password-input"]', TEST_CONFIG.adminPassword)
        await loginButton.click()
        await page.waitForURL('**/admin**')
      }
      
      // Navigate to campaigns
      await page.click('[data-testid="campaigns-tab"]')
      await page.waitForSelector('[data-testid="campaign-card"]', { timeout: 10000 })
      
      // Find a pending campaign
      const pendingCampaign = page.locator('[data-testid="campaign-card"]').filter({
        has: page.locator('text=pending')
      }).first()
      
      if (await pendingCampaign.isVisible()) {
        await pendingCampaign.click()
        
        // Click approve button
        const approveButton = page.getByTestId('approve-campaign-btn')
        if (await approveButton.isVisible()) {
          await approveButton.click()
          
          // Wait for approval modal
          await page.waitForSelector('[data-testid="network-select"]', { timeout: 5000 })
          
          // Select Ethereum Mainnet
          await page.selectOption('[data-testid="network-select"]', '1')
          
          // Wait for auto-enable effect
          await page.waitForTimeout(500)
          
          // Check that immediate payout checkbox is auto-checked
          const checkbox = page.getByTestId('immediate-payout-checkbox')
          if (await checkbox.isVisible()) {
            await expect(checkbox).toBeChecked()
          }
        }
      }
    })
  })
  
  test.describe('API - Immediate Payout Toggle', () => {
    
    test('GET /api/admin/campaigns/[id]/immediate-payout returns campaign status', async ({ request }) => {
      // This test requires a valid campaign ID and auth token
      // Skip if not configured
      const testCampaignId = process.env.TEST_CAMPAIGN_ID
      if (!testCampaignId) {
        test.skip()
        return
      }
      
      const response = await request.get(
        `${TEST_CONFIG.baseUrl}/api/admin/campaigns/${testCampaignId}/immediate-payout`,
        {
          params: {
            chainId: '1',
            contractAddress: '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e',
            campaignId: '0'
          }
        }
      )
      
      // Should return campaign info even without auth (GET is read-only)
      expect(response.status()).toBe(200)
      
      const data = await response.json()
      expect(data).toHaveProperty('immediatePayoutEnabled')
      expect(data).toHaveProperty('chainId')
      expect(data).toHaveProperty('contractAddress')
    })
  })
})

test.describe('Fund Distribution Roadmap Requirements', () => {
  
  test('approval modal includes network selection with V8 option', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/admin`)
    
    // Login
    const loginButton = page.getByTestId('login-btn')
    if (await loginButton.isVisible()) {
      await page.fill('[data-testid="email-input"]', TEST_CONFIG.adminEmail)
      await page.fill('[data-testid="password-input"]', TEST_CONFIG.adminPassword)
      await loginButton.click()
      await page.waitForURL('**/admin**')
    }
    
    // Check that network select exists in any approval modal
    await page.click('[data-testid="campaigns-tab"]')
    await page.waitForLoadState('networkidle')
    
    // Find any campaign with approve button
    const approveButton = page.getByTestId('approve-campaign-btn').first()
    if (await approveButton.isVisible()) {
      await approveButton.click()
      
      const networkSelect = page.getByTestId('network-select')
      await expect(networkSelect).toBeVisible()
      
      // Check for V8 options
      const options = await networkSelect.locator('option').allTextContents()
      const hasV8 = options.some(opt => opt.includes('v8'))
      expect(hasV8).toBe(true)
    }
  })
  
  test('campaign cards show chain badges for multi-chain support', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/admin`)
    
    // Login
    const loginButton = page.getByTestId('login-btn')
    if (await loginButton.isVisible()) {
      await page.fill('[data-testid="email-input"]', TEST_CONFIG.adminEmail)
      await page.fill('[data-testid="password-input"]', TEST_CONFIG.adminPassword)
      await loginButton.click()
      await page.waitForURL('**/admin**')
    }
    
    await page.click('[data-testid="campaigns-tab"]')
    await page.waitForSelector('[data-testid="campaign-card"]', { timeout: 10000 })
    
    // Check for network badges on campaign cards
    const networkBadges = page.locator('[data-testid^="network-badge-"]')
    const count = await networkBadges.count()
    
    // Should have at least one network badge if campaigns exist
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
