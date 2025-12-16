'use client'

import { useEffect, useState } from 'react'
import { useWallet } from '@/hooks/useWallet'

type Proposal = {
  id: number
  title: string
  description: string
  category: string
  yesVotes: number
  noVotes: number
  open: boolean
  status: string
  createdAt?: string
}

type Participation = {
  nftsOwned: number
  campaignsCreated: number
  totalDonated: number
  loaded: boolean
}

const CATEGORIES = [
  { value: 'expand_disasters', label: 'Expand to Disaster Relief', icon: '🌊' },
  { value: 'expand_children', label: 'Expand to Children\'s Causes', icon: '👧' },
  { value: 'expand_medical', label: 'Expand to Medical Needs', icon: '🏥' },
  { value: 'fee_adjustment', label: 'Adjust Platform Fees', icon: '💰' },
  { value: 'feature_request', label: 'New Feature Request', icon: '✨' },
  { value: 'general', label: 'General Improvement', icon: '📋' },
]

export default function GovernancePage() {
  const { address, isConnected, connectAuto, isConnecting } = useWallet()
  const [list, setList] = useState<Proposal[]>([])
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [cat, setCat] = useState('general')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [tab, setTab] = useState<'active' | 'closed'>('active')
  const [participation, setParticipation] = useState<Participation>({ nftsOwned: 0, campaignsCreated: 0, totalDonated: 0, loaded: false })
  const [votingId, setVotingId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/gov/proposals')
      if (res.ok) setList((await res.json())?.items || [])
    } catch {} finally { setLoading(false) }
  }

  // Load participation data when wallet is connected
  const loadParticipation = async (wallet: string) => {
    try {
      const res = await fetch(`/api/gov/participation?wallet=${wallet}`)
      if (res.ok) {
        const data = await res.json()
        setParticipation({
          nftsOwned: data.nftsOwned || 0,
          campaignsCreated: data.campaignsCreated || 0,
          totalDonated: data.totalDonated || 0,
          loaded: true
        })
      }
    } catch (e) {
      console.error('Failed to load participation:', e)
    }
  }

  useEffect(() => { load() }, [])
  
  useEffect(() => {
    if (isConnected && address) {
      loadParticipation(address)
    } else {
      setParticipation({ nftsOwned: 0, campaignsCreated: 0, totalDonated: 0, loaded: false })
    }
  }, [isConnected, address])

  const create = async () => {
    if (!isConnected || !address) return alert('Please connect your wallet first')
    if (!title?.trim() || !desc?.trim()) return alert('Title and description are required')
    if (!name?.trim() || !email?.trim()) return alert('Your name and email are required')
    
    setSubmitting(true)
    try {
      const res = await fetch('/api/gov/proposals', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          title: title.trim(), 
          description: desc.trim(), 
          category: cat,
          submitter_name: name.trim(),
          submitter_email: email.trim(),
          submitter_wallet: address,
          submitter_nfts_owned: participation.nftsOwned,
          submitter_campaigns_created: participation.campaignsCreated,
          submitter_total_donated: participation.totalDonated
        }) 
      })
      if (!res.ok) throw new Error('Failed to submit proposal')
      setTitle(''); setDesc('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 5000)
      await load()
    } catch (e:any) {
      alert(e?.message || 'Failed to create proposal')
    } finally { setSubmitting(false) }
  }

  const vote = async (id: number, support: boolean) => {
    if (!isConnected || !address) {
      alert('Please connect your wallet to vote')
      return
    }
    
    setVotingId(id)
    try {
      const res = await fetch('/api/gov/vote', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          id, 
          support,
          voter_wallet: address,
          voter_email: email || undefined,
          voter_name: name || undefined,
          nfts_owned: participation.nftsOwned,
          campaigns_created: participation.campaignsCreated,
          total_donated: participation.totalDonated
        }) 
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Vote failed')
      }
      await load()
    } catch (e:any) { 
      alert(e?.message || 'Vote failed') 
    } finally {
      setVotingId(null)
    }
  }

  const activeProposals = list.filter(p => p.open)
  const closedProposals = list.filter(p => !p.open)
  const displayList = tab === 'active' ? activeProposals : closedProposals

  const getCategoryInfo = (cat: string) => CATEGORIES.find(c => c.value === cat) || { label: cat, icon: '📋' }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-900/40 via-purple-900/30 to-transparent">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="container mx-auto px-4 py-16 relative">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Community <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Governance</span>
            </h1>
            <p className="text-xl text-white/70">
              Shape the future of Vets Helping Vets. Submit proposals, vote on changes, and help us expand our mission.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Submit Proposal Card */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 sticky top-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-2xl">
                  💡
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Submit a Proposal</h2>
                  <p className="text-sm text-white/50">Share your ideas with the community</p>
                </div>
              </div>

              {/* Wallet Connection Required */}
              {!isConnected ? (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-5 text-center mb-4">
                  <div className="text-3xl mb-2">🔐</div>
                  <h3 className="font-semibold text-amber-300 mb-2">Connect Your Wallet</h3>
                  <p className="text-sm text-white/60 mb-4">You must connect your wallet to submit proposals or vote. This helps us verify your platform participation.</p>
                  <button 
                    onClick={connectAuto}
                    disabled={isConnecting}
                    className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium hover:from-amber-400 hover:to-orange-400 disabled:opacity-50"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                  </button>
                </div>
              ) : (
                <>
                  {/* Wallet & Participation Stats */}
                  <div className="rounded-xl bg-white/5 border border-white/10 p-4 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-sm text-green-400 font-medium">Wallet Connected</span>
                    </div>
                    <div className="text-xs text-white/50 font-mono mb-3 break-all">{address}</div>
                    
                    {participation.loaded ? (
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-white/5 p-2">
                          <div className="text-lg font-bold text-purple-400">{participation.nftsOwned}</div>
                          <div className="text-xs text-white/40">NFTs Owned</div>
                        </div>
                        <div className="rounded-lg bg-white/5 p-2">
                          <div className="text-lg font-bold text-blue-400">{participation.campaignsCreated}</div>
                          <div className="text-xs text-white/40">Campaigns</div>
                        </div>
                        <div className="rounded-lg bg-white/5 p-2">
                          <div className="text-lg font-bold text-green-400">${participation.totalDonated.toFixed(0)}</div>
                          <div className="text-xs text-white/40">Donated</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-white/40 text-sm py-2">Loading participation data...</div>
                    )}
                  </div>

                  {success ? (
                    <div className="rounded-xl bg-green-500/20 border border-green-500/30 p-4 text-center">
                      <div className="text-3xl mb-2">✅</div>
                      <h3 className="font-semibold text-green-300">Proposal Submitted!</h3>
                      <p className="text-sm text-white/70 mt-1">Our team will review it and it will appear for voting once approved.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-1">Your Name *</label>
                        <input 
                          className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500/50" 
                          value={name} 
                          onChange={e => setName(e.target.value)}
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-1">Your Email *</label>
                        <input 
                          type="email"
                          className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500/50" 
                          value={email} 
                          onChange={e => setEmail(e.target.value)}
                          placeholder="john@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-1">Category</label>
                        <select 
                          className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white focus:outline-none focus:border-purple-500/50"
                          value={cat} 
                          onChange={e => setCat(e.target.value)}
                        >
                          {CATEGORIES.map(c => (
                            <option key={c.value} value={c.value} className="bg-gray-900">{c.icon} {c.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-1">Proposal Title *</label>
                        <input 
                          className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500/50" 
                          value={title} 
                          onChange={e => setTitle(e.target.value)}
                          placeholder="Brief, descriptive title"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-1">Description *</label>
                        <textarea 
                          className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500/50 min-h-[120px]" 
                          value={desc} 
                          onChange={e => setDesc(e.target.value)}
                          placeholder="Explain your proposal in detail. Why is this important? How would it benefit the community?"
                        />
                      </div>
                      <button 
                        disabled={submitting || !participation.loaded} 
                        onClick={create} 
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {submitting ? 'Submitting...' : 'Submit Proposal'}
                      </button>
                      <p className="text-xs text-white/40 text-center">Your wallet and participation stats will be attached to this proposal for admin review.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Proposals List */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              <button 
                onClick={() => setTab('active')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${tab === 'active' ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
              >
                Active Proposals ({activeProposals.length})
              </button>
              <button 
                onClick={() => setTab('closed')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${tab === 'closed' ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
              >
                Closed ({closedProposals.length})
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-white/50">Loading proposals...</p>
              </div>
            ) : displayList.length === 0 ? (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-12 text-center">
                <div className="text-5xl mb-4">{tab === 'active' ? '📭' : '📦'}</div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {tab === 'active' ? 'No Active Proposals' : 'No Closed Proposals'}
                </h3>
                <p className="text-white/50">
                  {tab === 'active' ? 'Be the first to submit a proposal!' : 'Closed proposals will appear here.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {displayList.map(p => {
                  const catInfo = getCategoryInfo(p.category)
                  const totalVotes = p.yesVotes + p.noVotes
                  const yesPercent = totalVotes > 0 ? Math.round((p.yesVotes / totalVotes) * 100) : 0
                  
                  return (
                    <div key={p.id} className="rounded-2xl bg-white/5 border border-white/10 p-6 hover:bg-white/[0.07] transition-all">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl flex-shrink-0">
                          {catInfo.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="text-lg font-semibold text-white">{p.title}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.open ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-white/50'}`}>
                              {p.open ? 'Open for Voting' : 'Closed'}
                            </span>
                            {p.status === 'implemented' && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300">
                                Implemented
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-white/50 mb-3">{catInfo.label}</p>
                          <p className="text-white/80 mb-4">{p.description}</p>
                          
                          {/* Vote Bar */}
                          <div className="mb-3">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-green-400">👍 {p.yesVotes} Yes ({yesPercent}%)</span>
                              <span className="text-red-400">👎 {p.noVotes} No ({100 - yesPercent}%)</span>
                            </div>
                            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all" 
                                style={{ width: `${yesPercent}%` }}
                              />
                            </div>
                            <p className="text-xs text-white/40 mt-1">{totalVotes} total votes</p>
                          </div>

                          {/* Vote Buttons */}
                          {p.open && (
                            <div>
                              {!isConnected ? (
                                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-center">
                                  <p className="text-sm text-amber-300">🔐 Connect your wallet to vote</p>
                                  <p className="text-xs text-white/50 mt-1">Use the Connect Wallet button in the header</p>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => vote(p.id, true)} 
                                    disabled={votingId === p.id}
                                    className="flex-1 py-2 rounded-lg bg-green-500/20 text-green-300 font-medium hover:bg-green-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {votingId === p.id ? '...' : '👍 Vote Yes'}
                                  </button>
                                  <button 
                                    onClick={() => vote(p.id, false)} 
                                    disabled={votingId === p.id}
                                    className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-300 font-medium hover:bg-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {votingId === p.id ? '...' : '👎 Vote No'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
