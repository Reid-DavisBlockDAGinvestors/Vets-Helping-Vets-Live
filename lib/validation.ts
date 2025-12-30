/**
 * Input Validation Utilities
 * 
 * Sanitization and validation for user inputs
 * Following ISP - focused on validation only
 */

import { logger } from './logger'

/**
 * Sanitize HTML to prevent XSS attacks
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate Ethereum address format
 */
export function isValidEthAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Sanitize and trim string input
 */
export function sanitizeString(input: string, maxLength = 1000): string {
  return sanitizeHtml(input.trim().slice(0, maxLength))
}

/**
 * Validate positive integer
 */
export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/**
 * Validate number within range
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

/**
 * Validate UUID format
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * Validate campaign category
 */
const VALID_CATEGORIES = [
  'medical', 'education', 'housing', 'business', 
  'emergency', 'community', 'legal', 'other'
]

export function isValidCategory(category: string): boolean {
  return VALID_CATEGORIES.includes(category.toLowerCase())
}

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate submission form data
 */
export function validateSubmissionForm(data: {
  title?: string
  description?: string
  category?: string
  goalUsd?: number
  email?: string
}): ValidationResult {
  const errors: string[] = []

  if (!data.title || data.title.trim().length < 5) {
    errors.push('Title must be at least 5 characters')
  }
  if (data.title && data.title.length > 200) {
    errors.push('Title must be less than 200 characters')
  }

  if (!data.description || data.description.trim().length < 50) {
    errors.push('Description must be at least 50 characters')
  }
  if (data.description && data.description.length > 10000) {
    errors.push('Description must be less than 10,000 characters')
  }

  if (!data.category || !isValidCategory(data.category)) {
    errors.push('Please select a valid category')
  }

  if (data.goalUsd !== undefined) {
    if (!isPositiveInteger(data.goalUsd)) {
      errors.push('Goal must be a positive number')
    }
    if (data.goalUsd < 100) {
      errors.push('Minimum goal is $100')
    }
    if (data.goalUsd > 1000000) {
      errors.push('Maximum goal is $1,000,000')
    }
  }

  if (data.email && !isValidEmail(data.email)) {
    errors.push('Please enter a valid email address')
  }

  if (errors.length > 0) {
    logger.debug('[Validation] Form validation failed:', errors)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate purchase request
 */
export function validatePurchaseRequest(data: {
  campaignId?: number
  quantity?: number
  walletAddress?: string
}): ValidationResult {
  const errors: string[] = []

  if (!data.campaignId || !isPositiveInteger(data.campaignId)) {
    errors.push('Invalid campaign ID')
  }

  if (data.quantity !== undefined) {
    if (!isPositiveInteger(data.quantity)) {
      errors.push('Quantity must be a positive integer')
    }
    if (data.quantity > 100) {
      errors.push('Maximum quantity per purchase is 100')
    }
  }

  if (data.walletAddress && !isValidEthAddress(data.walletAddress)) {
    errors.push('Invalid wallet address')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate bug report
 */
export function validateBugReport(data: {
  title?: string
  description?: string
  category?: string
}): ValidationResult {
  const errors: string[] = []

  if (!data.title || data.title.trim().length < 5) {
    errors.push('Title must be at least 5 characters')
  }

  if (!data.description || data.description.trim().length < 20) {
    errors.push('Description must be at least 20 characters')
  }

  if (!data.category) {
    errors.push('Please select a category')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
