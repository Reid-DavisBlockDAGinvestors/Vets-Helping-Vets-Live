'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { TipSplit } from '../types'

interface UseTipSplitResult {
  tipSplit: TipSplit | null
  isLoading: boolean
  isSaving: boolean
  error: string | null
  fetchTipSplit: (campaignId: string) => Promise<void>
  saveTipSplit: (campaignId: string, split: TipSplit) => Promise<boolean>
}

/**
 * Hook for managing per-campaign tip split configuration
 * Single responsibility: Fetch and save tip split settings
 */
export function useTipSplit(): UseTipSplitResult {
  const [tipSplit, setTipSplit] = useState<TipSplit | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTipSplit = useCallback(async (campaignId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/admin/distributions/tip-split?campaignId=${campaignId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tip split: ${response.statusText}`)
      }

      const data = await response.json()
      setTipSplit({
        submitterPercent: data.tipSplit.submitter_percent,
        nonprofitPercent: data.tipSplit.nonprofit_percent
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tip split')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const saveTipSplit = useCallback(async (campaignId: string, split: TipSplit): Promise<boolean> => {
    setIsSaving(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/admin/distributions/tip-split', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          campaignId,
          submitterPercent: split.submitterPercent,
          nonprofitPercent: split.nonprofitPercent
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save tip split')
      }

      setTipSplit(split)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tip split')
      return false
    } finally {
      setIsSaving(false)
    }
  }, [])

  return {
    tipSplit,
    isLoading,
    isSaving,
    error,
    fetchTipSplit,
    saveTipSplit
  }
}

export default useTipSplit
