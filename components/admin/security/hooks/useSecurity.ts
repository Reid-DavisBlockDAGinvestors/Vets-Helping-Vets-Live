'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { ContractStatus, BlacklistedAddress } from '../types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface UseSecurityResult {
  contractStatus: ContractStatus | null
  blacklistedAddresses: BlacklistedAddress[]
  isLoading: boolean
  error: string | null
  refresh: () => void
  blacklistAddress: (address: string, reason?: string) => Promise<boolean>
  removeBlacklist: (address: string) => Promise<boolean>
  pauseContract: () => Promise<boolean>
  unpauseContract: () => Promise<boolean>
  emergencyWithdraw: (to: string, amount: string) => Promise<boolean>
}

export function useSecurity(chainId: number = 1043, contractVersion: string = 'v6'): UseSecurityResult {
  const [contractStatus, setContractStatus] = useState<ContractStatus | null>(null)
  const [blacklistedAddresses, setBlacklistedAddresses] = useState<BlacklistedAddress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const getToken = useCallback(async (): Promise<string | null> => {
    const { data: session } = await supabase.auth.getSession()
    return session?.session?.access_token || null
  }, [])

  const fetchStatus = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch(`/api/admin/security/status?chainId=${chainId}&contractVersion=${contractVersion}`, {
        headers: { authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch security status')
      }

      const data = await res.json()
      setContractStatus(data.status)
      setBlacklistedAddresses(data.blacklisted || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load security status')
    } finally {
      setIsLoading(false)
    }
  }, [getToken, chainId, contractVersion])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const executeAction = useCallback(async (
    action: string,
    body: Record<string, any>
  ): Promise<boolean> => {
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch(`/api/admin/security/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...body, chainId, contractVersion })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `Failed to ${action}`)
      }

      await fetchStatus()
      return true
    } catch (e: any) {
      setError(e?.message || `Failed to ${action}`)
      return false
    }
  }, [getToken, fetchStatus, chainId, contractVersion])

  const blacklistAddress = useCallback((address: string, reason?: string) =>
    executeAction('blacklist', { address, reason, action: 'add' }), [executeAction])

  const removeBlacklist = useCallback((address: string) =>
    executeAction('blacklist', { address, action: 'remove' }), [executeAction])

  const pauseContract = useCallback(() =>
    executeAction('pause', { pause: true }), [executeAction])

  const unpauseContract = useCallback(() =>
    executeAction('pause', { pause: false }), [executeAction])

  const emergencyWithdraw = useCallback((to: string, amount: string) =>
    executeAction('emergency-withdraw', { to, amount }), [executeAction])

  return {
    contractStatus,
    blacklistedAddresses,
    isLoading,
    error,
    refresh: fetchStatus,
    blacklistAddress,
    removeBlacklist,
    pauseContract,
    unpauseContract,
    emergencyWithdraw
  }
}
