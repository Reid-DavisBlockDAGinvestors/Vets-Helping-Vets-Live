'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

/**
 * Authentication state interface following ISP
 */
export interface AuthState {
  isLoggedIn: boolean
  isEmailVerified: boolean
  user: User | null
  session: Session | null
  email: string | null
  userId: string | null
  isLoading: boolean
}

/**
 * Authentication actions interface following ISP
 */
export interface AuthActions {
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

/**
 * Combined auth hook return type
 */
export type UseAuthReturn = AuthState & AuthActions

/**
 * Shared authentication hook - eliminates duplicated auth logic across components
 * 
 * Usage:
 * ```tsx
 * const { isLoggedIn, user, email, isEmailVerified, signOut } = useAuth()
 * ```
 * 
 * Replaces duplicated patterns in:
 * - StoryForm.tsx
 * - PurchasePanel.tsx
 * - NavBar.tsx
 * - UserAccountPortal.tsx
 * - AdminCampaignHub.tsx
 * - And 7+ other components
 */
export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    isLoggedIn: false,
    isEmailVerified: false,
    user: null,
    session: null,
    email: null,
    userId: null,
    isLoading: true,
  })

  const updateFromSession = useCallback((session: Session | null) => {
    if (session?.user) {
      setState({
        isLoggedIn: true,
        isEmailVerified: !!session.user.email_confirmed_at,
        user: session.user,
        session,
        email: session.user.email || null,
        userId: session.user.id,
        isLoading: false,
      })
    } else {
      setState({
        isLoggedIn: false,
        isEmailVerified: false,
        user: null,
        session: null,
        email: null,
        userId: null,
        isLoading: false,
      })
    }
  }, [])

  const refreshSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    updateFromSession(session)
  }, [updateFromSession])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setState({
      isLoggedIn: false,
      isEmailVerified: false,
      user: null,
      session: null,
      email: null,
      userId: null,
      isLoading: false,
    })
  }, [])

  useEffect(() => {
    // Initial session check
    refreshSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        updateFromSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [refreshSession, updateFromSession])

  return {
    ...state,
    signOut,
    refreshSession,
  }
}

/**
 * Hook to get just the access token for API calls
 * Useful for components that only need the token
 */
export function useAccessToken(): string | null {
  const { session } = useAuth()
  return session?.access_token || null
}

/**
 * Hook to check if user has a specific role/permission
 * Can be extended for RBAC in the future
 */
export function useAuthCheck(requiredEmailVerified = false): {
  isAuthorized: boolean
  isLoading: boolean
  reason: string | null
} {
  const { isLoggedIn, isEmailVerified, isLoading } = useAuth()

  if (isLoading) {
    return { isAuthorized: false, isLoading: true, reason: null }
  }

  if (!isLoggedIn) {
    return { isAuthorized: false, isLoading: false, reason: 'Not logged in' }
  }

  if (requiredEmailVerified && !isEmailVerified) {
    return { isAuthorized: false, isLoading: false, reason: 'Email not verified' }
  }

  return { isAuthorized: true, isLoading: false, reason: null }
}

export default useAuth
