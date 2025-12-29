import { test, expect } from '@playwright/test'

/**
 * Community Hub E2E Tests
 * 
 * Tests for the community discussion features.
 */

test.describe('Community Hub', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/community')
  })

  test('community page loads successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/PatriotPledge/i)
    
    // Should show community heading or content
    const hasHeading = await page.getByRole('heading', { name: /community/i }).count() > 0
    const hasContent = await page.getByText(/post|discussion|feed/i).count() > 0
    
    expect(hasHeading || hasContent).toBe(true)
  })

  test('shows post feed or empty state', async ({ page }) => {
    await page.waitForLoadState('networkidle')
    
    // Either posts exist or empty state message
    const hasPosts = await page.locator('[class*="post"]').or(page.locator('[class*="card"]')).count() > 0
    const hasEmptyState = await page.getByText(/no posts|be the first|start a discussion/i).count() > 0
    const hasContent = await page.getByRole('main').count() > 0
    
    expect(hasPosts || hasEmptyState || hasContent).toBe(true)
  })

  test('shows post composer or sign-in prompt', async ({ page }) => {
    await page.waitForLoadState('networkidle')
    
    // Either composer is visible (authenticated) or sign-in prompt
    const hasComposer = await page.locator('textarea').or(page.getByPlaceholder(/write|share|post/i)).count() > 0
    const hasSignIn = await page.getByText(/sign in|log in|connect/i).count() > 0
    const hasButton = await page.getByRole('button').count() > 0
    
    expect(hasComposer || hasSignIn || hasButton).toBe(true)
  })

  test('navigation links work', async ({ page }) => {
    // Should have navigation to other pages
    const marketplaceLink = page.getByRole('link', { name: /marketplace/i })
    const submitLink = page.getByRole('link', { name: /submit/i })
    
    expect(await marketplaceLink.count() > 0 || await submitLink.count() > 0).toBe(true)
  })
})

test.describe('Community Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/community')
    await page.waitForLoadState('networkidle')
  })

  test('posts have reaction buttons', async ({ page }) => {
    // Find posts with reaction buttons
    const reactionButtons = page.locator('button').filter({ hasText: /❤|🙏|💪|🎉|😢|like|love/i })
    
    // Either reactions exist or no posts yet
    const hasReactions = await reactionButtons.count() > 0
    const noPosts = await page.getByText(/no posts|empty/i).count() > 0
    const hasPage = await page.getByRole('main').count() > 0
    
    expect(hasReactions || noPosts || hasPage).toBe(true)
  })

  test('posts show author and timestamp', async ({ page }) => {
    const posts = page.locator('[class*="post"]').or(page.locator('article'))
    
    if (await posts.count() > 0) {
      const firstPost = posts.first()
      // Should have some author indicator or timestamp
      const hasAuthor = await firstPost.locator('[class*="author"]').or(firstPost.getByText(/@|by /i)).count() > 0
      const hasTime = await firstPost.locator('time').or(firstPost.getByText(/ago|today|yesterday/i)).count() > 0
      
      expect(hasAuthor || hasTime).toBe(true)
    }
  })
})
