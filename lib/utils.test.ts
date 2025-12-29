/**
 * Tests for utils utility functions
 * Following Test-Driven Design principles
 */

import {
  cn,
  formatCurrency,
  formatNumber,
  truncate,
  generateId,
  delay,
  isClient,
  isServer,
} from './utils'

describe('cn', () => {
  it('should merge class names', () => {
    const result = cn('text-red-500', 'bg-blue-500')
    expect(result).toBe('text-red-500 bg-blue-500')
  })

  it('should handle conditional classes', () => {
    const result = cn('base', true && 'included', false && 'excluded')
    expect(result).toBe('base included')
  })

  it('should handle arrays', () => {
    const result = cn(['class1', 'class2'])
    expect(result).toBe('class1 class2')
  })

  it('should merge conflicting Tailwind classes', () => {
    const result = cn('px-4', 'px-6')
    expect(result).toBe('px-6')
  })

  it('should handle empty inputs', () => {
    expect(cn()).toBe('')
    expect(cn('')).toBe('')
  })
})

describe('formatCurrency', () => {
  it('should format USD by default', () => {
    expect(formatCurrency(100)).toBe('$100')
  })

  it('should format large amounts with commas', () => {
    expect(formatCurrency(1000)).toBe('$1,000')
    expect(formatCurrency(1000000)).toBe('$1,000,000')
  })

  it('should format decimals properly', () => {
    expect(formatCurrency(99.99)).toBe('$99.99')
    expect(formatCurrency(99.9)).toBe('$99.9')
  })

  it('should handle zero', () => {
    expect(formatCurrency(0)).toBe('$0')
  })

  it('should handle negative amounts', () => {
    expect(formatCurrency(-50)).toBe('-$50')
  })
})

describe('formatNumber', () => {
  it('should return number as string for small values', () => {
    expect(formatNumber(100)).toBe('100')
    expect(formatNumber(999)).toBe('999')
  })

  it('should format thousands with K suffix', () => {
    expect(formatNumber(1000)).toBe('1.0K')
    expect(formatNumber(5500)).toBe('5.5K')
    expect(formatNumber(999999)).toBe('1000.0K')
  })

  it('should format millions with M suffix', () => {
    expect(formatNumber(1000000)).toBe('1.0M')
    expect(formatNumber(2500000)).toBe('2.5M')
  })

  it('should handle zero', () => {
    expect(formatNumber(0)).toBe('0')
  })
})

describe('truncate', () => {
  it('should not truncate short strings', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('should truncate long strings with ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hello...')
  })

  it('should handle exact length', () => {
    expect(truncate('hello', 5)).toBe('hello')
  })

  it('should trim trailing whitespace before ellipsis', () => {
    expect(truncate('hello world', 6)).toBe('hello...')
  })

  it('should handle empty string', () => {
    expect(truncate('', 5)).toBe('')
  })
})

describe('generateId', () => {
  it('should generate ID of default length 8', () => {
    const id = generateId()
    expect(id.length).toBe(8)
  })

  it('should generate ID of specified length', () => {
    expect(generateId(4).length).toBe(4)
    expect(generateId(10).length).toBe(10)
  })

  it('should generate unique IDs', () => {
    const ids = new Set()
    for (let i = 0; i < 100; i++) {
      ids.add(generateId())
    }
    expect(ids.size).toBe(100)
  })

  it('should only contain alphanumeric characters', () => {
    const id = generateId(100)
    expect(/^[a-z0-9]+$/.test(id)).toBe(true)
  })
})

describe('delay', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should resolve after specified time', async () => {
    const promise = delay(1000)
    jest.advanceTimersByTime(1000)
    await expect(promise).resolves.toBeUndefined()
  })

  it('should not resolve before specified time', () => {
    let resolved = false
    delay(1000).then(() => { resolved = true })
    
    jest.advanceTimersByTime(500)
    expect(resolved).toBe(false)
  })
})

describe('isClient and isServer', () => {
  it('should be boolean values', () => {
    expect(typeof isClient).toBe('boolean')
    expect(typeof isServer).toBe('boolean')
  })

  it('should be mutually exclusive', () => {
    expect(isClient).not.toBe(isServer)
  })
})
