/**
 * Rate Limiting Utility
 * 
 * In-memory rate limiter for API routes
 * Following ISP - focused on rate limiting only
 * 
 * For production, consider using:
 * - Redis-based rate limiting
 * - Upstash @upstash/ratelimit
 * - Vercel Edge Config
 */

import { NextRequest } from 'next/server'
import { logger } from './logger'

interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
  /** Identifier for the rate limit (e.g., 'api', 'auth') */
  identifier?: string
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically
const CLEANUP_INTERVAL = 60000 // 1 minute
let lastCleanup = Date.now()

function cleanupExpiredEntries(): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  
  lastCleanup = now
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}

/**
 * Get client identifier from request
 */
export function getClientId(request: NextRequest): string {
  // Try to get real IP from various headers
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfIp = request.headers.get('cf-connecting-ip')
  
  // Use first forwarded IP or fallback
  const ip = forwarded?.split(',')[0]?.trim() || realIp || cfIp || 'unknown'
  
  return ip
}

/**
 * Check if request is rate limited
 */
export function checkRateLimit(
  clientId: string,
  config: RateLimitConfig
): { limited: boolean; remaining: number; resetTime: number } {
  cleanupExpiredEntries()
  
  const key = `${config.identifier || 'default'}:${clientId}`
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  
  // No existing entry or expired
  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    })
    return {
      limited: false,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    }
  }
  
  // Increment count
  entry.count++
  
  // Check if over limit
  if (entry.count > config.maxRequests) {
    logger.warn(`[RateLimit] Client ${clientId} exceeded limit for ${config.identifier || 'default'}`)
    return {
      limited: true,
      remaining: 0,
      resetTime: entry.resetTime,
    }
  }
  
  return {
    limited: false,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  }
}

/**
 * Rate limit middleware for API routes
 */
export function rateLimit(config: RateLimitConfig) {
  return function rateLimitMiddleware(request: NextRequest): Response | null {
    const clientId = getClientId(request)
    const result = checkRateLimit(clientId, config)
    
    if (result.limited) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.resetTime.toString(),
            'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
          },
        }
      )
    }
    
    return null // Not rate limited, continue
  }
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  /** Standard API: 100 requests per minute */
  api: rateLimit({ maxRequests: 100, windowMs: 60000, identifier: 'api' }),
  
  /** Auth endpoints: 10 requests per minute */
  auth: rateLimit({ maxRequests: 10, windowMs: 60000, identifier: 'auth' }),
  
  /** Sensitive operations: 5 requests per minute */
  sensitive: rateLimit({ maxRequests: 5, windowMs: 60000, identifier: 'sensitive' }),
  
  /** Purchases: 20 requests per minute */
  purchase: rateLimit({ maxRequests: 20, windowMs: 60000, identifier: 'purchase' }),
  
  /** File uploads: 10 requests per minute */
  upload: rateLimit({ maxRequests: 10, windowMs: 60000, identifier: 'upload' }),
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: Response,
  config: RateLimitConfig,
  clientId: string
): Response {
  const result = checkRateLimit(clientId, config)
  
  const headers = new Headers(response.headers)
  headers.set('X-RateLimit-Limit', config.maxRequests.toString())
  headers.set('X-RateLimit-Remaining', result.remaining.toString())
  headers.set('X-RateLimit-Reset', result.resetTime.toString())
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
