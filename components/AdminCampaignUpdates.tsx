"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ipfsToHttp } from '@/lib/ipfs'

type CampaignUpdate = {
  id: string
  submission_id: string
  campaign_id: number | null
  creator_wallet: string
  creator_email: string | null
  title: string | null
  story_update: string | null
  funds_utilization: string | null
  benefits: string | null
  still_needed: string | null
  new_image_uri: string | null
  media_uris: string[] | null
  status: 'pending' | 'approved' | 'rejected'
  reviewer_notes: string | null
  reviewed_at: string | null
  created_at: string
  submissions?: {
    title: string
    image_uri: string
    category: string
    goal: number
  }
}

export default function AdminCampaignUpdates() {
  const [updates, setUpdates] = useState<CampaignUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('pending')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [reviewerNotes, setReviewerNotes] = useState<Record<string, string>>({})

  const fetchUpdates = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      const res = await fetch(`/api/campaign-updates?admin=true&status=${filterStatus}`, {
        headers: { authorization: `Bearer ${token}` }
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data?.error || 'Failed to fetch updates')
        return
      }

      setUpdates(data.updates || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch updates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUpdates()
  }, [filterStatus])

  const handleAction = async (updateId: string, action: 'approve' | 'reject') => {
    setProcessingId(updateId)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) {
        alert('Not authenticated')
        return
      }

      const res = await fetch(`/api/campaign-updates/${updateId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          reviewer_notes: reviewerNotes[updateId] || null
        })
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data?.error || data?.details || 'Action failed')
        return
      }

      // Remove from list if viewing pending
      if (filterStatus === 'pending') {
        setUpdates(prev => prev.filter(u => u.id !== updateId))
      } else {
        // Update status in list
        setUpdates(prev => prev.map(u =>
          u.id === updateId ? { ...u, status: action === 'approve' ? 'approved' : 'rejected' } : u
        ))
      }

      // Show success message
      if (action === 'approve' && data.txHash) {
        alert(`Update approved! On-chain tx: ${data.txHash}`)
      }
    } catch (e: any) {
      alert(e?.message || 'Action failed')
    } finally {
      setProcessingId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Campaign Updates</h2>
          <p className="text-sm text-white/50">Review and approve Living NFT updates from fundraisers</p>
        </div>
        <div className="flex gap-2">
          {['pending', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm text-white/50">Loading updates...</p>
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-400 text-sm">{error}</div>
      ) : updates.length === 0 ? (
        <div className="text-center py-8 text-white/50 text-sm">
          No {filterStatus} updates found.
        </div>
      ) : (
        <div className="space-y-3">
          {updates.map((update) => (
            <div
              key={update.id}
              className="rounded-xl bg-white/5 border border-white/10 overflow-hidden"
            >
              {/* Header */}
              <div
                className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setExpandedId(expandedId === update.id ? null : update.id)}
              >
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  {update.submissions?.image_uri && (
                    <img
                      src={ipfsToHttp(update.submissions.image_uri)}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white truncate">
                        {update.submissions?.title || `Campaign #${update.campaign_id}`}
                      </h3>
                      {update.title && (
                        <span className="text-white/50 text-sm">- {update.title}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
                      <span className="font-mono">{update.creator_wallet?.slice(0, 6)}...{update.creator_wallet?.slice(-4)}</span>
                      <span>{formatDate(update.created_at)}</span>
                      <span className={`px-2 py-0.5 rounded-full ${
                        update.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                        update.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                        'bg-red-500/20 text-red-300'
                      }`}>
                        {update.status}
                      </span>
                    </div>
                  </div>

                  {/* Expand Arrow */}
                  <svg
                    className={`w-5 h-5 text-white/30 transition-transform ${expandedId === update.id ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedId === update.id && (
                <div className="border-t border-white/10 p-4 space-y-4">
                  {/* Update Fields */}
                  <div className="grid gap-4 md:grid-cols-2">
                    {update.story_update && (
                      <div className="rounded-lg bg-white/5 p-3">
                        <div className="text-xs text-white/40 mb-1">Situation Update</div>
                        <div className="text-sm text-white/80 whitespace-pre-wrap">{update.story_update}</div>
                      </div>
                    )}
                    {update.funds_utilization && (
                      <div className="rounded-lg bg-white/5 p-3">
                        <div className="text-xs text-white/40 mb-1">Funds Utilization</div>
                        <div className="text-sm text-white/80 whitespace-pre-wrap">{update.funds_utilization}</div>
                      </div>
                    )}
                    {update.benefits && (
                      <div className="rounded-lg bg-white/5 p-3">
                        <div className="text-xs text-white/40 mb-1">Benefits & Impact</div>
                        <div className="text-sm text-white/80 whitespace-pre-wrap">{update.benefits}</div>
                      </div>
                    )}
                    {update.still_needed && (
                      <div className="rounded-lg bg-white/5 p-3">
                        <div className="text-xs text-white/40 mb-1">Still Needed</div>
                        <div className="text-sm text-white/80 whitespace-pre-wrap">{update.still_needed}</div>
                      </div>
                    )}
                  </div>

                  {/* Media Attachments */}
                  {update.media_uris && update.media_uris.length > 0 && (
                    <div>
                      <div className="text-xs text-white/40 mb-2">Media Attachments ({update.media_uris.length})</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {update.media_uris.map((uri: string, idx: number) => {
                          const httpUrl = ipfsToHttp(uri)
                          const isVideo = uri.includes('video') || httpUrl.match(/\.(mp4|webm|mov)$/i)
                          const isAudio = uri.includes('audio') || httpUrl.match(/\.(mp3|wav|ogg|m4a|aac)$/i)
                          
                          return (
                            <a
                              key={idx}
                              href={httpUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-lg overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                            >
                              {isVideo ? (
                                <div className="h-20 flex items-center justify-center bg-gradient-to-br from-blue-900/30 to-purple-900/30">
                                  <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                              ) : isAudio ? (
                                <div className="h-20 flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-pink-900/30">
                                  <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                  </svg>
                                </div>
                              ) : (
                                <img
                                  src={httpUrl}
                                  alt={`Media ${idx + 1}`}
                                  className="h-20 w-full object-cover"
                                />
                              )}
                              <div className="p-1.5 text-[10px] text-white/50 text-center">
                                {isVideo ? 'Video' : isAudio ? 'Audio' : 'Image'}
                              </div>
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Reviewer Notes */}
                  {update.status === 'pending' && (
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Reviewer Notes (optional)</label>
                      <textarea
                        value={reviewerNotes[update.id] || ''}
                        onChange={(e) => setReviewerNotes(prev => ({ ...prev, [update.id]: e.target.value }))}
                        placeholder="Add notes for internal records..."
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:border-blue-500 outline-none resize-none"
                        rows={2}
                      />
                    </div>
                  )}

                  {/* Actions */}
                  {update.status === 'pending' && (
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => handleAction(update.id, 'reject')}
                        disabled={processingId === update.id}
                        className="flex-1 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleAction(update.id, 'approve')}
                        disabled={processingId === update.id}
                        className="flex-1 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {processingId === update.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-green-300/30 border-t-green-300 rounded-full animate-spin" />
                            Processing...
                          </>
                        ) : (
                          'Approve & Update NFT'
                        )}
                      </button>
                    </div>
                  )}

                  {/* Already reviewed */}
                  {update.status !== 'pending' && update.reviewer_notes && (
                    <div className="rounded-lg bg-white/5 p-3">
                      <div className="text-xs text-white/40 mb-1">Reviewer Notes</div>
                      <div className="text-sm text-white/60">{update.reviewer_notes}</div>
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
