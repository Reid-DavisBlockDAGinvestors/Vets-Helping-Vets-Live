/**
 * Retry utility with exponential backoff
 * Follows Interface Segregation Principle - each interface has a single responsibility
 */

// Interface for retry configuration
export interface IRetryConfig {
  maxAttempts: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

// Interface for retry result
export interface IRetryResult<T> {
  success: boolean
  data?: T
  error?: Error
  attempts: number
  totalTimeMs: number
}

// Interface for retry status callback
export interface IRetryStatusCallback {
  (status: {
    attempt: number
    maxAttempts: number
    delayMs: number
    error?: Error
  }): void
}

// Interface for the operation to retry
export interface IRetryableOperation<T> {
  (): Promise<T>
}

// Default configuration
export const DEFAULT_RETRY_CONFIG: IRetryConfig = {
  maxAttempts: 5,
  initialDelayMs: 2000,
  maxDelayMs: 10000,
  backoffMultiplier: 1.5,
}

/**
 * Calculate delay for a given attempt using exponential backoff
 */
export function calculateBackoffDelay(
  attempt: number,
  config: IRetryConfig
): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1)
  return Math.min(delay, config.maxDelayMs)
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Execute an operation with retry logic and exponential backoff
 */
export async function withRetry<T>(
  operation: IRetryableOperation<T>,
  config: Partial<IRetryConfig> = {},
  onStatus?: IRetryStatusCallback
): Promise<IRetryResult<T>> {
  const fullConfig: IRetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  const startTime = Date.now()
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= fullConfig.maxAttempts; attempt++) {
    try {
      const data = await operation()
      return {
        success: true,
        data,
        attempts: attempt,
        totalTimeMs: Date.now() - startTime,
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      
      const isLastAttempt = attempt >= fullConfig.maxAttempts
      const delayMs = isLastAttempt ? 0 : calculateBackoffDelay(attempt, fullConfig)

      // Notify status callback
      if (onStatus) {
        onStatus({
          attempt,
          maxAttempts: fullConfig.maxAttempts,
          delayMs,
          error: lastError,
        })
      }

      // If not last attempt, wait before retrying
      if (!isLastAttempt && delayMs > 0) {
        await sleep(delayMs)
      }
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: fullConfig.maxAttempts,
    totalTimeMs: Date.now() - startTime,
  }
}

/**
 * Check if an error is retryable (network/RPC errors typically are)
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase()
  const retryablePatterns = [
    'timeout',
    'network',
    'econnrefused',
    'econnreset',
    'etimedout',
    'socket hang up',
    'rpc',
    'json-rpc',
    'internal error',
    'server error',
    '503',
    '502',
    '504',
    'rate limit',
    'too many requests',
  ]
  return retryablePatterns.some(pattern => message.includes(pattern))
}
