"use client"
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ipfsToHttp } from '@/lib/ipfs'

type Submission = {
  id: string
  created_at?: string
  title?: string
  story?: string
  category: string
  goal?: number
  creator_wallet: string
  creator_email: string
  image_uri?: string
  metadata_uri: string
  status: 'pending'|'approved'|'rejected'|'minted'
  reviewer_notes?: string
  token_id?: number
  campaign_id?: number  // V5: campaign ID for editions
  tx_hash?: string
  price_per_copy?: number | null
  num_copies?: number | null
  benchmarks?: string[] | null
  contract_address?: string | null
  visible_on_marketplace?: boolean
}

export default function AdminSubmissions() {
  const [items, setItems] = useState<Submission[]>([])
  const [usernames, setUsernames] = useState<Record<string,string>>({})
  const [selected, setSelected] = useState<Submission|null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [srcUrl, setSrcUrl] = useState('')
  const [apiCount, setApiCount] = useState<number | null>(null)
  const [benchmarksText, setBenchmarksText] = useState('')
  const [contractFilter, setContractFilter] = useState<string | 'all'>('all')

  const refresh = async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      const headers: Record<string,string> = { }
      if (token) headers['authorization'] = `Bearer ${token}`
      const res = await fetch('/api/submissions', { headers: Object.keys(headers).length ? headers : undefined })
      const data = await res.json().catch(()=>({}))
      if (res.ok) {
        const src = res.headers.get('X-Supabase-Url') || ''
        console.log('[admin] submissions source:', src, 'count:', data?.count)
        setSrcUrl(src)
        setApiCount(typeof data?.count === 'number' ? data.count : null)
        setItems(data.items || [])
        setUsernames(data.usernames || {})
        setMsg('')
      } else {
        console.error('[admin] GET /api/submissions failed', res.status, data)
        setItems([])
        setUsernames({})
        setMsg([data?.error, data?.code, data?.details].filter(Boolean).join(' | ') || 'Failed to load submissions')
      }
    } catch {}
  }

  const deleteSelected = async () => {
    if (!selected) return
    if (!confirm('Delete this submission permanently?')) return
    setBusy(true)
    setMsg('')
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      const headers: Record<string,string> = { 'Content-Type': 'application/json' }
      if (token) headers['authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/submissions/${selected.id}`, { method: 'DELETE', headers })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) { setMsg([data?.error, data?.code, data?.details].filter(Boolean).join(' | ') || 'Delete failed'); return }
      // Run cleanup automatically
      try {
        const headers: Record<string,string> = { 'Content-Type': 'application/json' }
        if (token) headers['authorization'] = `Bearer ${token}`
        const run = await fetch('/api/cleanup/run', { method: 'POST', headers })
        const rj = await run.json().catch(()=>({}))
        if (run.ok) setMsg(`Deleted · Cleanup processed ${rj?.processed || 0}`)
        else setMsg(`Deleted · Cleanup failed: ${[rj?.error, rj?.details].filter(Boolean).join(' | ') || run.status}`)
      } catch {
        setMsg('Deleted · Cleanup failed')
      }
      setSelected(null)
      refresh()
    } catch (e:any) {
      setMsg(e?.message || 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  useEffect(()=>{ refresh() },[])
  useEffect(()=>{
    const id = setInterval(()=>{ refresh() }, 30000) // Poll every 30 seconds
    return ()=>clearInterval(id)
  }, [])
  useEffect(()=>{
    const { data: sub } = supabase.auth.onAuthStateChange((_event, _session) => {
      refresh()
    })
    return () => { sub.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    // When switching contract filters, clear selection so we don't show
    // a preview from a different contract than the one currently filtered.
    setSelected(null)
  }, [contractFilter])

  const onSelect = (s: Submission) => {
    setSelected({ ...s })
    setBenchmarksText(Array.isArray(s.benchmarks) ? s.benchmarks.join('\n') : '')
    setMsg('')
  }

  const saveEdits = async () => {
    if (!selected) return
    setBusy(true)
    setMsg('')
    try {
      const { id, ...fields } = selected
      const payload: any = { ...fields }
      // Convert benchmarks text (one per line) into string[] for storage
      const trimmed = benchmarksText.trim()
      if (trimmed) {
        payload.benchmarks = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      } else {
        payload.benchmarks = null
      }
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      const headers: Record<string,string> = { 'Content-Type': 'application/json' }
      if (token) headers['authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/submissions/${id}`, { method: 'PATCH', headers, body: JSON.stringify(payload) })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) { setMsg([data?.error, data?.code, data?.details].filter(Boolean).join(' | ') || 'Save failed'); return }
      setMsg('Saved edits')
      refresh()
    } catch (e:any) {
      setMsg(e?.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const reject = async () => {
    if (!selected) return
    setBusy(true)
    setMsg('')
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      const headers: Record<string,string> = { 'Content-Type': 'application/json' }
      if (token) headers['authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/submissions/${selected.id}`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'rejected', reviewer_notes: selected.reviewer_notes || '' }) })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) { setMsg([data?.error, data?.code, data?.details].filter(Boolean).join(' | ') || 'Reject failed'); return }
      setMsg('Submission rejected')
      setSelected(null)
      refresh()
    } catch (e:any) {
      setMsg(e?.message || 'Reject failed')
    } finally {
      setBusy(false)
    }
  }

  const approveAndMint = async () => {
    if (!selected) return
    setBusy(true)
    setMsg('')
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      const headers: Record<string,string> = { 'Content-Type': 'application/json' }
      if (token) headers['authorization'] = `Bearer ${token}`
      const res = await fetch('/api/submissions/approve', {
        method: 'POST', headers, body: JSON.stringify({ id: selected.id, updates: {
          title: selected.title,
          story: selected.story,
          category: selected.category,
          image_uri: selected.image_uri,
          metadata_uri: selected.metadata_uri,
          reviewer_notes: selected.reviewer_notes || ''
        }})
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) {
        const err = String(data?.error || '')
        const details = String(data?.details || '')
        // Provide a friendlier explanation for common on-chain failures so
        // admins know what to fix instead of silently failing.
        if (err === 'APPROVE_AND_MINT_FAILED' && details.includes('already known')) {
          setMsg('Approve & Mint failed: the relayer transaction is already known to the RPC node. This usually means a previous mint transaction from the relayer is still pending or stuck in the mempool. Try using a fresh relayer key in .env and restarting the server. Raw error: ' + details)
        } else {
          setMsg([data?.error, data?.code, data?.details].filter(Boolean).join(' | ') || 'Approve failed')
        }
        return
      }
      const tid = (data?.tokenId != null) ? ` · tokenId #${data.tokenId}` : ''
      const primaryTx = Array.isArray(data?.txHashes) && data.txHashes.length ? data.txHashes[0] : (data?.txHash || '')
      setMsg('Approved and minted on‑chain: ' + (primaryTx || '(tx pending)') + tid)
      setSelected(null)
      refresh()
    } catch (e:any) {
      setMsg(e?.message || 'Approve failed')
    } finally {
      setBusy(false)
    }
  }

  const uniqueContracts = useMemo(() => {
    const KNOWN_CONTRACTS = [
      '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e',
    ]
    const dynamic = items
      .map(i => (i as any).contract_address as string | undefined)
      .map(a => a?.trim())
      .filter(Boolean) as string[]
    const merged = [...KNOWN_CONTRACTS, ...dynamic]
    return Array.from(new Set(merged))
  }, [items])

  const filteredItems = useMemo(() => {
    if (contractFilter === 'all') {
      return items
    }
    const target = contractFilter.toLowerCase()
    return items.filter(i => {
      const addr = ((i as any).contract_address as string | undefined)?.toLowerCase() || ''
      return addr === target
    })
  }, [items, contractFilter])

  const pending = useMemo(()=>filteredItems.filter(i=>i.status==='pending'),[filteredItems])
  const others = useMemo(()=>filteredItems.filter(i=>i.status!=='pending'),[filteredItems])

  return (
    <div className="rounded border border-white/10 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Submissions Review{items?.length != null ? ` (${items.length})` : ''}</h2>
          <div className="text-[11px] opacity-70 mt-0.5">
            {(() => {
              const active = contractFilter === 'all' ? 'all' : contractFilter
              if (!active) return 'Filter: (none)'
              if (active === 'all') return 'Filter: all contracts'
              const short = active.length > 10 ? `${active.slice(0,6)}…${active.slice(-4)}` : active
              return `Filter: ${short}`
            })()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="text-xs rounded bg-white/10 px-2 py-1"
            value={contractFilter}
            onChange={e => setContractFilter(e.target.value as any)}
          >
            <option value="all">All contracts</option>
            {uniqueContracts.map(addr => (
              <option key={addr} value={addr}>{addr.slice(0,6)}…{addr.slice(-4)}</option>
            ))}
          </select>
          <button className="text-xs rounded bg-white/10 px-2 py-1" onClick={refresh}>Refresh</button>
        </div>
      </div>
      <div className="mt-2 rounded bg-white/5 p-2 text-[11px]">
        <div><span className="opacity-60">API Source:</span> {srcUrl || '—'}</div>
        <div><span className="opacity-60">API Count:</span> {apiCount ?? '—'}</div>
        <div className="opacity-60">Samples:</div>
        <ul className="list-disc pl-5">
          {items.slice(0,3).map(s => (
            <li key={s.id} className="break-all">
              {s.id} · {usernames[s.creator_email] || s.creator_email}
              {(s as any).contract_address && (
                <> · {(s as any).contract_address.slice(0,6)}…{(s as any).contract_address.slice(-4)}</>
              )}
            </li>
          ))}
          {items.length === 0 && <li>none</li>}
        </ul>
      </div>
      {msg && (
        <div className="mt-2 text-xs rounded bg-red-900/30 border border-red-800 px-2 py-1">
          {msg}
        </div>
      )}
      <div className="mt-3 grid md:grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-medium mb-2">Pending</div>
          <div className="space-y-2">
            {pending.map(s=> (
              <div key={s.id} className={`rounded p-3 cursor-pointer ${selected?.id===s.id? 'bg-white/20':'bg-white/10'}`} onClick={()=>onSelect(s)}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{s.title || 'Untitled'}</div>
                    <div className="text-xs opacity-70">
                      {s.category} · {usernames[s.creator_email] || s.creator_email}
                    </div>
                    <div className="text-[11px] opacity-70 mt-0.5">
                      {typeof s.goal === 'number' && s.goal > 0 && (
                        <span>Goal: ${s.goal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      )}
                      {typeof s.price_per_copy === 'number' && (
                        <span>{typeof s.goal === 'number' && s.goal > 0 ? ' · ' : ''}Price: ${s.price_per_copy.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      )}
                      {typeof s.num_copies === 'number' && s.num_copies > 0 && (
                        <span>{(typeof s.goal === 'number' && s.goal > 0) || typeof s.price_per_copy === 'number' ? ' · ' : ''}Copies: {s.num_copies}</span>
                      )}
                    </div>
                    {s.story && (
                      <div className="text-[11px] opacity-60 mt-0.5 line-clamp-2">
                        {s.story.length > 120 ? s.story.slice(0,120) + '…' : s.story}
                      </div>
                    )}
                    {(s.contract_address || s.campaign_id != null || s.token_id != null) && (
                      <div className="text-[11px] opacity-70 mt-0.5">
                        {s.contract_address && <span>{s.contract_address.slice(0,6)}…{s.contract_address.slice(-4)}</span>}
                        {s.contract_address && (s.campaign_id != null || s.token_id != null) && <span> · </span>}
                        {s.campaign_id != null && <span>campaign #{s.campaign_id}</span>}
                        {s.campaign_id == null && s.token_id != null && <span>token #{s.token_id}</span>}
                      </div>
                    )}
                  </div>
                  <div className="text-xs opacity-70">{new Date(s.created_at||'').toLocaleString?.()}</div>
                </div>
              </div>
            ))}
            {pending.length===0 && <div className="opacity-70 text-sm">No pending submissions.</div>}
          </div>

          <div className="text-sm font-medium mt-6 mb-2">Reviewed</div>
          <div className="space-y-2 max-h-64 overflow-auto pr-2">
            {others.map(s=> (
              <div
                key={s.id}
                className={`rounded p-3 cursor-pointer ${selected?.id===s.id ? 'bg-white/20' : 'bg-white/5'}`}
                onClick={()=>onSelect(s)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{s.title || 'Untitled'} ({s.status})</div>
                    <div className="text-xs opacity-70">
                      {s.category} · {usernames[s.creator_email] || s.creator_email}
                    </div>
                    <div className="text-[11px] opacity-70 mt-0.5">
                      {typeof s.goal === 'number' && s.goal > 0 && (
                        <span>Goal: ${s.goal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      )}
                      {typeof s.price_per_copy === 'number' && (
                        <span>{typeof s.goal === 'number' && s.goal > 0 ? ' · ' : ''}Price: ${s.price_per_copy.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      )}
                      {typeof s.num_copies === 'number' && s.num_copies > 0 && (
                        <span>{(typeof s.goal === 'number' && s.goal > 0) || typeof s.price_per_copy === 'number' ? ' · ' : ''}Copies: {s.num_copies}</span>
                      )}
                    </div>
                    {s.story && (
                      <div className="text-[11px] opacity-60 mt-0.5 line-clamp-2">
                        {s.story.length > 120 ? s.story.slice(0,120) + '…' : s.story}
                      </div>
                    )}
                    {(s.contract_address || s.campaign_id != null || s.token_id != null) && (
                      <div className="text-[11px] opacity-70 mt-0.5">
                        {s.contract_address && <span>{s.contract_address.slice(0,6)}…{s.contract_address.slice(-4)}</span>}
                        {s.contract_address && (s.campaign_id != null || s.token_id != null) && <span> · </span>}
                        {s.campaign_id != null && <span>campaign #{s.campaign_id}</span>}
                        {s.campaign_id == null && s.token_id != null && <span>token #{s.token_id}</span>}
                        {s.visible_on_marketplace === false && <span> · hidden</span>}
                      </div>
                    )}
                  </div>
                  {s.tx_hash && <a className="text-xs underline opacity-80" href={`${process.env.NEXT_PUBLIC_EXPLORER_BASE || ''}/tx/${s.tx_hash}`} target="_blank">tx</a>}
                </div>
              </div>
            ))}
            {others.length===0 && <div className="opacity-70 text-sm">No reviewed submissions.</div>}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium mb-2">Details</div>
          {!selected && <div className="opacity-70 text-sm">Select a submission to review.</div>}
          {selected && (
            <div className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs opacity-70">Title</label>
                  <input className="w-full rounded bg-white/10 p-2" value={selected.title || ''} onChange={e=>setSelected({ ...selected, title: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs opacity-70">Category</label>
                  <select className="w-full rounded bg-white/10 p-2" value={selected.category} onChange={e=>setSelected({ ...selected, category: e.target.value as any })}>
                    <option value="veteran">veteran</option>
                    <option value="general">general</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs opacity-70">Story</label>
                <textarea className="w-full rounded bg-white/10 p-2 h-32" value={selected.story || ''} onChange={e=>setSelected({ ...selected, story: e.target.value })} />
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs opacity-70">Requested Goal (USD)</label>
                  <input
                    type="number"
                    className="w-full rounded bg-white/10 p-2"
                    value={selected.goal ?? 0}
                    onChange={e=>setSelected({ ...selected, goal: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70">Price per Copy (USD)</label>
                  <input
                    type="number"
                    className="w-full rounded bg-white/10 p-2"
                    value={selected.price_per_copy ?? ''}
                    onChange={e=>setSelected({ ...selected, price_per_copy: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70">Number of Copies</label>
                  <input
                    type="number"
                    className="w-full rounded bg-white/10 p-2"
                    value={selected.num_copies ?? ''}
                    onChange={e=>setSelected({ ...selected, num_copies: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs opacity-70">Benchmarks / Milestones (one per line)</label>
                <textarea
                  className="w-full rounded bg-white/10 p-2 h-24 text-xs"
                  value={benchmarksText}
                  onChange={e=>setBenchmarksText(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs opacity-70">Metadata URI</label>
                <input className="w-full rounded bg-white/10 p-2" value={selected.metadata_uri} onChange={e=>setSelected({ ...selected, metadata_uri: e.target.value })} />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs opacity-70">Creator Wallet</label>
                  <input className="w-full rounded bg-white/10 p-2" value={selected.creator_wallet} onChange={e=>setSelected({ ...selected, creator_wallet: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs opacity-70">Creator Email</label>
                  <input className="w-full rounded bg-white/10 p-2" value={selected.creator_email} onChange={e=>setSelected({ ...selected, creator_email: e.target.value })} />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs opacity-70">Contract Address</label>
                  <input
                    className="w-full rounded bg-white/10 p-2 text-xs"
                    value={selected.contract_address || ''}
                    onChange={e=>setSelected({ ...selected, contract_address: e.target.value || null })}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70">Campaign ID (V5)</label>
                  <input
                    type="number"
                    className="w-full rounded bg-white/10 p-2 text-xs"
                    value={selected.campaign_id ?? ''}
                    readOnly
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs opacity-70">Transaction Hash</label>
                  <div className="flex gap-2">
                    <input
                      className="w-full rounded bg-white/10 p-2 text-xs"
                      value={selected.tx_hash || ''}
                      readOnly
                    />
                    {selected.tx_hash && (
                      <a 
                        href={`${process.env.NEXT_PUBLIC_EXPLORER_BASE || 'https://explorer.blockdag.network'}/tx/${selected.tx_hash}`}
                        target="_blank"
                        className="rounded bg-white/10 px-2 py-2 text-xs whitespace-nowrap"
                      >
                        View
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    id="visible-marketplace"
                    type="checkbox"
                    className="h-4 w-4"
                    checked={selected.visible_on_marketplace !== false}
                    onChange={e=>setSelected({ ...selected, visible_on_marketplace: e.target.checked })}
                  />
                  <label htmlFor="visible-marketplace" className="text-xs opacity-80">Visible on marketplace</label>
                </div>
              </div>
              <div>
                <label className="text-xs opacity-70">Reviewer Notes</label>
                <textarea className="w-full rounded bg-white/10 p-2 h-24" value={selected.reviewer_notes || ''} onChange={e=>setSelected({ ...selected, reviewer_notes: e.target.value })} />
              </div>

              <div className="flex gap-2">
                <button disabled={busy} onClick={saveEdits} className="rounded bg-white/10 px-3 py-2">Save</button>
                <button disabled={busy} onClick={reject} className="rounded bg-red-600 px-3 py-2">Reject</button>
                <button disabled={busy} onClick={approveAndMint} className="rounded bg-patriotic-red px-3 py-2">Approve & Mint</button>
                <button disabled={busy} onClick={deleteSelected} className="rounded bg-white/10 px-3 py-2">Delete</button>
              </div>
              {msg && <div className="text-xs opacity-80 break-all">{msg}</div>}

              {selected.image_uri && (
                <div className="mt-3">
                  <div className="text-xs opacity-70 mb-1">Media</div>
                  <img src={ipfsToHttp(selected.image_uri)} alt="Submission media" className="max-h-64 rounded" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
