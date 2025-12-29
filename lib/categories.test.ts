/**
 * Tests for categories utility functions
 * Following Test-Driven Design principles
 */

import {
  CATEGORIES,
  getCategoryById,
  getCategoryLabel,
  getCategoryClasses,
  mapLegacyCategory,
  DEFAULT_CATEGORY,
  CategoryId,
} from './categories'

describe('CATEGORIES', () => {
  it('should have 8 categories', () => {
    expect(CATEGORIES.length).toBe(8)
  })

  it('should have all required category IDs', () => {
    const expectedIds: CategoryId[] = [
      'veteran',
      'medical',
      'children',
      'pets',
      'disaster',
      'education',
      'community',
      'other',
    ]
    
    const actualIds = CATEGORIES.map(c => c.id)
    expectedIds.forEach(id => {
      expect(actualIds).toContain(id)
    })
  })

  it('should have emoji, label, description, and color for each category', () => {
    CATEGORIES.forEach(cat => {
      expect(cat.emoji).toBeDefined()
      expect(cat.emoji.length).toBeGreaterThan(0)
      expect(cat.label).toBeDefined()
      expect(cat.label.length).toBeGreaterThan(0)
      expect(cat.description).toBeDefined()
      expect(cat.description.length).toBeGreaterThan(0)
      expect(cat.color).toBeDefined()
    })
  })
})

describe('getCategoryById', () => {
  it('should return category for valid ID', () => {
    const veteran = getCategoryById('veteran')
    expect(veteran).toBeDefined()
    expect(veteran?.id).toBe('veteran')
    expect(veteran?.emoji).toBe('🎖️')
  })

  it('should return undefined for invalid ID', () => {
    expect(getCategoryById('invalid')).toBeUndefined()
    expect(getCategoryById('')).toBeUndefined()
  })

  it('should return correct category for each valid ID', () => {
    CATEGORIES.forEach(cat => {
      const result = getCategoryById(cat.id)
      expect(result).toEqual(cat)
    })
  })
})

describe('getCategoryLabel', () => {
  it('should return emoji + label for valid category', () => {
    const label = getCategoryLabel('veteran')
    expect(label).toBe('🎖️ Veteran / Military')
  })

  it('should return ID for unknown category', () => {
    expect(getCategoryLabel('unknown')).toBe('unknown')
  })

  it('should include emoji at start', () => {
    const label = getCategoryLabel('medical')
    expect(label.startsWith('🏥')).toBe(true)
  })
})

describe('getCategoryClasses', () => {
  it('should return bg class by default', () => {
    const classes = getCategoryClasses('veteran')
    expect(classes).toBe('bg-red-500')
  })

  it('should return text class when specified', () => {
    const classes = getCategoryClasses('veteran', 'text')
    expect(classes).toBe('text-red-400')
  })

  it('should return border class when specified', () => {
    const classes = getCategoryClasses('veteran', 'border')
    expect(classes).toBe('border-red-500')
  })

  it('should return gray for unknown category', () => {
    const classes = getCategoryClasses('invalid')
    expect(classes).toBe('bg-gray-500')
  })
})

describe('mapLegacyCategory', () => {
  it('should map "general" to "other"', () => {
    expect(mapLegacyCategory('general')).toBe('other')
  })

  it('should return valid category ID unchanged', () => {
    expect(mapLegacyCategory('veteran')).toBe('veteran')
    expect(mapLegacyCategory('medical')).toBe('medical')
  })

  it('should return "other" for unknown category', () => {
    expect(mapLegacyCategory('unknown')).toBe('other')
    expect(mapLegacyCategory('')).toBe('other')
  })
})

describe('DEFAULT_CATEGORY', () => {
  it('should be "other"', () => {
    expect(DEFAULT_CATEGORY).toBe('other')
  })

  it('should be a valid category ID', () => {
    const category = getCategoryById(DEFAULT_CATEGORY)
    expect(category).toBeDefined()
  })
})
