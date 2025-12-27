import { NextResponse } from 'next/server'

/**
 * Guard function to disable debug endpoints in production
 * Usage: Add at the start of debug route handlers
 * 
 * Example:
 * ```ts
 * import { debugGuard } from '@/lib/debugGuard'
 * 
 * export async function GET(req: NextRequest) {
 *   const blocked = debugGuard()
 *   if (blocked) return blocked
 *   // ... rest of handler
 * }
 * ```
 */
export function debugGuard(): NextResponse | null {
  if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_DEBUG_ENDPOINTS) {
    return NextResponse.json(
      { error: 'DEBUG_DISABLED', message: 'Debug endpoints are disabled in production' },
      { status: 404 }
    )
  }
  return null
}

/**
 * Check if debug endpoints should be enabled
 */
export function isDebugEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || !!process.env.ENABLE_DEBUG_ENDPOINTS
}
