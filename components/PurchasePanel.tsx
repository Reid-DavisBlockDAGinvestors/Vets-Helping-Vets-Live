'use client'

import { useEffect, useState } from 'react'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { useWallet } from '@/hooks/useWallet'
import { BrowserProvider, Contract, parseEther, formatEther, Interface } from 'ethers'
import { supabase } from '@/lib/supabase'

type PaymentTab = 'card' | 'crypto' | 'other'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''
const BDAG_USD_PRICE = 0.05 // Fixed test price: 1 BDAG = $0.05 USD

// V5 ABI for client-side edition minting
const MINT_EDITION_ABI = [
  'function mintWithBDAG(uint256 campaignId) external payable returns (uint256)',
  'function mintWithBDAGAndTip(uint256 campaignId, uint256 tipAmount) external payable returns (uint256)',
  'function getCampaign(uint256 campaignId) external view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
  'function totalCampaigns() external view returns (uint256)',
  'event EditionMinted(uint256 indexed campaignId, uint256 indexed tokenId, address indexed buyer, uint256 editionNumber, uint256 amount)',
]

type PurchasePanelProps = {
  campaignId: string  // V5: campaign ID instead of token ID
  tokenId?: string    // Legacy support
  pricePerNft?: number | null
  remainingCopies?: number | null
  isPendingOnchain?: boolean  // True if campaign is approved but not yet on-chain
}

