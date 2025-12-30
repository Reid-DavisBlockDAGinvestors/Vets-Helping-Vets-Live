/**
 * Unit Tests for Validation Utilities
 * Following TDD principles
 */

import {
  sanitizeHtml,
  isValidEmail,
  isValidEthAddress,
  isValidUrl,
  sanitizeString,
  isPositiveInteger,
  isInRange,
  isValidUuid,
  isValidCategory,
  validateSubmissionForm,
  validatePurchaseRequest,
  validateBugReport,
} from './validation'

describe('sanitizeHtml', () => {
  it('should escape HTML characters', () => {
    expect(sanitizeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    )
  })

  it('should escape ampersands', () => {
    expect(sanitizeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry')
  })

  it('should escape single quotes', () => {
    expect(sanitizeHtml("It's a test")).toBe("It&#039;s a test")
  })
})

describe('isValidEmail', () => {
  it('should return true for valid emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
    expect(isValidEmail('user.name@domain.org')).toBe(true)
    expect(isValidEmail('user+tag@example.co.uk')).toBe(true)
  })

  it('should return false for invalid emails', () => {
    expect(isValidEmail('notanemail')).toBe(false)
    expect(isValidEmail('@nodomain.com')).toBe(false)
    expect(isValidEmail('no@')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})

describe('isValidEthAddress', () => {
  it('should return true for valid Ethereum addresses', () => {
    expect(isValidEthAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD61')).toBe(true)
    expect(isValidEthAddress('0x0000000000000000000000000000000000000000')).toBe(true)
  })

  it('should return false for invalid addresses', () => {
    expect(isValidEthAddress('0x123')).toBe(false)
    expect(isValidEthAddress('not an address')).toBe(false)
    expect(isValidEthAddress('742d35Cc6634C0532925a3b844Bc9e7595f2bD61')).toBe(false) // no 0x
    expect(isValidEthAddress('')).toBe(false)
  })
})

describe('isValidUrl', () => {
  it('should return true for valid URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true)
    expect(isValidUrl('http://localhost:3000')).toBe(true)
    expect(isValidUrl('https://sub.domain.com/path?query=1')).toBe(true)
  })

  it('should return false for invalid URLs', () => {
    expect(isValidUrl('not a url')).toBe(false)
    expect(isValidUrl('example.com')).toBe(false) // no protocol
    expect(isValidUrl('')).toBe(false)
  })
})

describe('sanitizeString', () => {
  it('should trim and sanitize', () => {
    expect(sanitizeString('  hello world  ')).toBe('hello world')
  })

  it('should respect maxLength', () => {
    expect(sanitizeString('hello world', 5)).toBe('hello')
  })

  it('should escape HTML', () => {
    expect(sanitizeString('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;')
  })
})

describe('isPositiveInteger', () => {
  it('should return true for positive integers', () => {
    expect(isPositiveInteger(1)).toBe(true)
    expect(isPositiveInteger(100)).toBe(true)
  })

  it('should return false for non-positive or non-integers', () => {
    expect(isPositiveInteger(0)).toBe(false)
    expect(isPositiveInteger(-1)).toBe(false)
    expect(isPositiveInteger(1.5)).toBe(false)
    expect(isPositiveInteger('1')).toBe(false)
    expect(isPositiveInteger(null)).toBe(false)
  })
})

describe('isInRange', () => {
  it('should return true for values in range', () => {
    expect(isInRange(5, 1, 10)).toBe(true)
    expect(isInRange(1, 1, 10)).toBe(true)
    expect(isInRange(10, 1, 10)).toBe(true)
  })

  it('should return false for values out of range', () => {
    expect(isInRange(0, 1, 10)).toBe(false)
    expect(isInRange(11, 1, 10)).toBe(false)
  })
})

describe('isValidUuid', () => {
  it('should return true for valid UUIDs', () => {
    expect(isValidUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
    expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('should return false for invalid UUIDs', () => {
    expect(isValidUuid('not-a-uuid')).toBe(false)
    expect(isValidUuid('123e4567-e89b-12d3-a456')).toBe(false)
    expect(isValidUuid('')).toBe(false)
  })
})

describe('isValidCategory', () => {
  it('should return true for valid categories', () => {
    expect(isValidCategory('medical')).toBe(true)
    expect(isValidCategory('education')).toBe(true)
    expect(isValidCategory('HOUSING')).toBe(true) // case insensitive
  })

  it('should return false for invalid categories', () => {
    expect(isValidCategory('invalid')).toBe(false)
    expect(isValidCategory('')).toBe(false)
  })
})

describe('validateSubmissionForm', () => {
  it('should pass valid submission', () => {
    const result = validateSubmissionForm({
      title: 'Valid Title Here',
      description: 'This is a valid description that is at least fifty characters long for testing purposes.',
      category: 'medical',
      goalUsd: 1000,
      email: 'test@example.com',
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should fail with short title', () => {
    const result = validateSubmissionForm({
      title: 'Hi',
      description: 'This is a valid description that is at least fifty characters long for testing purposes.',
      category: 'medical',
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Title must be at least 5 characters')
  })

  it('should fail with short description', () => {
    const result = validateSubmissionForm({
      title: 'Valid Title',
      description: 'Too short',
      category: 'medical',
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Description must be at least 50 characters')
  })

  it('should fail with invalid category', () => {
    const result = validateSubmissionForm({
      title: 'Valid Title',
      description: 'This is a valid description that is at least fifty characters long for testing purposes.',
      category: 'invalid',
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Please select a valid category')
  })
})

describe('validatePurchaseRequest', () => {
  it('should pass valid purchase', () => {
    const result = validatePurchaseRequest({
      campaignId: 1,
      quantity: 5,
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD61',
    })
    expect(result.valid).toBe(true)
  })

  it('should fail with invalid campaign ID', () => {
    const result = validatePurchaseRequest({
      campaignId: -1,
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Invalid campaign ID')
  })

  it('should fail with excessive quantity', () => {
    const result = validatePurchaseRequest({
      campaignId: 1,
      quantity: 101,
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Maximum quantity per purchase is 100')
  })
})

describe('validateBugReport', () => {
  it('should pass valid bug report', () => {
    const result = validateBugReport({
      title: 'Bug Title',
      description: 'This is a detailed bug description',
      category: 'ui',
    })
    expect(result.valid).toBe(true)
  })

  it('should fail with missing fields', () => {
    const result = validateBugReport({})
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
