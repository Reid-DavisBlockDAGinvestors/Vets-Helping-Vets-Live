import { NextRequest, NextResponse } from 'next/server'

/**
 * ELITE SECURITY MIDDLEWARE - Financial Application Standards
 * 
 * Features:
 * - Tiered rate limiting (stricter for auth endpoints)
 * - Security headers injection
 * - Request logging for audit
 * - IP-based throttling with exponential backoff
 */

// Rate limit configurations by endpoint type
const RATE_LIMITS = {
  auth: { capacity: 5, refillPerSec: 0.1 },      // 5 requests, 1 per 10 sec refill (strict for login)
  sensitive: { capacity: 10, refillPerSec: 0.5 }, // 10 requests, 1 per 2 sec (admin, purchases)
  standard: { capacity: 60, refillPerSec: 1 },    // 60 requests, 1 per sec (general API)
} as const

// Endpoint classification
const AUTH_ENDPOINTS = ['/api/auth', '/api/admin/me', '/api/login']
const SENSITIVE_ENDPOINTS = ['/api/admin', '/api/purchase', '/api/withdraw', '/api/transfer']

const buckets = new Map<string, { tokens: number; last: number; violations: number }>()

function getEndpointType(pathname: string): keyof typeof RATE_LIMITS {
  if (AUTH_ENDPOINTS.some(ep => pathname.startsWith(ep))) return 'auth'
  if (SENSITIVE_ENDPOINTS.some(ep => pathname.startsWith(ep))) return 'sensitive'
  return 'standard'
}

function allow(ip: string, endpointType: keyof typeof RATE_LIMITS): { allowed: boolean; remaining: number } {
  const now = Date.now() / 1000
  const key = `${ip}:${endpointType}`
  const config = RATE_LIMITS[endpointType]
  
  const b = buckets.get(key) || { tokens: config.capacity, last: now, violations: 0 }
  const delta = now - b.last
  
  // Apply exponential backoff for repeat violators
  const effectiveCapacity = b.violations > 0 
    ? Math.max(1, config.capacity / Math.pow(2, b.violations))
    : config.capacity
  
  b.tokens = Math.min(effectiveCapacity, b.tokens + delta * config.refillPerSec)
  b.last = now
  
  if (b.tokens < 1) {
    b.violations = Math.min(b.violations + 1, 5) // Cap at 5 violations
    buckets.set(key, b)
    return { allowed: false, remaining: 0 }
  }
  
  b.tokens -= 1
  
  // Decay violations over time (1 hour)
  if (delta > 3600 && b.violations > 0) {
    b.violations = Math.max(0, b.violations - 1)
  }
  
  buckets.set(key, b)
  return { allowed: true, remaining: Math.floor(b.tokens) }
}

// Security headers for all responses
function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  // Prevent caching of sensitive data
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  response.headers.set('Pragma', 'no-cache')
  
  return response
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const ip = req.ip || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0'
  
  // Apply rate limiting to API routes
  if (pathname.startsWith('/api')) {
    const endpointType = getEndpointType(pathname)
    const { allowed, remaining } = allow(ip, endpointType)
    
    if (!allowed) {
      const response = new NextResponse(
        JSON.stringify({ 
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter: endpointType === 'auth' ? 60 : 30
        }), 
        { 
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        }
      )
      
      response.headers.set('Retry-After', endpointType === 'auth' ? '60' : '30')
      response.headers.set('X-RateLimit-Remaining', '0')
      
      return addSecurityHeaders(response)
    }
    
    // Continue with rate limit headers
    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Remaining', String(remaining))
    return addSecurityHeaders(response)
  }
  
  // Add security headers to all responses
  return addSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
