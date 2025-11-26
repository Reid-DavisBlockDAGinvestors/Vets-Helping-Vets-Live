'use client'

import { useEffect, useState } from 'react'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import WalletConnectButton from './WalletConnectButton'

export default function PurchasePanel({ tokenId }: { tokenId: string }) {
  const [amount, setAmount] = useState<number>(5)
  const [email, setEmail] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [asset, setAsset] = useState<'BDAG'|'ETH'|'BTC'|'SOL'|'XRP'>('BDAG')
  const [bridge, setBridge] = useState<any>(null)
  const [toAddress, setToAddress] = useState('')
  const isOnchain = process.env.NEXT_PUBLIC_BDAG_ONCHAIN === 'true'
  const onchainActive = isOnchain && asset === 'BDAG'
  const [cryptoMsg, setCryptoMsg] = useState<string>('')
  const [maxUsdAllowed, setMaxUsdAllowed] = useState<number | null>(null)
  const [maxAssetAllowed, setMaxAssetAllowed] = useState<number | null>(null)
  const [preflightMsg, setPreflightMsg] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    async function run() {
      setPreflightMsg('')
      setMaxUsdAllowed(null)
      setMaxAssetAllowed(null)
      if (!onchainActive) return
      try {
        const res = await fetch('/api/purchase/preflight', {
          method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ asset })
        })
        const data = await res.json().catch(()=>({ error: 'INVALID_JSON_RESPONSE' }))
        if (!res.ok) {
          setPreflightMsg(data?.error || 'Preflight failed')
          return
        }
        if (!cancelled) {
          setMaxUsdAllowed(typeof data?.maxUsdAllowed === 'number' ? data.maxUsdAllowed : null)
          setMaxAssetAllowed(typeof data?.maxAssetAllowed === 'number' ? data.maxAssetAllowed : null)
        }
      } catch (e:any) {
        if (!cancelled) setPreflightMsg(e?.message || 'Preflight failed')
      }
    }
    run()
    return () => { cancelled = true }
  }, [asset, onchainActive])

  const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

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

  const createPayPal = async () => {
    try {
      const res = await fetch('/api/payments/paypal/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Math.round(amount * 100), tokenId, email: email || undefined })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'PAYPAL_FAILED')
      setResult(data)
      if (data.approvalUrl) window.open(data.approvalUrl, '_blank')
    } catch (e:any) { alert(e?.message || 'PayPal init failed') }
  }

  const createCashApp = async () => {
    try {
      const res = await fetch('/api/payments/cashapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Math.round(amount * 100), tokenId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'CASHAPP_FAILED')
      setResult(data)
      if (data.deepLink) window.open(data.deepLink, '_blank')
    } catch (e:any) { alert(e?.message || 'Cash App init failed') }
  }

  const createVenmo = async () => {
    try {
      const res = await fetch('/api/payments/venmo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Math.round(amount * 100), tokenId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'VENMO_FAILED')
      setResult(data)
      if (data.deepLink) window.open(data.deepLink, '_blank')
    } catch (e:any) { alert(e?.message || 'Venmo init failed') }
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
      // Client confirmation will be handled by Elements form below
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

  const purchaseCrypto = async () => {
    try {
      setLoading(true)
      setResult(null)
      setCryptoMsg('')
      let res = await fetch('/api/purchase', {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ amountUSD: amount, asset, tokenId, toAddress: toAddress || undefined })
      })
      // Simple retry on network error
      if (!res.ok && res.status >= 500) {
        await new Promise(r=>setTimeout(r, 500))
        res = await fetch('/api/purchase', {
          method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ amountUSD: amount, asset, tokenId, toAddress: toAddress || undefined })
        })
      }
      const data = await res.json().catch(()=>({ error: 'INVALID_JSON_RESPONSE' }))
      if (!res.ok) {
        const msg = [data?.error, data?.details].filter(Boolean).join(': ')
        setCryptoMsg(msg || 'CRYPTO_PURCHASE_FAILED')
        return
      }
      setResult(data)
      setCryptoMsg('On-chain transfer complete.')
    } catch (e:any) {
      const msg = e?.message || 'Crypto purchase failed'
      setCryptoMsg(msg)
    } finally { setLoading(false) }
  }

  const OneTimeForm = () => {
    const stripe = useStripe()
    const elements = useElements()
    const [submitting, setSubmitting] = useState(false)

    const onPay = async () => {
      if (!stripe || !elements) return
      setSubmitting(true)
      try {
        const res = await fetch('/api/payments/stripe/intent', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: Math.round(amount * 100), tokenId, customerEmail: email || undefined })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'INTENT_FAILED')
        setResult(data)
        if (data.clientSecret) {
          const { error, paymentIntent } = await stripe.confirmCardPayment(data.clientSecret, {
            payment_method: { card: elements.getElement(CardElement)! },
            receipt_email: email || undefined
          })
          if (error) throw error
          if (paymentIntent?.status === 'succeeded') alert('Payment successful! Receipt will be emailed if provided.')
        }
      } catch (e:any) {
        alert(e?.message || 'Payment failed')
      } finally { setSubmitting(false) }
    }

    return (
      <div className="space-y-2">
        <CardElement options={{ hidePostalCode: true }} />
        <button onClick={onPay} disabled={submitting} className="rounded bg-patriotic-red px-3 py-1 text-sm">{submitting ? 'Processing…' : 'Pay One‑Time'}</button>
      </div>
    )
  }

  const SubscriptionForm = () => {
    const stripe = useStripe()
    const elements = useElements()
    const [submitting, setSubmitting] = useState(false)

    const onSubscribe = async () => {
      if (!stripe || !elements) return
      if (!email) return alert('Email required for subscription')
      setSubmitting(true)
      try {
        const res = await fetch('/api/payments/stripe/subscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: Math.round(amount * 100), customerEmail: email, tokenId })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'SUBSCRIBE_FAILED')
        setResult(data)
        if (data.clientSecret) {
          const { error } = await stripe.confirmCardPayment(data.clientSecret, {
            payment_method: { card: elements.getElement(CardElement)! },
            receipt_email: email
          })
          if (error) throw error
          alert('Subscription started. Next invoices will be charged automatically.')
        }
      } catch (e:any) {
        alert(e?.message || 'Subscription failed')
      } finally { setSubmitting(false) }
    }

    return (
      <div className="space-y-2">
        <CardElement options={{ hidePostalCode: true }} />
        <button onClick={onSubscribe} disabled={submitting} className="rounded bg-white/10 px-3 py-1 text-sm">{submitting ? 'Creating…' : 'Start Monthly Subscription'}</button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm">Amount (USD)</label>
        <input type="number" min={1} className="w-full rounded bg-white/10 p-2" value={amount} onChange={e=>setAmount(Number(e.target.value))} />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded border border-white/10 p-3">
          <div className="relative flex items-center justify-between">
            <div className="font-semibold">One-time Donation</div>
            <div className="flex items-center gap-2">
              <WalletConnectButton />
              <button onClick={purchase} disabled={loading} className="relative z-10 rounded bg-patriotic-red px-3 py-1 text-sm">{loading ? 'Processing…' : 'Donate (Mock)'}</button>
            </div>
          </div>
          {result?.breakdown && (
            <div className="mt-3 rounded border border-white/10 p-3 text-sm">
              <p>{`Amount: $${Number(result.breakdown.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
              <p>{`Nonprofit fee (${result.breakdown.nonprofitFeePct ?? 1}%): $${Number(result.breakdown.fee ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
              <p>{`Creator receives: $${Number(result.breakdown.toCreator ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
            </div>
          )}
          <div className="mt-3 space-y-2">
            <input className="w-full rounded bg-white/10 p-2" placeholder="Email for receipt (optional)" value={email} onChange={e=>setEmail(e.target.value)} />
            <Elements stripe={stripePromise}><OneTimeForm /></Elements>
          </div>
        </div>
        <div className="rounded border border-white/10 p-3">
          <div className="font-semibold">Recurring Donation (Stripe)</div>
          <div className="mt-2 space-y-2">
            <input className="w-full rounded bg-white/10 p-2" placeholder="Your email (required)" value={email} onChange={e=>setEmail(e.target.value)} />
            <Elements stripe={stripePromise}><SubscriptionForm /></Elements>
          </div>
        </div>
      </div>

      <div className="rounded border border-white/10 p-3">
        <div className="flex items-center gap-2">
          <div className="font-semibold">Bridge (Crypto → BDAG)</div>
          {isOnchain && (
            <span className="rounded bg-green-600/20 px-2 py-0.5 text-xs text-green-300">BDAG On‑chain Active</span>
          )}
        </div>
        <div className="mt-2 flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs opacity-70">Asset</label>
            <select className="w-full rounded bg-white/10 p-2" value={asset} onChange={e=>setAsset(e.target.value as any)}>
              <option value="BDAG">BDAG (native)</option>
              <option value="ETH">ETH</option>
              <option value="BTC">BTC</option>
              <option value="SOL">SOL</option>
              <option value="XRP">XRP</option>
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
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="text-xs opacity-70">Creator Wallet (optional override)</label>
            <input data-testid="creator-wallet-input" className="w-full rounded bg-white/10 p-2" placeholder={'0x... / addr... (optional)'} value={toAddress} onChange={e=>setToAddress(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button data-testid="pay-crypto" onClick={purchaseCrypto} disabled={loading || (!!maxUsdAllowed && amount > maxUsdAllowed)} className="w-full rounded bg-white/10 px-3 py-2 text-sm">{loading ? 'Processing…' : (onchainActive ? 'Pay with BDAG (On‑chain)' : 'Pay with Crypto (Mock)')}
            </button>
          </div>
          {(onchainActive && typeof maxUsdAllowed === 'number') && (
            <div className="md:col-span-3 text-xs opacity-80 mt-1">{`Max available: $${maxUsdAllowed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${maxAssetAllowed? ` (~${maxAssetAllowed.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} BDAG)` : ''}`}</div>
          )}
          {preflightMsg && (
            <div className="md:col-span-3 text-xs opacity-80 mt-1">{preflightMsg}</div>
          )}
          {cryptoMsg && (
            <div className="md:col-span-3 text-xs opacity-80 mt-2 break-all">{cryptoMsg}</div>
          )}
        </div>
        {result?.explorerUrl && (
          <div className="mt-2 text-sm">
            <p>Txn Hash: <span className="break-all">{result.txHash}</span></p>
            <a href={result.explorerUrl} target="_blank" className="text-blue-300 underline">View on Explorer</a>
            {result.feeExplorerUrl && (
              <div className="mt-1">
                <p>Fee Txn Hash: <span className="break-all">{result.feeTxHash}</span></p>
                <a href={result.feeExplorerUrl} target="_blank" className="text-blue-300 underline">View Fee on Explorer</a>
              </div>
            )}
            {result.conversion && (
              <p className="opacity-80">{`USD→${asset}: $${result.conversion.usdPrice} per ${asset}, sending ≈ ${result.conversion.amountAsset} ${asset}`}</p>
            )}
          </div>
        )}
      </div>

      <div className="rounded border border-white/10 p-3">
        <div className="font-semibold">Other Payment Options</div>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
          <button onClick={createPayPal} className="rounded bg-white/10 px-3 py-2 text-sm">PayPal</button>
          <button onClick={createCashApp} className="rounded bg-white/10 px-3 py-2 text-sm">Cash App</button>
          <button onClick={createVenmo} className="rounded bg-white/10 px-3 py-2 text-sm">Venmo</button>
        </div>
        {result?.breakdown && (
          <div className="mt-2 text-sm opacity-90">
            <p>{`Amount: $${(result.breakdown.amount/100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
            <p>{`Nonprofit fee: $${(result.breakdown.fee/100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
            <p>{`Creator receives: $${(result.breakdown.toCreator/100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
            {result.notice && <p className="opacity-70">{result.notice}</p>}
          </div>
        )}
        <p className="mt-2 text-xs opacity-70">If unavailable, use Stripe card above (fallback).</p>
      </div>
    </div>
  )
}
