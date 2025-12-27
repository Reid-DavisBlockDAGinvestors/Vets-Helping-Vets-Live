/**
 * Environment-aware Logger Utility
 * Replaces console.log with production-safe logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogOptions {
  context?: string
  data?: any
}

const isDev = process.env.NODE_ENV !== 'production'
const isDebugEnabled = process.env.DEBUG === 'true'

/**
 * Structured logger with environment awareness
 */
export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (isDev || isDebugEnabled) {
      console.log(`🔍 ${message}`, ...args)
    }
  },

  info: (message: string, ...args: any[]) => {
    console.log(`ℹ️ ${message}`, ...args)
  },

  warn: (message: string, ...args: any[]) => {
    console.warn(`⚠️ ${message}`, ...args)
  },

  error: (message: string, ...args: any[]) => {
    console.error(`❌ ${message}`, ...args)
  },

  // Specific loggers for common contexts
  api: (message: string, data?: any) => {
    if (isDev || isDebugEnabled) {
      console.log(`[API] ${message}`, data || '')
    }
  },

  blockchain: (message: string, data?: any) => {
    if (isDev || isDebugEnabled) {
      console.log(`[CHAIN] ${message}`, data || '')
    }
  },

  auth: (message: string, data?: any) => {
    if (isDev || isDebugEnabled) {
      console.log(`[AUTH] ${message}`, data || '')
    }
  },

  purchase: (message: string, data?: any) => {
    // Always log purchases for audit trail
    console.log(`[PURCHASE] ${message}`, data || '')
  },
}

/**
 * Performance timer for measuring operations
 */
export function createTimer(label: string) {
  const start = Date.now()
  return {
    end: () => {
      const duration = Date.now() - start
      if (isDev || isDebugEnabled) {
        console.log(`⏱️ [${label}] ${duration}ms`)
      }
      return duration
    }
  }
}

/**
 * Conditional log that only runs in development
 */
export function devLog(message: string, ...args: any[]) {
  if (isDev) {
    console.log(message, ...args)
  }
}

/**
 * Log with timestamp prefix
 */
export function timestampLog(message: string, ...args: any[]) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${message}`, ...args)
}

export default logger
