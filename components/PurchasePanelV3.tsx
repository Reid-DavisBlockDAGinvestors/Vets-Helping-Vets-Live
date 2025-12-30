'use client'

/**
 * PurchasePanelV3 - Fully Modular Purchase Flow
 * 
 * Orchestrator component using purchase-panel modules
 * Following ISP - delegates to focused hooks and components
 * 
 * Original PurchasePanelV2: 635 lines
 * Refactored PurchasePanelV3: ~250 lines (orchestrator pattern)
 * 
 * Uses modular components from ./purchase-panel:
 * - usePurchaseConfig - Price calculations
 * - usePurchaseAuth - Authentication state
 * - useBdagPurchase - BDAG blockchain transactions
 * - CardPaymentForm - Stripe card payment UI
 * - CryptoPaymentSection - Crypto payment UI
 * - SuccessMessage - Purchase success display
 */

import { useState, useEffect } from 'react'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { useWallet } from '@/hooks/useWallet'

import { 
  usePurchaseConfig,
  usePurchaseAuth,
  useBdagPurchase,
  CardPaymentForm,
  CryptoPaymentSection,
  SuccessMessage,
  type PurchasePanelProps,
  type PaymentTab
} from './purchase-panel'

// Contract configuration
const CONTRACT_ADDRESS_V5 = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_V5 || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const CONTRACT_ADDRESS_V6 = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0xaE54e4E8A75a81780361570c17b8660CEaD27053'
const DEFAULT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')
const presetAmounts = [10, 25, 50, 100, 250]

