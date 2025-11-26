'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminStoryTools() {
  const [tokenId, setTokenId] = useState('1')
  const [newURI, setNewURI] = useState('')
  const [addAmt, setAddAmt] = useState<number>(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [payoutAmt, setPayoutAmt] = useState<number>(0)
  const [payoutRecipient, setPayoutRecipient] = useState('')
  const [payoutOnchain, setPayoutOnchain] = useState(true)

  const doUpdate = async () => {
    try {
      setBusy(true); setMsg('')
      const { data: session } = await supabase.auth.getSession()
      const t = session?.session?.access_token
      const headers: Record<string,string> = { 'Content-Type': 'application/json' }
      if (t) headers['authorization'] = `Bearer ${t}`
      const res = await fetch(`/api/onchain/tokens/${tokenId}/update`, { method: 'POST', headers, body: JSON.stringify({ newUri: newURI }) })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data?.error || 'update failed')
      setMsg('updateTokenURI tx: ' + (data?.txHash || ''))
    } catch (e:any) { setMsg(e?.message || 'update failed') } finally { setBusy(false) }
  }

  const doAddFunds = async () => {
    try {
      setBusy(true); setMsg('')
      const { data: session } = await supabase.auth.getSession()
      const t = session?.session?.access_token
      const headers: Record<string,string> = { 'Content-Type': 'application/json' }
      if (t) headers['authorization'] = `Bearer ${t}`
      const res = await fetch(`/api/onchain/tokens/${tokenId}/update`, { method: 'POST', headers, body: JSON.stringify({ addRaised: Number(addAmt) }) })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data?.error || 'addRaised failed')
      setMsg('addRaised tx: ' + (data?.txHash || ''))
    } catch (e:any) { setMsg(e?.message || 'addRaised failed') } finally { setBusy(false) }
  }

  const doBurn = async () => {
    try {
      setBusy(true); setMsg('')
      const { data: session } = await supabase.auth.getSession()
      const t = session?.session?.access_token
      const headers: Record<string,string> = { 'Content-Type': 'application/json' }
      if (t) headers['authorization'] = `Bearer ${t}`
      const res = await fetch(`/api/onchain/tokens/${tokenId}/burn`, { method: 'POST', headers })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data?.error || 'burn failed')
      setMsg('burn tx: ' + (data?.txHash || ''))
    } catch (e:any) { setMsg(e?.message || 'burn failed') } finally { setBusy(false) }
  }

  const doPayout = async () => {
    try {
      setBusy(true); setMsg('')
      const { data: session } = await supabase.auth.getSession()
      const t = session?.session?.access_token
      const headers: Record<string,string> = { 'Content-Type': 'application/json' }
      if (t) headers['authorization'] = `Bearer ${t}`
      const res = await fetch('/api/admin/payout', {
        method: 'POST',
        headers,
        body: JSON.stringify({ tokenId, amount: payoutAmt, recipient: payoutRecipient, onchain: payoutOnchain })
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data?.error || 'payout failed')
      setMsg('payout tx: ' + (data?.txHash || ''))
    } catch (e:any) {
      setMsg(e?.message || 'payout failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded border border-white/10 p-4 space-y-4">
      <div className="font-semibold">Admin Story Tools</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="space-y-2">
          <div className="text-sm">Update Token URI</div>
          <input className="w-full rounded bg-white/10 p-2" placeholder="Token ID" value={tokenId} onChange={e=>setTokenId(e.target.value)} />
          <input className="w-full rounded bg-white/10 p-2" placeholder="https://... or ipfs://..." value={newURI} onChange={e=>setNewURI(e.target.value)} />
          <button onClick={doUpdate} disabled={busy} className="rounded bg-white/10 px-3 py-2 text-sm">Update URI</button>
        </div>
        <div className="space-y-2">
          <div className="text-sm">Add Funds (on-chain raised)</div>
          <input className="w-full rounded bg-white/10 p-2" placeholder="Token ID" value={tokenId} onChange={e=>setTokenId(e.target.value)} />
          <input type="number" className="w-full rounded bg-white/10 p-2" placeholder="Amount" value={addAmt} onChange={e=>setAddAmt(Number(e.target.value))} />
          <button onClick={doAddFunds} disabled={busy} className="rounded bg-white/10 px-3 py-2 text-sm">Add Raised</button>
        </div>
        <div className="space-y-2">
          <div className="text-sm">Burn / Revoke</div>
          <input className="w-full rounded bg-white/10 p-2" placeholder="Token ID" value={tokenId} onChange={e=>setTokenId(e.target.value)} />
          <button onClick={doBurn} disabled={busy} className="rounded bg-red-600 px-3 py-2 text-sm">Burn</button>
        </div>
        <div className="space-y-2">
          <div className="text-sm">Approve Payout</div>
          <input className="w-full rounded bg-white/10 p-2" placeholder="Token ID" value={tokenId} onChange={e=>setTokenId(e.target.value)} />
          <input type="number" className="w-full rounded bg-white/10 p-2" placeholder="Amount" value={payoutAmt} onChange={e=>setPayoutAmt(Number(e.target.value))} />
          <input className="w-full rounded bg-white/10 p-2" placeholder="Recipient wallet (for on-chain)" value={payoutRecipient} onChange={e=>setPayoutRecipient(e.target.value)} />
          <label className="flex items-center gap-2 text-xs opacity-80">
            <input type="checkbox" className="h-3 w-3" checked={payoutOnchain} onChange={e=>setPayoutOnchain(e.target.checked)} />
            On-chain payout
          </label>
          <button onClick={doPayout} disabled={busy} className="rounded bg-white/10 px-3 py-2 text-sm">Mark Payout Released</button>
        </div>
      </div>
      {msg && <div className="text-xs opacity-80 break-all">{msg}</div>}
    </div>
  )
}
