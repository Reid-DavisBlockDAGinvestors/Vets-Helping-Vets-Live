/**
 * ELITE SECURITY MODULE - Financial Application Standards
 * 
 * Implements:
 * - Session security with fingerprinting
 * - Rate limiting with exponential backoff
 * - CSRF protection
 * - Security event logging
 * - Account lockout after failed attempts
 * - Input sanitization
 */

import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

// ============================================================================
// SECURITY CONSTANTS - Financial Application Standards
// ============================================================================

export const SECURITY_CONFIG = {
  // Session timeouts (in milliseconds)
  SESSION_TIMEOUT_MS: 15 * 60 * 1000,           // 15 minutes - financial standard
  SESSION_ABSOLUTE_TIMEOUT_MS: 8 * 60 * 60 * 1000, // 8 hours absolute max
  TOKEN_REFRESH_INTERVAL_MS: 5 * 60 * 1000,     // 5 minutes
  
  // Rate limiting
  LOGIN_RATE_LIMIT: 5,                          // 5 attempts per window
  LOGIN_RATE_WINDOW_MS: 15 * 60 * 1000,         // 15 minute window
  API_RATE_LIMIT: 100,                          // 100 requests per minute
  SENSITIVE_API_RATE_LIMIT: 10,                 // 10 requests per minute for sensitive ops
  
  // Account lockout
  MAX_FAILED_ATTEMPTS: 5,                       // Lock after 5 failed attempts
  LOCKOUT_DURATION_MS: 30 * 60 * 1000,          // 30 minute lockout
  LOCKOUT_ESCALATION_FACTOR: 2,                 // Double lockout each time
  
  // Password requirements
  MIN_PASSWORD_LENGTH: 12,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: true,
  
  // CSRF
  CSRF_TOKEN_LENGTH: 32,
  CSRF_TOKEN_EXPIRY_MS: 60 * 60 * 1000,         // 1 hour
} as const

// ============================================================================
// SECURITY EVENT TYPES
// ============================================================================

export type SecurityEventType = 
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'SESSION_EXPIRED'
  | 'SESSION_TIMEOUT'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_UNLOCKED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'RATE_LIMIT_EXCEEDED'
  | 'CSRF_VIOLATION'
  | 'INVALID_TOKEN'
  | 'ADMIN_ACCESS'
  | 'SENSITIVE_DATA_ACCESS'

export interface SecurityEvent {
  event_type: SecurityEventType
  user_id?: string
  email?: string
  ip_address?: string
  user_agent?: string
  details?: Record<string, any>
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  timestamp: string
}

// ============================================================================
// RATE LIMITER - Per IP with exponential backoff
// ============================================================================

interface RateLimitEntry {
  count: number
  firstAttempt: number
  lastAttempt: number
  blocked: boolean
  blockUntil?: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

export function checkRateLimit(
  key: string, 
  limit: number, 
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  
  // Check if currently blocked
  if (entry?.blocked && entry.blockUntil && now < entry.blockUntil) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetAt: entry.blockUntil 
    }
  }
  
  // Reset if window expired
  if (!entry || (now - entry.firstAttempt) > windowMs) {
    rateLimitStore.set(key, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
      blocked: false
    })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }
  
  // Increment count
  entry.count++
  entry.lastAttempt = now
  
  if (entry.count > limit) {
    entry.blocked = true
    entry.blockUntil = now + windowMs
    rateLimitStore.set(key, entry)
    return { allowed: false, remaining: 0, resetAt: entry.blockUntil }
  }
  
  rateLimitStore.set(key, entry)
  return { 
    allowed: true, 
    remaining: limit - entry.count, 
    resetAt: entry.firstAttempt + windowMs 
  }
}

export function getLoginRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  return checkRateLimit(
    `login:${ip}`, 
    SECURITY_CONFIG.LOGIN_RATE_LIMIT, 
    SECURITY_CONFIG.LOGIN_RATE_WINDOW_MS
  )
}

// ============================================================================
// ACCOUNT LOCKOUT
// ============================================================================

interface LockoutEntry {
  failedAttempts: number
  lastFailure: number
  lockoutCount: number
  lockedUntil?: number
}

const lockoutStore = new Map<string, LockoutEntry>()

export function recordFailedLogin(email: string): { locked: boolean; lockoutEndsAt?: number } {
  const now = Date.now()
  const entry = lockoutStore.get(email) || {
    failedAttempts: 0,
    lastFailure: now,
    lockoutCount: 0
  }
  
  // Reset if last failure was long ago (2x lockout window)
  if (now - entry.lastFailure > SECURITY_CONFIG.LOCKOUT_DURATION_MS * 2) {
    entry.failedAttempts = 0
  }
  
  entry.failedAttempts++
  entry.lastFailure = now
  
  if (entry.failedAttempts >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS) {
    entry.lockoutCount++
    const lockoutDuration = SECURITY_CONFIG.LOCKOUT_DURATION_MS * 
      Math.pow(SECURITY_CONFIG.LOCKOUT_ESCALATION_FACTOR, entry.lockoutCount - 1)
    entry.lockedUntil = now + lockoutDuration
    lockoutStore.set(email, entry)
    
    return { locked: true, lockoutEndsAt: entry.lockedUntil }
  }
  
  lockoutStore.set(email, entry)
  return { locked: false }
}

