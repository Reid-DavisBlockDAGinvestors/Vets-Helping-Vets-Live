'use client'

/**
 * usePurchaseAuth Hook
 * 
 * Manages authentication state for purchase flow
 * Following ISP - focused on auth state only
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { AuthState } from '../types'

export interface UsePurchaseAuthReturn extends AuthState {
  checkAuth: () => Promise<void>
}

export function usePurchaseAuth(): UsePurchaseAuthReturn {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isEmailVerified, setIsEmailVerified] = useState(false)

  const updateAuthState = useCallback((session: any) => {
    if (session?.user) {
      setIsLoggedIn(true)
      setUserEmail(session.user.email || null)
      setUserId(session.user.id || null)
      setIsEmailVerified(!!session.user.email_confirmed_at)
    } else {
      setIsLoggedIn(false)
      setUserEmail(null)
      setUserId(null)
      setIsEmailVerified(false)
    }
  }, [])

  const checkAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    updateAuthState(session)
  }, [updateAuthState])

  useEffect(() => {
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      updateAuthState(session)
    })

    return () => subscription.unsubscribe()
  }, [checkAuth, updateAuthState])

  return {
    isLoggedIn,
    userEmail,
    userId,
    isEmailVerified,
    checkAuth
  }
}
