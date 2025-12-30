'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { UserData, Purchase, Campaign, PurchaseStats, DetailTab } from '../types'

/**
 * Hook for fetching user details (purchases, campaigns)
 */
export function useUserDetails(selectedUser: UserData | null) {
  const [userPurchases, setUserPurchases] = useState<Purchase[]>([])
  const [createdCampaigns, setCreatedCampaigns] = useState<Campaign[]>([])
  const [purchasedCampaigns, setPurchasedCampaigns] = useState<Campaign[]>([])
  const [purchaseStats, setPurchaseStats] = useState<PurchaseStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailTab, setDetailTab] = useState<DetailTab>('purchased')

  const loadUserPurchases = useCallback(async (userId: string) => {
    setLoading(true)
    setUserPurchases([])
    setCreatedCampaigns([])
    setPurchasedCampaigns([])
    setPurchaseStats(null)
    
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) return

      const res = await fetch(`/api/admin/users/${userId}/purchases`, {
        headers: { authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      
      logger.debug('[useUserDetails] API response:', {
        ok: res.ok,
        purchases: data?.purchases?.length,
        purchasedCampaigns: data?.purchasedCampaigns?.length,
        createdCampaigns: data?.createdCampaigns?.length,
      })
      
      if (res.ok) {
        setUserPurchases(data?.purchases || [])
        setCreatedCampaigns(data?.createdCampaigns || [])
        setPurchasedCampaigns(data?.purchasedCampaigns || [])
        setPurchaseStats(data?.stats || null)
      } else {
        logger.error('[useUserDetails] API error:', data?.error)
      }
    } catch (e) {
      logger.error('[useUserDetails] Failed to load purchases:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedUser) {
      loadUserPurchases(selectedUser.id)
    }
  }, [selectedUser, loadUserPurchases])

  return {
    userPurchases,
    createdCampaigns,
    purchasedCampaigns,
    purchaseStats,
    loading,
    detailTab,
    setDetailTab,
  }
}