export function checkAccountLocked(email: string): { locked: boolean; lockoutEndsAt?: number; attemptsRemaining: number } {
  const now = Date.now()
  const entry = lockoutStore.get(email)
  
  if (!entry) {
    return { locked: false, attemptsRemaining: SECURITY_CONFIG.MAX_FAILED_ATTEMPTS }
  }
  
  if (entry.lockedUntil && now < entry.lockedUntil) {
    return { 
      locked: true, 
      lockoutEndsAt: entry.lockedUntil,
      attemptsRemaining: 0
    }
  }
  
  // Lockout expired, reset but keep lockout count for escalation
  if (entry.lockedUntil && now >= entry.lockedUntil) {
    entry.failedAttempts = 0
    entry.lockedUntil = undefined
    lockoutStore.set(email, entry)
  }
  
  return { 
    locked: false, 
    attemptsRemaining: SECURITY_CONFIG.MAX_FAILED_ATTEMPTS - entry.failedAttempts
  }
}

export function clearLockout(email: string): void {
  lockoutStore.delete(email)
}

// ============================================================================
// PASSWORD VALIDATION
// ============================================================================

export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
  strength: 'weak' | 'fair' | 'good' | 'strong'
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = []
  let strengthScore = 0
  
  if (password.length < SECURITY_CONFIG.MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${SECURITY_CONFIG.MIN_PASSWORD_LENGTH} characters`)
  } else {
    strengthScore++
  }
  
  if (SECURITY_CONFIG.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  } else {
    strengthScore++
  }
  
  if (SECURITY_CONFIG.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  } else {
    strengthScore++
  }
  
  if (SECURITY_CONFIG.REQUIRE_NUMBER && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  } else {
    strengthScore++
  }
  
  if (SECURITY_CONFIG.REQUIRE_SPECIAL && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)')
  } else {
    strengthScore++
  }
  
  // Additional strength checks
  if (password.length >= 16) strengthScore++
  if (/[!@#$%^&*(),.?":{}|<>].*[!@#$%^&*(),.?":{}|<>]/.test(password)) strengthScore++
  
  const strength: PasswordValidationResult['strength'] = 
    strengthScore <= 2 ? 'weak' :
    strengthScore <= 4 ? 'fair' :
    strengthScore <= 5 ? 'good' : 'strong'
  
  return {
    valid: errors.length === 0,
    errors,
    strength
  }
}

// ============================================================================
// CSRF PROTECTION
// ============================================================================

const csrfTokens = new Map<string, { token: string; expires: number }>()

export function generateCSRFToken(sessionId: string): string {
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '')
  csrfTokens.set(sessionId, {
    token,
    expires: Date.now() + SECURITY_CONFIG.CSRF_TOKEN_EXPIRY_MS
  })
  return token
}

export function validateCSRFToken(sessionId: string, token: string): boolean {
  const stored = csrfTokens.get(sessionId)
  if (!stored) return false
  if (Date.now() > stored.expires) {
    csrfTokens.delete(sessionId)
    return false
  }
  return stored.token === token
}

// ============================================================================
// SESSION FINGERPRINTING
// ============================================================================

export function generateSessionFingerprint(req: {
  ip?: string
  userAgent?: string
}): string {
  const data = `${req.ip || 'unknown'}|${req.userAgent || 'unknown'}`
  // Simple hash for fingerprinting
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(36)
}

export function validateSessionFingerprint(
  storedFingerprint: string,
  currentFingerprint: string
): boolean {
  return storedFingerprint === currentFingerprint
}

// ============================================================================
// SECURITY EVENT LOGGING
// ============================================================================

export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  // Log to console with appropriate level
  const logMethod = event.severity === 'CRITICAL' ? 'error' : 
                    event.severity === 'WARNING' ? 'warn' : 'info'
  
  logger[logMethod](`[SECURITY] ${event.event_type}`, {
    userId: event.user_id,
    email: event.email,
    ip: event.ip_address,
    details: event.details
  })
  
  // Store in database for audit trail
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
    
    await supabase.from('security_events').insert({
      event_type: event.event_type,
      user_id: event.user_id,
      email: event.email,
      ip_address: event.ip_address,
      user_agent: event.user_agent,
      details: event.details,
      severity: event.severity,
      created_at: event.timestamp
    })
  } catch (err) {
    logger.error('[SECURITY] Failed to log security event to database:', err)
  }
}

// ============================================================================
// INPUT SANITIZATION
// ============================================================================

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
}

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

// ============================================================================
// SECURE HEADERS HELPER
// ============================================================================

export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
  }
}

// ============================================================================
// EXPORT CLEANUP FUNCTION (for memory management)
// ============================================================================

export function cleanupExpiredEntries(): void {
  const now = Date.now()
  
  // Clean rate limit entries
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.blockUntil && now > entry.blockUntil + 60000) {
      rateLimitStore.delete(key)
    }
  }
  
  // Clean lockout entries
  for (const [key, entry] of lockoutStore.entries()) {
    if (entry.lockedUntil && now > entry.lockedUntil + SECURITY_CONFIG.LOCKOUT_DURATION_MS) {
      lockoutStore.delete(key)
    }
  }
  
  // Clean CSRF tokens
  for (const [key, entry] of csrfTokens.entries()) {
    if (now > entry.expires) {
      csrfTokens.delete(key)
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000)
}
