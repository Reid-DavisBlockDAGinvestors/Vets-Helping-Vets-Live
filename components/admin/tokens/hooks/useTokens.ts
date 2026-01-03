'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { TokenInfo, TokenFilters } from '../types'

interface UseTokensResult {
  tokens: TokenInfo[]
  isLoading: boolean
  error: string | null
  refresh: () => void
  freezeToken: (tokenId: number) => Promise<boolean>
  unfreezeToken: (tokenId: number) => Promise<boolean>
  batchFreeze: (tokenIds: number[], freeze: boolean) => Promise<boolean>
  makeSoulbound: (tokenId: number) => Promise<boolean>
  removeSoulbound: (tokenId: number) => Promise<boolean>
  burnToken: (tokenId: number) => Promise<boolean>
  fixTokenUri: (tokenId: number, newUri: string) => Promise<boolean>
}

export function useTokens(filters: TokenFilters = {}): UseTokensResult {
  const getToken = useCallback(async (): Promise<string | null> => {
    const { data: session } = await supabase.auth.getSession()
    return session?.session?.access_token || null
  }, [])
  const [tokens, setTokens] = useState<TokenInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTokens = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const params = new URLSearchParams()
      if (filters.campaignId) params.set('campaignId', filters.campaignId.toString())
      if (filters.chainId) params.set('chainId', filters.chainId.toString())
      if (filters.frozen !== undefined) params.set('frozen', filters.frozen.toString())
      if (filters.soulbound !== undefined) params.set('soulbound', filters.soulbound.toString())
      if (filters.owner) params.set('owner', filters.owner)

      const res = await fetch(`/api/admin/tokens?${params}`, {
        headers: { authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch tokens')
      }

      const data = await res.json()
      setTokens(data.tokens || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load tokens')
      setTokens([])
    } finally {
      setIsLoading(false)
    }
  }, [getToken, filters.campaignId, filters.chainId, filters.frozen, filters.soulbound, filters.owner])

  useEffect(() => {
    fetchTokens()
  }, [fetchTokens])

  const executeAction = useCallback(async (
    action: string,
    body: Record<string, any>
  ): Promise<boolean> => {
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch(`/api/admin/tokens/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `Failed to ${action}`)
      }

      await fetchTokens()
      return true
    } catch (e: any) {
      setError(e?.message || `Failed to ${action}`)
      return false
    }
  }, [getToken, fetchTokens])

  const freezeToken = useCallback((tokenId: number) => 
    executeAction('freeze', { tokenId, freeze: true }), [executeAction])

  const unfreezeToken = useCallback((tokenId: number) => 
    executeAction('freeze', { tokenId, freeze: false }), [executeAction])

  const batchFreeze = useCallback((tokenIds: number[], freeze: boolean) => 
    executeAction('freeze', { tokenIds, freeze }), [executeAction])

  const makeSoulbound = useCallback((tokenId: number) => 
    executeAction('soulbound', { tokenId, soulbound: true }), [executeAction])

  const removeSoulbound = useCallback((tokenId: number) => 
    executeAction('soulbound', { tokenId, soulbound: false }), [executeAction])

  const burnToken = useCallback((tokenId: number) => 
    executeAction('burn', { tokenId }), [executeAction])

  const fixTokenUri = useCallback((tokenId: number, newUri: string) => 
    executeAction('fix-uri', { tokenId, newUri }), [executeAction])

  return {
    tokens,
    isLoading,
    error,
    refresh: fetchTokens,
    freezeToken,
    unfreezeToken,
    batchFreeze,
    makeSoulbound,
    removeSoulbound,
    burnToken,
    fixTokenUri
  }
}
