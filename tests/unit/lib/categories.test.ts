import {
  CATEGORIES,
  getCategoryById,
  getCategoryLabel,
  getCategoryClasses,
  mapLegacyCategory,
  DEFAULT_CATEGORY,
  type CategoryId,
} from '@/lib/categories'

describe('lib/categories', () => {
  describe('CATEGORIES', () => {
    it('should have 8 categories', () => {
      expect(CATEGORIES).toHaveLength(8)
    })

    it('should have required properties for each category', () => {
      CATEGORIES.forEach((cat) => {
        expect(cat).toHaveProperty('id')
        expect(cat).toHaveProperty('label')
        expect(cat).toHaveProperty('emoji')
        expect(cat).toHaveProperty('description')
        expect(cat).toHaveProperty('color')
      })
    })

    it('should include veteran category', () => {
      const veteran = CATEGORIES.find((c) => c.id === 'veteran')
      expect(veteran).toBeDefined()
      expect(veteran?.label).toBe('Veteran / Military')
      expect(veteran?.emoji).toBe('🎖️')
    })
  })

  describe('getCategoryById', () => {
    it('should return category for valid ID', () => {
      const result = getCategoryById('veteran')
      expect(result).toBeDefined()
      expect(result?.id).toBe('veteran')
    })

    it('should return undefined for invalid ID', () => {
      const result = getCategoryById('invalid-category')
      expect(result).toBeUndefined()
    })

    it('should return medical category', () => {
      const result = getCategoryById('medical')
      expect(result?.label).toBe('Medical Expenses')
      expect(result?.color).toBe('pink')
    })
  })

  describe('getCategoryLabel', () => {
    it('should return emoji + label for valid category', () => {
      const result = getCategoryLabel('veteran')
      expect(result).toBe('🎖️ Veteran / Military')
    })

    it('should return ID for unknown category', () => {
      const result = getCategoryLabel('unknown')
      expect(result).toBe('unknown')
    })

    it('should handle other category', () => {
      const result = getCategoryLabel('other')
      expect(result).toBe('💙 Other')
    })
  })

  describe('getCategoryClasses', () => {
    it('should return bg class by default', () => {
      const result = getCategoryClasses('veteran')
      expect(result).toBe('bg-red-500')
    })

    it('should return text class when specified', () => {
      const result = getCategoryClasses('veteran', 'text')
      expect(result).toBe('text-red-400')
    })

    it('should return border class when specified', () => {
      const result = getCategoryClasses('veteran', 'border')
      expect(result).toBe('border-red-500')
    })

    it('should return gray for unknown category', () => {
      const result = getCategoryClasses('unknown')
      expect(result).toBe('bg-gray-500')
    })
  })

  describe('mapLegacyCategory', () => {
    it('should map "general" to "other"', () => {
      const result = mapLegacyCategory('general')
      expect(result).toBe('other')
    })

    it('should return valid category as-is', () => {
      const result = mapLegacyCategory('veteran')
      expect(result).toBe('veteran')
    })

    it('should return "other" for unknown category', () => {
      const result = mapLegacyCategory('unknown-category')
      expect(result).toBe('other')
    })

    it('should handle all valid categories', () => {
      const validIds: CategoryId[] = [
        'veteran',
        'medical',
        'children',
        'pets',
        'disaster',
        'education',
        'community',
        'other',
      ]
      validIds.forEach((id) => {
        expect(mapLegacyCategory(id)).toBe(id)
      })
    })
  })

  describe('DEFAULT_CATEGORY', () => {
    it('should be "other"', () => {
      expect(DEFAULT_CATEGORY).toBe('other')
    })
  })
})
