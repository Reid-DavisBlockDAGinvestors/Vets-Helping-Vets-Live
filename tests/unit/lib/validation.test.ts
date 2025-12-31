import {
  sanitizeHtml,
  isValidEmail,
  isValidEthAddress,
  isValidUrl,
  sanitizeString,
  isPositiveInteger,
  isInRange,
  isValidUuid,
  validateSubmissionForm,
  validatePurchaseRequest,
  validateBugReport,
} from '@/lib/validation'

describe('lib/validation', () => {
  describe('sanitizeHtml', () => {
    it('should escape HTML entities', () => {
      expect(sanitizeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      )
    })

    it('should escape ampersands', () => {
      expect(sanitizeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry')
    })

    it('should escape single quotes', () => {
      expect(sanitizeHtml("It's fine")).toBe('It&#039;s fine')
    })

    it('should handle empty string', () => {
      expect(sanitizeHtml('')).toBe('')
    })
  })

  describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('user.name@domain.org')).toBe(true)
      expect(isValidEmail('user+tag@gmail.com')).toBe(true)
    })

    it('should return false for invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false)
      expect(isValidEmail('missing@domain')).toBe(false)
      expect(isValidEmail('@nodomain.com')).toBe(false)
      expect(isValidEmail('spaces in@email.com')).toBe(false)
    })
  })

  describe('isValidEthAddress', () => {
    it('should return true for valid addresses', () => {
      expect(isValidEthAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00')).toBe(true)
      expect(isValidEthAddress('0x0000000000000000000000000000000000000000')).toBe(true)
    })

    it('should return false for invalid addresses', () => {
      expect(isValidEthAddress('0x123')).toBe(false)
      expect(isValidEthAddress('not-an-address')).toBe(false)
      expect(isValidEthAddress('742d35Cc6634C0532925a3b844Bc9e7595f8fE00')).toBe(false) // missing 0x
    })
  })

  describe('isValidUrl', () => {
    it('should return true for valid URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true)
      expect(isValidUrl('http://localhost:3000')).toBe(true)
      expect(isValidUrl('https://sub.domain.com/path?query=1')).toBe(true)
    })

    it('should return false for invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false)
      expect(isValidUrl('//missing-protocol.com')).toBe(false)
    })
  })

  describe('sanitizeString', () => {
    it('should trim and sanitize', () => {
      expect(sanitizeString('  hello <world>  ')).toBe('hello &lt;world&gt;')
    })

    it('should respect max length', () => {
      const result = sanitizeString('a'.repeat(100), 10)
      expect(result).toHaveLength(10)
    })
  })

  describe('isPositiveInteger', () => {
    it('should return true for positive integers', () => {
      expect(isPositiveInteger(1)).toBe(true)
      expect(isPositiveInteger(100)).toBe(true)
    })

    it('should return false for non-positive integers', () => {
      expect(isPositiveInteger(0)).toBe(false)
      expect(isPositiveInteger(-1)).toBe(false)
      expect(isPositiveInteger(1.5)).toBe(false)
      expect(isPositiveInteger('1')).toBe(false)
    })
  })

  describe('isInRange', () => {
    it('should return true when in range', () => {
      expect(isInRange(5, 1, 10)).toBe(true)
      expect(isInRange(1, 1, 10)).toBe(true)
      expect(isInRange(10, 1, 10)).toBe(true)
    })

    it('should return false when out of range', () => {
      expect(isInRange(0, 1, 10)).toBe(false)
      expect(isInRange(11, 1, 10)).toBe(false)
    })
  })

  describe('isValidUuid', () => {
    it('should return true for valid UUIDs', () => {
      expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
      expect(isValidUuid('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true)
    })

    it('should return false for invalid UUIDs', () => {
      expect(isValidUuid('not-a-uuid')).toBe(false)
      expect(isValidUuid('550e8400-e29b-41d4-a716')).toBe(false)
    })
  })

  describe('validateSubmissionForm', () => {
    it('should validate valid submission', () => {
      const result = validateSubmissionForm({
        title: 'Valid Campaign Title',
        description: 'A'.repeat(50),
        category: 'medical',
        goalUsd: 1000,
        email: 'test@example.com',
      })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject short title', () => {
      const result = validateSubmissionForm({
        title: 'Hi',
        description: 'A'.repeat(50),
        category: 'medical',
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Title must be at least 5 characters')
    })

    it('should reject invalid email', () => {
      const result = validateSubmissionForm({
        title: 'Valid Title',
        description: 'A'.repeat(50),
        category: 'medical',
        email: 'invalid-email',
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Please enter a valid email address')
    })
  })

  describe('validatePurchaseRequest', () => {
    it('should validate valid purchase', () => {
      const result = validatePurchaseRequest({
        campaignId: 1,
        quantity: 5,
        walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00',
      })
      expect(result.valid).toBe(true)
    })

    it('should reject invalid campaign ID', () => {
      const result = validatePurchaseRequest({
        campaignId: 0,
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid campaign ID')
    })

    it('should reject quantity over 100', () => {
      const result = validatePurchaseRequest({
        campaignId: 1,
        quantity: 101,
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Maximum quantity per purchase is 100')
    })
  })

  describe('validateBugReport', () => {
    it('should validate valid bug report', () => {
      const result = validateBugReport({
        title: 'Bug Title',
        description: 'A'.repeat(25),
        category: 'ui',
      })
      expect(result.valid).toBe(true)
    })

    it('should reject missing category', () => {
      const result = validateBugReport({
        title: 'Bug Title',
        description: 'A'.repeat(25),
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Please select a category')
    })
  })
})
