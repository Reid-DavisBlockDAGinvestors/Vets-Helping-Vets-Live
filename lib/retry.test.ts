/**
 * Tests for retry utility
 * Following Test-Driven Design principles
 */

/// <reference types="jest" />

import {
  withRetry,
  calculateBackoffDelay,
  isRetryableError,
  DEFAULT_RETRY_CONFIG,
  IRetryConfig,
  IRetryResult,
} from './retry'

describe('calculateBackoffDelay', () => {
  const config: IRetryConfig = {
    maxAttempts: 5,
    initialDelayMs: 2000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  }

  it('should return initial delay for first attempt', () => {
    expect(calculateBackoffDelay(1, config)).toBe(2000)
  })

  it('should apply exponential backoff for subsequent attempts', () => {
    expect(calculateBackoffDelay(2, config)).toBe(4000)
    expect(calculateBackoffDelay(3, config)).toBe(8000)
  })

  it('should cap delay at maxDelayMs', () => {
    expect(calculateBackoffDelay(4, config)).toBe(10000) // Would be 16000, capped at 10000
    expect(calculateBackoffDelay(5, config)).toBe(10000)
  })
})

describe('isRetryableError', () => {
  it('should return true for timeout errors', () => {
    expect(isRetryableError(new Error('Connection timeout'))).toBe(true)
    expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true)
  })

  it('should return true for network errors', () => {
    expect(isRetryableError(new Error('Network error'))).toBe(true)
    expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true)
    expect(isRetryableError(new Error('ECONNRESET'))).toBe(true)
  })

  it('should return true for RPC errors', () => {
    expect(isRetryableError(new Error('JSON-RPC error'))).toBe(true)
    expect(isRetryableError(new Error('Internal RPC error'))).toBe(true)
  })

  it('should return true for server errors', () => {
    expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true)
    expect(isRetryableError(new Error('502 Bad Gateway'))).toBe(true)
  })

  it('should return false for non-retryable errors', () => {
    expect(isRetryableError(new Error('Invalid input'))).toBe(false)
    expect(isRetryableError(new Error('Unauthorized'))).toBe(false)
  })
})

describe('withRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should succeed on first attempt if operation succeeds', async () => {
    const operation = jest.fn().mockResolvedValue('success')
    
    const resultPromise = withRetry(operation, { maxAttempts: 3 })
    jest.runAllTimers()
    const result = await resultPromise

    expect(result.success).toBe(true)
    expect(result.data).toBe('success')
    expect(result.attempts).toBe(1)
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure and succeed on subsequent attempt', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue('success')

    const resultPromise = withRetry(operation, { 
      maxAttempts: 5,
      initialDelayMs: 100,
      backoffMultiplier: 1,
      maxDelayMs: 100
    })
    
    // Fast-forward through all timers
    await jest.runAllTimersAsync()
    const result = await resultPromise

    expect(result.success).toBe(true)
    expect(result.data).toBe('success')
    expect(result.attempts).toBe(3)
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('should fail after max attempts', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Always fails'))

    const resultPromise = withRetry(operation, { 
      maxAttempts: 3,
      initialDelayMs: 100,
      backoffMultiplier: 1,
      maxDelayMs: 100
    })
    
    await jest.runAllTimersAsync()
    const result = await resultPromise

    expect(result.success).toBe(false)
    expect(result.error?.message).toBe('Always fails')
    expect(result.attempts).toBe(3)
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('should call status callback on each attempt', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('Fail'))
      .mockResolvedValue('success')
    
    const onStatus = jest.fn()

    const resultPromise = withRetry(
      operation, 
      { maxAttempts: 3, initialDelayMs: 100, backoffMultiplier: 1, maxDelayMs: 100 },
      onStatus
    )
    
    await jest.runAllTimersAsync()
    await resultPromise

    expect(onStatus).toHaveBeenCalledTimes(1) // Called once for the failure
    expect(onStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        maxAttempts: 3,
        error: expect.any(Error),
      })
    )
  })

  it('should use default config when not specified', async () => {
    expect(DEFAULT_RETRY_CONFIG.maxAttempts).toBe(5)
    expect(DEFAULT_RETRY_CONFIG.initialDelayMs).toBe(2000)
    expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(1.5)
  })
})
