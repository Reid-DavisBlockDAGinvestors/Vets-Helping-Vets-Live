'use client'

import { useEffect, useState } from 'react'

type Proposal = {
  id: number
  title: string
  description: string
  category: string
  yesVotes: number
  noVotes: number
  open: boolean
  createdAt?: string
}

export default function GovernancePage() {
  const [list, setList] = useState<Proposal[]>([])
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [cat, setCat] = useState('expand_disasters')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    try {
      const res = await fetch('/api/gov/proposals')
      if (res.ok) setList((await res.json())?.items || [])
    } catch {}
  }

  useEffect(() => { load() }, [])

  const create = async () => {
    if (!title || !desc) return alert('Title and description required')
    setLoading(true)
    try {
      const res = await fetch('/api/gov/proposals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description: desc, category: cat }) })
      if (!res.ok) throw new Error('CREATE_FAILED')
      setTitle(''); setDesc('')
      await load()
    } catch (e:any) {
      alert(e?.message || 'Failed to create proposal')
    } finally { setLoading(false) }
  }

  const vote = async (id: number, support: boolean) => {
    try {
      const res = await fetch('/api/gov/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, support }) })
      if (!res.ok) throw new Error('VOTE_FAILED')
      await load()
    } catch (e:any) { alert(e?.message || 'Vote failed') }
  }

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold">Community Governance</h1>
      <p className="mt-2 text-white/80">Propose and vote on platform changes: expand causes, adjust fees, and more.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded border border-white/10 p-4">
          <h2 className="font-semibold">Create Proposal</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-sm">Title</label>
              <input className="w-full rounded bg-white/10 p-2" value={title} onChange={e=>setTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Description</label>
              <textarea className="w-full rounded bg-white/10 p-2 h-28" value={desc} onChange={e=>setDesc(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Category</label>
              <select className="w-full rounded bg-white/10 p-2" value={cat} onChange={e=>setCat(e.target.value)}>
                <option value="expand_disasters">Expand to Disasters</option>
                <option value="expand_children">Expand to Children's Issues</option>
                <option value="fee_adjustment">Adjust Nonprofit Fee</option>
              </select>
            </div>
            <button disabled={loading} onClick={create} className="rounded bg-patriotic-red px-4 py-2">{loading ? 'Creating…' : 'Create Proposal'}</button>
          </div>
        </div>

        <div className="rounded border border-white/10 p-4">
          <h2 className="font-semibold">Active Proposals</h2>
          <div className="mt-3 space-y-3">
            {list.map(p => (
              <div key={p.id} className="rounded bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{p.title}</h3>
                    <p className="text-xs opacity-70">{p.category} · {p.open ? 'Open' : 'Closed'}</p>
                  </div>
                  <div className="text-sm">👍 {p.yesVotes} · 👎 {p.noVotes}</div>
                </div>
                <p className="mt-2 text-sm opacity-90">{p.description}</p>
                {p.open && (
                  <div className="mt-2 flex gap-2">
                    <button onClick={()=>vote(p.id, true)} className="rounded bg-white/10 px-3 py-1 text-sm">Vote Yes</button>
                    <button onClick={()=>vote(p.id, false)} className="rounded bg-white/10 px-3 py-1 text-sm">Vote No</button>
                  </div>
                )}
              </div>
            ))}
            {list.length === 0 && <p className="text-sm opacity-70">No proposals yet.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
