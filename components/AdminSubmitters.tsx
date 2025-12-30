'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

interface SubmitterData {
  email: string
  name: string | null
  phone: string | null
  wallet_address: string | null
  campaigns_count: number
  minted_count: number
  pending_count: number
  approved_count: number
  total_raised_usd: number
  total_nfts_sold: number
  first_submission: string
  last_submission: string
}

interface Campaign {
  id: string
  title: string
  status: string
  category: string
  goal: number
  raised: number
  nfts_sold: number
  created_at: string
  image_uri: string | null
}

export default function AdminSubmitters() {
  const [submitters, setSubmitters] = useState<SubmitterData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedSubmitter, setSelectedSubmitter] = useState<SubmitterData | null>(null)
  const [submitterCampaigns, setSubmitterCampaigns] = useState<Campaign[]>([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'campaigns_count' | 'total_raised_usd' | 'last_submission'>('last_submission')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const loadSubmitters = async () => {
    setLoading(true)
    setError('')
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) {
        setError('Not authenticated')
        return
      }

      const res = await fetch('/api/admin/submitters', {
        headers: { authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      
      if (!res.ok) {
        setError(data?.error || 'Failed to load submitters')
        return
      }
      
      setSubmitters(data?.submitters || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load submitters')
    } finally {
      setLoading(false)
    }
  }

  const loadSubmitterCampaigns = async (email: string) => {
    setLoadingCampaigns(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) return

      const res = await fetch(`/api/admin/submitters/${encodeURIComponent(email)}/campaigns`, {
        headers: { authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      
      if (res.ok) {
        setSubmitterCampaigns(data?.campaigns || [])
      }
    } catch (e) {
      logger.error('Failed to load campaigns:', e)
    } finally {
      setLoadingCampaigns(false)
    }
  }

  useEffect(() => {
    loadSubmitters()
  }, [])

  useEffect(() => {
    if (selectedSubmitter) {
      loadSubmitterCampaigns(selectedSubmitter.email)
    }
  }, [selectedSubmitter])

  const filteredSubmitters = submitters
    .filter(s => 
      !searchTerm || 
      s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aVal: any = a[sortBy]
      let bVal: any = b[sortBy]
      if (sortBy === 'last_submission') {
        aVal = new Date(aVal || 0).getTime()
        bVal = new Date(bVal || 0).getTime()
      }
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1
      }
      return aVal < bVal ? 1 : -1
    })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'minted': return 'bg-green-500/20 text-green-400'
      case 'approved': return 'bg-blue-500/20 text-blue-400'
      case 'pending': return 'bg-yellow-500/20 text-yellow-400'
      case 'rejected': return 'bg-red-500/20 text-red-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-blue-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-white/50">Loading submitters...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Campaign Submitters</h2>
          <p className="text-white/50 text-sm">{submitters.length} unique submitters</p>
        </div>
        <button
          onClick={loadSubmitters}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by email or name..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-1 rounded-lg bg-white/10 border border-white/10 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
        />
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="flex-1 sm:flex-none rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none"
          >
            <option value="last_submission" className="bg-gray-800">Last Submission</option>
            <option value="campaigns_count" className="bg-gray-800">Campaigns</option>
            <option value="total_raised_usd" className="bg-gray-800">Total Raised</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-colors"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Submitters - Desktop Table */}
      <div className="hidden md:block rounded-xl bg-white/5 border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left p-4 text-white/70 font-medium">Submitter</th>
              <th className="text-right p-4 text-white/70 font-medium">Campaigns</th>
              <th className="text-right p-4 text-white/70 font-medium">Minted</th>
              <th className="text-right p-4 text-white/70 font-medium">NFTs Sold</th>
              <th className="text-right p-4 text-white/70 font-medium">Total Raised</th>
              <th className="text-left p-4 text-white/70 font-medium">Last Submission</th>
              <th className="text-center p-4 text-white/70 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSubmitters.map(submitter => (
              <tr key={submitter.email} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-4">
                  <div>
                    <div className="font-medium text-white">{submitter.name || 'No name'}</div>
                    <div className="text-sm text-white/50">{submitter.email}</div>
                    {submitter.phone && (
                      <div className="text-xs text-white/40">{submitter.phone}</div>
                    )}
                  </div>
                </td>
                <td className="p-4 text-right">
                  <span className="text-white font-medium">{submitter.campaigns_count || 0}</span>
                  <div className="text-xs text-white/40">
                    {submitter.pending_count > 0 && <span className="text-yellow-400">{submitter.pending_count} pending</span>}
                  </div>
                </td>
                <td className="p-4 text-right">
                  <span className="text-green-400 font-medium">{submitter.minted_count || 0}</span>
                </td>
                <td className="p-4 text-right">
                  <span className="text-purple-400 font-medium">{submitter.total_nfts_sold || 0}</span>
                </td>
                <td className="p-4 text-right">
                  <span className="text-green-400 font-medium">${(submitter.total_raised_usd || 0).toFixed(2)}</span>
                </td>
                <td className="p-4 text-white/70 text-sm">
                  {submitter.last_submission ? new Date(submitter.last_submission).toLocaleDateString() : 'N/A'}
                </td>
                <td className="p-4 text-center">
                  <button
                    onClick={() => setSelectedSubmitter(submitter)}
                    className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm transition-colors"
                  >
                    View Campaigns
                  </button>
                </td>
              </tr>
            ))}
            {filteredSubmitters.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-white/40">
                  {searchTerm ? 'No submitters match your search' : 'No submitters found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Submitters - Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filteredSubmitters.map(submitter => (
          <div key={submitter.email} className="rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="mb-3">
              <div className="font-medium text-white">{submitter.name || 'No name'}</div>
              <div className="text-sm text-white/50 truncate">{submitter.email}</div>
              {submitter.phone && (
                <div className="text-xs text-white/40">{submitter.phone}</div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-lg font-bold text-white">{submitter.campaigns_count || 0}</div>
                <div className="text-xs text-white/50">Campaigns</div>
                {submitter.pending_count > 0 && (
                  <div className="text-xs text-yellow-400">{submitter.pending_count} pending</div>
                )}
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-lg font-bold text-green-400">{submitter.minted_count || 0}</div>
                <div className="text-xs text-white/50">Minted</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-lg font-bold text-purple-400">{submitter.total_nfts_sold || 0}</div>
                <div className="text-xs text-white/50">NFTs Sold</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-lg font-bold text-green-400">${(submitter.total_raised_usd || 0).toFixed(0)}</div>
                <div className="text-xs text-white/50">Raised</div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
              <span className="text-xs text-white/50">
                Last: {submitter.last_submission ? new Date(submitter.last_submission).toLocaleDateString() : 'N/A'}
              </span>
              <button
                onClick={() => setSelectedSubmitter(submitter)}
                className="px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium transition-colors"
              >
                View Campaigns
              </button>
            </div>
          </div>
        ))}
        {filteredSubmitters.length === 0 && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-8 text-center text-white/40">
            {searchTerm ? 'No submitters match your search' : 'No submitters found'}
          </div>
        )}
      </div>

      {/* Submitter Detail Modal */}
      {selectedSubmitter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedSubmitter.name || 'No name'}</h2>
                <p className="text-white/50">{selectedSubmitter.email}</p>
                {selectedSubmitter.phone && (
                  <p className="text-white/40 text-sm">{selectedSubmitter.phone}</p>
                )}
                {selectedSubmitter.wallet_address && (
                  <p className="text-white/40 text-xs font-mono mt-1">
                    Wallet: {selectedSubmitter.wallet_address.slice(0, 10)}...{selectedSubmitter.wallet_address.slice(-8)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedSubmitter(null)}
                className="text-white/50 hover:text-white p-2 rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400">{selectedSubmitter.campaigns_count || 0}</div>
                  <div className="text-sm text-white/50">Total Campaigns</div>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{selectedSubmitter.minted_count || 0}</div>
                  <div className="text-sm text-white/50">Minted</div>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400">{selectedSubmitter.total_nfts_sold || 0}</div>
                  <div className="text-sm text-white/50">NFTs Sold</div>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">${(selectedSubmitter.total_raised_usd || 0).toFixed(2)}</div>
                  <div className="text-sm text-white/50">Total Raised</div>
                </div>
              </div>

              {/* Campaigns */}
              <h3 className="text-lg font-semibold text-white mb-4">Campaigns</h3>
              {loadingCampaigns ? (
                <div className="text-center py-8 text-white/40">Loading campaigns...</div>
              ) : submitterCampaigns.length > 0 ? (
                <div className="space-y-3">
                  {submitterCampaigns.map(c => (
                    <div key={c.id} className="rounded-lg bg-white/5 border border-white/10 p-4 flex items-center gap-4">
                      {c.image_uri && (
                        <img 
                          src={c.image_uri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')} 
                          alt="" 
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{c.title}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(c.status)}`}>
                            {c.status}
                          </span>
                        </div>
                        <div className="text-sm text-white/50 mt-1">
                          {c.category} • Created {new Date(c.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-medium">${c.raised?.toFixed(2) || '0.00'} / ${c.goal || 0}</div>
                        <div className="text-sm text-purple-400">{c.nfts_sold || 0} NFTs sold</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-white/40">No campaigns found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
