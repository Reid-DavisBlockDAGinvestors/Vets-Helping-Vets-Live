import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory token bucket rate limiter per IP for /api/* routes
// Note: In production, use durable storage (Redis) across instances.

const buckets = new Map<string, { tokens: number; last: number }>()
const CAPACITY = 60 // requests
const REFILL_PER_SEC = 1 // 1 token/sec

function allow(ip: string) {
  const now = Date.now() / 1000
  const b = buckets.get(ip) || { tokens: CAPACITY, last: now }
  const delta = now - b.last
  b.tokens = Math.min(CAPACITY, b.tokens + delta * REFILL_PER_SEC)
  b.last = now
  if (b.tokens < 1) {
    buckets.set(ip, b)
    return false
  }
  b.tokens -= 1
  buckets.set(ip, b)
  return true
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname.startsWith('/api')) {
    const ip = req.ip || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0'
    if (!allow(ip)) {
      return new NextResponse('Too Many Requests', { status: 429 })
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*']
}
