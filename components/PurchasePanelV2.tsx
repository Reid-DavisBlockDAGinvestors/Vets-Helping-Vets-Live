'use client'

/**
 * PurchasePanelV2 - Modular Purchase Flow
 * 
 * Orchestrator component using purchase-panel modules
 * Following ISP - delegates to focused hooks and components
 * 
 * Reduced from 1,004 lines to ~650 lines through modularization
 */

import { useEffect, useState } from 'react'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { useWallet } from '@/hooks/useWallet'
import { BrowserProvider, Contract, parseEther, Interface } from 'ethers'
import { withRetry, IRetryConfig } from '@/lib/retry'
import { supabase } from '@/lib/supabase'
import { openBugReport } from '@/components/BugReportButton'
import { logger } from '@/lib/logger'

import { 
  usePurchaseConfig, 
  usdToBdag,
  type PurchasePanelProps,
  type PurchaseResult,
  type PaymentTab,
  type CryptoAsset
} from './purchase-panel'

// Contract configuration
const CONTRACT_ADDRESS_V5 = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_V5 || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const CONTRACT_ADDRESS_V6 = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0xaE54e4E8A75a81780361570c17b8660CEaD27053'
const DEFAULT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''

const MINT_EDITION_ABI = [
  'function mintWithBDAG(uint256 campaignId) external payable returns (uint256)',
  'function mintWithBDAGAndTip(uint256 campaignId, uint256 tipAmount) external payable returns (uint256)',
  'function getCampaign(uint256 campaignId) external view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
  'function totalCampaigns() external view returns (uint256)',
  'event EditionMinted(uint256 indexed campaignId, uint256 indexed tokenId, address indexed buyer, uint256 editionNumber, uint256 amount)',
]

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')
const presetAmounts = [10, 25, 50, 100, 250]

