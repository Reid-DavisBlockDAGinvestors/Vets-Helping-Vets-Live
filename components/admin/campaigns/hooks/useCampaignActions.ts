'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Campaign, ApprovalFormData, EditFormData } from '../types'

interface UseCampaignActionsReturn {
  // Action states
  approvingId: string | null
  rejectingId: string | null
  deletingId: string | null
  verifyingId: string | null
  fixingId: string | null
  savingId: string | null
  
  // Actions
  approveCampaign: (campaign: Campaign, formData: ApprovalFormData) => Promise<{ success: boolean; campaignId?: number; status?: string; error?: string }>
  rejectCampaign: (campaign: Campaign, reason: string) => Promise<{ success: boolean; error?: string }>
  deleteCampaign: (campaignId: string) => Promise<{ success: boolean; error?: string }>
  updateCampaign: (campaignId: string, data: EditFormData) => Promise<{ success: boolean; error?: string }>
  verifyTransaction: (campaign: Campaign) => Promise<{ success: boolean; campaignId?: number; status?: string; error?: string }>
  fixCampaign: (campaign: Campaign) => Promise<{ success: boolean; newCampaignId?: number; error?: string }>
  changeStatus: (campaignId: string, newStatus: string) => Promise<{ success: boolean; error?: string }>
}

/**
 * Hook for campaign CRUD operations
 * Follows ISP - focused on actions only
 */
export function useCampaignActions(): UseCampaignActionsReturn {
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [fixingId, setFixingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const getToken = useCallback(async (): Promise<string | null> => {
    const { data: session } = await supabase.auth.getSession()
    return session?.session?.access_token || null
  }, [])

  const approveCampaign = useCallback(async (
    campaign: Campaign, 
    formData: ApprovalFormData
  ): Promise<{ success: boolean; campaignId?: number; status?: string; error?: string }> => {
    setApprovingId(campaign.id)
    
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/submissions/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: campaign.id,
          // Network selection for multi-chain support
          targetChainId: formData.targetNetwork?.chainId || 1043,
          targetContractVersion: formData.targetNetwork?.contractVersion || 'v6',
          isTestnet: formData.targetNetwork?.isTestnet ?? true,
          updates: {
            goal: formData.goal,
            num_copies: formData.nft_editions,
            price_per_copy: formData.nft_price,
            creator_wallet: formData.creator_wallet || campaign.creator_wallet,
            benchmarks: formData.benchmarks?.trim()
              ? formData.benchmarks.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
              : null,
            // Store network info in submission
            chain_id: formData.targetNetwork?.chainId || 1043,
            chain_name: formData.targetNetwork?.chainName || 'BlockDAG Testnet',
            contract_version: formData.targetNetwork?.contractVersion || 'v6',
            is_testnet: formData.targetNetwork?.isTestnet ?? true,
            // V7 feature: immediate payout
            immediate_payout_enabled: formData.immediatePayoutEnabled ?? false
          }
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || data?.details || 'Approval failed')

      // Return the actual status from API (minted or pending_onchain)
      return { success: true, campaignId: data.campaignId, status: data.status || 'minted' }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Approval failed' }
    } finally {
      setApprovingId(null)
    }
  }, [getToken])

  const rejectCampaign = useCallback(async (
    campaign: Campaign,
    reason: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!reason.trim()) {
      return { success: false, error: 'Please provide a reason for rejection' }
    }

    setRejectingId(campaign.id)

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/submissions/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: campaign.id,
          reason,
          sendEmail: true
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Rejection failed')

      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Rejection failed' }
    } finally {
      setRejectingId(null)
    }
  }, [getToken])

  const deleteCampaign = useCallback(async (
    campaignId: string
  ): Promise<{ success: boolean; error?: string }> => {
    setDeletingId(campaignId)

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch(`/api/submissions?id=${campaignId}`, {
        method: 'DELETE',
        headers: { 'authorization': `Bearer ${token}` }
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Delete failed')

      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Delete failed' }
    } finally {
      setDeletingId(null)
    }
  }, [getToken])

  const updateCampaign = useCallback(async (
    campaignId: string,
    data: EditFormData
  ): Promise<{ success: boolean; error?: string }> => {
    setSavingId(campaignId)

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/submissions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: campaignId, ...data })
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result?.error || 'Save failed')

      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Save failed' }
    } finally {
      setSavingId(null)
    }
  }, [getToken])

  const verifyTransaction = useCallback(async (
    campaign: Campaign
  ): Promise<{ success: boolean; campaignId?: number; status?: string; error?: string }> => {
    setVerifyingId(campaign.id)

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/admin/verify-tx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ submissionId: campaign.id })
      })

      const data = await res.json()

      if (data.verified) {
        return { success: true, campaignId: data.campaignId, status: 'verified' }
      } else if (data.status === 'pending') {
        return { success: false, status: 'pending', error: 'Transaction still pending' }
      } else if (data.status === 'failed') {
        return { success: false, status: 'failed', error: data.message }
      } else {
        return { success: false, status: data.status, error: data.message || data.error }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Verification failed' }
    } finally {
      setVerifyingId(null)
    }
  }, [getToken])

  const fixCampaign = useCallback(async (
    campaign: Campaign
  ): Promise<{ success: boolean; newCampaignId?: number; error?: string }> => {
    setFixingId(campaign.id)

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/admin/verify-campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ submissionId: campaign.id })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || data?.details || 'Verification failed')

      if (data.status === 'valid') {
        return { success: true, newCampaignId: data.campaignId }
      } else if (data.status === 'fixed') {
        return { success: true, newCampaignId: data.newCampaignId }
      } else if (data.status === 'created') {
        return { success: true, newCampaignId: data.campaignId }
      } else {
        return { success: false, error: data.message || data.error }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Verification failed' }
    } finally {
      setFixingId(null)
    }
  }, [getToken])

  const changeStatus = useCallback(async (
    campaignId: string,
    newStatus: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/submissions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: campaignId, status: newStatus })
      })

      if (!res.ok) throw new Error('Status update failed')

      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Status update failed' }
    }
  }, [getToken])

  return {
    approvingId,
    rejectingId,
    deletingId,
    verifyingId,
    fixingId,
    savingId,
    approveCampaign,
    rejectCampaign,
    deleteCampaign,
    updateCampaign,
    verifyTransaction,
    fixCampaign,
    changeStatus,
  }
}

export default useCampaignActions
