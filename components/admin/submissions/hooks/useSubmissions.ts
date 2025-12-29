'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { Submission } from '../types'

/**
 * Hook for fetching and managing submissions
 */
export function useSubmissions() {
  const [items, setItems] = useState<Submission[]>([])
  const [usernames, setUsernames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [srcUrl, setSrcUrl] = useState('')
  const [apiCount, setApiCount] = useState<number | null>(null)
  const [contractFilter, setContractFilter] = useState<string | 'all'>('all')

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      const headers: Record<string, string> = {}
      if (token) headers['authorization'] = `Bearer ${token}`
      
      const res = await fetch('/api/submissions', { 
        headers: Object.keys(headers).length ? headers : undefined 
      })
      const data = await res.json().catch(() => ({}))
      
      if (res.ok) {
        const src = res.headers.get('X-Supabase-Url') || ''
        logger.debug('[admin] submissions source:', src, 'count:', data?.count)
        setSrcUrl(src)
        setApiCount(typeof data?.count === 'number' ? data.count : null)
        setItems(data.items || [])
        setUsernames(data.usernames || {})
        setError('')
      } else {
        logger.error('[admin] GET /api/submissions failed', res.status, data)
        setItems([])
        setUsernames({})
        setError([data?.error, data?.code, data?.details].filter(Boolean).join(' | ') || 'Failed to load submissions')
      }
    } catch (e) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => { refresh() }, [refresh])

  // Polling every 30 seconds
  useEffect(() => {
    const id = setInterval(refresh, 30000)
    return () => clearInterval(id)
  }, [refresh])

  // Refresh on auth change
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh()
    })
    return () => { sub.subscription.unsubscribe() }
  }, [refresh])

  // Get unique contract addresses
  const uniqueContracts = useMemo(() => {
    const KNOWN_CONTRACTS = ['0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e']
    const dynamic = items
      .map(i => i.contract_address?.trim())
      .filter(Boolean) as string[]
    return Array.from(new Set([...KNOWN_CONTRACTS, ...dynamic]))
  }, [items])

  // Filter by contract
  const filteredItems = useMemo(() => {
    if (contractFilter === 'all') return items
    const target = contractFilter.toLowerCase()
    return items.filter(i => i.contract_address?.toLowerCase() === target)
  }, [items, contractFilter])

  // Split by status
  const pending = useMemo(() => 
    filteredItems.filter(i => i.status === 'pending'), 
    [filteredItems]
  )
  
  const reviewed = useMemo(() => 
    filteredItems.filter(i => i.status !== 'pending'), 
    [filteredItems]
  )

  return {
    items,
    usernames,
    loading,
    error,
    setError,
    srcUrl,
    apiCount,
    contractFilter,
    setContractFilter,
    uniqueContracts,
    filteredItems,
    pending,
    reviewed,
    refresh,
  }
}
