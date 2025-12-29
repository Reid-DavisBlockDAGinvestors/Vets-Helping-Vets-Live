'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Async data state interface following ISP
 */
export interface AsyncDataState<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  isInitialized: boolean
}

/**
 * Async data actions interface following ISP
 */
export interface AsyncDataActions {
  refetch: () => Promise<void>
  reset: () => void
  setData: (data: any) => void
}

export type UseAsyncDataReturn<T> = AsyncDataState<T> & AsyncDataActions

export interface UseAsyncDataOptions {
  /** Whether to fetch immediately on mount */
  immediate?: boolean
  /** Dependencies that trigger refetch when changed */
  deps?: any[]
  /** Debounce delay in ms */
  debounceMs?: number
  /** Whether to keep previous data while loading */
  keepPreviousData?: boolean
}

/**
 * Shared async data fetching hook - eliminates duplicated loading/error patterns
 * 
 * Replaces duplicated patterns in:
 * - AdminCampaignHub.tsx (loadData pattern)
 * - AdminSubmissions.tsx
 * - AdminUsers.tsx
 * - UserAccountPortal.tsx
 * - And many other components
 * 
 * Usage:
 * ```tsx
 * const { data, isLoading, error, refetch } = useAsyncData(
 *   async () => {
 *     const res = await fetch('/api/campaigns')
 *     return res.json()
 *   },
 *   { immediate: true }
 * )
 * ```
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  options: UseAsyncDataOptions = {}
): UseAsyncDataReturn<T> {
  const {
    immediate = true,
    deps = [],
    debounceMs = 0,
    keepPreviousData = false,
  } = options

  const [state, setState] = useState<AsyncDataState<T>>({
    data: null,
    isLoading: immediate,
    error: null,
    isInitialized: false,
  })

  const fetcherRef = useRef(fetcher)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  // Update fetcher ref when it changes
  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  const reset = useCallback(() => {
    setState({
      data: null,
      isLoading: false,
      error: null,
      isInitialized: false,
    })
  }, [])

  const setData = useCallback((data: T) => {
    setState(prev => ({
      ...prev,
      data,
    }))
  }, [])

  const refetch = useCallback(async () => {
    // Clear any pending debounced fetch
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    const executeFetch = async () => {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
        data: keepPreviousData ? prev.data : null,
      }))

      try {
        const data = await fetcherRef.current()
        
        if (mountedRef.current) {
          setState({
            data,
            isLoading: false,
            error: null,
            isInitialized: true,
          })
        }
      } catch (e: any) {
        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: e?.message || 'An error occurred',
            isInitialized: true,
          }))
        }
      }
    }

    if (debounceMs > 0) {
      timeoutRef.current = setTimeout(executeFetch, debounceMs)
    } else {
      await executeFetch()
    }
  }, [debounceMs, keepPreviousData])

  // Initial fetch and refetch on deps change
  useEffect(() => {
    mountedRef.current = true

    if (immediate) {
      refetch()
    }

    return () => {
      mountedRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [immediate, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    refetch,
    reset,
    setData,
  }
}

/**
 * Hook for fetching with automatic token injection
 */
export function useAuthenticatedData<T>(
  url: string,
  getToken: () => Promise<string | null>,
  options: UseAsyncDataOptions & { method?: string; body?: any } = {}
): UseAsyncDataReturn<T> {
  const { method = 'GET', body, ...asyncOptions } = options

  const fetcher = useCallback(async () => {
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data?.error || `Request failed: ${res.status}`)
    }

    return res.json()
  }, [url, getToken, method, body])

  return useAsyncData<T>(fetcher, asyncOptions)
}

export default useAsyncData
