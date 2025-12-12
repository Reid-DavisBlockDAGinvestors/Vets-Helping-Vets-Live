'use client'

import { useState, useEffect } from 'react'

type Vote = {
  id: string
  voterWallet: string
  voterEmail: string | null
  voterName: string | null
  support: boolean
  nftsOwned: number
  campaignsCreated: number
  totalDonated: number
  createdAt: string
}

type Proposal = {
  id: number
  title: string
  description: string
  category: string
  submitterName: string | null
  submitterEmail: string | null
  submitterWallet: string | null
  submitterNftsOwned: number
  submitterCampaignsCreated: number
  submitterTotalDonated: number
  yesVotes: number
  noVotes: number
  open: boolean
  status: string
  adminNotes: string | null
  createdAt: string
}

const CATEGORIES: Record<string, { label: string; icon: string }> = {
  'expand_disasters': { label: 'Expand to Disaster Relief', icon: '🌊' },
  'expand_children': { label: 'Expand to Children\'s Causes', icon: '👧' },
  'expand_medical': { label: 'Expand to Medical Needs', icon: '🏥' },
  'fee_adjustment': { label: 'Adjust Platform Fees', icon: '💰' },
  'feature_request': { label: 'New Feature Request', icon: '✨' },
  'general': { label: 'General Improvement', icon: '📋' },
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-300',
  approved: 'bg-green-500/20 text-green-300',
  rejected: 'bg-red-500/20 text-red-300',
  implemented: 'bg-blue-500/20 text-blue-300',
}

