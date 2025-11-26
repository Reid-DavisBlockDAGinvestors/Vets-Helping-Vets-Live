'use client'

import { useState } from 'react'

export default function CampaignCreator() {
  const [size, setSize] = useState<number>(10)
  const [priceWei, setPriceWei] = useState<string>('100000000000000000')
  const [goalWei, setGoalWei] = useState<string>('0')
  const [creator, setCreator] = useState<string>('')
  const [baseURI, setBaseURI] = useState<string>('')
  const [cat, setCat] = useState<string>('general')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [msg, setMsg] = useState<string>('')

  const submit = async () => {
    try {
      setLoading(true)
      setResult(null)
      setMsg('')
      const res = await fetch('/api/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ size, priceWei, goalWei, creator, baseURI, category: cat })
      })
      const data = await res.json().catch(()=>({ error: 'INVALID_JSON' }))
      if (!res.ok) {
        setMsg(data?.error || 'Mint failed')
        return
      }
      setResult(data)
      setMsg('Mint submitted')
    } catch (e:any) {
      setMsg(e?.message || 'Mint failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded border border-white/10 p-4 space-y-2">
      <div className="font-semibold">Create Campaign</div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div>
          <label className="text-xs opacity-70">Size</label>
          <input type="number" min={1} className="w-full rounded bg-white/10 p-2" value={size} onChange={e=>setSize(Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs opacity-70">Price (wei)</label>
          <input className="w-full rounded bg-white/10 p-2" value={priceWei} onChange={e=>setPriceWei(e.target.value)} />
        </div>
        <div>
          <label className="text-xs opacity-70">Goal (wei)</label>
          <input className="w-full rounded bg-white/10 p-2" value={goalWei} onChange={e=>setGoalWei(e.target.value)} />
        </div>
        <div>
          <label className="text-xs opacity-70">Creator Address</label>
          <input className="w-full rounded bg-white/10 p-2" value={creator} onChange={e=>setCreator(e.target.value)} placeholder="0x..." />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs opacity-70">Base URI</label>
          <input className="w-full rounded bg-white/10 p-2" value={baseURI} onChange={e=>setBaseURI(e.target.value)} placeholder="ipfs://... or https://..." />
        </div>
        <div>
          <label className="text-xs opacity-70">Category</label>
          <select className="w-full rounded bg-white/10 p-2" value={cat} onChange={e=>setCat(e.target.value)}>
            <option value="general">general</option>
            <option value="veteran">veteran</option>
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={submit} disabled={loading} className="w-full rounded bg-patriotic-red px-3 py-2 text-sm">{loading ? 'Submitting…' : 'Mint Series'}</button>
        </div>
      </div>
      {msg && <div className="text-xs opacity-80">{msg}</div>}
      {result?.txHash && (
        <div className="text-sm">
          <div>Tx Hash: <span className="break-all">{result.txHash}</span></div>
        </div>
      )}
    </div>
  )
}
