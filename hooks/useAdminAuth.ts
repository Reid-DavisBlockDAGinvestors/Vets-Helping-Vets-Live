'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Admin authentication state interface following ISP
 */
export interface AdminAuthState {
  isAdmin: boolean
  isLoading: boolean
  token: string | null
  error: string | null
}

/**
 * Admin authentication actions interface following ISP
 */
export interface AdminAuthActions {
  getToken: () => Promise<string | null>
  refreshAdminStatus: () => Promise<void>
}

export type UseAdminAuthReturn = AdminAuthState & AdminAuthActions

/**
 * Shared admin authentication hook
 * 
 * Eliminates duplicated admin token patterns in:
 * - AdminCampaignHub.tsx (11 instances)
 * - AdminSubmissions.tsx (5 instances)
 * - AdminUsers.tsx (2 instances)
 * - AdminBugReports.tsx (3 instances)
 * - And other admin components
 * 
 * Usage:
 * ```tsx
 * const { isAdmin, token, getToken, isLoading, error } = useAdminAuth()
 * 
 * // For API calls
 * const res = await fetch('/api/admin/endpoint', {
 *   headers: { authorization: `Bearer ${token}` }
 * })
 * ```
 */
export function useAdminAuth(): UseAdminAuthReturn {
  const [state, setState] = useState<AdminAuthState>({
    isAdmin: false,
    isLoading: true,
    token: null,
    error: null,
  })

  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token || null
      return token
    } catch (e) {
      return null
    }
  }, [])

  const refreshAdminStatus = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      
      if (!token) {
        setState({
          isAdmin: false,
          isLoading: false,
          token: null,
          error: 'Not authenticated',
        })
        return
      }

      // Verify admin status via API
      const res = await fetch('/api/admin/me', {
        headers: { authorization: `Bearer ${token}` }
      })
      
      if (res.ok) {
        setState({
          isAdmin: true,
          isLoading: false,
          token,
          error: null,
        })
      } else {
        const data = await res.json().catch(() => ({}))
        setState({
          isAdmin: false,
          isLoading: false,
          token: null,
          error: data?.error || 'Not authorized',
        })
      }
    } catch (e: any) {
      setState({
        isAdmin: false,
        isLoading: false,
        token: null,
        error: e?.message || 'Failed to verify admin status',
      })
    }
  }, [])

  useEffect(() => {
    refreshAdminStatus()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refreshAdminStatus()
    })

    return () => subscription.unsubscribe()
  }, [refreshAdminStatus])

  return {
    ...state,
    getToken,
    refreshAdminStatus,
  }
}

/**
 * Hook for making authenticated admin API calls
 * Automatically includes the authorization header
 */
export function useAdminApi() {
  const { getToken } = useAdminAuth()

  const adminFetch = useCallback(async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const token = await getToken()
    
    if (!token) {
      throw new Error('Not authenticated')
    }

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        authorization: `Bearer ${token}`,
      },
    })
  }, [getToken])

  return { adminFetch }
}

export default useAdminAuth
