'use client'

/**
 * AdminCampaignHubV2 - Modular Refactored Version
 * 
 * Original: 2,237 lines (monolithic)
 * Refactored: ~150 lines (orchestrator pattern)
 * 
 * Uses modular components from ./admin/campaigns:
 * - useCampaigns - Data fetching and filtering
 * - useCampaignActions - CRUD operations
 * - CampaignStatsGrid - Stats display
 * - CampaignFilters - Filter controls
 * - CampaignList - Campaign cards
 * - ApprovalModal, RejectModal, DeleteModal - Action modals
 */

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import ErrorWithBugReport from './ErrorWithBugReport'
import {
  useCampaigns,
  useCampaignActions,
  CampaignStatsGrid,
  CampaignFilters,
  CampaignList,
  ApprovalModal,
  RejectModal,
  DeleteModal,
  type Campaign,
  type ApprovalFormData
} from './admin/campaigns'

export default function AdminCampaignHubV2() {
  // Data and filtering from hook
  const {
    campaigns,
    filteredCampaigns,
    stats,
    isLoading,
    error,
    filters,
    setFilters,
    refetch,
    updateCampaignLocally,
    removeCampaignLocally
  } = useCampaigns()

  // Actions from hook
  const {
    approvingId,
    rejectingId,
    deletingId,
    verifyingId,
    fixingId,
    approveCampaign,
    rejectCampaign,
    deleteCampaign,
    verifyTransaction,
    fixCampaign
  } = useCampaignActions()

  // UI State
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [approvalTarget, setApprovalTarget] = useState<Campaign | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Campaign | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null)

  // Toggle expand
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // View verification document
  const viewDocument = useCallback(async (path: string) => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) {
        alert('Please log in to view documents')
        return
      }
      const res = await fetch(`/api/verification-upload?path=${encodeURIComponent(path)}`, {
        headers: { authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to load document')
        return
      }
      const { url } = await res.json()
      window.open(url, '_blank')
    } catch (e) {
      logger.error('Error viewing document:', e)
      alert('Failed to load document')
    }
  }, [])

  // Handle approval
  const handleApprove = useCallback(async (formData: ApprovalFormData) => {
    if (!approvalTarget) return
    const result = await approveCampaign(approvalTarget, formData)
    if (result.success) {
      // Use the status from API response (minted or pending_onchain)
      const newStatus = (result.status || 'minted') as 'minted' | 'pending_onchain'
      updateCampaignLocally(approvalTarget.id, { 
        status: newStatus,
        campaign_id: result.campaignId ?? null
      })
      setApprovalTarget(null)
      
      // If pending_onchain, show helpful message
      if (newStatus === 'pending_onchain') {
        alert('Campaign transaction submitted! The blockchain may take a moment to confirm. Use "Verify" or "Fix Campaign" to update the status.')
      }
    } else {
      alert(result.error || 'Approval failed')
    }
  }, [approvalTarget, approveCampaign, updateCampaignLocally])

  // Handle rejection
  const handleReject = useCallback(async (reason: string) => {
    if (!rejectTarget) return
    const result = await rejectCampaign(rejectTarget, reason)
    if (result.success) {
      updateCampaignLocally(rejectTarget.id, { status: 'rejected' })
      setRejectTarget(null)
    } else {
      alert(result.error || 'Rejection failed')
    }
  }, [rejectTarget, rejectCampaign, updateCampaignLocally])

  // Handle deletion
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    const result = await deleteCampaign(deleteTarget.id)
    if (result.success) {
      removeCampaignLocally(deleteTarget.id)
      setDeleteTarget(null)
    } else {
      alert(result.error || 'Delete failed')
    }
  }, [deleteTarget, deleteCampaign, removeCampaignLocally])

  // Handle verify transaction
  const handleVerify = useCallback(async (campaign: Campaign) => {
    const result = await verifyTransaction(campaign)
    if (result.success && result.campaignId) {
      updateCampaignLocally(campaign.id, { 
        status: 'minted',
        campaign_id: result.campaignId
      })
    } else if (!result.success) {
      alert(result.error || 'Verification failed')
    }
  }, [verifyTransaction, updateCampaignLocally])

  // Handle fix campaign
  const handleFix = useCallback(async (campaign: Campaign) => {
    const result = await fixCampaign(campaign)
    if (result.success && result.newCampaignId) {
      updateCampaignLocally(campaign.id, {
        status: 'minted',
        campaign_id: result.newCampaignId
      })
    } else if (!result.success) {
      alert(result.error || 'Fix failed')
    }
  }, [fixCampaign, updateCampaignLocally])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white rounded-full" />
      </div>
    )
  }

  // Error state
  if (error) {
    return <ErrorWithBugReport error={error} context={{ page: 'AdminCampaignHub' }} />
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <CampaignStatsGrid stats={stats} />

      {/* Filters */}
      <CampaignFilters
        filters={filters}
        onFiltersChange={setFilters}
        resultCount={filteredCampaigns.length}
        totalCount={campaigns.length}
      />

      {/* Campaign List */}
      <CampaignList
        campaigns={filteredCampaigns}
        expandedIds={expandedIds}
        onToggleExpand={toggleExpand}
        onApprove={setApprovalTarget}
        onReject={setRejectTarget}
        onEdit={() => {}} // TODO: Implement edit modal
        onDelete={setDeleteTarget}
        onVerify={handleVerify}
        onFix={handleFix}
        onViewDocument={viewDocument}
        approvingId={approvingId}
        verifyingId={verifyingId}
        fixingId={fixingId}
      />

      {/* Modals */}
      <ApprovalModal
        campaign={approvalTarget}
        isOpen={!!approvalTarget}
        onClose={() => setApprovalTarget(null)}
        onApprove={handleApprove}
        isApproving={!!approvingId}
      />

      <RejectModal
        campaign={rejectTarget}
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onReject={handleReject}
        isRejecting={!!rejectingId}
      />

      <DeleteModal
        campaign={deleteTarget}
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDelete={handleDelete}
        isDeleting={!!deletingId}
      />
    </div>
  )
}
