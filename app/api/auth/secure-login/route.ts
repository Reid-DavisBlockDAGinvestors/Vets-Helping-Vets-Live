import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { 
  checkAccountLocked, 
  recordFailedLogin, 
  clearLockout,
  getLoginRateLimit,
  validatePassword,
  logSecurityEvent,
  sanitizeEmail,
  getSecurityHeaders
} from '@/lib/security'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * ELITE SECURE LOGIN API
 * 
 * Financial-grade authentication with:
 * - Rate limiting per IP
 * - Account lockout after failed attempts
 * - Security event logging
 * - Input sanitization
 */

export async function POST(req: NextRequest) {
  const headers = getSecurityHeaders()
  const ip = req.ip || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = req.headers.get('user-agent') || 'unknown'
  
  try {
    // Rate limit check
    const rateLimit = getLoginRateLimit(ip)
    if (!rateLimit.allowed) {
      await logSecurityEvent({
        event_type: 'RATE_LIMIT_EXCEEDED',
        ip_address: ip,
        user_agent: userAgent,
        severity: 'WARNING',
        timestamp: new Date().toISOString(),
        details: { endpoint: '/api/auth/secure-login' }
      })
      
      return NextResponse.json(
        { error: 'TOO_MANY_ATTEMPTS', message: 'Too many login attempts. Please try again later.' },
        { status: 429, headers: { ...headers, 'Retry-After': '60' } }
      )
    }

    const body = await req.json()
    const email = sanitizeEmail(body.email || '')
    const password = body.password || ''

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'Email and password are required.' },
        { status: 400, headers }
      )
    }

    // Check account lockout
    const lockoutStatus = checkAccountLocked(email)
    if (lockoutStatus.locked) {
      const remainingTime = lockoutStatus.lockoutEndsAt 
        ? Math.ceil((lockoutStatus.lockoutEndsAt - Date.now()) / 60000)
        : 30
      
      await logSecurityEvent({
        event_type: 'LOGIN_FAILURE',
        email,
        ip_address: ip,
        user_agent: userAgent,
        severity: 'WARNING',
        timestamp: new Date().toISOString(),
        details: { reason: 'account_locked', remainingMinutes: remainingTime }
      })
      
      return NextResponse.json(
        { 
          error: 'ACCOUNT_LOCKED', 
          message: `Account temporarily locked. Try again in ${remainingTime} minutes.`,
          lockedUntil: lockoutStatus.lockoutEndsAt
        },
        { status: 423, headers }
      )
    }

    // Attempt login with Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error || !data.session) {
      // Record failed attempt
      const lockResult = recordFailedLogin(email)
      
      await logSecurityEvent({
        event_type: 'LOGIN_FAILURE',
        email,
        ip_address: ip,
        user_agent: userAgent,
        severity: lockResult.locked ? 'CRITICAL' : 'WARNING',
        timestamp: new Date().toISOString(),
        details: { 
          reason: error?.message || 'invalid_credentials',
          attemptsRemaining: checkAccountLocked(email).attemptsRemaining,
          accountLocked: lockResult.locked
        }
      })

      if (lockResult.locked) {
        return NextResponse.json(
          { 
            error: 'ACCOUNT_LOCKED', 
            message: 'Too many failed attempts. Account has been locked for 30 minutes.',
            lockedUntil: lockResult.lockoutEndsAt
          },
          { status: 423, headers }
        )
      }

      return NextResponse.json(
        { 
          error: 'INVALID_CREDENTIALS', 
          message: 'Invalid email or password.',
          attemptsRemaining: checkAccountLocked(email).attemptsRemaining
        },
        { status: 401, headers }
      )
    }

    // Successful login - clear any lockout
    clearLockout(email)

    await logSecurityEvent({
      event_type: 'LOGIN_SUCCESS',
      user_id: data.user?.id,
      email,
      ip_address: ip,
      user_agent: userAgent,
      severity: 'INFO',
      timestamp: new Date().toISOString(),
      details: { method: 'password' }
    })

    logger.api(`[SecureLogin] Successful login for ${email} from ${ip}`)

    return NextResponse.json({
      success: true,
      user: {
        id: data.user?.id,
        email: data.user?.email,
        createdAt: data.user?.created_at
      },
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
        expiresIn: data.session.expires_in
      }
    }, { headers })

  } catch (err: any) {
    logger.error('[SecureLogin] Error:', err)
    
    await logSecurityEvent({
      event_type: 'LOGIN_FAILURE',
      ip_address: ip,
      user_agent: userAgent,
      severity: 'CRITICAL',
      timestamp: new Date().toISOString(),
      details: { error: err?.message || 'unknown_error' }
    })

    return NextResponse.json(
      { error: 'AUTH_ERROR', message: 'Authentication failed. Please try again.' },
      { status: 500, headers }
    )
  }
}

// Password validation endpoint
export async function PUT(req: NextRequest) {
  const headers = getSecurityHeaders()
  
  try {
    const { password } = await req.json()
    const result = validatePassword(password || '')
    
    return NextResponse.json(result, { headers })
  } catch (err) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR' },
      { status: 400, headers }
    )
  }
}
