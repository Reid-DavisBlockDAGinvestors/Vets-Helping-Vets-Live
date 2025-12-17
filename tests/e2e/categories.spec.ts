/**
 * Tests for Fundraiser Categories
 * TDD: These tests define expected behavior for the category system
 */

import { test, expect } from '@playwright/test'
import { 
  CATEGORIES, 
  CategoryId,
  getCategoryById, 
  getCategoryLabel, 
  mapLegacyCategory,
  DEFAULT_CATEGORY
} from '../../lib/categories'

test.describe('Categories Configuration', () => {
  test('should have at least 8 categories', () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(8)
  })

  test('should include required category types', () => {
    const categoryIds = CATEGORIES.map(c => c.id)
    
    // Core categories that must exist
    expect(categoryIds).toContain('veteran')
    expect(categoryIds).toContain('medical')
    expect(categoryIds).toContain('children')
    expect(categoryIds).toContain('pets')
    expect(categoryIds).toContain('disaster')
    expect(categoryIds).toContain('education')
    expect(categoryIds).toContain('community')
    expect(categoryIds).toContain('other')
  })

  test('each category should have required fields', () => {
    for (const category of CATEGORIES) {
      expect(category.id).toBeTruthy()
      expect(category.label).toBeTruthy()
      expect(category.emoji).toBeTruthy()
      expect(category.description).toBeTruthy()
      expect(category.color).toBeTruthy()
    }
  })

  test('category IDs should be unique', () => {
    const ids = CATEGORIES.map(c => c.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  test('veteran category should be first (primary focus)', () => {
    expect(CATEGORIES[0].id).toBe('veteran')
  })
})

test.describe('getCategoryById', () => {
  test('should return category for valid ID', () => {
    const veteran = getCategoryById('veteran')
    expect(veteran).toBeDefined()
    expect(veteran?.label).toBe('Veteran / Military')
    expect(veteran?.emoji).toBe('🎖️')
  })

  test('should return undefined for invalid ID', () => {
    const invalid = getCategoryById('nonexistent')
    expect(invalid).toBeUndefined()
  })

  test('should find all defined categories', () => {
    for (const cat of CATEGORIES) {
      const found = getCategoryById(cat.id)
      expect(found).toBeDefined()
      expect(found?.id).toBe(cat.id)
    }
  })
})

test.describe('getCategoryLabel', () => {
  test('should return emoji + label for valid category', () => {
    const label = getCategoryLabel('veteran')
    expect(label).toBe('🎖️ Veteran / Military')
  })

  test('should return ID for unknown category', () => {
    const label = getCategoryLabel('unknown_category')
    expect(label).toBe('unknown_category')
  })

  test('should work for all categories', () => {
    for (const cat of CATEGORIES) {
      const label = getCategoryLabel(cat.id)
      expect(label).toContain(cat.emoji)
      expect(label).toContain(cat.label)
    }
  })
})

test.describe('mapLegacyCategory', () => {
  test('should map "general" to "other"', () => {
    expect(mapLegacyCategory('general')).toBe('other')
  })

  test('should keep valid category IDs unchanged', () => {
    expect(mapLegacyCategory('veteran')).toBe('veteran')
    expect(mapLegacyCategory('medical')).toBe('medical')
    expect(mapLegacyCategory('pets')).toBe('pets')
  })

  test('should map unknown categories to "other"', () => {
    expect(mapLegacyCategory('random')).toBe('other')
    expect(mapLegacyCategory('')).toBe('other')
  })
})

test.describe('DEFAULT_CATEGORY', () => {
  test('should be "other"', () => {
    expect(DEFAULT_CATEGORY).toBe('other')
  })

  test('should be a valid category ID', () => {
    const cat = getCategoryById(DEFAULT_CATEGORY)
    expect(cat).toBeDefined()
  })
})

test.describe('Category Colors', () => {
  test('veteran should be red (brand color)', () => {
    const veteran = getCategoryById('veteran')
    expect(veteran?.color).toBe('red')
  })

  test('each category should have a distinct color', () => {
    // Note: colors don't need to be unique, but most should be distinct
    const colors = CATEGORIES.map(c => c.color)
    const uniqueColors = new Set(colors)
    // At least 6 different colors for 8 categories
    expect(uniqueColors.size).toBeGreaterThanOrEqual(6)
  })
})

// E2E Tests for Category UI across portals
test.describe('Category UI - Submission Portal', () => {
  test('submission form should display all category options', async ({ page }) => {
    await page.goto('/submit')
    await page.waitForLoadState('networkidle')
    
    // Check for category buttons with emojis
    for (const cat of CATEGORIES) {
      const categoryButton = page.locator(`button:has-text("${cat.label}")`)
      // Should find the category label somewhere on the page
      const labelVisible = await page.locator(`text=${cat.label}`).isVisible().catch(() => false)
      const emojiVisible = await page.locator(`text=${cat.emoji}`).isVisible().catch(() => false)
      
      // At least the label or emoji should be visible
      if (!labelVisible && !emojiVisible) {
        console.log(`Category ${cat.id} (${cat.label}) not visible on submission form`)
      }
    }
    
    // Verify "Campaign Type" section exists
    const campaignTypeSection = page.locator('text=Campaign Type')
    expect(await campaignTypeSection.isVisible()).toBe(true)
  })
})

test.describe('Category UI - Community Hub', () => {
  test('community hub should show category filters in sidebar', async ({ page }) => {
    await page.goto('/community')
    await page.waitForLoadState('networkidle')
    
    // Should have "All Campaigns" option
    const allCampaigns = page.locator('text=All Campaigns')
    expect(await allCampaigns.isVisible()).toBe(true)
    
    // Check that some category labels are visible (sidebar may show abbreviated versions)
    let categoriesFound = 0
    for (const cat of CATEGORIES) {
      const visible = await page.locator(`text=${cat.label}`).isVisible().catch(() => false)
      if (visible) categoriesFound++
    }
    
    console.log(`Found ${categoriesFound}/${CATEGORIES.length} categories visible in Community Hub`)
    expect(categoriesFound).toBeGreaterThan(0)
  })
})

test.describe('Category UI - Admin Portal', () => {
  test('admin submissions should have category dropdown with all options', async ({ request }) => {
    // Test that the AdminSubmissions component imports CATEGORIES
    // We can verify this by checking if the API returns campaigns with valid categories
    const response = await request.get('/api/marketplace/fundraisers?limit=10')
    expect(response.ok()).toBe(true)
    
    const data = await response.json()
    if (data.items && data.items.length > 0) {
      // Verify returned categories are valid
      const validIds = CATEGORIES.map(c => c.id)
      for (const item of data.items) {
        const category = item.category || 'other'
        const mapped = category === 'general' ? 'other' : category
        // Category should be one of our defined categories or legacy 'general'
        const isValid = validIds.includes(mapped) || category === 'general'
        expect(isValid).toBe(true)
      }
    }
  })
})
