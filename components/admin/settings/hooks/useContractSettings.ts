'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { ContractSettings, PendingSettingsChange, SettingsChangeRequest, SECURITY_THRESHOLDS } from '../types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface UseContractSettingsResult {
  settings: ContractSettings | null
  pendingChanges: PendingSettingsChange[]
  isLoading: boolean
  error: string | null
  lastChangeAt: string | null
  canMakeChange: boolean
  refresh: () => void
  
  // Financial-grade operations (all require confirmation)
  requestFeeChange: (newFeeBps: number, reason: string) => Promise<{ success: boolean; pendingId?: string; error?: string }>
  requestTreasuryChange: (newTreasury: string, reason: string) => Promise<{ success: boolean; pendingId?: string; error?: string }>
  requestRoyaltyChange: (newRoyaltyBps: number, reason: string) => Promise<{ success: boolean; pendingId?: string; error?: string }>
  toggleImmediatePayout: (enabled: boolean, reason: string) => Promise<{ success: boolean; error?: string }>
  
  // Pending change management
  executeChange: (pendingId: string) => Promise<{ success: boolean; txHash?: string; error?: string }>
  cancelChange: (pendingId: string) => Promise<{ success: boolean; error?: string }>
  approveChange: (pendingId: string) => Promise<{ success: boolean; error?: string }>
}

export function useContractSettings(
  chainId: number = 1043, 
  contractVersion: string = 'v6'
): UseContractSettingsResult {
  const [settings, setSettings] = useState<ContractSettings | null>(null)
  const [pendingChanges, setPendingChanges] = useState<PendingSettingsChange[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastChangeAt, setLastChangeAt] = useState<string | null>(null)

  const getToken = useCallback(async (): Promise<string | null> => {
    const { data: session } = await supabase.auth.getSession()
    return session?.session?.access_token || null
  }, [])

  // Calculate if user can make a change (rate limiting)
  const canMakeChange = useCallback(() => {
    if (!lastChangeAt) return true
    const lastChange = new Date(lastChangeAt)
    const cooldownMs = 15 * 60 * 1000 // 15 minutes
    return Date.now() - lastChange.getTime() > cooldownMs
  }, [lastChangeAt])

  const fetchSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      // Fetch current settings
      const settingsRes = await fetch(
        `/api/admin/settings/contract?chainId=${chainId}&contractVersion=${contractVersion}`,
        { headers: { authorization: `Bearer ${token}` } }
      )

      if (!settingsRes.ok) {
        const data = await settingsRes.json()
        throw new Error(data.error || 'Failed to fetch settings')
      }

      const settingsData = await settingsRes.json()
      setSettings(settingsData.settings)
      setPendingChanges(settingsData.pendingChanges || [])
      setLastChangeAt(settingsData.lastChangeAt || null)
    } catch (e: any) {
      setError(e?.message || 'Failed to load settings')
    } finally {
      setIsLoading(false)
    }
  }, [getToken, chainId, contractVersion])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // Request a fee change (requires confirmation/timelock)
  const requestFeeChange = useCallback(async (
    newFeeBps: number,
    reason: string
  ): Promise<{ success: boolean; pendingId?: string; error?: string }> => {
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/admin/settings/request-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          chainId,
          contractVersion,
          changeType: 'fee',
          newValue: newFeeBps,
          reason
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to request change')

      await fetchSettings()
      return { success: true, pendingId: data.pendingId }
    } catch (e: any) {
      return { success: false, error: e?.message }
    }
  }, [getToken, chainId, contractVersion, fetchSettings])

  // Request a treasury change (always requires multi-sig)
  const requestTreasuryChange = useCallback(async (
    newTreasury: string,
    reason: string
  ): Promise<{ success: boolean; pendingId?: string; error?: string }> => {
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/admin/settings/request-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          chainId,
          contractVersion,
          changeType: 'treasury',
          newValue: newTreasury,
          reason
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to request change')

      await fetchSettings()
      return { success: true, pendingId: data.pendingId }
    } catch (e: any) {
      return { success: false, error: e?.message }
    }
  }, [getToken, chainId, contractVersion, fetchSettings])

  // Request a royalty change
  const requestRoyaltyChange = useCallback(async (
    newRoyaltyBps: number,
    reason: string
  ): Promise<{ success: boolean; pendingId?: string; error?: string }> => {
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/admin/settings/request-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          chainId,
          contractVersion,
          changeType: 'royalty',
          newValue: newRoyaltyBps,
          reason
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to request change')

      await fetchSettings()
      return { success: true, pendingId: data.pendingId }
    } catch (e: any) {
      return { success: false, error: e?.message }
    }
  }, [getToken, chainId, contractVersion, fetchSettings])

  // Toggle immediate payout (less sensitive, direct execution)
  const toggleImmediatePayout = useCallback(async (
    enabled: boolean,
    reason: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/admin/settings/immediate-payout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          chainId,
          contractVersion,
          enabled,
          reason
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to toggle payout')

      await fetchSettings()
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message }
    }
  }, [getToken, chainId, contractVersion, fetchSettings])

  // Execute a pending change (after timelock)
  const executeChange = useCallback(async (
    pendingId: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/admin/settings/execute-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pendingId })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to execute change')

      await fetchSettings()
      return { success: true, txHash: data.txHash }
    } catch (e: any) {
      return { success: false, error: e?.message }
    }
  }, [getToken, fetchSettings])

  // Cancel a pending change
  const cancelChange = useCallback(async (
    pendingId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/admin/settings/cancel-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pendingId })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to cancel change')

      await fetchSettings()
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message }
    }
  }, [getToken, fetchSettings])

  // Approve a pending change (for multi-sig)
  const approveChange = useCallback(async (
    pendingId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/admin/settings/approve-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pendingId })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to approve change')

      await fetchSettings()
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message }
    }
  }, [getToken, fetchSettings])

  return {
    settings,
    pendingChanges,
    isLoading,
    error,
    lastChangeAt,
    canMakeChange: canMakeChange(),
    refresh: fetchSettings,
    requestFeeChange,
    requestTreasuryChange,
    requestRoyaltyChange,
    toggleImmediatePayout,
    executeChange,
    cancelChange,
    approveChange
  }
}
