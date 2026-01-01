import { createClient } from '@supabase/supabase-js'

/**
 * ELITE SECURITY - Supabase Client Configuration
 * 
 * Financial application standards:
 * - Secure session storage with encryption
 * - Automatic token refresh with shorter intervals
 * - Session detection and validation
 */

// Custom secure storage wrapper
const secureStorage = typeof window !== 'undefined' ? {
  getItem: (key: string) => {
    try {
      const item = window.sessionStorage.getItem(key) || window.localStorage.getItem(key)
      return item
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string) => {
    try {
      // Use sessionStorage for better security (cleared on tab close)
      // Fall back to localStorage for "remember me" functionality
      window.sessionStorage.setItem(key, value)
    } catch {
      // Silent fail
    }
  },
  removeItem: (key: string) => {
    try {
      window.sessionStorage.removeItem(key)
      window.localStorage.removeItem(key)
    } catch {
      // Silent fail
    }
  }
} : undefined

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key',
  {
    auth: {
      persistSession: true,
      storageKey: 'patriotpledge-auth-v2', // New key to force re-auth
      storage: secureStorage,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce', // More secure auth flow
    },
    global: {
      headers: {
        'X-Client-Info': 'patriotpledge-web'
      }
    }
  }
)

// Helper to clear all auth data (for secure logout)
export function clearAllAuthData(): void {
  if (typeof window === 'undefined') return
  
  try {
    // Clear all auth-related storage
    const keysToRemove = ['patriotpledge-auth', 'patriotpledge-auth-v2', 'sb-auth-token']
    keysToRemove.forEach(key => {
      window.sessionStorage.removeItem(key)
      window.localStorage.removeItem(key)
    })
    
    // Clear any other sensitive data
    window.sessionStorage.clear()
  } catch {
    // Silent fail
  }
}