export default function AdminGovernance() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [selected, setSelected] = useState<Proposal | null>(null)
  const [notes, setNotes] = useState('')
  const [updating, setUpdating] = useState(false)
  const [votes, setVotes] = useState<Vote[]>([])
  const [loadingVotes, setLoadingVotes] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/gov/proposals?admin=true')
      const data = await res.json()
      setProposals(data?.items || [])
    } catch (e) {
      console.error('Failed to load proposals:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Load votes when a proposal is selected
  const loadVotes = async (proposalId: number) => {
    setLoadingVotes(true)
    try {
      const res = await fetch(`/api/gov/votes?proposal_id=${proposalId}`)
      const data = await res.json()
      setVotes(data?.votes || [])
    } catch (e) {
      console.error('Failed to load votes:', e)
      setVotes([])
    } finally {
      setLoadingVotes(false)
    }
  }

  const selectProposal = (p: Proposal) => {
    setSelected(p)
    setNotes(p.adminNotes || '')
    if (p.yesVotes > 0 || p.noVotes > 0) {
      loadVotes(p.id)
    } else {
      setVotes([])
    }
  }

  const updateProposal = async (id: number, updates: { status?: string; open?: boolean; admin_notes?: string }) => {
    setUpdating(true)
    try {
      const res = await fetch('/api/gov/proposals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates })
      })
      if (!res.ok) throw new Error('Update failed')
      await load()
      setSelected(null)
    } catch (e) {
      alert('Failed to update proposal')
    } finally {
      setUpdating(false)
    }
  }

  const approve = (p: Proposal) => {
    updateProposal(p.id, { status: 'approved', open: true, admin_notes: notes || undefined })
  }

  const reject = (p: Proposal) => {
    if (!notes.trim()) return alert('Please add a reason for rejection')
    updateProposal(p.id, { status: 'rejected', open: false, admin_notes: notes })
  }

  const implement = (p: Proposal) => {
    updateProposal(p.id, { status: 'implemented', open: false, admin_notes: notes || undefined })
  }

  const close = (p: Proposal) => {
    updateProposal(p.id, { open: false })
  }

  const filtered = proposals.filter(p => {
    if (filter === 'all') return true
    return p.status === filter
  })

  const getCat = (cat: string) => CATEGORIES[cat] || { label: cat, icon: '📋' }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Governance Proposals</h2>
          <p className="text-white/50">Review and manage community proposals</p>
        </div>
        <button onClick={load} disabled={loading} className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-50">
          {loading ? 'Loading...' : '↻ Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Pending', count: proposals.filter(p => p.status === 'pending').length, color: 'yellow' },
          { label: 'Approved', count: proposals.filter(p => p.status === 'approved').length, color: 'green' },
          { label: 'Rejected', count: proposals.filter(p => p.status === 'rejected').length, color: 'red' },
          { label: 'Implemented', count: proposals.filter(p => p.status === 'implemented').length, color: 'blue' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl bg-${s.color}-500/10 border border-${s.color}-500/20 p-4`}>
            <div className={`text-3xl font-bold text-${s.color}-400`}>{s.count}</div>
            <div className="text-white/50 text-sm">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <button 
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium capitalize transition-all ${filter === f ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
          >
            {f} {f !== 'all' && `(${proposals.filter(p => p.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Proposals List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-white/50">Loading proposals...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-white/5 border border-white/10 p-12 text-center">
          <div className="text-5xl mb-4">📭</div>
          <h3 className="text-xl font-semibold text-white mb-2">No {filter !== 'all' ? filter : ''} Proposals</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const cat = getCat(p.category)
            const totalVotes = p.yesVotes + p.noVotes
            
            return (
              <div 
                key={p.id} 
                className={`rounded-xl bg-white/5 border border-white/10 p-5 hover:bg-white/[0.07] transition-all cursor-pointer ${selected?.id === p.id ? 'ring-2 ring-purple-500' : ''}`}
                onClick={() => selectProposal(p)}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-xl flex-shrink-0">
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-white">{p.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || 'bg-white/10 text-white/50'}`}>
                        {p.status}
                      </span>
                      {p.open && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-300">Open</span>}
                    </div>
                    <p className="text-sm text-white/50 mb-2">{cat.label}</p>
                    <p className="text-white/70 text-sm line-clamp-2 mb-2">{p.description}</p>
                    
                    {/* Submitter Info */}
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="text-white/50">By: {p.submitterName || 'Anonymous'}</span>
                      {p.submitterWallet && (
                        <span className="font-mono text-white/40">{p.submitterWallet.slice(0,6)}...{p.submitterWallet.slice(-4)}</span>
                      )}
                      <div className="flex gap-2 ml-auto">
                        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">{p.submitterNftsOwned} NFTs</span>
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">{p.submitterCampaignsCreated} Campaigns</span>
                        <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-300">${p.submitterTotalDonated.toFixed(0)}</span>
                      </div>
                    </div>
                    
                    {totalVotes > 0 && (
                      <p className="text-xs text-white/40 mt-2">👍 {p.yesVotes} / 👎 {p.noVotes} votes</p>
                    )}
                  </div>
                  <div className="text-xs text-white/40">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Action Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">{selected.title}</h3>
                <button onClick={() => setSelected(null)} className="text-white/50 hover:text-white text-2xl">&times;</button>
              </div>
              <p className="text-white/50 text-sm mt-1">
                {getCat(selected.category).icon} {getCat(selected.category).label} • 
                Status: <span className={`${STATUS_COLORS[selected.status]} px-2 py-0.5 rounded-full text-xs`}>{selected.status}</span>
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Submitter Info Card */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <h4 className="text-sm font-medium text-white/70 mb-3">Submitter Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-white/40">Name</div>
                    <div className="text-white">{selected.submitterName || 'Anonymous'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/40">Email</div>
                    <div className="text-white">{selected.submitterEmail || 'Not provided'}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-white/40">Wallet Address</div>
                    <div className="text-white font-mono text-sm break-all">{selected.submitterWallet || 'Not connected'}</div>
                  </div>
                </div>
                
                {/* Participation Stats */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="text-xs text-white/40 mb-2">Platform Participation (at time of submission)</div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3">
                      <div className="text-2xl font-bold text-purple-400">{selected.submitterNftsOwned}</div>
                      <div className="text-xs text-purple-300/70">NFTs Owned</div>
                    </div>
                    <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                      <div className="text-2xl font-bold text-blue-400">{selected.submitterCampaignsCreated}</div>
                      <div className="text-xs text-blue-300/70">Campaigns Created</div>
                    </div>
                    <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
                      <div className="text-2xl font-bold text-green-400">${selected.submitterTotalDonated.toFixed(0)}</div>
                      <div className="text-xs text-green-300/70">Total Donated</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-white/70 mb-1">Proposal Description</h4>
                <p className="text-white/90 whitespace-pre-wrap">{selected.description}</p>
              </div>

              {(selected.yesVotes > 0 || selected.noVotes > 0) && (
                <div>
                  <h4 className="text-sm font-medium text-white/70 mb-2">Votes Summary</h4>
                  <div className="flex gap-4 mb-4">
                    <span className="text-green-400">👍 {selected.yesVotes} Yes</span>
                    <span className="text-red-400">👎 {selected.noVotes} No</span>
                  </div>
                  
                  {/* Voter Details */}
                  <h4 className="text-sm font-medium text-white/70 mb-2">Voter Details</h4>
                  {loadingVotes ? (
                    <div className="text-center py-4 text-white/40">Loading voters...</div>
                  ) : votes.length === 0 ? (
                    <div className="text-center py-4 text-white/40">No vote records found</div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {votes.map(v => (
                        <div key={v.id} className={`rounded-lg p-3 ${v.support ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`font-medium ${v.support ? 'text-green-300' : 'text-red-300'}`}>
                              {v.support ? '👍 Yes' : '👎 No'} - {v.voterName || 'Anonymous'}
                            </span>
                            <span className="text-xs text-white/40">{new Date(v.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="text-xs text-white/50 font-mono mb-2">{v.voterWallet}</div>
                          <div className="flex gap-2 text-xs">
                            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">{v.nftsOwned} NFTs</span>
                            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">{v.campaignsCreated} Campaigns</span>
                            <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-300">${v.totalDonated.toFixed(0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <div>
                <h4 className="text-sm font-medium text-white/70 mb-1">Admin Notes</h4>
                <textarea 
                  className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500/50 min-h-[100px]"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add notes (required for rejection)"
                />
              </div>
            </div>

            <div className="p-6 border-t border-white/10 flex gap-3 flex-wrap">
              {selected.status === 'pending' && (
                <>
                  <button 
                    onClick={() => approve(selected)}
                    disabled={updating}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-500 disabled:opacity-50"
                  >
                    ✓ Approve & Open for Voting
                  </button>
                  <button 
                    onClick={() => reject(selected)}
                    disabled={updating}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-500 disabled:opacity-50"
                  >
                    ✕ Reject
                  </button>
                </>
              )}
              {selected.status === 'approved' && selected.open && (
                <>
                  <button 
                    onClick={() => implement(selected)}
                    disabled={updating}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50"
                  >
                    🚀 Mark as Implemented
                  </button>
                  <button 
                    onClick={() => close(selected)}
                    disabled={updating}
                    className="px-4 py-2 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 disabled:opacity-50"
                  >
                    Close Voting
                  </button>
                </>
              )}
              <button 
                onClick={() => setSelected(null)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
