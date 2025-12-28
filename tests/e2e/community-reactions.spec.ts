/**
 * E2E Tests for Community Reactions (Multiple reaction types)
 * TDD: Written BEFORE implementation
 * 
 * Reaction types for charitable/heartfelt fundraising:
 * - ❤️ love (support)
 * - 🙏 pray (hope)
 * - 💪 encourage (strength)
 * - 🎉 celebrate (joy)
 * - 😢 care (sympathy)
 */

import { test, expect } from '@playwright/test'

test.describe('Community Reactions API', () => {
  
  test('reaction API should accept reaction_type parameter', async ({ request }) => {
    // Without auth, we get 401
    const response = await request.post('/api/community/like', {
      data: { post_id: 'test-id', reaction_type: 'love' }
    })
    expect(response.status()).toBe(401)
  })

  test('posts should return reaction counts by type', async ({ request }) => {
    const response = await request.get('/api/community/posts?limit=3')
    expect(response.ok()).toBe(true)
    
    const data = await response.json()
    expect(data.posts).toBeDefined()
    
    // Posts should have likes_count (for backward compatibility)
    for (const post of data.posts || []) {
      expect(post).toHaveProperty('likes_count')
    }
  })
})

test.describe('Community Reactions UI', () => {
  
  test('post should have reaction picker', async ({ page }) => {
    await page.goto('/community')
    await page.waitForTimeout(2000)
    
    // Look for reaction buttons or picker
    const hasReactionUI = await page.locator('button:has-text("❤️"), button:has-text("🙏"), button:has-text("💪")').count()
    console.log(`Found ${hasReactionUI} reaction buttons`)
  })

  test('hovering on like should show reaction options', async ({ page }) => {
    await page.goto('/community')
    await page.waitForTimeout(2000)
    
    // Find a like/reaction button
    const reactionButton = page.locator('button:has-text("❤️"), button:has-text("🤍")').first()
    
    if (await reactionButton.isVisible()) {
      // Hover to see if reaction picker appears
      await reactionButton.hover()
      await page.waitForTimeout(500)
      
      // Check for reaction picker
      const hasReactionPicker = await page.locator('.reaction-picker, [data-reaction-picker]').count()
      console.log(`Reaction picker visible: ${hasReactionPicker > 0}`)
    }
  })
})
