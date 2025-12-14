'use client'

import { useState, useEffect, useMemo } from 'react'
import { ipfsToHttp } from '@/lib/ipfs'
import { supabase } from '@/lib/supabase'

type CampaignUpdate = {
  id: string
  title: string | null
  story_update: string | null
  funds_utilization: string | null
  benefits: string | null
  still_needed: string | null
  media_uris: string[] | null
  status: 'pending' | 'approved' | 'rejected'
  reviewer_notes: string | null
  reviewed_at: string | null
  created_at: string
}

type Campaign = {
  id: string
  campaign_id: number | null
  title: string
  story: string | null
  image_uri: string
  category: string
  goal: number
  creator_wallet: string
  creator_email: string | null
  creator_name: string | null
  creator_phone: string | null
  creator_address: {
    street?: string
    city?: string
    state?: string
    zip?: string
    country?: string
  } | null
  status: string
  created_at: string
  metadata_uri: string | null
  // Verification fields
  verification_status: string | null
  verification_selfie: string | null
  verification_id_front: string | null
  verification_id_back: string | null
  verification_documents: any[] | null
  // Admin fields
  admin_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  // NFT settings
  nft_price: number | null
  nft_editions: number | null
  num_copies: number | null
  // On-chain data
  tx_hash: string | null
  contract_address: string | null
  // On-chain stats (for minted campaigns)
  onchainStats: {
    editionsMinted: number
    maxEditions: number
    remainingEditions: number | null
    progressPercent: number
    nftSalesUSD: number
    tipsUSD: number
    totalRaisedUSD: number
    netRaisedUSD: number
  } | null
  // Updates
  updates: CampaignUpdate[]
  pendingUpdates: number
  approvedUpdates: number
}

