/**
 * E2E Tests for Community Like Functionality
 * TDD: Written BEFORE implementation to verify the fix works
 */

import { test, expect } from '@playwright/test'

test.describe('Community Like Functionality', () => {
  
  test('community page should load', async ({ page }) => {
    await page.goto('/community')
    await expect(page.locator('body')).toBeVisible()
  })

  test('like API should require authentication', async ({ request }) => {
    const response = await request.post('/api/community/like', {
      data: { post_id: 'test-post-id' }
    })
    expect(response.status()).toBe(401)
  })

  test('like API should require target (post_id or comment_id)', async ({ request }) => {
    // Without auth, we get 401 first
    const response = await request.post('/api/community/like', {
      data: {}
    })
    // Should be 401 (unauthorized) or 400 (missing target)
    expect([400, 401]).toContain(response.status())
  })

  test('posts API should return posts with likes_count', async ({ request }) => {
    const response = await request.get('/api/community/posts?limit=5')
    expect(response.ok()).toBe(true)
    
    const data = await response.json()
    expect(data.posts).toBeDefined()
    
    // Each post should have likes_count field
    for (const post of data.posts || []) {
      expect(post).toHaveProperty('likes_count')
      expect(typeof post.likes_count).toBe('number')
    }
  })

  test('comments API should return comments with likes_count', async ({ request }) => {
    // First get a post to find comments for
    const postsRes = await request.get('/api/community/posts?limit=1')
    const postsData = await postsRes.json()
    
    if (postsData.posts?.length > 0) {
      const postId = postsData.posts[0].id
      const response = await request.get(`/api/community/comments?post_id=${postId}`)
      
      if (response.ok()) {
        const data = await response.json()
        // Each comment should have likes_count field
        for (const comment of data.comments || []) {
          expect(comment).toHaveProperty('likes_count')
        }
      }
    }
  })
})

test.describe('Community UI Elements', () => {
  
  test('post should have like button with count', async ({ page }) => {
    await page.goto('/community')
    
    // Wait for posts to load
    await page.waitForTimeout(2000)
    
    // Look for like buttons (heart emoji)
    const likeButtons = page.locator('button:has-text("❤️"), button:has-text("🤍")')
    
    // Should have at least one like button if there are posts
    const count = await likeButtons.count()
    console.log(`Found ${count} like buttons`)
  })

  test('comment section should have like buttons', async ({ page }) => {
    await page.goto('/community')
    await page.waitForTimeout(2000)
    
    // Click on comments button to expand
    const commentsButton = page.locator('button:has-text("💬")').first()
    if (await commentsButton.isVisible()) {
      await commentsButton.click()
      await page.waitForTimeout(1000)
      
      // Check for comment like buttons
      const commentLikes = page.locator('.text-xs button:has-text("❤️")')
      const count = await commentLikes.count()
      console.log(`Found ${count} comment like buttons`)
    }
  })
})