export default function PurchasePanel({ campaignId, tokenId, pricePerNft, remainingCopies, isPendingOnchain }: PurchasePanelProps) {
  // V5: Use campaignId, fall back to tokenId for backwards compat
  const targetId = campaignId || tokenId || '0'
  const hasNftPrice = pricePerNft && pricePerNft > 0
  const [quantity, setQuantity] = useState<number>(1)
  const [tipAmount, setTipAmount] = useState<number>(0)
  const [customAmount, setCustomAmount] = useState<number>(hasNftPrice ? pricePerNft : 25)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<PaymentTab>('card')
  const [isMonthly, setIsMonthly] = useState(false)
  const [asset, setAsset] = useState<'BDAG'|'ETH'|'BTC'|'SOL'|'XRP'>('BDAG')
  const [cryptoMsg, setCryptoMsg] = useState<string>('')
  const [maxUsdAllowed, setMaxUsdAllowed] = useState<number | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const isOnchain = process.env.NEXT_PUBLIC_BDAG_ONCHAIN === 'true'
  
  // Wallet connection
  const wallet = useWallet()
  
  // Auth - get logged-in user's email
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setIsLoggedIn(true)
        setUserEmail(session.user.email || null)
        // Pre-fill email field with user's email
        if (session.user.email && !email) {
          setEmail(session.user.email)
        }
      } else {
        setIsLoggedIn(false)
        setUserEmail(null)
      }
    }
    checkAuth()
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (session?.user) {
        setIsLoggedIn(true)
        setUserEmail(session.user.email || null)
        if (session.user.email && !email) {
          setEmail(session.user.email)
        }
      } else {
        setIsLoggedIn(false)
        setUserEmail(null)
      }
    })
    
    return () => subscription.unsubscribe()
  }, [])
  
  // Calculate total based on whether this is an NFT purchase or donation
  const nftSubtotal = hasNftPrice ? pricePerNft * quantity : 0
  const totalAmount = hasNftPrice ? nftSubtotal + tipAmount : customAmount
  
  // Check if sold out
  const isSoldOut = remainingCopies !== null && remainingCopies !== undefined && remainingCopies <= 0
  const maxQuantity = remainingCopies !== null && remainingCopies !== undefined ? remainingCopies : 10

  useEffect(() => {
    if (activeTab !== 'crypto' || !isOnchain) return
    let cancelled = false
    async function run() {
      try {
        const res = await fetch('/api/purchase/preflight', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asset })
        })
        const data = await res.json().catch(() => ({}))
        if (!cancelled && res.ok) {
          setMaxUsdAllowed(data?.maxUsdAllowed ?? null)
        }
      } catch {}
    }
    run()
    return () => { cancelled = true }
  }, [asset, activeTab, isOnchain])

  const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

  const presetAmounts = [10, 25, 50, 100, 250]

  // Convert USD to BDAG
  const usdToBdag = (usd: number) => {
    return usd / BDAG_USD_PRICE
  }
  
  const bdagAmount = usdToBdag(totalAmount)
  const bdagTipAmount = tipAmount > 0 ? usdToBdag(tipAmount) : 0

  // Purchase with connected wallet (direct on-chain)
  const purchaseWithWallet = async () => {
    // Require login for NFT purchases to ensure we have email for receipt
    if (!isLoggedIn || !userEmail) {
      setCryptoMsg('Please log in to purchase NFTs. Your email is required for the purchase receipt.')
      return
    }
    
    if (!wallet.isConnected || !wallet.address) {
      setCryptoMsg('Please connect your wallet first')
      return
    }
    
    if (!wallet.isOnBlockDAG) {
      setCryptoMsg('Please switch to BlockDAG network')
      await wallet.switchToBlockDAG()
      return
    }

    if (!CONTRACT_ADDRESS) {
      setCryptoMsg('Contract not configured')
      return
    }

    // Block purchases for pending campaigns
    if (isPendingOnchain) {
      setCryptoMsg('⏳ Campaign is awaiting blockchain confirmation. Please wait for admin to verify the transaction.')
      return
    }

    // IMMEDIATE LOG - should appear as soon as button is clicked
    console.log(`[PurchasePanel] ========== PURCHASE STARTED ==========`)
    console.log(`[PurchasePanel] Campaign ID: ${targetId}, Price: ${pricePerNft}, Quantity: ${quantity}`)
    console.log(`[PurchasePanel] CONTRACT_ADDRESS: ${CONTRACT_ADDRESS}`)

    try {
      setLoading(true)
      setCryptoMsg('Verifying campaign on blockchain...')
      setTxHash(null)

      console.log(`[PurchasePanel] Getting ethereum provider...`)
      const ethereum = (window as any).ethereum
      if (!ethereum) {
        console.error('[PurchasePanel] No ethereum provider found!')
        setCryptoMsg('No wallet detected. Please install MetaMask.')
        setLoading(false)
        return
      }
      
      console.log(`[PurchasePanel] Creating BrowserProvider...`)
      const provider = new BrowserProvider(ethereum)
      
      console.log(`[PurchasePanel] Getting signer...`)
      const signer = await provider.getSigner()
      console.log(`[PurchasePanel] Signer address: ${await signer.getAddress()}`)
      
      console.log(`[PurchasePanel] Creating contract instance...`)
      const contract = new Contract(CONTRACT_ADDRESS, MINT_EDITION_ABI, signer)

      // Pre-flight check: Verify campaign exists and is active on-chain
      // Note: BlockDAG RPC can have latency issues, so we retry a few times
      console.log(`[PurchasePanel] Checking campaign ${targetId} on-chain...`)
      let verifyAttempts = 0
      const maxVerifyAttempts = 3
      let lastVerifyError: any = null
      
      while (verifyAttempts < maxVerifyAttempts) {
        try {
          const totalCampaigns = await contract.totalCampaigns()
          console.log(`[PurchasePanel] Total campaigns on-chain: ${totalCampaigns} (attempt ${verifyAttempts + 1})`)
          
          if (Number(targetId) >= Number(totalCampaigns)) {
            // Campaign ID is beyond total - might be RPC latency, retry
            if (verifyAttempts < maxVerifyAttempts - 1) {
              console.log(`[PurchasePanel] Campaign ${targetId} >= total ${totalCampaigns}, retrying...`)
              verifyAttempts++
              await new Promise(r => setTimeout(r, 2000)) // Wait 2 seconds
              continue
            }
            setCryptoMsg(`Campaign #${targetId} does not exist on-chain yet. Total campaigns: ${totalCampaigns}. The blockchain may be slow - please wait a moment and try again.`)
            setLoading(false)
            return
          }
          
          const campaign = await contract.getCampaign(BigInt(targetId))
          console.log(`[PurchasePanel] Campaign ${targetId} data:`, {
            category: campaign[0],
            baseURI: campaign[1]?.slice(0, 50),
            active: campaign[8],
            closed: campaign[9],
            editionsMinted: Number(campaign[5]),
            maxEditions: Number(campaign[6])
          })
          
          if (!campaign[8]) { // active is at index 8
            setCryptoMsg(`Campaign #${targetId} is not active on-chain. The campaign may need to be fixed in the admin panel.`)
            setLoading(false)
            return
          }
          
          if (campaign[9]) { // closed is at index 9
            setCryptoMsg(`Campaign #${targetId} is closed and no longer accepting purchases.`)
            setLoading(false)
            return
          }
          
          // Verification passed!
          break
        } catch (verifyErr: any) {
          lastVerifyError = verifyErr
          console.error(`[PurchasePanel] Campaign verification failed (attempt ${verifyAttempts + 1}):`, verifyErr?.message?.slice(0, 100))
          verifyAttempts++
          if (verifyAttempts < maxVerifyAttempts) {
            await new Promise(r => setTimeout(r, 2000)) // Wait 2 seconds before retry
          }
        }
      }
      
      if (verifyAttempts >= maxVerifyAttempts && lastVerifyError) {
        setCryptoMsg(`Failed to verify campaign after ${maxVerifyAttempts} attempts. The blockchain may be experiencing delays. Please try again in a moment.`)
        setLoading(false)
        return
      }

      setCryptoMsg('Preparing transaction...')

      // Calculate per-NFT price in BDAG (contract mints 1 NFT per call)
      const pricePerNftBdag = hasNftPrice ? usdToBdag(pricePerNft!) : bdagAmount
      const pricePerNftWei = parseEther(pricePerNftBdag.toFixed(18))
      const tipBdagWei = bdagTipAmount > 0 ? parseEther(bdagTipAmount.toFixed(18)) : 0n

      console.log(`[PurchasePanel] Minting ${quantity} edition(s) for campaign ${targetId}`)
      console.log(`[PurchasePanel] Price per NFT: ${pricePerNftBdag} BDAG (${pricePerNftWei} wei)`)
      console.log(`[PurchasePanel] Tip BDAG: ${bdagTipAmount} (${tipBdagWei} wei)`)
      console.log(`[PurchasePanel] Contract: ${CONTRACT_ADDRESS}`)
      
      const txHashes: string[] = []
      
      // Mint each NFT separately (contract mints 1 per call)
      const mintedTokenIds: number[] = []
      for (let i = 0; i < quantity; i++) {
        const isLast = i === quantity - 1
        setCryptoMsg(`Minting NFT ${i + 1} of ${quantity}... Please confirm in your wallet.`)
        
        let tx
        // Apply tip only on the last mint
        // Add explicit gas limit to avoid estimation failures on slow RPC
        const gasLimit = 300000n // Safe gas limit for minting
        
        try {
          if (isLast && tipBdagWei > 0n) {
            const valueWithTip = pricePerNftWei + tipBdagWei
            console.log(`[PurchasePanel] Calling mintWithBDAGAndTip(${targetId}, ${tipBdagWei}) with value ${valueWithTip}`)
            
            // Manually encode the function call to ensure data is included
            const iface = new Interface(MINT_EDITION_ABI)
            const callData = iface.encodeFunctionData('mintWithBDAGAndTip', [BigInt(targetId), tipBdagWei])
            console.log(`[PurchasePanel] Encoded call data: ${callData}`)
            
            // Try static call first to get revert reason if it would fail
            try {
              await contract.mintWithBDAGAndTip.staticCall(BigInt(targetId), tipBdagWei, { value: valueWithTip })
            } catch (staticErr: any) {
              console.error('[PurchasePanel] Static call failed:', staticErr)
              const reason = staticErr?.reason || staticErr?.message || 'Unknown error'
              throw new Error(`Contract would revert: ${reason}`)
            }
            
            // Send transaction with explicit data field
            tx = await signer.sendTransaction({
              to: CONTRACT_ADDRESS,
              value: valueWithTip,
              data: callData,
              gasLimit,
            })
          } else {
            console.log(`[PurchasePanel] Calling mintWithBDAG(${targetId}) with value ${pricePerNftWei}`)
            
            // Manually encode the function call to ensure data is included
            const iface = new Interface(MINT_EDITION_ABI)
            const callData = iface.encodeFunctionData('mintWithBDAG', [BigInt(targetId)])
            console.log(`[PurchasePanel] Encoded call data: ${callData}`)
            
            // Try static call first to get revert reason if it would fail
            try {
              await contract.mintWithBDAG.staticCall(BigInt(targetId), { value: pricePerNftWei })
            } catch (staticErr: any) {
              console.error('[PurchasePanel] Static call failed:', staticErr)
              const reason = staticErr?.reason || staticErr?.message || 'Unknown error'
              throw new Error(`Contract would revert: ${reason}`)
            }
            
            // Send transaction with explicit data field
            tx = await signer.sendTransaction({
              to: CONTRACT_ADDRESS,
              value: pricePerNftWei,
              data: callData,
              gasLimit,
            })
          }
        } catch (mintErr: any) {
          console.error('[PurchasePanel] Mint call failed:', mintErr)
          // Extract meaningful error message
          let errorMsg = mintErr?.reason || mintErr?.message || 'Transaction failed'
          if (errorMsg.includes('user rejected')) {
            errorMsg = 'Transaction cancelled by user'
          } else if (errorMsg.includes('insufficient funds')) {
            errorMsg = 'Insufficient BDAG balance in wallet'
          } else if (errorMsg.includes('Campaign not active')) {
            errorMsg = 'Campaign is not active on-chain'
          }
          setCryptoMsg(`❌ ${errorMsg}`)
          setLoading(false)
          return
        }
        
        txHashes.push(tx.hash)
        setTxHash(tx.hash)
        console.log(`[PurchasePanel] Tx ${i + 1}/${quantity} submitted: ${tx.hash}`)
        
        // Wait for each tx to confirm before the next (prevents nonce issues)
        setCryptoMsg(`Waiting for NFT ${i + 1} of ${quantity} to confirm...`)
        const receipt = await tx.wait(1)
        console.log(`[PurchasePanel] Tx ${i + 1}/${quantity} confirmed`)
        
        // Extract token ID from EditionMinted event in the receipt
        try {
          const editionMintedEvent = receipt?.logs?.find((log: any) => {
            try {
              const parsed = contract.interface.parseLog({ topics: log.topics as string[], data: log.data })
              return parsed?.name === 'EditionMinted'
            } catch { return false }
          })
          if (editionMintedEvent) {
            const parsed = contract.interface.parseLog({ topics: editionMintedEvent.topics as string[], data: editionMintedEvent.data })
            const tokenId = Number(parsed?.args?.tokenId || parsed?.args?.[1])
            if (tokenId > 0) {
              mintedTokenIds.push(tokenId)
              console.log(`[PurchasePanel] Minted token ID: ${tokenId}`)
            }
          }
        } catch (e) {
          console.warn('[PurchasePanel] Could not parse EditionMinted event:', e)
        }
      }
      
      console.log(`[PurchasePanel] All ${quantity} NFTs minted!`)
      
      // Record the purchase in our backend (use last tx hash)
      const lastTxHash = txHashes[txHashes.length - 1]
      const lastTokenId = mintedTokenIds.length > 0 ? mintedTokenIds[mintedTokenIds.length - 1] : null
      try {
        await fetch('/api/purchase/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: targetId,
            tokenId: lastTokenId, // The actual minted token ID for NFT import
            txHash: lastTxHash,
            amountUSD: totalAmount,
            tipUSD: tipAmount,
            amountBDAG: bdagAmount,
            tipBDAG: bdagTipAmount,
            walletAddress: wallet.address,
            editionMinted: lastTokenId, // Token ID or null
            mintedTokenIds, // All token IDs if multiple minted
            quantity, // Track how many were minted
            buyerEmail: userEmail || email, // Use logged-in user's email, fallback to manual entry
          })
        })
        console.log(`[PurchasePanel] Purchase recorded for campaign ${targetId}, tokenId=${lastTokenId}`)
      } catch (e) {
        // Non-critical - tx is already on-chain
        console.warn('Failed to record purchase:', e)
      }

      setResult({ success: true, txHash: lastTxHash, txHashes, quantity })
      setCryptoMsg(`🎉 ${quantity} NFT${quantity > 1 ? 's' : ''} minted successfully!`)
      wallet.updateBalance()
    } catch (e: any) {
      console.error('BDAG purchase error:', e)
      console.error('Error details:', JSON.stringify({
        code: e?.code,
        reason: e?.reason,
        data: e?.data,
        message: e?.message,
        info: e?.info,
      }, null, 2))
      if (e?.code === 'ACTION_REJECTED' || e?.code === 4001) {
        setCryptoMsg('Transaction cancelled')
      } else {
        // Try to extract revert reason
        const reason = e?.reason || e?.data?.message || e?.info?.error?.message || e?.message || 'Transaction failed'
        setCryptoMsg(reason.slice(0, 150))
      }
    } finally {
      setLoading(false)
    }
  }

  // Legacy API-based crypto purchase (for non-BDAG or fallback)
  const purchaseCrypto = async () => {
    try {
      setLoading(true)
      setCryptoMsg('')
      const res = await fetch('/api/purchase', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountUSD: totalAmount, asset, tokenId, quantity: hasNftPrice ? quantity : undefined })
      })
      const data = await res.json().catch(() => ({ error: 'Failed' }))
      if (!res.ok) {
        setCryptoMsg(data?.error || 'Payment failed')
        return
      }
      setResult(data)
      setCryptoMsg('Payment successful!')
    } catch (e: any) {
      setCryptoMsg(e?.message || 'Payment failed')
    } finally { setLoading(false) }
  }

  const CardPaymentForm = () => {
    const stripe = useStripe()
    const elements = useElements()
    const [submitting, setSubmitting] = useState(false)
    const [cardError, setCardError] = useState('')

    const handlePayment = async () => {
      if (!stripe || !elements) return
      setSubmitting(true)
      setCardError('')
      try {
        const endpoint = isMonthly ? '/api/payments/stripe/subscribe' : '/api/payments/stripe/intent'
        const res = await fetch(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            amount: Math.round(totalAmount * 100), 
            tokenId, 
            customerEmail: email || undefined 
          })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Payment failed')
        
        if (data.clientSecret) {
          const { error, paymentIntent } = await stripe.confirmCardPayment(data.clientSecret, {
            payment_method: { card: elements.getElement(CardElement)! },
            receipt_email: email || undefined
          })
          if (error) throw error
          if (paymentIntent?.status === 'succeeded') {
            setResult({ success: true })
          }
        }
      } catch (e: any) {
        setCardError(e?.message || 'Payment failed')
      } finally { setSubmitting(false) }
    }

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">Email (for receipt)</label>
          <input 
            type="email"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-white/40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">Card Details</label>
          <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3">
            <CardElement 
              options={{ 
                hidePostalCode: true,
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#ffffff',
                    '::placeholder': { color: 'rgba(255,255,255,0.4)' }
                  }
                }
              }} 
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMonthly(!isMonthly)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isMonthly ? 'bg-blue-600' : 'bg-white/20'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isMonthly ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className="text-sm text-white/70">Make this a monthly donation</span>
        </div>
        {cardError && <p className="text-red-400 text-sm">{cardError}</p>}
        <button
          onClick={handlePayment}
          disabled={submitting || !stripe}
          className="w-full rounded-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 px-6 py-4 font-semibold text-white shadow-lg shadow-red-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
              Processing...
            </span>
          ) : (
            hasNftPrice 
              ? `Purchase ${quantity} NFT${quantity > 1 ? 's' : ''} - $${totalAmount}${isMonthly ? '/month' : ''}`
              : `Donate $${totalAmount}${isMonthly ? '/month' : ''}`
          )}
        </button>
      </div>
    )
  }

  // If campaign is pending on-chain, show a message instead of purchase options
  if (isPendingOnchain) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-4 text-center">
          <span className="text-3xl mb-2 block">⏳</span>
          <p className="text-yellow-300 font-medium">Pending Blockchain Confirmation</p>
          <p className="text-yellow-300/70 text-sm mt-2">
            This campaign is being created on the blockchain. Please check back in a few minutes.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* NFT Purchase Mode */}
      {hasNftPrice ? (
        <div className="space-y-4">
          {/* Quantity Selector */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Quantity</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={isSoldOut || quantity <= 1}
                className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold disabled:opacity-50"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={maxQuantity}
                value={quantity}
                onChange={e => setQuantity(Math.min(maxQuantity, Math.max(1, Number(e.target.value))))}
                disabled={isSoldOut}
                className="w-20 text-center rounded-lg bg-white/5 border border-white/10 py-2 text-lg text-white"
              />
              <button
                onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                disabled={isSoldOut || quantity >= maxQuantity}
                className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold disabled:opacity-50"
              >
                +
              </button>
              <span className="text-white/50 text-sm">× ${pricePerNft} = ${nftSubtotal}</span>
            </div>
          </div>

          {/* Optional Tip */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Add a tip (optional)</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-2">
              {[0, 5, 10, 25, 50].map(tip => (
                <button
                  key={tip}
                  onClick={() => setTipAmount(tip)}
                  className={`rounded-lg py-2 text-sm font-medium transition-all ${
                    tipAmount === tip 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {tip === 0 ? 'None' : `$${tip}`}
                </button>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center pt-2 border-t border-white/10">
            <span className="text-white/70">Total</span>
            <span className="text-xl font-bold text-white">${totalAmount}</span>
          </div>
        </div>
      ) : (
        /* Donation Mode - No fixed NFT price */
        <div>
          <label className="block text-sm font-medium text-white/80 mb-3">Select Amount</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
            {presetAmounts.map(preset => (
              <button
                key={preset}
                onClick={() => setCustomAmount(preset)}
                className={`rounded-lg py-2 text-sm font-medium transition-all ${
                  customAmount === preset 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' 
                    : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                }`}
              >
                ${preset}
              </button>
            ))}
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 text-lg">$</span>
            <input
              type="number"
              min={1}
              value={customAmount}
              onChange={e => setCustomAmount(Number(e.target.value))}
              className="w-full rounded-lg bg-white/5 border border-white/10 pl-8 pr-4 py-3 text-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
        </div>
      )}

      {/* Payment Method Tabs */}
      <div>
        <div className="flex rounded-lg bg-white/5 p-1 mb-4">
          {[
            { id: 'card' as const, label: 'Card', icon: '💳' },
            { id: 'crypto' as const, label: 'Crypto', icon: '⛓️' },
            { id: 'other' as const, label: 'Other', icon: '📱' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-white/10 text-white shadow-sm' 
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Card Tab */}
        {activeTab === 'card' && (
          <Elements stripe={stripePromise}>
            <CardPaymentForm />
          </Elements>
        )}

        {/* Crypto Tab */}
        {activeTab === 'crypto' && (
          <div className="space-y-4">
            {/* Wallet Connection */}
            {!wallet.isConnected ? (
              <div className="space-y-3">
                <p className="text-sm text-white/70">Connect your wallet to pay with BDAG directly on-chain</p>
                <button
                  onClick={wallet.connect}
                  disabled={wallet.isConnecting}
                  className="w-full rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 px-6 py-4 font-semibold text-white shadow-lg shadow-orange-900/30 transition-all disabled:opacity-50"
                >
                  {wallet.isConnecting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                      Connecting...
                    </span>
                  ) : (
                    '🦊 Connect Wallet'
                  )}
                </button>
                {wallet.error && (
                  <p className="text-sm text-red-400">{wallet.error}</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Connected Wallet Info */}
                <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-sm text-white/70">Connected</span>
                    </div>
                    <button
                      onClick={wallet.disconnect}
                      className="text-xs text-white/50 hover:text-white/70"
                    >
                      Disconnect
                    </button>
                  </div>
                  <p className="text-white font-mono text-sm mt-1">
                    {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
                  </p>
                  {wallet.balance && (
                    <p className="text-white/50 text-xs mt-1">
                      Balance: {parseFloat(wallet.balance).toFixed(4)} BDAG
                    </p>
                  )}
                  {!wallet.isOnBlockDAG && (
                    <button
                      onClick={wallet.switchToBlockDAG}
                      className="mt-2 text-xs text-amber-400 hover:text-amber-300"
                    >
                      ⚠️ Switch to BlockDAG Network
                    </button>
                  )}
                </div>

                {/* BDAG Amount Display */}
                <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white/70 text-sm">Amount in BDAG</span>
                    <span className="text-white font-bold">{bdagAmount.toLocaleString()} BDAG</span>
                  </div>
                  <p className="text-xs text-white/40 mt-1">≈ ${totalAmount} USD</p>
                </div>

                {/* Pay Button */}
                {cryptoMsg && (
                  <p className={`text-sm ${cryptoMsg.includes('🎉') || cryptoMsg.includes('confirmed') ? 'text-green-400' : cryptoMsg.includes('cancelled') ? 'text-yellow-400' : 'text-white/70'}`}>
                    {cryptoMsg}
                  </p>
                )}
                <button
                  onClick={purchaseWithWallet}
                  disabled={loading || !wallet.isOnBlockDAG}
                  className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 px-6 py-4 font-semibold text-white shadow-lg shadow-purple-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                      Processing...
                    </span>
                  ) : (
                    `Pay ${bdagAmount.toLocaleString()} BDAG`
                  )}
                </button>

                {/* Transaction Hash */}
                {txHash && (
                  <a 
                    href={`https://awakening.bdagscan.com/tx/${txHash}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block text-center text-sm text-blue-400 hover:underline"
                  >
                    View transaction on explorer →
                  </a>
                )}
              </div>
            )}

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-[#0a1628] text-white/40">or pay with other crypto</span>
              </div>
            </div>

            {/* Other Crypto Options */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Select Asset</label>
              <select
                value={asset}
                onChange={e => setAsset(e.target.value as any)}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              >
                <option value="ETH">ETH (Ethereum)</option>
                <option value="BTC">BTC (Bitcoin)</option>
                <option value="SOL">SOL (Solana)</option>
              </select>
            </div>
            <button
              onClick={purchaseCrypto}
              disabled={loading}
              className="w-full rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 px-6 py-3 font-medium text-white transition-all disabled:opacity-50"
            >
              {loading ? 'Processing...' : `Pay $${totalAmount} with ${asset}`}
            </button>
          </div>
        )}

        {/* Other Payment Methods Tab */}
        {activeTab === 'other' && (
          <div className="space-y-3">
            <p className="text-sm text-white/50 mb-4">Choose an alternative payment method:</p>
            {[
              { name: 'PayPal', color: 'from-blue-600 to-blue-700', endpoint: '/api/payments/paypal/create' },
              { name: 'Cash App', color: 'from-green-600 to-green-700', endpoint: '/api/payments/cashapp' },
              { name: 'Venmo', color: 'from-cyan-600 to-blue-600', endpoint: '/api/payments/venmo' },
            ].map(method => (
              <button
                key={method.name}
                onClick={async () => {
                  try {
                    setLoading(true)
                    const res = await fetch(method.endpoint, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ amount: Math.round(totalAmount * 100), tokenId, email })
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data?.error)
                    if (data.approvalUrl) window.open(data.approvalUrl, '_blank')
                    if (data.deepLink) window.open(data.deepLink, '_blank')
                  } catch (e: any) {
                    alert(e?.message || `${method.name} failed`)
                  } finally { setLoading(false) }
                }}
                disabled={loading}
                className={`w-full rounded-lg bg-gradient-to-r ${method.color} px-6 py-4 font-semibold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-50`}
              >
                Pay with {method.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Success Message */}
      {result?.success && (
        <div className="rounded-lg bg-green-500/20 border border-green-500/30 p-4 text-center">
          <p className="text-green-400 font-semibold">Thank you for your donation!</p>
          <p className="text-sm text-green-400/70 mt-1">Your support makes a difference.</p>
        </div>
      )}

      {/* Trust Badges */}
      <div className="flex items-center justify-center gap-2 pt-4 pb-2 text-xs text-white/40 flex-wrap">
        <span>🔒 Secure</span>
        <span>•</span>
        <span>📧 Receipt</span>
        <span>•</span>
        <span>💯 Tax Deductible</span>
      </div>
    </div>
  )
}