export default function PurchasePanelV3({ 
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
  const [activeTab, setActiveTab] = useState<PaymentTab>('card')
  const [isMonthly, setIsMonthly] = useState(false)
  const [loading, setLoading] = useState(false)

  // Modular hooks
  const wallet = useWallet()
  const auth = usePurchaseAuth()
  const config = usePurchaseConfig(pricePerNft, quantity, tipAmount, customAmount, remainingCopies)
  
  const bdagPurchase = useBdagPurchase({
    targetId,
    contractAddress: effectiveContractAddress,
    contractVersion,
    pricePerNft: pricePerNft ?? null,
    hasNftPrice: config.hasNftPrice,
    bdagAmount: config.bdagAmount,
    bdagTipAmount: config.bdagTipAmount,
    totalAmount: config.totalAmount,
    tipAmount,
    quantity,
    auth,
    wallet: {
      isConnected: wallet.isConnected,
      address: wallet.address,
      isOnBlockDAG: wallet.isOnBlockDAG,
      switchToBlockDAG: wallet.switchToBlockDAG,
      updateBalance: wallet.updateBalance
    },
    isPendingOnchain
  })

  // Set email from auth
  useEffect(() => {
    if (auth.userEmail && !email) setEmail(auth.userEmail)
  }, [auth.userEmail, email])

  // Pending on-chain state
  if (isPendingOnchain) {
    return (
      <div className="space-y-5" data-testid="purchase-panel-pending">
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-4 text-center">
          <span className="text-3xl mb-2 block">⏳</span>
          <p className="text-yellow-300 font-medium">Pending Blockchain Confirmation</p>
          <p className="text-yellow-300/70 text-sm mt-2">Please check back in a few minutes.</p>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="purchase-panel" className="space-y-5">
      {/* NFT Purchase Mode */}
      {config.hasNftPrice ? (
        <div className="space-y-4">
          {/* Quantity Selector */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Quantity</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={config.isSoldOut || quantity <= 1}
                data-testid="quantity-decrease-btn" aria-label="Decrease quantity"
                className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold disabled:opacity-50">−</button>
              <input type="number" min={1} max={config.maxQuantity} value={quantity} disabled={config.isSoldOut}
                onChange={e => setQuantity(Math.min(config.maxQuantity, Math.max(1, Number(e.target.value))))}
                data-testid="quantity-input" aria-label="Quantity"
                className="w-20 text-center rounded-lg bg-white/5 border border-white/10 py-2 text-lg text-white" />
              <button onClick={() => setQuantity(Math.min(config.maxQuantity, quantity + 1))} disabled={config.isSoldOut || quantity >= config.maxQuantity}
                data-testid="quantity-increase-btn" aria-label="Increase quantity"
                className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold disabled:opacity-50">+</button>
              <span className="text-white/50 text-sm">× ${pricePerNft} = ${config.nftSubtotal}</span>
            </div>
          </div>

          {/* Tip Selector */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Add a tip (optional)</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[0, 5, 10, 25, 50].map(tip => (
                <button key={tip} onClick={() => setTipAmount(tip)} data-testid={`tip-btn-${tip}`}
                  className={`rounded-lg py-2 text-sm font-medium transition-all ${
                    tipAmount === tip ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                  }`}>{tip === 0 ? 'None' : `$${tip}`}</button>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center pt-2 border-t border-white/10">
            <span className="text-white/70">Total</span>
            <span className="text-xl font-bold text-white" data-testid="total-amount">${config.totalAmount}</span>
          </div>
        </div>
      ) : (
        /* Donation Mode */
        <div>
          <label className="block text-sm font-medium text-white/80 mb-3">Select Amount</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
            {presetAmounts.map(preset => (
              <button key={preset} onClick={() => setCustomAmount(preset)} data-testid={`amount-btn-${preset}`}
                className={`rounded-lg py-2 text-sm font-medium transition-all ${
                  customAmount === preset ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                }`}>${preset}</button>
            ))}
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 text-lg">$</span>
            <input type="number" min={1} value={customAmount} onChange={e => setCustomAmount(Number(e.target.value))}
              data-testid="custom-amount-input"
              className="w-full rounded-lg bg-white/5 border border-white/10 pl-8 pr-4 py-3 text-lg text-white focus:border-blue-500" />
          </div>
        </div>
      )}

      {/* Payment Method Tabs */}
      <div>
        <div data-testid="payment-tabs" className="flex rounded-lg bg-white/5 p-1 mb-4">
          {[
            { id: 'card' as const, label: 'Card', icon: '💳' },
            { id: 'crypto' as const, label: 'Crypto', icon: '⛓️' },
            { id: 'other' as const, label: 'Other', icon: '📱' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} data-testid={`payment-tab-${tab.id}`}
              className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white/70'
              }`}><span className="mr-1.5">{tab.icon}</span>{tab.label}</button>
          ))}
        </div>

        {/* Card Tab */}
        {activeTab === 'card' && (
          <Elements stripe={stripePromise}>
            <CardPaymentForm
              totalAmount={config.totalAmount}
              tokenId={tokenId}
              email={email}
              onEmailChange={setEmail}
              isMonthly={isMonthly}
              onMonthlyChange={setIsMonthly}
              hasNftPrice={config.hasNftPrice}
              quantity={quantity}
              onSuccess={bdagPurchase.setResult}
              onError={(msg) => bdagPurchase.setCryptoMsg(`❌ ${msg}`)}
            />
          </Elements>
        )}

        {/* Crypto Tab */}
        {activeTab === 'crypto' && (
          <CryptoPaymentSection
            wallet={wallet}
            bdagAmount={config.bdagAmount}
            totalAmount={config.totalAmount}
            cryptoMsg={bdagPurchase.cryptoMsg}
            txHash={bdagPurchase.txHash}
            loading={bdagPurchase.loading}
            onPurchase={bdagPurchase.purchaseWithWallet}
          />
        )}

        {/* Other Payment Tab */}
        {activeTab === 'other' && (
          <div className="space-y-3" data-testid="other-payment-section">
            <p className="text-sm text-white/50 mb-4">Choose an alternative payment method:</p>
            {[
              { name: 'PayPal', color: 'from-blue-600 to-blue-700', endpoint: '/api/payments/paypal/create' },
              { name: 'Cash App', color: 'from-green-600 to-green-700', endpoint: '/api/payments/cashapp' },
              { name: 'Venmo', color: 'from-cyan-600 to-blue-600', endpoint: '/api/payments/venmo' },
            ].map(method => (
              <button key={method.name} disabled={loading} data-testid={`pay-${method.name.toLowerCase().replace(' ', '-')}-btn`}
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
      {bdagPurchase.result?.success && (
        <SuccessMessage result={bdagPurchase.result} contractAddress={effectiveContractAddress} />
      )}

      {/* Trust Badges */}
      <div className="flex items-center justify-center gap-2 pt-4 pb-2 text-xs text-white/40 flex-wrap">
        <span>🔒 Secure</span><span>•</span><span>📧 Receipt</span><span>•</span><span>💯 Tax Deductible</span>
      </div>
    </div>
  )
}
