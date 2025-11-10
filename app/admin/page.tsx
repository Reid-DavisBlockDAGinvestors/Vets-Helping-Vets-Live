'use client'

import { useEffect, useState } from 'react'

export default function AdminPage() {
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [proposals, setProposals] = useState<any[]>([])

  const login = async () => {
    const ok = !!secret && (await fetch('/api/admin-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret }) })).ok
    setAuthed(!!ok)
    if (!ok) alert('Invalid admin secret')
  }

  if (!authed) return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold">Admin Panel</h1>
      <p className="mt-2 text-white/80">Enter admin secret to manage platform content.</p>
      <div className="mt-4 flex gap-2">
        <input className="w-64 rounded bg-white/10 p-2" placeholder="Admin Secret" type="password" value={secret} onChange={e=>setSecret(e.target.value)} />
        <button className="rounded bg-patriotic-red px-4" onClick={login}>Login</button>
      </div>
    </div>
  )

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/analytics/summary')
        if (res.ok) setSummary(await res.json())
      } catch {}
      try {
        const res2 = await fetch('/api/gov/proposals')
        if (res2.ok) setProposals((await res2.json())?.items || [])
      } catch {}
    }
    run()
  }, [])

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded border border-white/10 p-4">Manage Stories/NFTs (edit, hide/unhide)</div>
        <div className="rounded border border-white/10 p-4">Platform Settings (mission, categories, fees)</div>
        <div className="rounded border border-white/10 p-4">Reports and Receipts</div>
        <div className="rounded border border-white/10 p-4">Hidden Lists (server-side persisted)</div>
        <div className="rounded border border-white/10 p-4">
          <h2 className="font-semibold">Analytics Summary</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded bg-white/5 p-3">Funds Raised: ${'{'}summary?.fundsRaised?.toLocaleString?.() || 0{'}'}</div>
            <div className="rounded bg-white/5 p-3">Purchases: ${'{'}summary?.purchases || 0{'}'}</div>
            <div className="rounded bg-white/5 p-3">Mints: ${'{'}summary?.mints || 0{'}'}</div>
            <div className="rounded bg-white/5 p-3">Milestones: ${'{'}summary?.milestones || 0{'}'}</div>
            <div className="rounded bg-white/5 p-3">Donor Retention: ${'{'}summary?.donorRetention || 0{'}'}%</div>
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
                      const res = await fetch('/api/gov/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, open: nextOpen, secret }) })
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
      </div>
    </div>
  )
}
