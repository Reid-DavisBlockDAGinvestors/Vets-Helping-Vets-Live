'use client'

import { useEffect, useState } from 'react'
import AdminStoryTools from '@/components/AdminStoryTools'
import AdminCampaignHub from '@/components/AdminCampaignHub'
import { supabase } from '@/lib/supabase'

export default function AdminPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [proposals, setProposals] = useState<any[]>([])
  const [authMsg, setAuthMsg] = useState('')
  const [cleanupMsg, setCleanupMsg] = useState('')
  const [backfillMsg, setBackfillMsg] = useState('')
  const [backfillAddr, setBackfillAddr] = useState('')
  const [mktContracts, setMktContracts] = useState<any[]>([])
  const [mktMsg, setMktMsg] = useState('')

  const login = async () => {
    setAuthMsg('')
    try {
      if (!email || !password) {
        setAuthMsg('Email and password required')
        return
      }

      let { error: signErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signErr) {
        // Attempt bootstrap sign-up once, then continue
        const { error: suErr } = await supabase.auth.signUp({ email, password })
        if (suErr) { setAuthMsg(signErr.message || suErr.message || 'Sign-in failed'); return }
        // After signup, sign in again to get session token
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
    // React to Supabase session changes: if session disappears, de-auth
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
        const res2 = await fetch('/api/gov/proposals')
        if (res2.ok) setProposals((await res2.json())?.items || [])
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
        } else {
          setMktMsg(data3?.error || 'Failed to load marketplace contracts')
        }
      } catch {}
    }
    run()
  }, [authed])

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        {authed && (
          <button className="text-sm rounded bg-white/10 px-3 py-2" onClick={logout}>Logout</button>
        )}
      </div>
      {!authed && (
        <div className="mt-4 rounded border border-white/10 p-4">
          <h2 className="font-semibold">Login</h2>
          <p className="mt-1 text-white/70 text-sm">Sign in with admin email/password.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <input className="w-full rounded bg-white/10 p-2" placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} />
            <input className="w-full rounded bg-white/10 p-2" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          </div>
          <div className="mt-3">
            <button className="rounded bg-patriotic-red px-4 py-2" onClick={login}>Login</button>
          </div>
          {authMsg && <div className="text-xs opacity-80 mt-2">{authMsg}</div>}
        </div>
      )}

      {authed && (
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded border border-white/10 p-4">Manage Stories/NFTs (edit, hide/unhide)</div>
        <div className="rounded border border-white/10 p-4">Platform Settings (mission, categories, fees)</div>
        <div className="rounded border border-white/10 p-4">Reports and Receipts</div>
        <div className="rounded border border-white/10 p-4">Hidden Lists (server-side persisted)</div>
        <div className="rounded border border-white/10 p-4">
          <h2 className="font-semibold">Marketplace Contracts</h2>
          <p className="text-sm opacity-80 mt-1">Choose which contracts are visible on the public marketplace.</p>
          <div className="mt-3 space-y-2 text-xs">
            {mktContracts.map(c => {
              const addr: string = c.contract_address || ''
              const label: string = c.label || ''
              const enabled: boolean = c.enabled !== false
              const short = addr && addr.length > 10 ? `${addr.slice(0,6)}…${addr.slice(-4)}` : addr || '(missing)'
              return (
                <div key={addr || label} className="flex items-center justify-between rounded bg-white/5 px-2 py-1 gap-2">
                  <div>
                    <div className="font-mono text-[11px] break-all">{short}</div>
                    {label && <div className="opacity-70">{label}</div>}
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      className="h-3 w-3"
                      checked={enabled}
                      onChange={async e => {
                        try {
                          setMktMsg('')
                          const { data: session } = await supabase.auth.getSession()
                          const token = session?.session?.access_token
                          if (!token) { setMktMsg('Missing admin session token'); return }
                          const res = await fetch('/api/admin/marketplace-contracts', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({ contractAddress: addr, enabled: e.target.checked, label })
                          })
                          const dj = await res.json().catch(()=>({}))
                          if (!res.ok) {
                            setMktMsg(dj?.error || 'Update failed')
                            return
                          }
                          setMktContracts(prev => prev.map(x => (x.contract_address === addr ? { ...x, enabled: e.target.checked } : x)))
                        } catch (err:any) {
                          setMktMsg(err?.message || 'Update failed')
                        }
                      }}
                    />
                    <span className="opacity-80">Visible</span>
                  </div>
                </div>
              )
            })}
            {mktContracts.length === 0 && (
              <div className="opacity-70">No marketplace contracts configured yet. Use the backfill or mint flows to start populating data, then configure visibility here.</div>
            )}
            {mktMsg && <div className="text-[11px] opacity-80 mt-1 break-all">{mktMsg}</div>}
          </div>
        </div>
        <div className="rounded border border-white/10 p-4">
          <h2 className="font-semibold">Backfill On-chain Data</h2>
          <p className="text-sm opacity-80 mt-1">Scan a contract on-chain and upsert tokens into submissions (contract_address, token_id, metadata, goal, etc.).</p>
          <div className="mt-3 space-y-2 text-xs">
            <div className="grid md:grid-cols-2 gap-2">
              <select
                className="rounded bg-white/10 p-2"
                onChange={e=>{
                  const v = e.target.value
                  if (!v) return
                  setBackfillAddr(v)
                }}
                value={backfillAddr || ''}
              >
                <option value="">Select known contract…</option>
                <option value="0x84a49f0a3a28f63f56431d59d5237437b12Db7De">First (legacy)</option>
                <option value="0xf549BC7C3de5fde9B92e2A804639b95BCAF29a62">Second (v2)</option>
                <option value="0x7354aaA7d71432868C90fc58f95D7bCd6c3F6cb9">Third (v3)</option>
                <option value="0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e">Fourth (current V3)</option>
              </select>
              <input
                className="rounded bg-white/10 p-2"
                placeholder="Or paste contract address 0x…"
                value={backfillAddr}
                onChange={e=>setBackfillAddr(e.target.value)}
              />
            </div>
            <div className="flex gap-2 items-center">
              <button
                className="rounded bg-white/10 px-3 py-2 text-sm"
                onClick={async ()=>{
                  setBackfillMsg('')
                  const addr = backfillAddr.trim()
                  if (!addr) { setBackfillMsg('Enter a contract address first'); return }
                  try {
                    const { data: session } = await supabase.auth.getSession()
                    const token = session?.session?.access_token
                    if (!token) { setBackfillMsg('Missing admin session token'); return }
                    const res = await fetch('/api/admin/backfill-contract', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({ contractAddress: addr }),
                    })
                    const data = await res.json().catch(()=>({}))
                    if (!res.ok) {
                      setBackfillMsg([data?.error, data?.details].filter(Boolean).join(' | ') || 'Backfill failed')
                      return
                    }
                    const count = Array.isArray(data?.upsertedTokenIds) ? data.upsertedTokenIds.length : null
                    setBackfillMsg(`Backfill ok for ${data?.contractAddress || addr}${count != null ? ` · tokens: ${count}` : ''}`)
                  } catch (e:any) {
                    setBackfillMsg(e?.message || 'Backfill failed')
                  }
                }}
              >Run Backfill</button>
            </div>
            {backfillMsg && <div className="mt-1 text-xs opacity-80 break-all">{backfillMsg}</div>}
          </div>
        </div>
        <div className="rounded border border-white/10 p-4">
          <h2 className="font-semibold">Background Cleanup</h2>
          <p className="text-sm opacity-80 mt-1">Processes up to 10 queued asset deletions (image/metadata) from cleanup_tasks.</p>
          <div className="mt-3 flex gap-2">
            <button
              className="rounded bg-white/10 px-3 py-2 text-sm"
              onClick={async ()=>{
                setCleanupMsg('')
                try {
                  const headers: Record<string,string> = { 'Content-Type': 'application/json' }
                  if (authed) {
                    const { data: session } = await supabase.auth.getSession()
                    const token = session?.session?.access_token
                    if (token) headers['authorization'] = `Bearer ${token}`
                  }
                  const res = await fetch('/api/cleanup/run', { method: 'POST', headers })
                  const data = await res.json().catch(()=>({}))
                  if (!res.ok) { setCleanupMsg([data?.error, data?.details].filter(Boolean).join(' | ') || 'Cleanup failed'); return }
                  setCleanupMsg(`Processed ${data?.processed || 0} tasks`)
                } catch (e:any) {
                  setCleanupMsg(e?.message || 'Cleanup failed')
                }
              }}
            >Run Cleanup</button>
          </div>
          {cleanupMsg && <div className="text-xs opacity-80 mt-2">{cleanupMsg}</div>}
        </div>
        <div className="rounded border border-white/10 p-4">
          <h2 className="font-semibold">Analytics Summary</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded bg-white/5 p-3">{`Funds Raised: $${summary?.fundsRaised?.toLocaleString?.() || 0}`}</div>
            <div className="rounded bg-white/5 p-3">{`Purchases: ${summary?.purchases != null ? Number(summary.purchases).toLocaleString() : 0}`}</div>
            <div className="rounded bg-white/5 p-3">{`Mints: ${summary?.mints != null ? Number(summary.mints).toLocaleString() : 0}`}</div>
            <div className="rounded bg-white/5 p-3">{`Milestones: ${summary?.milestones != null ? Number(summary.milestones).toLocaleString() : 0}`}</div>
            <div className="rounded bg-white/5 p-3">{`Donor Retention: ${summary?.donorRetention != null ? Number(summary.donorRetention).toLocaleString() : 0}%`}</div>
          </div>
        </div>
        <div className="rounded border border-white/10 p-4">
          <h2 className="font-semibold">Moderate Proposals</h2>
          <div className="mt-2 space-y-3 text-sm">
            {proposals.map(p => (
              <div key={p.id} className="rounded bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{p.title}</div>
                    <div className="text-xs opacity-70">{p.category} · {p.open ? 'Open' : 'Closed'}</div>
                  </div>
                  <button
                    className="rounded bg-white/10 px-3 py-1"
                    onClick={async ()=>{
                      const nextOpen = !p.open
                      const { data: session } = await supabase.auth.getSession()
                      const token = session?.session?.access_token
                      const headers: Record<string,string> = { 'Content-Type': 'application/json' }
                      if (token) headers['authorization'] = `Bearer ${token}`
                      const res = await fetch('/api/gov/moderate', { method: 'POST', headers, body: JSON.stringify({ id: p.id, open: nextOpen }) })
                      if (res.ok) {
                        setProposals(prev => prev.map(x => x.id === p.id ? { ...x, open: nextOpen } : x))
                      } else {
                        alert('Moderation failed')
                      }
                    }}
                  >{p.open ? 'Close' : 'Reopen'}</button>
                </div>
              </div>
            ))}
            {proposals.length === 0 && <div className="opacity-70">No proposals to moderate.</div>}
          </div>
        </div>
        <div className="md:col-span-2">
          <AdminStoryTools />
        </div>
        <div className="md:col-span-2">
          <AdminCampaignHub />
        </div>
      </div>
      )}
    </div>
  )
}