export default function AdminCampaignHub() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set())
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'minted' | 'approved' | 'pending' | 'rejected'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'updates' | 'pending' | 'goal'>('recent')
  const [hasUpdatesOnly, setHasUpdatesOnly] = useState(false)
  
  // Pagination
  const [page, setPage] = useState(1)
  const perPage = 20
  
  // Edit modal state
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [editForm, setEditForm] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  
  // Delete confirmation state
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null)
  const [deleting, setDeleting] = useState(false)
  
  // Rejection modal state
  const [rejectingCampaign, setRejectingCampaign] = useState<Campaign | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  
  // Update delete state
  const [deletingUpdateId, setDeletingUpdateId] = useState<string | null>(null)
  
  // Update expand/edit state
  const [expandedUpdates, setExpandedUpdates] = useState<Set<string>>(new Set())
  const [editingUpdate, setEditingUpdate] = useState<CampaignUpdate | null>(null)
  const [editUpdateForm, setEditUpdateForm] = useState<Record<string, any>>({})
  const [savingUpdate, setSavingUpdate] = useState(false)
  
  // Approval confirmation modal state
  const [approvingCampaign, setApprovingCampaign] = useState<Campaign | null>(null)
  const [approvalForm, setApprovalForm] = useState<{
    goal: number
    nft_editions: number
    nft_price: number
    creator_wallet: string
    benchmarks: string
  }>({ goal: 100, nft_editions: 100, nft_price: 1, creator_wallet: '', benchmarks: '' })

  useEffect(() => {
    const timer = setTimeout(() => loadData(), 300)
    return () => clearTimeout(timer)
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) {
        setError('Not authenticated')
        setLoading(false)
        return
      }
      
      // Fetch all submissions
      const subRes = await fetch('/api/submissions', {
        headers: { authorization: `Bearer ${token}` }
      })
      const subData = await subRes.json()
      if (!subRes.ok) throw new Error(subData?.error || 'Failed to load submissions')
      
      // Fetch all updates
      const updRes = await fetch('/api/campaign-updates?admin=true', {
        headers: { authorization: `Bearer ${token}` }
      })
      const updData = await updRes.json()
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
          title: sub.title || `Campaign #${sub.campaign_id || sub.id.slice(0,8)}`,
          story: sub.story || null,
          image_uri: sub.image_uri || '',
          category: sub.category || 'general',
          goal: sub.goal || 0,
          creator_wallet: sub.creator_wallet || '',
          creator_email: sub.creator_email || null,
          creator_name: sub.creator_name || null,
          creator_phone: sub.creator_phone || null,
          creator_address: sub.creator_address || null,
          status: sub.status || 'pending',
          created_at: sub.created_at,
          metadata_uri: sub.metadata_uri || null,
          // Verification fields
          verification_status: sub.verification_status || null,
          verification_selfie: sub.verification_selfie || null,
          verification_id_front: sub.verification_id_front || null,
          verification_id_back: sub.verification_id_back || null,
          verification_documents: sub.verification_documents || null,
          // Admin fields
          admin_notes: sub.admin_notes || null,
          reviewed_by: sub.reviewed_by || null,
          reviewed_at: sub.reviewed_at || null,
          // NFT settings
          nft_price: sub.nft_price || sub.price_per_copy || null,
          nft_editions: sub.nft_editions || sub.num_copies || 100,
          num_copies: sub.num_copies || sub.nft_editions || 100,
          // On-chain data
          tx_hash: sub.tx_hash || null,
          contract_address: sub.contract_address || null,
          onchainStats: null, // Will be populated below for minted campaigns
          // Updates
          updates: subUpdates,
          pendingUpdates: subUpdates.filter(u => u.status === 'pending').length,
          approvedUpdates: subUpdates.filter(u => u.status === 'approved').length
        }
      })
      
      // Fetch on-chain stats for minted campaigns
      const mintedCampaigns = campaignsWithUpdates.filter(c => c.status === 'minted' && c.campaign_id != null)
      if (mintedCampaigns.length > 0) {
        try {
          const campaignIds = mintedCampaigns.map(c => c.campaign_id).join(',')
          const statsRes = await fetch(`/api/campaigns/stats?campaignIds=${campaignIds}`)
          if (statsRes.ok) {
            const statsData = await statsRes.json()
            const statsMap = statsData?.stats || {}
            // Attach stats to campaigns
            for (const c of campaignsWithUpdates) {
              if (c.campaign_id != null && statsMap[c.campaign_id] && !statsMap[c.campaign_id].error) {
                c.onchainStats = statsMap[c.campaign_id]
              }
            }
          }
        } catch (e) {
          console.error('Failed to fetch on-chain stats:', e)
        }
      }
      
      setCampaigns(campaignsWithUpdates)
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  // Open edit modal
  const openEditModal = (campaign: Campaign) => {
    setEditingCampaign(campaign)
    setEditForm({
      title: campaign.title || '',
      story: campaign.story || '',
      category: campaign.category || 'general',
      goal: campaign.goal || 0,
      status: campaign.status || 'pending',
      creator_name: campaign.creator_name || '',
      creator_email: campaign.creator_email || '',
      creator_phone: campaign.creator_phone || '',
      creator_wallet: campaign.creator_wallet || '',
      creator_address: campaign.creator_address || {},
      verification_status: campaign.verification_status || 'pending',
      // NFT settings - allow admin to set these (price is in USD)
      nft_price: campaign.nft_price || (campaign.goal && campaign.nft_editions ? campaign.goal / campaign.nft_editions : 1),
      nft_editions: campaign.nft_editions || campaign.num_copies || 100,
    })
    setSaveMsg('')
  }

  // Save edits
  const saveEdits = async () => {
    if (!editingCampaign) return
    
    setSaving(true)
    setSaveMsg('')
    
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/submissions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: editingCampaign.id,
          ...editForm
        })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Save failed')
      
      setSaveMsg('✓ Saved successfully!')
      
      // Update local state
      setCampaigns(prev => prev.map(c => 
        c.id === editingCampaign.id ? { ...c, ...editForm } : c
      ))
      
      // Close modal after short delay
      setTimeout(() => {
        setEditingCampaign(null)
        setSaveMsg('')
      }, 1500)
      
    } catch (e: any) {
      setSaveMsg(`Error: ${e?.message || 'Save failed'}`)
    } finally {
      setSaving(false)
    }
  }

  // Quick status change (for non-approve actions like moving back to pending)
  const quickStatusChange = async (campaignId: string, newStatus: string) => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
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
      
      // Update local state
      setCampaigns(prev => prev.map(c => 
        c.id === campaignId ? { ...c, status: newStatus } : c
      ))
    } catch (e: any) {
      setError(e?.message || 'Status update failed')
    }
  }

  // Open approval confirmation modal
  const openApprovalModal = (campaign: Campaign) => {
    setApprovingCampaign(campaign)
    setApprovalForm({
      goal: campaign.goal || 100,
      nft_editions: campaign.nft_editions || campaign.num_copies || 100,
      nft_price: campaign.nft_price || (campaign.goal && (campaign.nft_editions || campaign.num_copies)
        ? campaign.goal / (campaign.nft_editions || campaign.num_copies || 100) : 1),
      creator_wallet: campaign.creator_wallet || '',
      benchmarks: ''
    })
  }

  // Verify and fix campaign on-chain status
  const [fixing, setFixing] = useState<string | null>(null)
  const verifyCampaign = async (campaign: Campaign) => {
    setFixing(campaign.id)
    setError('')
    
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
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
      
      // Handle different verification results
      if (data.status === 'valid') {
        alert(`✓ Campaign verified!\n\nCampaign ID: ${data.campaignId}\nActive: ${data.active}\nClosed: ${data.closed}\n\n${data.message}`)
      } else if (data.status === 'fixed') {
        // Campaign ID was corrected
        setCampaigns(prev => prev.map(c => 
          c.id === campaign.id 
            ? { ...c, campaign_id: data.newCampaignId, status: 'minted' } 
            : c
        ))
        alert(`✓ Campaign fixed!\n\nOld ID: ${data.oldCampaignId}\nNew ID: ${data.newCampaignId}\nActive: ${data.active}\n\n${data.message}`)
      } else if (data.status === 'reset') {
        // Campaign was not on-chain, status reset to approved
        setCampaigns(prev => prev.map(c => 
          c.id === campaign.id 
            ? { ...c, campaign_id: null, status: 'approved' } 
            : c
        ))
        alert(`⚠️ Campaign not found on-chain!\n\nTotal campaigns: ${data.totalCampaigns}\n\n${data.message}`)
      }
    } catch (e: any) {
      setError(e?.message || 'Verification failed')
      alert(`❌ Verification failed: ${e?.message || 'Unknown error'}`)
    } finally {
      setFixing(null)
    }
  }

  // Approve and create campaign on-chain
  const [approving, setApproving] = useState<string | null>(null)
  const approveCampaign = async (campaign: Campaign, formValues?: typeof approvalForm) => {
    setApproving(campaign.id)
    setError('')
    
    // Use form values if provided, otherwise use campaign values
    const values = formValues || {
      goal: campaign.goal,
      nft_editions: campaign.nft_editions || campaign.num_copies || 100,
      nft_price: campaign.nft_price || null,
      creator_wallet: campaign.creator_wallet,
      benchmarks: ''
    }
    
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) throw new Error('Not authenticated')

      // Call the approve endpoint which creates the campaign on-chain
      const res = await fetch('/api/submissions/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          id: campaign.id,
          updates: {
            // Include NFT settings for on-chain campaign creation
            goal: values.goal,
            num_copies: values.nft_editions,
            price_per_copy: values.nft_price,
            creator_wallet: values.creator_wallet || campaign.creator_wallet,
            // Convert benchmarks text (one per line) to array
            benchmarks: values.benchmarks?.trim() 
              ? values.benchmarks.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean)
              : null
          }
        })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || data?.details || 'Approval failed')
      
      // Update local state with campaign ID and minted status
      setCampaigns(prev => prev.map(c => 
        c.id === campaign.id 
          ? { ...c, status: 'minted', campaign_id: data.campaignId || null } 
          : c
      ))
      
      // Show success message
      if (data.campaignId != null) {
        alert(`✓ Campaign created on-chain!\n\nCampaign ID: ${data.campaignId}\nTx: ${data.txHash || 'pending'}`)
      }
    } catch (e: any) {
      setError(e?.message || 'Approval failed')
      alert(`❌ Approval failed: ${e?.message || 'Unknown error'}`)
    } finally {
      setApproving(null)
    }
  }

  // Delete submission
  const deleteSubmission = async (campaignId: string) => {
    setDeleting(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await fetch(`/api/submissions?id=${campaignId}`, {
        method: 'DELETE',
        headers: {
          'authorization': `Bearer ${token}`
        }
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Delete failed')
      
      // Remove from local state
      setCampaigns(prev => prev.filter(c => c.id !== campaignId))
      setDeletingCampaign(null)
      
      // Collapse if it was expanded
      setExpandedCampaigns(prev => {
        const next = new Set(prev)
        next.delete(campaignId)
        return next
      })
    } catch (e: any) {
      setError(e?.message || 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  // Reject submission with reason and email
  const rejectSubmission = async () => {
    if (!rejectingCampaign) return
    if (!rejectionReason.trim()) {
      setError('Please provide a reason for rejection')
      return
    }
    
    setRejecting(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/submissions/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: rejectingCampaign.id,
          reason: rejectionReason,
          sendEmail: true
        })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Rejection failed')
      
      // Update local state
      setCampaigns(prev => prev.map(c => 
        c.id === rejectingCampaign.id 
          ? { ...c, status: 'rejected' } 
          : c
      ))
      
      setRejectingCampaign(null)
      setRejectionReason('')
    } catch (e: any) {
      setError(e?.message || 'Rejection failed')
    } finally {
      setRejecting(false)
    }
  }

  // Delete campaign update
  const deleteUpdate = async (updateId: string, campaignId: string) => {
    if (!confirm('Are you sure you want to delete this update? This cannot be undone.')) {
      return
    }
    
    setDeletingUpdateId(updateId)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await fetch(`/api/campaign-updates/${updateId}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` }
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Delete failed')
      
      // Update local state - remove the update from the campaign
      setCampaigns(prev => prev.map(c => {
        if (c.id === campaignId) {
          const newUpdates = c.updates.filter(u => u.id !== updateId)
          return {
            ...c,
            updates: newUpdates,
            pendingUpdates: newUpdates.filter(u => u.status === 'pending').length,
            approvedUpdates: newUpdates.filter(u => u.status === 'approved').length
          }
        }
        return c
      }))
    } catch (e: any) {
      setError(e?.message || 'Delete failed')
      alert(`Delete failed: ${e?.message}`)
    } finally {
      setDeletingUpdateId(null)
    }
  }

  // Filter and sort campaigns
  const filteredCampaigns = useMemo(() => {
    let result = [...campaigns]
    
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(c => 
        c.title.toLowerCase().includes(q) ||
        c.creator_wallet.toLowerCase().includes(q) ||
        c.creator_email?.toLowerCase().includes(q) ||
        String(c.campaign_id).includes(q) ||
        c.id.toLowerCase().includes(q)
      )
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter)
    }
    
    // Has updates filter
    if (hasUpdatesOnly) {
      result = result.filter(c => c.updates.length > 0)
    }
    
    // Sort
    switch (sortBy) {
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
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    
    return result
  }, [campaigns, searchQuery, statusFilter, hasUpdatesOnly, sortBy])

  // Pagination
  const totalPages = Math.ceil(filteredCampaigns.length / perPage)
  const paginatedCampaigns = filteredCampaigns.slice((page - 1) * perPage, page * perPage)

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [searchQuery, statusFilter, hasUpdatesOnly, sortBy])

  const toggleExpanded = (id: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleUpdateExpanded = (updateId: string) => {
    setExpandedUpdates(prev => {
      const next = new Set(prev)
      if (next.has(updateId)) next.delete(updateId)
      else next.add(updateId)
      return next
    })
  }

  const openEditUpdate = (update: CampaignUpdate) => {
    setEditingUpdate(update)
    setEditUpdateForm({
      title: update.title || '',
      story_update: update.story_update || '',
      funds_utilization: update.funds_utilization || '',
      benefits: update.benefits || '',
      still_needed: update.still_needed || '',
      status: update.status
    })
  }

  const saveUpdateEdit = async () => {
    if (!editingUpdate) return
    setSavingUpdate(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) throw new Error('Not authenticated')
      
      const res = await fetch(`/api/admin/campaign-updates/${editingUpdate.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editUpdateForm)
      })
      
      if (!res.ok) throw new Error('Failed to update')
      
      // Refresh campaigns
      loadData()
      setEditingUpdate(null)
    } catch (e: any) {
      console.error('Failed to save update:', e)
      alert(e?.message || 'Failed to save update')
    } finally {
      setSavingUpdate(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      minted: 'bg-green-500/20 text-green-400 border-green-500/30',
      approved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30'
    }
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full border ${styles[status] || 'bg-white/10 text-white/50'}`}>
        {status}
      </span>
    )
  }

  const getUpdateStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      approved: 'bg-green-500/20 text-green-400 border-green-500/30',
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30'
    }
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full border ${styles[status] || ''}`}>
        {status}
      </span>
    )
  }

  // Stats
  const stats = useMemo(() => ({
    total: campaigns.length,
    minted: campaigns.filter(c => c.status === 'minted').length,
    pendingCampaigns: campaigns.filter(c => c.status === 'pending').length,
    withUpdates: campaigns.filter(c => c.updates.length > 0).length,
    pendingUpdates: campaigns.reduce((sum, c) => sum + c.pendingUpdates, 0),
    totalUpdates: campaigns.reduce((sum, c) => sum + c.updates.length, 0)
  }), [campaigns])

  if (loading) {
    return (
      <div className="rounded-xl bg-white/5 border border-white/10 p-8">
        <div className="flex items-center justify-center gap-3">
          <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span className="text-white/60">Loading campaigns...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-red-400">
        {error}
        <button onClick={loadData} className="ml-4 underline hover:no-underline">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Campaign Hub</h2>
          <p className="text-sm text-white/50 mt-1">
            Manage all campaigns and their Living NFT updates
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-sm text-blue-300 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-xs text-white/50">Total Campaigns</div>
        </div>
        <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4">
          <div className="text-2xl font-bold text-green-400">{stats.minted}</div>
          <div className="text-xs text-green-400/70">Minted</div>
        </div>
        <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-4">
          <div className="text-2xl font-bold text-yellow-400">{stats.pendingCampaigns}</div>
          <div className="text-xs text-yellow-400/70">Pending Review</div>
        </div>
        <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-4">
          <div className="text-2xl font-bold text-purple-400">{stats.withUpdates}</div>
          <div className="text-xs text-purple-400/70">With Updates</div>
        </div>
        <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-4">
          <div className="text-2xl font-bold text-orange-400">{stats.pendingUpdates}</div>
          <div className="text-xs text-orange-400/70">Pending Updates</div>
        </div>
        <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
          <div className="text-2xl font-bold text-blue-400">{stats.totalUpdates}</div>
          <div className="text-xs text-blue-400/70">Total Updates</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by title, wallet, email, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="minted">Minted</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
          
          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="recent">Most Recent</option>
            <option value="updates">Most Updates</option>
            <option value="pending">Pending Updates</option>
            <option value="goal">Highest Goal</option>
          </select>
          
          {/* Has Updates Toggle */}
          <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={hasUpdatesOnly}
              onChange={(e) => setHasUpdatesOnly(e.target.checked)}
              className="rounded border-white/20"
            />
            With updates only
          </label>
        </div>
        
        {/* Results count */}
        <div className="mt-3 text-sm text-white/50">
          Showing {paginatedCampaigns.length} of {filteredCampaigns.length} campaigns
          {searchQuery && ` matching "${searchQuery}"`}
        </div>
      </div>

      {/* Campaign List */}
      {paginatedCampaigns.length === 0 ? (
        <div className="rounded-xl bg-white/5 border border-white/10 p-12 text-center">
          <div className="text-5xl mb-4 opacity-30">🔍</div>
          <p className="text-white/50">No campaigns found</p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-3 text-blue-400 hover:text-blue-300 text-sm"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedCampaigns.map(campaign => (
            <div key={campaign.id} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
              {/* Campaign Row */}
              <div
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => toggleExpanded(campaign.id)}
              >
                {/* Image */}
                <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-white/10">
                  {campaign.image_uri ? (
                    <img 
                      src={ipfsToHttp(campaign.image_uri)} 
                      alt={campaign.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl opacity-30">🎖️</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-white truncate max-w-[300px]">{campaign.title}</h3>
                    {getStatusBadge(campaign.status)}
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      campaign.category === 'veteran' 
                        ? 'bg-red-500/20 text-red-300' 
                        : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {campaign.category}
                    </span>
                    {/* Milestone badge */}
                    {campaign.approvedUpdates > 0 && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-orange-500/20 text-orange-300 flex items-center gap-1">
                        🏆 {campaign.approvedUpdates} milestone{campaign.approvedUpdates > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-white/50">
                    {campaign.campaign_id && <span>#{campaign.campaign_id}</span>}
                    <span>${campaign.goal.toLocaleString()} goal</span>
                    <span className="font-mono">{campaign.creator_wallet.slice(0, 6)}...{campaign.creator_wallet.slice(-4)}</span>
                    {campaign.creator_email && <span>{campaign.creator_email}</span>}
                  </div>
                </div>

                {/* Quick Stats (for minted campaigns) */}
                {campaign.status === 'minted' && campaign.onchainStats && (
                  <div className="flex items-center gap-4 text-xs">
                    <div className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                      <span className="text-green-400 font-semibold">${campaign.onchainStats.totalRaisedUSD.toFixed(0)}</span>
                      <span className="text-white/40 ml-1">raised</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <span className="text-blue-400 font-semibold">{campaign.onchainStats.editionsMinted}/{campaign.onchainStats.maxEditions}</span>
                      <span className="text-white/40 ml-1">sold</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-emerald-400 font-semibold">${campaign.onchainStats.nftSalesUSD.toFixed(0)}</span>
                      <span className="text-white/40 ml-1">NFT</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <span className="text-purple-400 font-semibold">${campaign.onchainStats.tipsUSD.toFixed(0)}</span>
                      <span className="text-white/40 ml-1">tips</span>
                    </div>
                  </div>
                )}

                {/* Updates Badges */}
                <div className="flex items-center gap-2">
                  {campaign.pendingUpdates > 0 && (
                    <span className="px-3 py-1.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-medium animate-pulse">
                      ⚠️ {campaign.pendingUpdates} pending
                    </span>
                  )}
                  {campaign.approvedUpdates > 0 && (
                    <span className="px-3 py-1.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-medium">
                      📢 {campaign.approvedUpdates} update{campaign.approvedUpdates !== 1 ? 's' : ''}
                    </span>
                  )}
                  {campaign.updates.length === 0 && (
                    <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/40 text-xs">
                      No updates
                    </span>
                  )}
                </div>

                {/* Expand Arrow */}
                <svg 
                  className={`w-5 h-5 text-white/40 transition-transform flex-shrink-0 ${expandedCampaigns.has(campaign.id) ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Expanded Content */}
              {expandedCampaigns.has(campaign.id) && (
                <div className="border-t border-white/10 bg-black/30">
                  {/* Campaign Details Section */}
                  <div className="p-6 space-y-6">
                    {/* Creator Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Contact Info */}
                      <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                        <h4 className="text-sm font-medium text-white/70 mb-3 flex items-center gap-2">
                          👤 Creator Information
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-white/50">Name:</span>
                            <span className="text-white ml-2">{campaign.creator_name || '—'}</span>
                          </div>
                          <div>
                            <span className="text-white/50">Email:</span>
                            <span className="text-white ml-2">{campaign.creator_email || '—'}</span>
                          </div>
                          <div>
                            <span className="text-white/50">Phone:</span>
                            <span className="text-white ml-2">{campaign.creator_phone || '—'}</span>
                          </div>
                          <div>
                            <span className="text-white/50">Wallet:</span>
                            <span className="text-white ml-2 font-mono text-xs break-all">{campaign.creator_wallet || '—'}</span>
                          </div>
                          {campaign.creator_address && (
                            <div>
                              <span className="text-white/50">Address:</span>
                              <div className="text-white text-xs mt-1">
                                {campaign.creator_address.street && <div>{campaign.creator_address.street}</div>}
                                <div>
                                  {[campaign.creator_address.city, campaign.creator_address.state, campaign.creator_address.zip]
                                    .filter(Boolean).join(', ')}
                                </div>
                                {campaign.creator_address.country && <div>{campaign.creator_address.country}</div>}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Campaign Info */}
                      <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                        <h4 className="text-sm font-medium text-white/70 mb-3 flex items-center gap-2">
                          📋 Campaign Details
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-white/50">ID:</span>
                            <span className="text-white ml-2 font-mono text-xs">{campaign.id.slice(0, 8)}...</span>
                          </div>
                          {campaign.campaign_id && (
                            <div>
                              <span className="text-white/50">On-chain ID:</span>
                              <span className="text-white ml-2">#{campaign.campaign_id}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-white/50">Category:</span>
                            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                              campaign.category === 'veteran' 
                                ? 'bg-red-500/20 text-red-300' 
                                : 'bg-blue-500/20 text-blue-300'
                            }`}>{campaign.category}</span>
                          </div>
                          <div>
                            <span className="text-white/50">Goal:</span>
                            <span className="text-white ml-2">${campaign.goal.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-white/50">NFT Editions:</span>
                            <span className="text-white ml-2">{campaign.nft_editions || campaign.num_copies || 100}</span>
                          </div>
                          <div>
                            <span className="text-white/50">Price/Edition:</span>
                            <span className="text-white ml-2">
                              {campaign.nft_price 
                                ? `$${campaign.nft_price} USD` 
                                : campaign.goal && campaign.nft_editions 
                                  ? `$${(campaign.goal / campaign.nft_editions).toFixed(2)} USD (auto)`
                                  : 'Auto (goal ÷ editions)'}
                            </span>
                          </div>
                          <div>
                            <span className="text-white/50">Status:</span>
                            <span className="ml-2">{getStatusBadge(campaign.status)}</span>
                          </div>
                          <div>
                            <span className="text-white/50">Created:</span>
                            <span className="text-white ml-2 text-xs">
                              {new Date(campaign.created_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* On-Chain Stats - Only for minted campaigns */}
                      {campaign.status === 'minted' && campaign.onchainStats && (
                        <div className="rounded-lg bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-500/20 p-4">
                          <h4 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
                            📊 Live Fundraising Stats
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="bg-white/5 rounded-lg p-3">
                              <div className="text-white/50 text-xs mb-1">NFTs Sold</div>
                              <div className="text-white font-semibold">
                                {campaign.onchainStats.editionsMinted} / {campaign.onchainStats.maxEditions}
                              </div>
                              <div className="text-green-400 text-xs">
                                {campaign.onchainStats.remainingEditions !== null 
                                  ? `${campaign.onchainStats.remainingEditions} remaining`
                                  : 'Unlimited'}
                              </div>
                            </div>
                            <div className="bg-white/5 rounded-lg p-3">
                              <div className="text-white/50 text-xs mb-1">Progress</div>
                              <div className="text-white font-semibold">{campaign.onchainStats.progressPercent}%</div>
                              <div className="h-1.5 rounded-full bg-white/10 mt-1">
                                <div 
                                  className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400" 
                                  style={{ width: `${Math.min(100, campaign.onchainStats.progressPercent)}%` }}
                                />
                              </div>
                            </div>
                            <div className="bg-white/5 rounded-lg p-3">
                              <div className="text-white/50 text-xs mb-1">NFT Sales Revenue</div>
                              <div className="text-emerald-400 font-semibold">
                                ${campaign.onchainStats.nftSalesUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            </div>
                            <div className="bg-white/5 rounded-lg p-3">
                              <div className="text-white/50 text-xs mb-1">Tips Received</div>
                              <div className="text-purple-400 font-semibold">
                                ${campaign.onchainStats.tipsUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            </div>
                            <div className="col-span-2 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg p-3 border border-green-500/20">
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="text-white/50 text-xs mb-1">Total Raised</div>
                                  <div className="text-green-400 font-bold text-lg">
                                    ${campaign.onchainStats.totalRaisedUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-white/50 text-xs mb-1">Net (after 1% fee)</div>
                                  <div className="text-white font-semibold">
                                    ${campaign.onchainStats.netRaisedUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Verification Status */}
                      <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                        <h4 className="text-sm font-medium text-white/70 mb-3 flex items-center gap-2">
                          🔐 Verification Status
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-white/50">Overall:</span>
                            <span className={`px-2 py-0.5 text-xs rounded-full border ${
                              campaign.verification_status === 'verified' 
                                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                : campaign.verification_status === 'rejected'
                                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                  : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                            }`}>
                              {campaign.verification_status || 'pending'}
                            </span>
                          </div>
                          {/* Manual documents */}
                          <div className="pt-2 border-t border-white/10 mt-2">
                            <span className="text-white/50 text-xs">Documents:</span>
                            <div className="flex gap-2 mt-1">
                              {campaign.verification_selfie && (
                                <a href={campaign.verification_selfie} target="_blank" rel="noopener noreferrer"
                                   className="px-2 py-1 bg-white/10 rounded text-xs text-white/70 hover:text-white">
                                  📸 Selfie
                                </a>
                              )}
                              {campaign.verification_id_front && (
                                <a href={campaign.verification_id_front} target="_blank" rel="noopener noreferrer"
                                   className="px-2 py-1 bg-white/10 rounded text-xs text-white/70 hover:text-white">
                                  🪪 ID Front
                                </a>
                              )}
                              {campaign.verification_id_back && (
                                <a href={campaign.verification_id_back} target="_blank" rel="noopener noreferrer"
                                   className="px-2 py-1 bg-white/10 rounded text-xs text-white/70 hover:text-white">
                                  🪪 ID Back
                                </a>
                              )}
                              {!campaign.verification_selfie && !campaign.verification_id_front && !campaign.verification_id_back && (
                                <span className="text-white/40 text-xs">No documents uploaded</span>
                              )}
                            </div>
                            {campaign.verification_documents && campaign.verification_documents.length > 0 && (
                              <div className="mt-2">
                                <span className="text-white/50 text-xs">Supporting Docs:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {campaign.verification_documents.map((doc: any, i: number) => (
                                    <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer"
                                       className="px-2 py-1 bg-white/10 rounded text-xs text-white/70 hover:text-white">
                                      📄 {doc.name || doc.type || `Doc ${i + 1}`}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Rejection Notes - Show prominently for rejected campaigns */}
                    {campaign.status === 'rejected' && campaign.admin_notes && (
                      <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4">
                        <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                          ⚠️ Rejection Reason
                          {campaign.reviewed_at && (
                            <span className="text-xs text-red-400/60 font-normal">
                              ({new Date(campaign.reviewed_at).toLocaleDateString()})
                            </span>
                          )}
                        </h4>
                        <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
                          {campaign.admin_notes}
                        </p>
                      </div>
                    )}

                    {/* Story */}
                    {campaign.story && (
                      <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                        <h4 className="text-sm font-medium text-white/70 mb-2">📖 Story</h4>
                        <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
                          {campaign.story}
                        </p>
                      </div>
                    )}

                    {/* Admin Actions Bar */}
                    <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
                      <h4 className="text-sm font-medium text-blue-400 mb-3">⚙️ Admin Actions</h4>
                      <div className="flex flex-wrap gap-3">
                        {/* Quick Status Buttons */}
                        {campaign.status === 'pending' && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); openApprovalModal(campaign); }}
                              disabled={approving === campaign.id}
                              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-green-600/50 text-white text-sm font-medium transition-colors flex items-center gap-2"
                            >
                              {approving === campaign.id ? (
                                <>
                                  <span className="animate-spin">⏳</span>
                                  Creating On-Chain...
                                </>
                              ) : (
                                <>✓ Approve & Create Campaign</>
                              )}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setRejectingCampaign(campaign); setRejectionReason(''); }}
                              disabled={approving === campaign.id}
                              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
                            >
                              ✗ Reject
                            </button>
                          </>
                        )}
                        {/* Approved but not minted - allow retry */}
                        {campaign.status === 'approved' && campaign.campaign_id == null && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openApprovalModal(campaign); }}
                            disabled={approving === campaign.id}
                            className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:bg-orange-600/50 text-white text-sm font-medium transition-colors flex items-center gap-2"
                          >
                            {approving === campaign.id ? (
                              <>
                                <span className="animate-spin">⏳</span>
                                Retrying...
                              </>
                            ) : (
                              <>🔄 Retry Create Campaign</>
                            )}
                          </button>
                        )}
                        {/* Rejected - allow moving back to pending for re-review */}
                        {campaign.status === 'rejected' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); quickStatusChange(campaign.id, 'pending'); }}
                            className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-medium transition-colors"
                          >
                            ↩️ Move to Pending
                          </button>
                        )}
                        {/* Minted campaigns show their on-chain ID and explorer link */}
                        {campaign.status === 'minted' && campaign.campaign_id != null && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 text-sm">
                              🎨 On-Chain Campaign #{campaign.campaign_id}
                            </div>
                            {campaign.tx_hash && (
                              <a
                                href={`https://awakening.bdagscan.com/tx/${campaign.tx_hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
                              >
                                🔗 View on Explorer
                              </a>
                            )}
                            {/* Fix Campaign button - for campaigns that may have wrong ID */}
                            <button
                              onClick={(e) => { e.stopPropagation(); verifyCampaign(campaign); }}
                              disabled={fixing === campaign.id}
                              className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:bg-orange-600/50 text-white text-sm font-medium transition-colors flex items-center gap-2"
                              title="Fix campaign ID if purchases are failing"
                            >
                              {fixing === campaign.id ? (
                                <>
                                  <span className="animate-spin">⏳</span>
                                  Fixing...
                                </>
                              ) : (
                                <>🔧 Fix Campaign</>
                              )}
                            </button>
                          </div>
                        )}
                        
                        {/* Edit Button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditModal(campaign); }}
                          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                        >
                          ✏️ Edit Campaign
                        </button>
                        
                        {/* Delete Button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeletingCampaign(campaign); }}
                          className="px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600 border border-red-500/30 text-red-400 hover:text-white text-sm font-medium transition-colors"
                        >
                          🗑️ Delete
                        </button>
                        
                        {/* Current Status Display */}
                        <div className="flex items-center gap-2 ml-auto">
                          <span className="text-white/50 text-sm">Status:</span>
                          {getStatusBadge(campaign.status)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Updates Section Header */}
                  <div className="px-6 py-3 bg-white/5 border-t border-white/10">
                    <h4 className="text-sm font-medium text-white/70">
                      📢 Campaign Updates ({campaign.updates.length})
                    </h4>
                  </div>

                  {/* Updates List */}
                  {campaign.updates.length === 0 ? (
                    <div className="p-6 text-center text-white/40 text-sm">
                      No updates submitted for this campaign yet
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {campaign.updates.map((update, idx) => (
                        <div key={update.id} className={`p-4 ${update.status === 'pending' ? 'bg-yellow-500/5' : ''}`}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                                update.status === 'pending' 
                                  ? 'bg-yellow-500' 
                                  : update.status === 'approved' 
                                    ? 'bg-green-500' 
                                    : 'bg-red-500'
                              }`}>
                                {campaign.updates.length - idx}
                              </div>
                              <div>
                                <h4 className="font-medium text-white text-sm">
                                  {update.title || `Update #${campaign.updates.length - idx}`}
                                </h4>
                                <p className="text-xs text-white/40">
                                  {new Date(update.created_at).toLocaleDateString('en-US', {
                                    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getUpdateStatusBadge(update.status)}
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteUpdate(update.id, campaign.id); }}
                                disabled={deletingUpdateId === update.id}
                                className="px-2 py-1 rounded text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-colors disabled:opacity-50"
                              >
                                {deletingUpdateId === update.id ? '...' : '🗑️'}
                              </button>
                            </div>
                          </div>

                          {/* Update Content - Expandable */}
                          <div 
                            className="ml-10 space-y-2 text-sm cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); toggleUpdateExpanded(update.id); }}
                          >
                            {/* Preview Mode */}
                            {!expandedUpdates.has(update.id) ? (
                              <>
                                {update.story_update && (
                                  <p className="text-white/60 text-xs line-clamp-2">
                                    <span className="text-blue-400">Situation:</span> {update.story_update}
                                  </p>
                                )}
                                <p className="text-blue-400 text-xs hover:text-blue-300">Click to expand...</p>
                              </>
                            ) : (
                              /* Expanded Mode */
                              <div className="space-y-3 bg-white/5 rounded-lg p-4 border border-white/10">
                                <div className="flex justify-between items-start">
                                  <h5 className="font-medium text-white">Full Update Details</h5>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openEditUpdate(update); }}
                                    className="px-3 py-1 rounded text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 border border-blue-500/30 transition-colors"
                                  >
                                    ✏️ Edit
                                  </button>
                                </div>
                                {update.story_update && (
                                  <div>
                                    <span className="text-blue-400 text-xs font-medium">📖 Situation Update:</span>
                                    <p className="text-white/70 mt-1 whitespace-pre-wrap">{update.story_update}</p>
                                  </div>
                                )}
                                {update.funds_utilization && (
                                  <div>
                                    <span className="text-green-400 text-xs font-medium">💰 Funds Utilization:</span>
                                    <p className="text-white/70 mt-1 whitespace-pre-wrap">{update.funds_utilization}</p>
                                  </div>
                                )}
                                {update.benefits && (
                                  <div>
                                    <span className="text-purple-400 text-xs font-medium">✨ Benefits:</span>
                                    <p className="text-white/70 mt-1 whitespace-pre-wrap">{update.benefits}</p>
                                  </div>
                                )}
                                {update.still_needed && (
                                  <div>
                                    <span className="text-orange-400 text-xs font-medium">🎯 Still Needed:</span>
                                    <p className="text-white/70 mt-1 whitespace-pre-wrap">{update.still_needed}</p>
                                  </div>
                                )}
                                {update.media_uris && update.media_uris.length > 0 && (
                                  <div>
                                    <span className="text-white/40 text-xs font-medium">📎 Attachments:</span>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {update.media_uris.map((uri, i) => {
                                        const httpUrl = ipfsToHttp(uri)
                                        return (
                                          <a
                                            key={i}
                                            href={httpUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-16 h-16 rounded bg-white/10 overflow-hidden hover:ring-2 hover:ring-blue-500"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <img src={httpUrl} alt="" className="w-full h-full object-cover" />
                                          </a>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                                <p className="text-white/40 text-xs cursor-pointer hover:text-white/60" onClick={(e) => { e.stopPropagation(); toggleUpdateExpanded(update.id); }}>
                                  Click to collapse
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
          >
            Previous
          </button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (page <= 3) {
                pageNum = i + 1
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = page - 2 + i
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                    page === pageNum 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
          </div>
          
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-lg bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
          >
            Next
          </button>
          
          <span className="ml-4 text-sm text-white/50">
            Page {page} of {totalPages}
          </span>
        </div>
      )}

      {/* Edit Modal */}
      {editingCampaign && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditingCampaign(null)}>
          <div 
            className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Edit Campaign</h2>
              <button 
                onClick={() => setEditingCampaign(null)}
                className="text-white/50 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Title</label>
                  <input
                    type="text"
                    value={editForm.title || ''}
                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Category</label>
                  <select
                    value={editForm.category || 'general'}
                    onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white"
                  >
                    <option value="veteran">Veteran</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>

              {/* Story */}
              <div>
                <label className="block text-sm text-white/70 mb-1">Story</label>
                <textarea
                  value={editForm.story || ''}
                  onChange={e => setEditForm({ ...editForm, story: e.target.value })}
                  rows={5}
                  className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white resize-none"
                />
              </div>

              {/* NFT Settings */}
              <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-4">
                <h3 className="text-sm font-medium text-purple-400 mb-3">NFT Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Goal (USD)</label>
                    <input
                      type="number"
                      value={editForm.goal || 0}
                      onChange={e => setEditForm({ ...editForm, goal: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">NFT Price (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.nft_price || 1}
                      onChange={e => setEditForm({ ...editForm, nft_price: parseFloat(e.target.value) || 1 })}
                      className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white"
                    />
                    <p className="text-xs text-white/40 mt-1">
                      = {((editForm.nft_price || 1) / 0.05).toFixed(0)} BDAG
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Max Editions</label>
                    <input
                      type="number"
                      value={editForm.nft_editions || 100}
                      onChange={e => setEditForm({ ...editForm, nft_editions: parseInt(e.target.value) || 100 })}
                      className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white"
                    />
                    <p className="text-xs text-white/40 mt-1">0 = unlimited</p>
                  </div>
                </div>
                {/* Total potential summary */}
                <div className="mt-3 pt-3 border-t border-purple-500/20 text-sm">
                  <span className="text-purple-300">💰 Max Potential:</span>
                  <span className="text-white ml-2 font-medium">
                    ${((editForm.nft_price || 1) * (editForm.nft_editions || 100)).toLocaleString()} USD
                  </span>
                  <span className="text-white/40 ml-2">
                    (if all {editForm.nft_editions || 100} editions sell at ${editForm.nft_price || 1} each)
                  </span>
                </div>
              </div>

              {/* Status & Verification */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Campaign Status</label>
                  <select
                    value={editForm.status || 'pending'}
                    onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="minted">Minted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Verification Status</label>
                  <select
                    value={editForm.verification_status || 'pending'}
                    onChange={e => setEditForm({ ...editForm, verification_status: e.target.value })}
                    className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white"
                  >
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {/* Creator Info */}
              <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                <h3 className="text-sm font-medium text-white/70 mb-3">Creator Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Name</label>
                    <input
                      type="text"
                      value={editForm.creator_name || ''}
                      onChange={e => setEditForm({ ...editForm, creator_name: e.target.value })}
                      className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Email</label>
                    <input
                      type="email"
                      value={editForm.creator_email || ''}
                      onChange={e => setEditForm({ ...editForm, creator_email: e.target.value })}
                      className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Phone</label>
                    <input
                      type="text"
                      value={editForm.creator_phone || ''}
                      onChange={e => setEditForm({ ...editForm, creator_phone: e.target.value })}
                      className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Wallet Address</label>
                    <input
                      type="text"
                      value={editForm.creator_wallet || ''}
                      onChange={e => setEditForm({ ...editForm, creator_wallet: e.target.value })}
                      className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Save Message */}
              {saveMsg && (
                <div className={`rounded-lg p-3 text-sm ${
                  saveMsg.startsWith('✓') 
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                  {saveMsg}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingCampaign(null)}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdits}
                disabled={saving}
                className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm font-medium transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCampaign && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !deleting && setDeletingCampaign(null)}>
          <div 
            className="bg-gray-900 border border-red-500/30 rounded-2xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/10 bg-red-500/10">
              <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
                ⚠️ Delete Submission
              </h2>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <p className="text-white">
                Are you sure you want to delete this submission?
              </p>
              
              <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                <div className="font-medium text-white">{deletingCampaign.title}</div>
                <div className="text-sm text-white/50 mt-1">
                  {deletingCampaign.creator_email || deletingCampaign.creator_wallet.slice(0, 10) + '...'}
                </div>
                <div className="text-xs text-white/30 mt-1 font-mono">
                  ID: {deletingCampaign.id.slice(0, 8)}...
                </div>
              </div>
              
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-300">
                <strong>This action will permanently delete:</strong>
                <ul className="mt-2 space-y-1 text-red-300/80">
                  <li>• The submission record</li>
                  <li>• All campaign updates</li>
                  <li>• Uploaded verification documents</li>
                </ul>
              </div>
              
              <p className="text-sm text-white/50">
                This action cannot be undone.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingCampaign(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteSubmission(deletingCampaign.id)}
                disabled={deleting}
                className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 text-white text-sm font-medium transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingCampaign && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !rejecting && setRejectingCampaign(null)}>
          <div 
            className="bg-gray-900 border border-orange-500/30 rounded-2xl w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/10 bg-orange-500/10">
              <h2 className="text-lg font-bold text-orange-400 flex items-center gap-2">
                ✗ Reject Submission
              </h2>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                <div className="font-medium text-white">{rejectingCampaign.title}</div>
                <div className="text-sm text-white/50 mt-1">
                  By: {rejectingCampaign.creator_name || rejectingCampaign.creator_email || 'Unknown'}
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-white/70 mb-2">
                  Reason for Rejection <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Please explain why this submission is being rejected and what changes need to be made for approval..."
                  rows={5}
                  className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 resize-none focus:outline-none focus:border-orange-500/50"
                />
                <p className="text-xs text-white/40 mt-1">
                  This message will be emailed to the creator at {rejectingCampaign.creator_email}
                </p>
              </div>
              
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-sm text-blue-300">
                <strong>💡 Tip:</strong> Be specific about what needs to be fixed. Common reasons include:
                <ul className="mt-2 space-y-1 text-blue-300/80 text-xs">
                  <li>• Incomplete or unclear story description</li>
                  <li>• Missing or insufficient verification documents</li>
                  <li>• Image quality issues</li>
                  <li>• Goal amount needs clarification</li>
                  <li>• Additional information needed about fund usage</li>
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                onClick={() => { setRejectingCampaign(null); setRejectionReason(''); }}
                disabled={rejecting}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={rejectSubmission}
                disabled={rejecting || !rejectionReason.trim()}
                className="px-6 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:bg-orange-600/50 text-white text-sm font-medium transition-colors"
              >
                {rejecting ? 'Sending...' : 'Reject & Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Confirmation Modal */}
      {approvingCampaign && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setApprovingCampaign(null)}>
          <div 
            className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header - Fixed */}
            <div className="px-6 py-3 border-b border-white/10 flex items-center justify-between bg-green-500/10 flex-shrink-0">
              <h2 className="text-lg font-bold text-white">✓ Approve & Create Campaign</h2>
              <button 
                onClick={() => setApprovingCampaign(null)}
                className="text-white/50 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div className="text-sm text-white/70 mb-4">
                <strong className="text-white">{approvingCampaign.title}</strong>
                <p className="mt-1">Review and adjust the campaign settings before creating on-chain:</p>
              </div>

              {/* Goal + NFT Settings - Compact Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-white/70 mb-1">Goal (USD)</label>
                  <input
                    type="number"
                    value={approvalForm.goal}
                    onChange={e => setApprovalForm({ ...approvalForm, goal: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg bg-white/10 border border-white/10 p-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/70 mb-1">Price/NFT (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={approvalForm.nft_price}
                    onChange={e => setApprovalForm({ ...approvalForm, nft_price: parseFloat(e.target.value) || 1 })}
                    className="w-full rounded-lg bg-white/10 border border-white/10 p-2 text-white text-sm"
                  />
                  <p className="text-xs text-white/40">= {(approvalForm.nft_price / 0.05).toFixed(0)} BDAG</p>
                </div>
                <div>
                  <label className="block text-xs text-white/70 mb-1">Max Editions</label>
                  <input
                    type="number"
                    value={approvalForm.nft_editions}
                    onChange={e => setApprovalForm({ ...approvalForm, nft_editions: parseInt(e.target.value) || 100 })}
                    className="w-full rounded-lg bg-white/10 border border-white/10 p-2 text-white text-sm"
                  />
                </div>
              </div>

              {/* Wallet */}
              <div>
                <label className="block text-xs text-white/70 mb-1">Creator Wallet Address</label>
                <input
                  type="text"
                  value={approvalForm.creator_wallet}
                  onChange={e => setApprovalForm({ ...approvalForm, creator_wallet: e.target.value })}
                  placeholder="0x..."
                  className="w-full rounded-lg bg-white/10 border border-white/10 p-2 text-white font-mono text-xs"
                />
                {!approvalForm.creator_wallet && (
                  <p className="text-xs text-yellow-400">⚠️ No wallet - uses relayer fallback</p>
                )}
              </div>

              {/* Benchmarks / Milestones */}
              <div>
                <label className="block text-xs text-white/70 mb-1">Benchmarks (one per line, optional)</label>
                <textarea
                  value={approvalForm.benchmarks}
                  onChange={e => setApprovalForm({ ...approvalForm, benchmarks: e.target.value })}
                  placeholder="25% - Milestone 1&#10;50% - Milestone 2&#10;100% - Complete"
                  className="w-full rounded-lg bg-white/10 border border-white/10 p-2 text-white text-sm h-20"
                />
              </div>

              {/* Summary */}
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
                <div className="text-sm text-green-300">
                  <div className="flex justify-between mb-1">
                    <span>Max Potential Revenue:</span>
                    <span className="font-medium">${(approvalForm.nft_price * approvalForm.nft_editions).toLocaleString()} USD</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Fundraising Goal:</span>
                    <span>${approvalForm.goal.toLocaleString()} USD</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer - Fixed */}
            <div className="px-4 py-3 border-t border-white/10 flex items-center justify-end gap-3 flex-shrink-0 bg-gray-900">
              <button
                onClick={() => setApprovingCampaign(null)}
                disabled={approving === approvingCampaign.id}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  approveCampaign(approvingCampaign, approvalForm)
                  setApprovingCampaign(null)
                }}
                disabled={approving === approvingCampaign.id}
                className="px-5 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-green-600/50 text-white text-sm font-medium transition-colors flex items-center gap-2"
              >
                {approving === approvingCampaign.id ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Creating...
                  </>
                ) : (
                  <>✓ Create On-Chain</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Update Modal */}
      {editingUpdate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditingUpdate(null)}>
          <div 
            className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Edit Campaign Update</h2>
              <button 
                onClick={() => setEditingUpdate(null)}
                className="text-white/50 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">Title</label>
                <input
                  type="text"
                  value={editUpdateForm.title || ''}
                  onChange={e => setEditUpdateForm({ ...editUpdateForm, title: e.target.value })}
                  className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-blue-400 mb-1">📖 Situation Update</label>
                <textarea
                  value={editUpdateForm.story_update || ''}
                  onChange={e => setEditUpdateForm({ ...editUpdateForm, story_update: e.target.value })}
                  rows={4}
                  className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white resize-none"
                  placeholder="What's happening with the campaign?"
                />
              </div>

              <div>
                <label className="block text-sm text-green-400 mb-1">💰 Funds Utilization</label>
                <textarea
                  value={editUpdateForm.funds_utilization || ''}
                  onChange={e => setEditUpdateForm({ ...editUpdateForm, funds_utilization: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white resize-none"
                  placeholder="How have the funds been used?"
                />
              </div>

              <div>
                <label className="block text-sm text-purple-400 mb-1">✨ Benefits</label>
                <textarea
                  value={editUpdateForm.benefits || ''}
                  onChange={e => setEditUpdateForm({ ...editUpdateForm, benefits: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white resize-none"
                  placeholder="What benefits have been achieved?"
                />
              </div>

              <div>
                <label className="block text-sm text-orange-400 mb-1">🎯 Still Needed</label>
                <textarea
                  value={editUpdateForm.still_needed || ''}
                  onChange={e => setEditUpdateForm({ ...editUpdateForm, still_needed: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white resize-none"
                  placeholder="What's still needed?"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Status</label>
                <select
                  value={editUpdateForm.status || 'pending'}
                  onChange={e => setEditUpdateForm({ ...editUpdateForm, status: e.target.value })}
                  className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingUpdate(null)}
                disabled={savingUpdate}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveUpdateEdit}
                disabled={savingUpdate}
                className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm font-medium transition-colors flex items-center gap-2"
              >
                {savingUpdate ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Saving...
                  </>
                ) : (
                  <>✓ Save Changes</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
