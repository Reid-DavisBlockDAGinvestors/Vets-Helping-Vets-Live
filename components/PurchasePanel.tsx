'use client'

import { useState } from 'react'

export default function PurchasePanel({ tokenId }: { tokenId: string }) {
  const [amount, setAmount] = useState<number>(25)
  const [email, setEmail] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [asset, setAsset] = useState<'ETH'|'SOL'>('ETH')
  const [bridge, setBridge] = useState<any>(null)

  const purchase = async () => {
    try {
      setLoading(true)
      setResult(null)
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, tokenId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'PURCHASE_FAILED')
      setResult(data)
    } catch (e: any) {
      alert(e?.message || 'Purchase failed')
    } finally {
      setLoading(false)
    }
  }

  const subscribe = async () => {
    try {
      if (!email) return alert('Email required for Stripe subscription')
      setLoading(true)
      setResult(null)
      const res = await fetch('/api/payments/stripe/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Math.round(amount * 100), customerEmail: email, tokenId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'SUBSCRIBE_FAILED')
      setResult(data)
      alert('Subscription created. Complete payment setup via Stripe client flow.')
    } catch (e:any) {
      alert(e?.message || 'Subscription failed')
    } finally { setLoading(false) }
  }

  const quoteBridge = async () => {
    try {
      setBridge(null)
      const res = await fetch('/api/bridges/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ asset, amount })
      })
      const data = await res.json()
      if (res.ok) setBridge(data)
    } catch {}
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm">Amount (USD)</label>
        <input type="number" min={1} className="w-full rounded bg-white/10 p-2" value={amount} onChange={e=>setAmount(Number(e.target.value))} />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded border border-white/10 p-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">One-time Donation</div>
            <button onClick={purchase} disabled={loading} className="rounded bg-patriotic-red px-3 py-1 text-sm">{loading ? 'Processing…' : 'Donate'}</button>
          </div>
          {result?.breakdown && (
            <div className="mt-3 rounded border border-white/10 p-3 text-sm">
              <p>Amount: ${'{'}result.breakdown.amount.toFixed(2){'}'}</p>
              <p>Nonprofit fee ({'{'}result.breakdown.nonprofitFeePct{'}'}%): ${'{'}result.breakdown.fee.toFixed(2){'}'}</p>
              <p>Creator receives: ${'{'}result.breakdown.toCreator.toFixed(2){'}'}</p>
            </div>
          )}
        </div>
        <div className="rounded border border-white/10 p-3">
          <div className="font-semibold">Recurring Donation (Stripe)</div>
          <div className="mt-2 space-y-2">
            <input className="w-full rounded bg-white/10 p-2" placeholder="Your email (required)" value={email} onChange={e=>setEmail(e.target.value)} />
            <button onClick={subscribe} disabled={loading} className="rounded bg-white/10 px-3 py-1 text-sm">{loading ? 'Creating…' : 'Start Monthly Subscription'}</button>
          </div>
        </div>
      </div>

      <div className="rounded border border-white/10 p-3">
        <div className="font-semibold">Bridge (Crypto → BDAG)</div>
        <div className="mt-2 flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs opacity-70">Asset</label>
            <select className="w-full rounded bg-white/10 p-2" value={asset} onChange={e=>setAsset(e.target.value as any)}>
              <option value="ETH">ETH</option>
              <option value="SOL">SOL</option>
            </select>
          </div>
          <button onClick={quoteBridge} className="rounded bg-white/10 px-3 py-2 text-sm">Get Quote</button>
        </div>
        {bridge && (
          <div className="mt-2 text-sm opacity-90">
            <p>Bridge Fee ({'{'}bridge.bridgeFeePct{'}'}%): {bridge.bridgeFee}</p>
            <p>Estimated Received: {bridge.estimatedReceived} {asset}</p>
            <p className="opacity-70">{bridge.notice}</p>
          </div>
        )}
      </div>
    </div>
  )
}
