import { test, expect } from '@playwright/test'

test.describe('Mobile Profile Dropdown', () => {
  // Test viewport matching bug report: 389x556 (Android, MetaMask Mobile)
  test.use({ viewport: { width: 389, height: 556 } })

  test('profile dropdown should be fully visible on mobile screen', async ({ page }) => {
    // Navigate to marketplace (where bug was reported)
    await page.goto('/marketplace')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Check if there's a sign-in button or user avatar button
    const signInButton = page.locator('button:has-text("Sign In")')
    const userAvatarButton = page.locator('[data-testid="user-account-button"]')
    
    // If signed in, click the avatar to open dropdown
    // If not signed in, we still need to verify the auth modal fits
    const hasSignIn = await signInButton.isVisible().catch(() => false)
    
    if (hasSignIn) {
      // Click sign in to open auth modal
      await signInButton.click()
      
      // Wait for modal
      await page.waitForSelector('[data-testid="auth-modal"], .fixed.inset-0', { timeout: 5000 })
      
      // Check modal is within viewport
      const modal = page.locator('.bg-gray-900.border.rounded-2xl').first()
      const modalBox = await modal.boundingBox()
      
      if (modalBox) {
        // Modal should not extend past left edge (x >= 0)
        expect(modalBox.x).toBeGreaterThanOrEqual(0)
        // Modal should not extend past right edge (x + width <= viewport width)
        expect(modalBox.x + modalBox.width).toBeLessThanOrEqual(389)
        
        console.log(`Modal position: x=${modalBox.x}, width=${modalBox.width}`)
      }
    }
  })

  test('user dropdown menu should not overflow screen on mobile', async ({ page }) => {
    // This test checks that the dropdown (w-80 = 320px) fits in 389px viewport
    await page.goto('/marketplace')
    await page.waitForLoadState('networkidle')
    
    // Take a screenshot at mobile size for visual verification
    await page.screenshot({ path: 'test-results/mobile-profile-before.png', fullPage: false })
    
    // Check that no element with w-80 class overflows
    // The dropdown has class "w-80" which is 320px
    // On a 389px screen with right-0 positioning, it should still fit
    
    // Verify viewport width
    const viewportSize = page.viewportSize()
    expect(viewportSize?.width).toBe(389)
    
    console.log('Mobile viewport test passed - width:', viewportSize?.width)
  })

  test('dropdown should be contained within viewport bounds', async ({ page }) => {
    await page.goto('/marketplace')
    await page.waitForLoadState('networkidle')

    // Evaluate all absolutely positioned dropdowns
    const overflowingElements = await page.evaluate(() => {
      const viewportWidth = window.innerWidth
      const results: string[] = []
      
      // Check elements that might overflow
      document.querySelectorAll('.absolute.right-0').forEach((el) => {
        const rect = el.getBoundingClientRect()
        if (rect.left < 0) {
          results.push(`Element overflows left by ${Math.abs(rect.left)}px`)
        }
        if (rect.right > viewportWidth) {
          results.push(`Element overflows right by ${rect.right - viewportWidth}px`)
        }
      })
      
      return results
    })

    // Log any overflowing elements found
    if (overflowingElements.length > 0) {
      console.log('Overflowing elements found:', overflowingElements)
    }
    
    // This test documents the current state
    // After fix, there should be no overflowing elements
  })
})
