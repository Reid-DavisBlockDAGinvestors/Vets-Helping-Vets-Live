'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { mapLegacyCategory } from '@/lib/categories'
import type { 
  Campaign, 
  CampaignUpdate, 
  CampaignFilters, 
  CampaignStats,
  StatusFilter,
  SortOption
} from '../types'

interface UseCampaignsReturn {
  campaigns: Campaign[]
  filteredCampaigns: Campaign[]
  stats: CampaignStats
  isLoading: boolean
  error: string | null
  filters: CampaignFilters
  setFilters: (filters: Partial<CampaignFilters>) => void
  refetch: () => Promise<void>
  updateCampaignLocally: (id: string, updates: Partial<Campaign>) => void
  removeCampaignLocally: (id: string) => void
}

const defaultFilters: CampaignFilters = {
  searchQuery: '',
  statusFilter: 'all',
  sortBy: 'recent',
  hasUpdatesOnly: false,
  networkFilter: 'all',
}

/**
 * Hook for fetching and managing campaign data
 * Follows ISP - focused on data fetching and state management
 */
export function useCampaigns(): UseCampaignsReturn {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFiltersState] = useState<CampaignFilters>(defaultFilters)

  const setFilters = useCallback((updates: Partial<CampaignFilters>) => {
    setFiltersState(prev => ({ ...prev, ...updates }))
  }, [])

  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) {
        setError('Not authenticated')
        setIsLoading(false)
        return
      }

      // Fetch submissions and updates in parallel
      const [subRes, updRes] = await Promise.all([
        fetch('/api/submissions', {
          headers: { authorization: `Bearer ${token}` }
        }),
        fetch('/api/campaign-updates?admin=true', {
          headers: { authorization: `Bearer ${token}` }
        })
      ])

      const [subData, updData] = await Promise.all([
        subRes.json(),
        updRes.json()
      ])

      if (!subRes.ok) throw new Error(subData?.error || 'Failed to load submissions')
      if (!updRes.ok) throw new Error(updData?.error || 'Failed to load updates')

      const allSubs = subData?.items || []
      const updates = updData?.updates || []

      // Build campaign -> updates map
      const updatesBySubmission: Record<string, CampaignUpdate[]> = {}
      for (const u of updates) {
        if (!updatesBySubmission[u.submission_id]) {
          updatesBySubmission[u.submission_id] = []
        }
        updatesBySubmission[u.submission_id].push(u)
      }

      // Combine into campaigns with updates
      const campaignsWithUpdates: Campaign[] = allSubs.map((sub: any) => {
        const subUpdates = (updatesBySubmission[sub.id] || []).sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        return {
          id: sub.id,
          campaign_id: sub.campaign_id,
          title: sub.title || `Campaign #${sub.campaign_id || sub.id.slice(0, 8)}`,
          story: sub.story || null,
          image_uri: sub.image_uri || '',
          category: mapLegacyCategory(sub.category || 'other'),
          goal: sub.goal || 0,
          creator_wallet: sub.creator_wallet || '',
          creator_email: sub.creator_email || null,
          creator_name: sub.creator_name || null,
          creator_phone: sub.creator_phone || null,
          creator_address: sub.creator_address || null,
          status: sub.status || 'pending',
          immediate_payout_enabled: sub.immediate_payout_enabled ?? false,
          total_distributed: sub.total_distributed || null,
          last_distribution_at: sub.last_distribution_at || null,
          is_featured: sub.is_featured || false,
          featured_order: sub.featured_order || null,
          verification_selfie: sub.verification_selfie || null,
          verification_id_front: sub.verification_id_front || null,
          verification_id_back: sub.verification_id_back || null,
          verification_documents: sub.verification_documents || null,
          admin_notes: sub.admin_notes || null,
          reviewed_by: sub.reviewed_by || null,
          reviewed_at: sub.reviewed_at || null,
          nft_price: sub.nft_price || sub.price_per_copy || null,
          nft_editions: sub.nft_editions || sub.num_copies || 100,
          num_copies: sub.num_copies || sub.nft_editions || 100,
          tx_hash: sub.tx_hash || null,
          contract_address: sub.contract_address || null,
          contract_version: sub.contract_version || null,
          chain_id: sub.chain_id || null,
          chain_name: sub.chain_name || null,
          video_url: sub.video_url || null,
          onchainStats: null,
          updates: subUpdates,
          pendingUpdates: subUpdates.filter(u => u.status === 'pending').length,
          approvedUpdates: subUpdates.filter(u => u.status === 'approved').length
        }
      })

      // Fetch on-chain stats for minted campaigns
      const mintedCampaigns = campaignsWithUpdates.filter(
        c => c.status === 'minted' && c.campaign_id != null
      )
      
      if (mintedCampaigns.length > 0) {
        try {
          const campaignIds = mintedCampaigns.map(c => c.campaign_id).join(',')
          const statsRes = await fetch(`/api/campaigns/stats?campaignIds=${campaignIds}`)
          if (statsRes.ok) {
            const statsData = await statsRes.json()
            const statsMap = statsData?.stats || {}
            for (const c of campaignsWithUpdates) {
              if (c.campaign_id != null && statsMap[c.campaign_id] && !statsMap[c.campaign_id].error) {
                c.onchainStats = statsMap[c.campaign_id]
              }
            }
          }
        } catch (e) {
          logger.error('Failed to fetch on-chain stats:', e)
        }
      }

      setCampaigns(campaignsWithUpdates)
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    const timer = setTimeout(() => refetch(), 300)
    return () => clearTimeout(timer)
  }, [refetch])

  // Update campaign locally (optimistic update)
  const updateCampaignLocally = useCallback((id: string, updates: Partial<Campaign>) => {
    setCampaigns(prev => prev.map(c => 
      c.id === id ? { ...c, ...updates } : c
    ))
  }, [])

  // Remove campaign locally
  const removeCampaignLocally = useCallback((id: string) => {
    setCampaigns(prev => prev.filter(c => c.id !== id))
  }, [])

  // Filtered and sorted campaigns
  const filteredCampaigns = useMemo(() => {
    let result = [...campaigns]

    // Search filter
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase()
      result = result.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.creator_wallet.toLowerCase().includes(q) ||
        c.creator_email?.toLowerCase().includes(q) ||
        String(c.campaign_id).includes(q) ||
        c.id.toLowerCase().includes(q)
      )
    }

    // Status filter
    if (filters.statusFilter !== 'all') {
      result = result.filter(c => c.status === filters.statusFilter)
    }

    // Has updates filter
    if (filters.hasUpdatesOnly) {
      result = result.filter(c => c.updates.length > 0)
    }

    // Sort
    switch (filters.sortBy) {
      case 'updates':
        result.sort((a, b) => b.updates.length - a.updates.length)
        break
      case 'pending':
        result.sort((a, b) => b.pendingUpdates - a.pendingUpdates)
        break
      case 'goal':
        result.sort((a, b) => b.goal - a.goal)
        break
      case 'recent':
      default:
        result.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
    }

    return result
  }, [campaigns, filters])

  // Stats
  const stats = useMemo<CampaignStats>(() => ({
    total: campaigns.length,
    minted: campaigns.filter(c => c.status === 'minted').length,
    pendingCampaigns: campaigns.filter(c => c.status === 'pending').length,
    withUpdates: campaigns.filter(c => c.updates.length > 0).length,
    pendingUpdates: campaigns.reduce((sum, c) => sum + c.pendingUpdates, 0),
    totalUpdates: campaigns.reduce((sum, c) => sum + c.updates.length, 0)
  }), [campaigns])

  return {
    campaigns,
    filteredCampaigns,
    stats,
    isLoading,
    error,
    filters,
    setFilters,
    refetch,
    updateCampaignLocally,
    removeCampaignLocally,
  }
}

export default useCampaigns
