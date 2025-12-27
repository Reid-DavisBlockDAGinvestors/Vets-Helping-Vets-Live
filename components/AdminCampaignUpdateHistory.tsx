'use client'

import { logger } from '@/lib/logger'

import { useState, useEffect } from 'react'
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

type CampaignWithUpdates = {
  id: string
  campaign_id: number | null
  title: string
  image_uri: string
  category: string
  goal: number
  creator_wallet: string
  status: string
  updates: CampaignUpdate[]
}

export default function AdminCampaignUpdateHistory() {
  const [campaigns, setCampaigns] = useState<CampaignWithUpdates[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<'all' | 'with_updates'>('with_updates')

  logger.debug('[AdminCampaignUpdateHistory] Component mounted')

  useEffect(() => {
    logger.debug('[AdminCampaignUpdateHistory] useEffect triggered, loading data in 500ms')
    // Small delay to ensure auth session is ready
    const timer = setTimeout(() => loadData(), 500)
    return () => clearTimeout(timer)
  }, [])

  const loadData = async () => {
    logger.debug('[AdminCampaignUpdateHistory] loadData called')
    setLoading(true)
    setError('')
    try {
      // Get auth token
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      logger.debug('[AdminCampaignUpdateHistory] Token:', token ? 'present' : 'missing')
      if (!token) {
        setError('Not authenticated')
        setLoading(false)
        return
      }
      
      // Fetch all minted submissions
      const subRes = await fetch('/api/submissions', {
        headers: { authorization: `Bearer ${token}` }
      })
      const subData = await subRes.json()
      if (!subRes.ok) throw new Error(subData?.error || 'Failed to load submissions')
      
      // Fetch all updates (all statuses for admin view)
      const updRes = await fetch('/api/campaign-updates?admin=true', {
        headers: { authorization: `Bearer ${token}` }
      })
      const updData = await updRes.json()
      if (!updRes.ok) throw new Error(updData?.error || 'Failed to load updates')
      
      // Filter to minted campaigns and group updates
      const mintedSubs = (subData?.items || []).filter((s: any) => s.status === 'minted')
      const updates = updData?.updates || []
      
      // Build campaign -> updates map
      const updatesBySubmission: Record<string, CampaignUpdate[]> = {}
      for (const u of updates) {
        if (!updatesBySubmission[u.submission_id]) {
          updatesBySubmission[u.submission_id] = []
        }
        updatesBySubmission[u.submission_id].push(u)
      }
      
      logger.debug('[AdminCampaignUpdateHistory] Got', mintedSubs.length, 'minted subs and', updates.length, 'updates')
      
      // Combine into campaigns with updates
      const campaignsWithUpdates: CampaignWithUpdates[] = mintedSubs.map((sub: any) => ({
        id: sub.id,
        campaign_id: sub.campaign_id,
        title: sub.title || `Campaign #${sub.campaign_id}`,
        image_uri: sub.image_uri || '',
        category: sub.category || 'general',
        goal: sub.goal || 0,
        creator_wallet: sub.creator_wallet || '',
        status: sub.status,
        updates: (updatesBySubmission[sub.id] || []).sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      }))
      
      // Sort by update count (most updates first)
      campaignsWithUpdates.sort((a, b) => b.updates.length - a.updates.length)
      
      setCampaigns(campaignsWithUpdates)
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (id: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Approved</span>
      case 'rejected':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Rejected</span>
      case 'pending':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Pending</span>
      default:
        return null
    }
  }

  const filteredCampaigns = statusFilter === 'with_updates' 
    ? campaigns.filter(c => c.updates.length > 0)
    : campaigns

  if (loading) {
    return (
      <div className="rounded-xl bg-white/5 border border-white/10 p-8">
        <div className="flex items-center justify-center gap-3">
          <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span className="text-white/60">Loading campaign history...</span>
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
          <h2 className="text-xl font-bold text-white">Campaign Update History</h2>
          <p className="text-sm text-white/50 mt-1">
            View all campaigns and their Living NFT updates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="with_updates">With Updates Only</option>
            <option value="all">All Campaigns</option>
          </select>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="text-2xl font-bold text-white">{campaigns.length}</div>
          <div className="text-sm text-white/50">Total Campaigns</div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="text-2xl font-bold text-green-400">
            {campaigns.filter(c => c.updates.length > 0).length}
          </div>
          <div className="text-sm text-white/50">With Updates</div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="text-2xl font-bold text-blue-400">
            {campaigns.reduce((sum, c) => sum + c.updates.length, 0)}
          </div>
          <div className="text-sm text-white/50">Total Updates</div>
        </div>
      </div>

      {/* Campaign List */}
      {filteredCampaigns.length === 0 ? (
        <div className="rounded-xl bg-white/5 border border-white/10 p-8 text-center">
          <div className="text-4xl mb-3 opacity-30">📋</div>
          <p className="text-white/50">No campaigns found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCampaigns.map(campaign => (
            <div key={campaign.id} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
              {/* Campaign Header */}
              <button
                onClick={() => toggleExpanded(campaign.id)}
                className="w-full p-4 flex items-center gap-4 hover:bg-white/5 transition-colors text-left"
              >
                {/* Image */}
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-white/10">
                  {campaign.image_uri ? (
                    <img 
                      src={ipfsToHttp(campaign.image_uri)} 
                      alt={campaign.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">🎖️</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white truncate">{campaign.title}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      campaign.category === 'veteran' 
                        ? 'bg-red-500/20 text-red-300' 
                        : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {campaign.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-white/50">
                    <span>Campaign #{campaign.campaign_id}</span>
                    <span>Goal: ${campaign.goal.toLocaleString()}</span>
                    <span className="font-mono text-xs">{campaign.creator_wallet.slice(0, 6)}...{campaign.creator_wallet.slice(-4)}</span>
                  </div>
                </div>

                {/* Update Count Badge */}
                <div className="flex items-center gap-3">
                  {campaign.updates.length > 0 ? (
                    <span className="px-3 py-1.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-sm font-medium">
                      📢 {campaign.updates.length} update{campaign.updates.length !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/40 text-sm">
                      No updates
                    </span>
                  )}
                  <svg 
                    className={`w-5 h-5 text-white/40 transition-transform ${expandedCampaigns.has(campaign.id) ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Updates List (Expanded) */}
              {expandedCampaigns.has(campaign.id) && (
                <div className="border-t border-white/10 bg-black/20">
                  {campaign.updates.length === 0 ? (
                    <div className="p-6 text-center text-white/40">
                      No updates submitted for this campaign yet
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {campaign.updates.map((update, idx) => (
                        <div key={update.id} className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                                {campaign.updates.length - idx}
                              </div>
                              <div>
                                <h4 className="font-medium text-white">
                                  {update.title || `Update #${campaign.updates.length - idx}`}
                                </h4>
                                <p className="text-xs text-white/40">
                                  {new Date(update.created_at).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                            {getStatusBadge(update.status)}
                          </div>

                          {/* Update Content */}
                          <div className="ml-11 space-y-2 text-sm">
                            {update.story_update && (
                              <div>
                                <span className="text-blue-400 font-medium">Situation: </span>
                                <span className="text-white/70">{update.story_update}</span>
                              </div>
                            )}
                            {update.funds_utilization && (
                              <div>
                                <span className="text-green-400 font-medium">Funds: </span>
                                <span className="text-white/70">{update.funds_utilization}</span>
                              </div>
                            )}
                            {update.benefits && (
                              <div>
                                <span className="text-purple-400 font-medium">Impact: </span>
                                <span className="text-white/70">{update.benefits}</span>
                              </div>
                            )}
                            {update.still_needed && (
                              <div>
                                <span className="text-yellow-400 font-medium">Needed: </span>
                                <span className="text-white/70">{update.still_needed}</span>
                              </div>
                            )}

                            {/* Media Attachments */}
                            {update.media_uris && update.media_uris.length > 0 && (
                              <div className="mt-3">
                                <span className="text-white/50 text-xs block mb-2">Attached Media:</span>
                                <div className="flex flex-wrap gap-2">
                                  {update.media_uris.map((uri, i) => {
                                    const httpUrl = ipfsToHttp(uri)
                                    const isImage = httpUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                                    return (
                                      <a
                                        key={i}
                                        href={httpUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block w-16 h-16 rounded-lg overflow-hidden bg-white/10 hover:ring-2 hover:ring-blue-500 transition-all"
                                      >
                                        {isImage ? (
                                          <img src={httpUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-2xl">📎</div>
                                        )}
                                      </a>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Reviewer Notes */}
                            {update.reviewer_notes && (
                              <div className="mt-3 p-2 rounded-lg bg-white/5 border border-white/10">
                                <span className="text-white/40 text-xs">Admin Notes: </span>
                                <span className="text-white/60 text-xs">{update.reviewer_notes}</span>
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
    </div>
  )
}