export default function PurchasePanelV2({ 
  campaignId, 
  tokenId, 
  pricePerNft, 
  remainingCopies, 
  isPendingOnchain, 
  contractVersion, 
  contractAddress 
}: PurchasePanelProps) {
  const targetId = campaignId || tokenId || '0'
  const effectiveContractAddress = contractAddress || (
    contractVersion === 'v5' ? CONTRACT_ADDRESS_V5 :
    contractVersion === 'v6' ? CONTRACT_ADDRESS_V6 :
    DEFAULT_CONTRACT_ADDRESS
  )

  // State
  const [quantity, setQuantity] = useState(1)
  const [tipAmount, setTipAmount] = useState(0)
  const [customAmount, setCustomAmount] = useState(pricePerNft && pricePerNft > 0 ? pricePerNft : 25)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PurchaseResult | null>(null)
  const [activeTab, setActiveTab] = useState<PaymentTab>('card')
  const [isMonthly, setIsMonthly] = useState(false)
  const [asset, setAsset] = useState<CryptoAsset>('BDAG')
  const [cryptoMsg, setCryptoMsg] = useState('')
  const [txHash, setTxHash] = useState<string | null>(null)

  // Wallet and auth
  const wallet = useWallet()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isEmailVerified, setIsEmailVerified] = useState(false)

  // Use modular config hook
  const config = usePurchaseConfig(pricePerNft, quantity, tipAmount, customAmount, remainingCopies)

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setIsLoggedIn(true)
        setUserEmail(session.user.email || null)
        setUserId(session.user.id || null)
        setIsEmailVerified(!!session.user.email_confirmed_at)
        if (session.user.email && !email) setEmail(session.user.email)
      }
    }
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsLoggedIn(true)
        setUserEmail(session.user.email || null)
        setUserId(session.user.id || null)
        setIsEmailVerified(!!session.user.email_confirmed_at)
        if (session.user.email && !email) setEmail(session.user.email)
      } else {
        setIsLoggedIn(false)
        setUserEmail(null)
        setUserId(null)
        setIsEmailVerified(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // BDAG wallet purchase
  const purchaseWithWallet = async () => {
    logger.debug(`[PurchasePanelV2] ========== PURCHASE INITIATED ==========`)
    
    if (!isLoggedIn || !userEmail) {
      setCryptoMsg('⚠️ Account required: Please log in or create an account first.')
      return
    }
    if (!isEmailVerified) {
      setCryptoMsg('Please verify your email address before purchasing.')
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
    if (!effectiveContractAddress) {
      setCryptoMsg('Contract not configured')
      return
    }
    if (isPendingOnchain) {
      setCryptoMsg('⏳ Campaign awaiting blockchain confirmation.')
      return
    }

    try {
      setLoading(true)
      setCryptoMsg('Verifying campaign on blockchain...')
      setTxHash(null)

      const ethereum = (window as any).ethereum
      if (!ethereum) {
        setCryptoMsg('No wallet detected. Please install MetaMask.')
        setLoading(false)
        return
      }

      const provider = new BrowserProvider(ethereum)
      const signer = await provider.getSigner()
      const contract = new Contract(effectiveContractAddress, MINT_EDITION_ABI, signer)

      // Verify campaign on-chain
      const verifyConfig: Partial<IRetryConfig> = {
        maxAttempts: 5,
        initialDelayMs: 2000,
        maxDelayMs: 10000,
        backoffMultiplier: 1.5,
      }

      type VerifyResult = { campaign: any; totalCampaigns: number }
      const verifyResult = await withRetry<VerifyResult>(
        async () => {
          const totalCampaigns = await contract.totalCampaigns()
          if (Number(targetId) >= Number(totalCampaigns)) {
            throw new Error(`CAMPAIGN_NOT_FOUND:${totalCampaigns}`)
          }
          const campaign = await contract.getCampaign(BigInt(targetId))
          return { campaign, totalCampaigns: Number(totalCampaigns) }
        },
        verifyConfig,
        (status) => {
          setCryptoMsg(`Verifying campaign... Attempt ${status.attempt}/${status.maxAttempts}`)
        }
      )

      if (!verifyResult.success) {
        const errorMsg = verifyResult.error?.message || ''
        if (errorMsg.startsWith('CAMPAIGN_NOT_FOUND:')) {
          setCryptoMsg(`Campaign #${targetId} not on-chain yet. Please wait and try again.`)
        } else {
          setCryptoMsg(`Verification failed. Please try again.`)
        }
        setLoading(false)
        return
      }

      const { campaign } = verifyResult.data!
      if (!campaign[8]) {
        setCryptoMsg(`Campaign #${targetId} is not active.`)
        setLoading(false)
        return
      }
      if (campaign[9]) {
        setCryptoMsg(`Campaign #${targetId} is closed.`)
        setLoading(false)
        return
      }

      setCryptoMsg('Preparing transaction...')

      const pricePerNftBdag = config.hasNftPrice ? usdToBdag(pricePerNft!) : config.bdagAmount
      const pricePerNftWei = parseEther(pricePerNftBdag.toFixed(18))
      const tipBdagWei = config.bdagTipAmount > 0 ? parseEther(config.bdagTipAmount.toFixed(18)) : 0n
      const gasLimit = 600000n

      const txHashes: string[] = []
      const mintedTokenIds: number[] = []

      for (let i = 0; i < quantity; i++) {
        const isLast = i === quantity - 1
        setCryptoMsg(`Minting NFT ${i + 1} of ${quantity}... Please confirm in wallet.`)

        let tx
        try {
          if (isLast && tipBdagWei > 0n) {
            const valueWithTip = pricePerNftWei + tipBdagWei
            tx = await contract.mintWithBDAGAndTip(BigInt(targetId), tipBdagWei, {
              value: valueWithTip,
              gasLimit,
            })
          } else {
            const populatedTx = await contract.mintWithBDAG.populateTransaction(BigInt(targetId), {
              value: pricePerNftWei,
              gasLimit,
            })
            if (!populatedTx.data || populatedTx.data === '0x') {
              throw new Error('Transaction data is empty')
            }
            tx = await signer.sendTransaction(populatedTx)
          }
        } catch (mintErr: any) {
          let errorMsg = mintErr?.reason || mintErr?.message || 'Transaction failed'
          if (errorMsg.includes('user rejected')) errorMsg = 'Transaction cancelled'
          else if (errorMsg.includes('insufficient funds')) errorMsg = 'Insufficient BDAG balance'
          setCryptoMsg(`❌ ${errorMsg}`)
          setLoading(false)
          return
        }

        txHashes.push(tx.hash)
        setTxHash(tx.hash)
        
        setCryptoMsg(`Waiting for NFT ${i + 1} confirmation...`)
        const receipt = await tx.wait(1)

        // Extract token ID from event
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
            if (tokenId > 0) mintedTokenIds.push(tokenId)
          }
        } catch {}
      }

      // Record purchase
      try {
        await fetch('/api/purchase/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: targetId,
            tokenId: mintedTokenIds[mintedTokenIds.length - 1] || null,
            txHash: txHashes[txHashes.length - 1],
            amountUSD: config.totalAmount,
            tipUSD: tipAmount,
            amountBDAG: config.bdagAmount,
            tipBDAG: config.bdagTipAmount,
            walletAddress: wallet.address,
            mintedTokenIds,
            quantity,
            buyerEmail: userEmail || email,
            userId,
            paymentMethod: 'crypto_bdag',
            contractVersion: contractVersion || 'v6',
            contractAddress: effectiveContractAddress,
          })
        })
      } catch {}

      setResult({ success: true, txHash: txHashes[txHashes.length - 1], txHashes, quantity, mintedTokenIds })
      if (mintedTokenIds.length === 1) {
        setCryptoMsg(`🎉 NFT minted! Token ID #${mintedTokenIds[0]}`)
      } else if (mintedTokenIds.length > 1) {
        setCryptoMsg(`🎉 ${quantity} NFTs minted! IDs: ${mintedTokenIds.join(', ')}`)
      } else {
        setCryptoMsg(`🎉 ${quantity} NFT${quantity > 1 ? 's' : ''} minted!`)
      }
      wallet.updateBalance()
    } catch (e: any) {
      if (e?.code === 'ACTION_REJECTED' || e?.code === 4001) {
        setCryptoMsg('Transaction cancelled')
      } else {
        setCryptoMsg((e?.reason || e?.message || 'Transaction failed').slice(0, 150))
      }
    } finally {
      setLoading(false)
    }
  }

  // Card Payment Form Component
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
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: Math.round(config.totalAmount * 100), tokenId, customerEmail: email || undefined })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Payment failed')

        if (data.clientSecret) {
          const { error, paymentIntent } = await stripe.confirmCardPayment(data.clientSecret, {
            payment_method: { card: elements.getElement(CardElement)! },
            receipt_email: email || undefined
          })
          if (error) throw error
          if (paymentIntent?.status === 'succeeded') setResult({ success: true })
        }
      } catch (e: any) {
        setCardError(e?.message || 'Payment failed')
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">Email (for receipt)</label>
          <input type="email" className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-white/40 focus:border-blue-500" 
            placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">Card Details</label>
          <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3">
            <CardElement options={{ hidePostalCode: true, style: { base: { fontSize: '16px', color: '#ffffff', '::placeholder': { color: 'rgba(255,255,255,0.4)' } } } }} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setIsMonthly(!isMonthly)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isMonthly ? 'bg-blue-600' : 'bg-white/20'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isMonthly ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className="text-sm text-white/70">Make this a monthly donation</span>
        </div>
        {cardError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-400 text-sm">{cardError}</p>
            <button onClick={() => openBugReport({ title: 'Card Payment Error', errorMessage: cardError, category: 'purchase' })}
              className="mt-1 text-xs text-red-300 hover:text-red-200 underline">🐛 Report issue</button>
          </div>
        )}
        <button onClick={handlePayment} disabled={submitting || !stripe}
          className="w-full rounded-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 px-6 py-4 font-semibold text-white shadow-lg disabled:opacity-50">
          {submitting ? 'Processing...' : config.hasNftPrice 
            ? `Purchase ${quantity} NFT${quantity > 1 ? 's' : ''} - $${config.totalAmount}${isMonthly ? '/month' : ''}`
            : `Donate $${config.totalAmount}${isMonthly ? '/month' : ''}`}
        </button>
      </div>
    )
  }

  // Pending on-chain state
  if (isPendingOnchain) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-4 text-center">
          <span className="text-3xl mb-2 block">⏳</span>
          <p className="text-yellow-300 font-medium">Pending Blockchain Confirmation</p>
          <p className="text-yellow-300/70 text-sm mt-2">Please check back in a few minutes.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* NFT Purchase Mode */}
      {config.hasNftPrice ? (
        <div className="space-y-4">
          {/* Quantity Selector */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Quantity</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={config.isSoldOut || quantity <= 1}
                className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold disabled:opacity-50">−</button>
              <input type="number" min={1} max={config.maxQuantity} value={quantity} disabled={config.isSoldOut}
                onChange={e => setQuantity(Math.min(config.maxQuantity, Math.max(1, Number(e.target.value))))}
                className="w-20 text-center rounded-lg bg-white/5 border border-white/10 py-2 text-lg text-white" />
              <button onClick={() => setQuantity(Math.min(config.maxQuantity, quantity + 1))} disabled={config.isSoldOut || quantity >= config.maxQuantity}
                className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold disabled:opacity-50">+</button>
              <span className="text-white/50 text-sm">× ${pricePerNft} = ${config.nftSubtotal}</span>
            </div>
          </div>

          {/* Tip Selector */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Add a tip (optional)</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[0, 5, 10, 25, 50].map(tip => (
                <button key={tip} onClick={() => setTipAmount(tip)}
                  className={`rounded-lg py-2 text-sm font-medium transition-all ${
                    tipAmount === tip ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                  }`}>{tip === 0 ? 'None' : `$${tip}`}</button>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center pt-2 border-t border-white/10">
            <span className="text-white/70">Total</span>
            <span className="text-xl font-bold text-white">${config.totalAmount}</span>
          </div>
        </div>
      ) : (
        /* Donation Mode */
        <div>
          <label className="block text-sm font-medium text-white/80 mb-3">Select Amount</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
            {presetAmounts.map(preset => (
              <button key={preset} onClick={() => setCustomAmount(preset)}
                className={`rounded-lg py-2 text-sm font-medium transition-all ${
                  customAmount === preset ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                }`}>${preset}</button>
            ))}
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 text-lg">$</span>
            <input type="number" min={1} value={customAmount} onChange={e => setCustomAmount(Number(e.target.value))}
              className="w-full rounded-lg bg-white/5 border border-white/10 pl-8 pr-4 py-3 text-lg text-white focus:border-blue-500" />
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
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white/70'
              }`}><span className="mr-1.5">{tab.icon}</span>{tab.label}</button>
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
            {!wallet.isConnected ? (
              <div className="space-y-3">
                <p className="text-sm text-white/70">Connect your wallet to pay with BDAG</p>
                <button onClick={wallet.connectAuto} disabled={wallet.isConnecting}
                  className="w-full rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 px-6 py-4 font-semibold text-white shadow-lg disabled:opacity-50">
                  {wallet.isConnecting ? 'Connecting...' : '🔗 Connect Wallet'}
                </button>
                {wallet.error && <p className="text-sm text-red-400">{wallet.error}</p>}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Wallet Info */}
                <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-sm text-white/70">Connected</span>
                    </div>
                    <button onClick={wallet.disconnect} className="text-xs text-white/50 hover:text-white/70">Disconnect</button>
                  </div>
                  <p className="text-white font-mono text-sm mt-1">{wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}</p>
                  {wallet.balance && <p className="text-white/50 text-xs mt-1">Balance: {parseFloat(wallet.balance).toFixed(4)} BDAG</p>}
                  {!wallet.isOnBlockDAG && (
                    <button onClick={wallet.switchToBlockDAG} className="mt-2 text-xs text-amber-400 hover:text-amber-300">
                      ⚠️ Switch to BlockDAG Network
                    </button>
                  )}
                </div>

                {/* BDAG Amount */}
                <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white/70 text-sm">Amount in BDAG</span>
                    <span className="text-white font-bold">{config.bdagAmount.toLocaleString()} BDAG</span>
                  </div>
                  <p className="text-xs text-white/40 mt-1">≈ ${config.totalAmount} USD</p>
                </div>

                {/* Status Messages */}
                {cryptoMsg && (
                  <div className={`rounded-lg p-3 ${
                    cryptoMsg.includes('🎉') ? 'bg-green-500/10 border border-green-500/30' :
                    cryptoMsg.includes('❌') || cryptoMsg.includes('failed') ? 'bg-red-500/10 border border-red-500/30' :
                    'bg-white/5 border border-white/10'
                  }`}>
                    <p className={`text-sm ${
                      cryptoMsg.includes('🎉') ? 'text-green-400' :
                      cryptoMsg.includes('❌') ? 'text-red-400' : 'text-white/70'
                    }`}>{cryptoMsg}</p>
                    {(cryptoMsg.includes('❌') || cryptoMsg.includes('failed')) && (
                      <button onClick={() => openBugReport({ title: 'Crypto Purchase Error', errorMessage: cryptoMsg, category: 'purchase' })}
                        className="mt-2 text-xs text-red-300 hover:text-red-200 underline">🐛 Report issue</button>
                    )}
                  </div>
                )}

                <button onClick={purchaseWithWallet} disabled={loading || !wallet.isOnBlockDAG}
                  className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 px-6 py-4 font-semibold text-white shadow-lg disabled:opacity-50">
                  {loading ? 'Processing...' : `Pay ${config.bdagAmount.toLocaleString()} BDAG`}
                </button>

                {txHash && (
                  <a href={`https://awakening.bdagscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                    className="block text-center text-sm text-blue-400 hover:underline">View transaction →</a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Other Payment Tab */}
        {activeTab === 'other' && (
          <div className="space-y-3">
            <p className="text-sm text-white/50 mb-4">Choose an alternative payment method:</p>
            {[
              { name: 'PayPal', color: 'from-blue-600 to-blue-700', endpoint: '/api/payments/paypal/create' },
              { name: 'Cash App', color: 'from-green-600 to-green-700', endpoint: '/api/payments/cashapp' },
              { name: 'Venmo', color: 'from-cyan-600 to-blue-600', endpoint: '/api/payments/venmo' },
            ].map(method => (
              <button key={method.name} disabled={loading}
                onClick={async () => {
                  try {
                    setLoading(true)
                    const res = await fetch(method.endpoint, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ amount: Math.round(config.totalAmount * 100), tokenId, email })
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data?.error)
                    if (data.approvalUrl) window.open(data.approvalUrl, '_blank')
                    if (data.deepLink) window.open(data.deepLink, '_blank')
                  } catch (e: any) {
                    alert(e?.message || `${method.name} failed`)
                  } finally { setLoading(false) }
                }}
                className={`w-full rounded-lg bg-gradient-to-r ${method.color} px-6 py-4 font-semibold text-white shadow-lg hover:opacity-90 disabled:opacity-50`}>
                Pay with {method.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Success Message */}
      {result?.success && (
        <div className="rounded-lg bg-green-500/20 border border-green-500/30 p-4 space-y-3">
          <div className="text-center">
            <p className="text-green-400 font-semibold">Thank you for your donation!</p>
          </div>
          {result.mintedTokenIds && result.mintedTokenIds.length > 0 && (
            <div className="bg-white/5 rounded-lg p-3 space-y-2">
              <p className="text-sm text-white/80 font-medium">Your NFT{result.mintedTokenIds.length > 1 ? 's' : ''}:</p>
              <div className="flex flex-wrap gap-2">
                {result.mintedTokenIds.map((tid: number) => (
                  <span key={tid} className="px-3 py-1 bg-green-500/20 rounded-full text-green-400 text-sm font-mono">Token #{tid}</span>
                ))}
              </div>
              <div className="pt-2 border-t border-white/10 mt-2">
                <p className="text-xs text-white/60 mb-2">To view in MetaMask:</p>
                <ol className="text-xs text-white/50 space-y-1 list-decimal list-inside">
                  <li>Open MetaMask → NFTs tab</li>
                  <li>Click "Import NFT"</li>
                  <li>Contract: <span className="font-mono text-white/70">{effectiveContractAddress.slice(0,6)}...{effectiveContractAddress.slice(-4)}</span></li>
                  <li>Token ID: <span className="font-mono text-green-400">{result.mintedTokenIds[result.mintedTokenIds.length - 1]}</span></li>
                </ol>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trust Badges */}
      <div className="flex items-center justify-center gap-2 pt-4 pb-2 text-xs text-white/40 flex-wrap">
        <span>🔒 Secure</span><span>•</span><span>📧 Receipt</span><span>•</span><span>💯 Tax Deductible</span>
      </div>
    </div>
  )
}
