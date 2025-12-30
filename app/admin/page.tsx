'use client'

import { useEffect, useState } from 'react'
import AdminCampaignHub from '@/components/AdminCampaignHubV2'
import AdminGovernance from '@/components/AdminGovernance'
import AdminUsers from '@/components/AdminUsersV2'
import AdminSubmitters from '@/components/AdminSubmitters'
import AdminBugReports from '@/components/AdminBugReports'
import AdminSettings from '@/components/AdminSettings'
import { supabase } from '@/lib/supabase'

type AdminTab = 'campaigns' | 'users' | 'submitters' | 'governance' | 'bugs' | 'settings'

export default function AdminPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [showMilestoneModal, setShowMilestoneModal] = useState(false)
  const [showPurchasesModal, setShowPurchasesModal] = useState(false)
  const [purchases, setPurchases] = useState<any[]>([])
  const [purchasesLoading, setPurchasesLoading] = useState(false)
  const [purchasesSummary, setPurchasesSummary] = useState<any>(null)
  const [authMsg, setAuthMsg] = useState('')
  const [activeTab, setActiveTab] = useState<AdminTab>('campaigns')
  const [checkingSession, setCheckingSession] = useState(true)
  
  // Admin request state (for login form only)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [requestName, setRequestName] = useState('')
  const [requestReason, setRequestReason] = useState('')
  const [requestedRole, setRequestedRole] = useState<'admin' | 'moderator' | 'viewer'>('admin')
  const [requestMsg, setRequestMsg] = useState('')
  const [requestLoading, setRequestLoading] = useState(false)
  const [userPermissions, setUserPermissions] = useState<any>(null)

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        const token = session?.session?.access_token
        if (token) {
          const res = await fetch('/api/admin/me', { headers: { authorization: `Bearer ${token}` } })
          const data = await res.json().catch(() => ({}))
          // Allow any role with dashboard access
          const validRoles = ['super_admin', 'admin', 'moderator', 'viewer']
          if (res.ok && validRoles.includes(data?.role)) {
            setAuthed(true)
            setUserPermissions(data?.permissions || {})
          }
        }
      } catch (e) {
        console.error('Session check error:', e)
      } finally {
        setCheckingSession(false)
      }
    }
    checkSession()
  }, [])

  const login = async () => {
    setAuthMsg('')
    try {
      if (!email || !password) {
        setAuthMsg('Email and password required')
        return
      }

      let { error: signErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signErr) {
        const { error: suErr } = await supabase.auth.signUp({ email, password })
        if (suErr) { setAuthMsg(signErr.message || suErr.message || 'Sign-in failed'); return }
        const r = await supabase.auth.signInWithPassword({ email, password })
        signErr = r.error
        if (signErr) { setAuthMsg(signErr.message || 'Sign-in failed'); return }
      }

      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) { setAuthMsg('Missing session token'); return }

      const res = await fetch('/api/admin/me', { headers: { authorization: `Bearer ${token}` } })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) { setAuthMsg(data?.error || 'Unauthorized'); return }
      const validRoles = ['super_admin', 'admin', 'moderator', 'viewer']
      if (!validRoles.includes(data?.role || 'user')) { setAuthMsg('Unauthorized: not an admin'); return }
      setAuthed(true)
      setUserPermissions(data?.permissions || {})
    } catch (e:any) {
      setAuthMsg(e?.message || 'Auth failed')
    }
  }

  const logout = async () => {
    try { await supabase.auth.signOut() } catch {}
    setAuthed(false)
    setEmail('')
    setPassword('')
  }

  // Load all purchases for modal
  const loadPurchases = async () => {
    setPurchasesLoading(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) return

      const res = await fetch('/api/admin/purchases?limit=500', {
        headers: { authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setPurchases(data?.purchases || [])
        setPurchasesSummary(data?.summary || null)
      }
    } catch (e) {
      console.error('Failed to load purchases:', e)
    } finally {
      setPurchasesLoading(false)
    }
  }

  // Open purchases modal
  const openPurchasesModal = () => {
    setShowPurchasesModal(true)
    loadPurchases()
  }

  // Submit admin access request
  const submitRequest = async () => {
    setRequestMsg('')
    setRequestLoading(true)
    try {
      // First sign in or create account
      let { error: signErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signErr) {
        const { error: suErr } = await supabase.auth.signUp({ email, password })
        if (suErr) { setRequestMsg(signErr.message || suErr.message || 'Sign-in failed'); return }
        const r = await supabase.auth.signInWithPassword({ email, password })
        signErr = r.error
        if (signErr) { setRequestMsg(signErr.message || 'Sign-in failed'); return }
      }

      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) { setRequestMsg('Missing session token'); return }

      const res = await fetch('/api/admin/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: requestName, reason: requestReason, requestedRole })
      })
      const data = await res.json().catch(() => ({}))
      
      if (res.ok) {
        setRequestMsg('✅ Request submitted! An admin will review your request.')
        setShowRequestForm(false)
        setRequestName('')
        setRequestReason('')
      } else {
        setRequestMsg(data?.message || data?.error || 'Request failed')
      }
    } catch (e: any) {
      setRequestMsg(e?.message || 'Request failed')
    } finally {
      setRequestLoading(false)
    }
  }

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) setAuthed(false)
    })
    return () => {
      try { sub.data?.subscription?.unsubscribe?.() } catch {}
    }
  }, [])

  useEffect(() => {
    if (!authed) return
    const run = async () => {
      try {
        const res = await fetch('/api/analytics/summary')
        if (res.ok) setSummary(await res.json())
      } catch {}
    }
    run()
  }, [authed])

  // Loading screen while checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-blue-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-white/50">Checking session...</p>
        </div>
      </div>
    )
  }

  // Login screen
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md px-4">
          <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 sm:p-8">
            <div className="text-center mb-6 sm:mb-8">
              <div className="text-4xl mb-3">{showRequestForm ? '📝' : '🔐'}</div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                {showRequestForm ? 'Request Admin Access' : 'Admin Login'}
              </h1>
              <p className="mt-2 text-white/50 text-sm">
                {showRequestForm 
                  ? 'Submit a request to become an admin' 
                  : 'Sign in to access the admin dashboard'}
              </p>
            </div>
            <div className="space-y-4">
              <input 
                className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
                placeholder="Email" 
                type="email" 
                value={email} 
                onChange={e=>setEmail(e.target.value)} 
              />
              <input 
                className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
                placeholder="Password" 
                type="password" 
                value={password} 
                onChange={e=>setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (showRequestForm ? submitRequest() : login())}
              />
              
              {showRequestForm && (
                <>
                  <input 
                    className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
                    placeholder="Your Name" 
                    type="text" 
                    value={requestName} 
                    onChange={e=>setRequestName(e.target.value)} 
                  />
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Access Level Requested</label>
                    <select
                      className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white focus:outline-none focus:border-blue-500/50"
                      value={requestedRole}
                      onChange={e => setRequestedRole(e.target.value as any)}
                    >
                      <option value="admin" className="bg-gray-800">Admin - Full campaign management</option>
                      <option value="moderator" className="bg-gray-800">Moderator - Approve updates only</option>
                      <option value="viewer" className="bg-gray-800">Viewer - Read-only access</option>
                    </select>
                  </div>
                  <textarea 
                    className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 min-h-[80px]" 
                    placeholder="Why do you need admin access?" 
                    value={requestReason} 
                    onChange={e=>setRequestReason(e.target.value)} 
                  />
                </>
              )}
              
              {showRequestForm ? (
                <button 
                  className="w-full rounded-lg bg-green-600 hover:bg-green-500 px-4 py-3 font-medium text-white transition-colors disabled:opacity-50" 
                  onClick={submitRequest}
                  disabled={requestLoading || !email || !password}
                >
                  {requestLoading ? 'Submitting...' : 'Submit Request'}
                </button>
              ) : (
                <button 
                  className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-3 font-medium text-white transition-colors" 
                  onClick={login}
                >
                  Login
                </button>
              )}
              
              <button 
                className="w-full rounded-lg bg-white/5 hover:bg-white/10 px-4 py-2.5 text-sm text-white/70 transition-colors" 
                onClick={() => {
                  setShowRequestForm(!showRequestForm)
                  setAuthMsg('')
                  setRequestMsg('')
                }}
              >
                {showRequestForm ? '← Back to Login' : 'Need access? Request here →'}
              </button>
              
              {authMsg && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-red-400 text-sm text-center">
                  {authMsg}
                </div>
              )}
              {requestMsg && (
                <div className={`rounded-lg p-3 text-sm text-center ${
                  requestMsg.startsWith('✅') 
                    ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}>
                  {requestMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 backdrop-blur-xl sticky top-0 z-10">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
            <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
              Connected
            </span>
          </div>
          <button 
            className="text-sm rounded-lg bg-white/10 hover:bg-white/20 px-4 py-2 text-white/70 hover:text-white transition-colors" 
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </div>

      <div className="container py-8 space-y-8">
        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          <div className="rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/20 p-3 md:p-5">
            <div className="text-xl md:text-3xl font-bold text-green-400">
              ${summary?.fundsRaised?.toLocaleString?.() || 0}
            </div>
            <div className="text-xs md:text-sm text-green-400/70 mt-1">Total Raised</div>
          </div>
          <button
            onClick={openPurchasesModal}
            className="rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/20 p-3 md:p-5 text-left hover:border-blue-500/40 transition-colors cursor-pointer"
          >
            <div className="text-xl md:text-3xl font-bold text-blue-400">
              {summary?.purchases?.toLocaleString?.() || 0}
            </div>
            <div className="text-xs md:text-sm text-blue-400/70 mt-1">Purchases <span className="hidden sm:inline text-blue-400/50">→ Click</span></div>
          </button>
          <div className="rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/20 p-3 md:p-5">
            <div className="text-xl md:text-3xl font-bold text-purple-400">
              {summary?.mints?.toLocaleString?.() || 0}
            </div>
            <div className="text-xs md:text-sm text-purple-400/70 mt-1">NFTs Minted</div>
          </div>
          <button
            onClick={() => setShowMilestoneModal(true)}
            className="rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/20 p-3 md:p-5 text-left hover:border-orange-500/40 transition-colors cursor-pointer"
          >
            <div className="text-xl md:text-3xl font-bold text-orange-400">
              {summary?.milestones?.toLocaleString?.() || 0}
            </div>
            <div className="text-xs md:text-sm text-orange-400/70 mt-1">Milestones <span className="hidden sm:inline text-orange-400/50">→ Click</span></div>
          </button>
          <div className="rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/10 border border-cyan-500/20 p-3 md:p-5">
            <div className="text-xl md:text-3xl font-bold text-cyan-400">
              {summary?.donorRetention || 0}%
            </div>
            <div className="text-xs md:text-sm text-cyan-400/70 mt-1">Retention</div>
          </div>
        </div>

        {/* Tab Navigation - Scrollable on mobile */}
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-2 border-b border-white/10 pb-4 min-w-max sm:min-w-0 sm:flex-wrap">
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg font-medium transition-all flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base whitespace-nowrap ${
                activeTab === 'campaigns' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              📋 <span className="hidden xs:inline">Campaigns</span><span className="xs:hidden">Camp</span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg font-medium transition-all flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base whitespace-nowrap ${
                activeTab === 'users' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              👥 Users
            </button>
            <button
              onClick={() => setActiveTab('submitters')}
              className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg font-medium transition-all flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base whitespace-nowrap ${
                activeTab === 'submitters' 
                  ? 'bg-orange-600 text-white' 
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              📝 <span className="hidden xs:inline">Submitters</span><span className="xs:hidden">Subs</span>
            </button>
            <button
              onClick={() => setActiveTab('governance')}
              className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg font-medium transition-all flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base whitespace-nowrap ${
                activeTab === 'governance' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              🗳️ <span className="hidden xs:inline">Governance</span><span className="xs:hidden">Gov</span>
            </button>
            <button
              onClick={() => setActiveTab('bugs')}
              className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg font-medium transition-all flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base whitespace-nowrap ${
                activeTab === 'bugs' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              🐛 <span className="hidden xs:inline">Bug Reports</span><span className="xs:hidden">Bugs</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg font-medium transition-all flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base whitespace-nowrap ${
                activeTab === 'settings' 
                  ? 'bg-gray-600 text-white' 
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              ⚙️ <span className="hidden xs:inline">Settings</span><span className="xs:hidden">Set</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'campaigns' && <AdminCampaignHub />}
        {activeTab === 'users' && <AdminUsers />}
        {activeTab === 'submitters' && <AdminSubmitters />}
        {activeTab === 'governance' && <AdminGovernance />}
        {activeTab === 'bugs' && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-white">Bug Reports</h2>
              <p className="text-sm text-white/50">Review user-submitted bug reports and feedback</p>
            </div>
            <AdminBugReports />
          </div>
        )}
        {activeTab === 'settings' && <AdminSettings />}
      </div>

      {/* Milestone Modal */}
      {showMilestoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">🏆 Milestones Reached</h2>
                <p className="text-white/50 text-sm mt-1">{summary?.milestones || 0} total approved updates</p>
              </div>
              <button
                onClick={() => setShowMilestoneModal(false)}
                className="text-white/50 hover:text-white p-2 rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {summary?.recentMilestones?.length > 0 ? (
                <div className="space-y-3">
                  {summary.recentMilestones.map((m: any, i: number) => (
                    <div key={i} className="p-4 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-white">{m.title || 'Untitled Update'}</div>
                        <div className="text-xs text-white/50">
                          {new Date(m.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-sm text-orange-400">
                          Submission ID: {m.submission_id}
                        </div>
                        <button
                          onClick={() => {
                            setShowMilestoneModal(false)
                            // Find and expand this campaign in the list
                            const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
                            if (searchInput && m.submission_id) {
                              searchInput.value = m.submission_id
                              searchInput.dispatchEvent(new Event('input', { bubbles: true }))
                            }
                            // Scroll to top of campaign hub
                            window.scrollTo({ top: 400, behavior: 'smooth' })
                          }}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors flex items-center gap-1"
                        >
                          📋 View Campaign
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-white/50 py-8">
                  No milestones reached yet
                </div>
              )}
            </div>
            <div className="p-4 border-t border-white/10 bg-white/5">
              <button
                onClick={() => setShowMilestoneModal(false)}
                className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchases Modal */}
      {showPurchasesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">💳 All Purchases</h2>
                <p className="text-white/50 text-sm mt-1">
                  {purchases.length} purchases · ${purchasesSummary?.totalAmountUSD?.toLocaleString() || 0} total
                </p>
              </div>
              <button
                onClick={() => setShowPurchasesModal(false)}
                className="text-white/50 hover:text-white p-2 rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            {/* Summary Stats */}
            {purchasesSummary && (
              <div className="px-6 py-4 border-b border-white/10 bg-white/5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-green-400">${purchasesSummary.totalAmountUSD?.toLocaleString() || 0}</div>
                    <div className="text-xs text-white/50">Total Revenue</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-blue-400">${purchasesSummary.totalTipsUSD?.toLocaleString() || 0}</div>
                    <div className="text-xs text-white/50">Total Tips</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-purple-400">{purchasesSummary.totalBDAG?.toLocaleString() || 0}</div>
                    <div className="text-xs text-white/50">BDAG Collected</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-orange-400">${purchasesSummary.averageUSD?.toLocaleString() || 0}</div>
                    <div className="text-xs text-white/50">Avg Purchase</div>
                  </div>
                </div>
              </div>
            )}

            <div className="p-6 overflow-y-auto max-h-[55vh]">
              {purchasesLoading ? (
                <div className="text-center text-white/50 py-8">
                  <div className="animate-spin inline-block w-6 h-6 border-2 border-white/20 border-t-blue-400 rounded-full mb-2"></div>
                  <div>Loading purchases...</div>
                </div>
              ) : purchases.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-white/50">
                        <th className="text-left p-3">Date</th>
                        <th className="text-left p-3">Campaign</th>
                        <th className="text-left p-3">Buyer</th>
                        <th className="text-right p-3">Amount</th>
                        <th className="text-right p-3">Tip</th>
                        <th className="text-center p-3">Qty</th>
                        <th className="text-left p-3">Tx</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.map((p: any, i: number) => (
                        <tr key={p.id || i} className="border-b border-white/5 hover:bg-white/5">
                          <td className="p-3 text-white/70">
                            {new Date(p.created_at).toLocaleDateString()}
                            <div className="text-xs text-white/40">
                              {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="text-white font-medium truncate max-w-[180px]" title={p.campaign_title}>
                              {p.campaign_title || `#${p.campaign_id}`}
                            </div>
                            <div className="text-xs text-white/40">ID: {p.campaign_id}</div>
                          </td>
                          <td className="p-3">
                            <div className="text-white/70 truncate max-w-[150px]" title={p.email || p.wallet_address}>
                              {p.email || (p.wallet_address ? `${p.wallet_address.slice(0,6)}...${p.wallet_address.slice(-4)}` : 'Unknown')}
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <div className="text-green-400 font-medium">${(p.amount_usd || 0).toFixed(2)}</div>
                            <div className="text-xs text-white/40">{(p.amount_bdag || 0).toFixed(2)} BDAG</div>
                          </td>
                          <td className="p-3 text-right">
                            {p.tip_usd > 0 ? (
                              <div className="text-blue-400">${(p.tip_usd || 0).toFixed(2)}</div>
                            ) : (
                              <span className="text-white/30">-</span>
                            )}
                          </td>
                          <td className="p-3 text-center text-white/70">{p.quantity || 1}</td>
                          <td className="p-3">
                            {p.tx_hash ? (
                              <a
                                href={`https://awakening.bdagscan.com/tx/${p.tx_hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 text-xs"
                              >
                                {p.tx_hash.slice(0,8)}...
                              </a>
                            ) : (
                              <span className="text-white/30">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-white/50 py-8">
                  No purchases recorded yet
                </div>
              )}
            </div>
            <div className="p-4 border-t border-white/10 bg-white/5">
              <button
                onClick={() => setShowPurchasesModal(false)}
                className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
