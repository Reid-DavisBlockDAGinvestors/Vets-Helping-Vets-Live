'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { UserData, SortBy, SortOrder } from '../types'

/**
 * Hook for fetching and managing users list
 */
export function useUsers() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) {
        setError('Not authenticated')
        return
      }

      const res = await fetch('/api/admin/users', {
        headers: { authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      logger.debug('[useUsers] API response:', data)
      
      if (!res.ok) {
        setError(data?.error || 'Failed to load users')
        return
      }
      
      if (data?.debug?.walletOwnersCount === 0 && data?.debug?.mintedCampaignsWithSales > 0) {
        logger.warn('[useUsers] Blockchain query may have failed')
      }
      setUsers(data?.users || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const filteredUsers = useMemo(() => {
    return users
      .filter(u => 
        !searchTerm || 
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        const aVal = a[sortBy] ?? 0
        const bVal = b[sortBy] ?? 0
        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : -1
        }
        return aVal < bVal ? 1 : -1
      })
  }, [users, searchTerm, sortBy, sortOrder])

  return {
    users,
    filteredUsers,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    refresh: loadUsers,
  }
}
