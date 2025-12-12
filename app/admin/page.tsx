'use client'

import { useEffect, useState } from 'react'
import AdminCampaignHub from '@/components/AdminCampaignHub'
import AdminGovernance from '@/components/AdminGovernance'
import { supabase } from '@/lib/supabase'

type AdminTab = 'campaigns' | 'governance' | 'settings'

export default function AdminPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [authMsg, setAuthMsg] = useState('')
  const [mktContracts, setMktContracts] = useState<any[]>([])
  const [mktMsg, setMktMsg] = useState('')
  const [activeTab, setActiveTab] = useState<AdminTab>('campaigns')
  
  // Collapsible sections
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState('')
  const [backfillAddr, setBackfillAddr] = useState('')
  const [checkingSession, setCheckingSession] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        const token = session?.session?.access_token
        if (token) {
          const res = await fetch('/api/admin/me', { headers: { authorization: `Bearer ${token}` } })
          const data = await res.json().catch(() => ({}))
          if (res.ok && data?.role === 'admin') {
            setAuthed(true)
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
      if ((data?.role || 'user') !== 'admin') { setAuthMsg('Unauthorized: not an admin'); return }
      setAuthed(true)
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
      try {
        const { data: session } = await supabase.auth.getSession()
        const token = session?.session?.access_token
        if (!token) return
        const res3 = await fetch('/api/admin/marketplace-contracts', {
          headers: { authorization: `Bearer ${token}` }
        })
        const data3 = await res3.json().catch(()=>({}))
        if (res3.ok) {
          setMktContracts(data3?.items || [])
        }
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
              <div className="text-4xl mb-3">🔐</div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Admin Login</h1>
              <p className="mt-2 text-white/50 text-sm">Sign in to access the admin dashboard</p>
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
                onKeyDown={e => e.key === 'Enter' && login()}
              />
              <button 
                className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-3 font-medium text-white transition-colors" 
                onClick={login}
              >
                Login
              </button>
              {authMsg && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-red-400 text-sm text-center">
                  {authMsg}
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/20 p-5">
            <div className="text-3xl font-bold text-green-400">
              ${summary?.fundsRaised?.toLocaleString?.() || 0}
            </div>
            <div className="text-sm text-green-400/70 mt-1">Total Raised</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/20 p-5">
            <div className="text-3xl font-bold text-blue-400">
              {summary?.purchases?.toLocaleString?.() || 0}
            </div>
            <div className="text-sm text-blue-400/70 mt-1">Purchases</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/20 p-5">
            <div className="text-3xl font-bold text-purple-400">
              {summary?.mints?.toLocaleString?.() || 0}
            </div>
            <div className="text-sm text-purple-400/70 mt-1">NFTs Minted</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/20 p-5">
            <div className="text-3xl font-bold text-orange-400">
              {summary?.milestones?.toLocaleString?.() || 0}
            </div>
            <div className="text-sm text-orange-400/70 mt-1">Milestones</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/10 border border-cyan-500/20 p-5">
            <div className="text-3xl font-bold text-cyan-400">
              {summary?.donorRetention || 0}%
            </div>
            <div className="text-sm text-cyan-400/70 mt-1">Donor Retention</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-white/10 pb-4">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeTab === 'campaigns' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            📋 Campaigns & Updates
          </button>
          <button
            onClick={() => setActiveTab('governance')}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeTab === 'governance' 
                ? 'bg-purple-600 text-white' 
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            🗳️ Governance
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeTab === 'settings' 
                ? 'bg-gray-600 text-white' 
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            ⚙️ Settings
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'campaigns' && <AdminCampaignHub />}
        {activeTab === 'governance' && <AdminGovernance />}
        {activeTab === 'settings' && (
          <>
            {/* Marketplace Contracts - Compact */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Marketplace Visibility</h2>
              <p className="text-sm text-white/50">Control which contracts appear on the public marketplace</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {mktContracts.map(c => {
              const addr: string = c.contract_address || ''
              const label: string = c.label || ''
              const enabled: boolean = c.enabled !== false
              const short = addr && addr.length > 10 ? `${addr.slice(0,6)}…${addr.slice(-4)}` : addr || '(missing)'
              return (
                <div 
                  key={addr || label} 
                  className={`flex items-center gap-3 rounded-lg px-4 py-2.5 border transition-colors cursor-pointer ${
                    enabled 
                      ? 'bg-green-500/10 border-green-500/30 text-green-300' 
                      : 'bg-white/5 border-white/10 text-white/50'
                  }`}
                  onClick={async () => {
                    try {
                      setMktMsg('')
                      const { data: session } = await supabase.auth.getSession()
                      const token = session?.session?.access_token
                      if (!token) { setMktMsg('Missing admin session token'); return }
                      const res = await fetch('/api/admin/marketplace-contracts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
                        body: JSON.stringify({ contractAddress: addr, enabled: !enabled, label })
                      })
                      if (res.ok) {
                        setMktContracts(prev => prev.map(x => (x.contract_address === addr ? { ...x, enabled: !enabled } : x)))
                      }
                    } catch {}
                  }}
                >
                  <div className={`w-3 h-3 rounded-full ${enabled ? 'bg-green-400' : 'bg-white/30'}`} />
                  <div>
                    <div className="font-mono text-xs">{short}</div>
                    {label && <div className="text-xs opacity-70">{label}</div>}
                  </div>
                </div>
              )
            })}
            {mktContracts.length === 0 && (
              <div className="text-white/40 text-sm">No contracts configured yet</div>
            )}
          </div>
          {mktMsg && <div className="text-xs text-red-400 mt-2">{mktMsg}</div>}
        </div>

        {/* Advanced Tools - Collapsible */}
        <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">⚙️</span>
              <div className="text-left">
                <h2 className="font-semibold text-white">Advanced Tools</h2>
                <p className="text-sm text-white/50">Backfill, cleanup, and other admin utilities</p>
              </div>
            </div>
            <svg 
              className={`w-5 h-5 text-white/40 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showAdvanced && (
            <div className="border-t border-white/10 p-6 space-y-6">
              {/* Backfill */}
              <div>
                <h3 className="font-medium text-white mb-2">Backfill On-chain Data</h3>
                <p className="text-sm text-white/50 mb-3">Scan a contract and sync token data to the database</p>
                <div className="flex gap-3">
                  <select
                    className="flex-1 rounded-lg bg-white/10 border border-white/10 p-2 text-white text-sm"
                    onChange={e => setBackfillAddr(e.target.value)}
                    value={backfillAddr || ''}
                  >
                    <option value="">Select contract…</option>
                    <option value={process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''}>Current V5 Contract</option>
                  </select>
                  <input
                    className="flex-1 rounded-lg bg-white/10 border border-white/10 p-2 text-white placeholder:text-white/40 text-sm"
                    placeholder="Or paste address 0x…"
                    value={backfillAddr}
                    onChange={e => setBackfillAddr(e.target.value)}
                  />
                  <button
                    className="rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 px-4 py-2 text-blue-300 text-sm transition-colors"
                    onClick={async () => {
                      setBackfillMsg('')
                      const addr = backfillAddr.trim()
                      if (!addr) { setBackfillMsg('Enter a contract address first'); return }
                      try {
                        const { data: session } = await supabase.auth.getSession()
                        const token = session?.session?.access_token
                        if (!token) { setBackfillMsg('Missing admin session token'); return }
                        const res = await fetch('/api/admin/backfill-contract', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
                          body: JSON.stringify({ contractAddress: addr }),
                        })
                        const data = await res.json().catch(()=>({}))
                        if (!res.ok) {
                          setBackfillMsg(data?.error || 'Backfill failed')
                          return
                        }
                        const count = Array.isArray(data?.upsertedTokenIds) ? data.upsertedTokenIds.length : 0
                        setBackfillMsg(`✓ Synced ${count} tokens from ${addr.slice(0,6)}…${addr.slice(-4)}`)
                      } catch (e:any) {
                        setBackfillMsg(e?.message || 'Backfill failed')
                      }
                    }}
                  >
                    Run Backfill
                  </button>
                </div>
                {backfillMsg && (
                  <div className={`text-sm mt-2 ${backfillMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                    {backfillMsg}
                  </div>
                )}
              </div>

              {/* Cleanup */}
              <div>
                <h3 className="font-medium text-white mb-2">Background Cleanup</h3>
                <p className="text-sm text-white/50 mb-3">Process queued asset deletions from cleanup_tasks</p>
                <button
                  className="rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-2 text-white/70 text-sm transition-colors"
                  onClick={async () => {
                    try {
                      const { data: session } = await supabase.auth.getSession()
                      const token = session?.session?.access_token
                      const headers: Record<string,string> = { 'Content-Type': 'application/json' }
                      if (token) headers['authorization'] = `Bearer ${token}`
                      const res = await fetch('/api/cleanup/run', { method: 'POST', headers })
                      const data = await res.json().catch(()=>({}))
                      alert(res.ok ? `Processed ${data?.processed || 0} tasks` : 'Cleanup failed')
                    } catch {}
                  }}
                >
                  Run Cleanup
                </button>
              </div>
            </div>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  )
}
