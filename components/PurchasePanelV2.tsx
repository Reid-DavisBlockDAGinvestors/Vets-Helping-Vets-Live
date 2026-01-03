'use client'

/**
 * PurchasePanelV2 - Modular Purchase Flow
 * 
 * Orchestrator component using purchase-panel modules
 * Following ISP - delegates to focused hooks and components
 * 
 * Refactored to use modular components from ./purchase-panel/
 */

import { useState } from 'react'
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
  type PaymentTab,
} from './purchase-panel'
import { useEthPurchase, usdToEth } from './purchase-panel/hooks/useEthPurchase'
import { useLivePrice } from '@/hooks/useLivePrice'
import { getEffectiveContractAddress, PRESET_AMOUNTS, TIP_OPTIONS } from './purchase-panel/constants'
import { getTestnetWarning, isTestnetChain, getContractAddress, type ChainId } from '@/lib/chains'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

export default function PurchasePanelV2({ 
  campaignId, 
  tokenId, 
  pricePerNft, 
  remainingCopies, 
  isPendingOnchain, 
  contractVersion, 
  contractAddress,
  chainId: propChainId
}: PurchasePanelProps) {
  const targetId = campaignId || tokenId || '0'
  const effectiveContractAddress = getEffectiveContractAddress(contractAddress, contractVersion as 'v5' | 'v6')
  
  // Determine network type based on chainId (for default network selection)
  const isEthereumMainnet = propChainId === 1
  const isSepoliaTestnet = propChainId === 11155111

  // UI State
  const [quantity, setQuantity] = useState(1)
  const [giftAmount, setGiftAmount] = useState(0)
  const [customGiftAmount, setCustomGiftAmount] = useState('')
  const [customAmount, setCustomAmount] = useState(pricePerNft && pricePerNft > 0 ? pricePerNft : 25)
  const [email, setEmail] = useState('')
  const [activeTab, setActiveTab] = useState<PaymentTab>('card')
  const [isMonthly, setIsMonthly] = useState(false)
  const [cardResult, setCardResult] = useState<{ success: boolean } | null>(null)
  const [otherLoading, setOtherLoading] = useState(false)
  const [donorNote, setDonorNote] = useState('')
  const [donorName, setDonorName] = useState('')
  const [showNoteField, setShowNoteField] = useState(false)
  // Default network based on campaign's chainId
  const defaultNetwork = isEthereumMainnet ? 'ethereum' : isSepoliaTestnet ? 'sepolia' : 'bdag'
  const [selectedNetwork, setSelectedNetwork] = useState<'bdag' | 'sepolia' | 'ethereum'>(defaultNetwork)

  // Modular hooks
  const wallet = useWallet()
  const auth = usePurchaseAuth()
  const config = usePurchaseConfig(pricePerNft, quantity, giftAmount, customAmount, remainingCopies)
  
  // Determine chainId based on selected network
  const liveChainId = selectedNetwork === 'ethereum' ? 1 : selectedNetwork === 'sepolia' ? 11155111 : 1043
  const isEthNetwork = selectedNetwork === 'ethereum' || selectedNetwork === 'sepolia'
  
  // Live price for native currency (ETH for Sepolia/Mainnet, BDAG for BlockDAG)
  const { price: livePrice, loading: priceLoading, refresh: refreshPrice } = useLivePrice(liveChainId, { 
    refreshInterval: 60000, 
    enabled: true // Always fetch live price
  })
  const ethRate = livePrice?.priceUsd || 3100 // Fallback to $3100 for ETH
  const bdagRate = livePrice?.priceUsd || 0.05 // Fallback to $0.05 for BDAG
  
  // V7/V8 ETH contract addresses
  const sepoliaContractAddress = getContractAddress(11155111, 'v8') || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_V8_SEPOLIA || ''
  const ethereumContractAddress = getContractAddress(1, 'v8') || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_V8_MAINNET || '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e'
  
  // Select contract address and chainId based on selected network
  const ethContractAddress = selectedNetwork === 'ethereum' ? ethereumContractAddress : sepoliaContractAddress
  const ethChainId = selectedNetwork === 'ethereum' ? 1 : 11155111

  // BDAG purchase hook (BlockDAG network)
  const bdagPurchase = useBdagPurchase({
    targetId,
    contractAddress: effectiveContractAddress,
    contractVersion,
    pricePerNft: pricePerNft ?? null,
    hasNftPrice: config.hasNftPrice,
    bdagAmount: config.bdagAmount,
    bdagTipAmount: config.bdagGiftAmount,
    totalAmount: config.totalAmount,
    giftAmount,
    quantity,
    auth,
    wallet,
    isPendingOnchain,
    donorNote: donorNote.trim() || undefined,
    donorName: donorName.trim() || undefined,
  })

  // Calculate ETH amounts using live rate
  const ethAmountLive = (config.totalAmount - giftAmount) / ethRate
  const ethTipAmountLive = giftAmount / ethRate
  
  // ETH purchase hook (Sepolia testnet or Ethereum Mainnet)
  const ethPurchase = useEthPurchase({
    targetId,
    contractAddress: ethContractAddress,
    contractVersion: 'v8',
    chainId: ethChainId,
    pricePerNft: pricePerNft ?? null,
    hasNftPrice: config.hasNftPrice,
    ethAmount: ethAmountLive,
    ethGiftAmount: ethTipAmountLive,
    totalAmountUsd: config.totalAmount,
    giftAmountUsd: giftAmount,
    quantity,
    auth,
    wallet: {
      ...wallet,
      chainId: wallet.chainId,
    },
    isPendingOnchain,
    donorNote: donorNote.trim() || undefined,
    donorName: donorName.trim() || undefined,
  })

  // Select active purchase hook based on network
  const activePurchase = (selectedNetwork === 'sepolia' || selectedNetwork === 'ethereum') ? ethPurchase : bdagPurchase

  // Combined result from card or crypto
  const result = activePurchase.result || (cardResult?.success ? { success: true } : null)

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
    <div data-testid="purchase-panel" className="space-y-5">
      {/* NFT Purchase Mode */}
      {config.hasNftPrice ? (
        <div className="space-y-4">
          {/* Quantity Selector */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Quantity</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={config.isSoldOut || quantity <= 1}
                data-testid="quantity-decrease-btn"
                aria-label="Decrease quantity"
                className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold disabled:opacity-50">−</button>
              <input type="number" min={1} max={config.maxQuantity} value={quantity} disabled={config.isSoldOut}
                onChange={e => setQuantity(Math.min(config.maxQuantity, Math.max(1, Number(e.target.value))))}
                data-testid="quantity-input"
                aria-label="Quantity"
                className="w-20 text-center rounded-lg bg-white/5 border border-white/10 py-2 text-lg text-white" />
              <button onClick={() => setQuantity(Math.min(config.maxQuantity, quantity + 1))} disabled={config.isSoldOut || quantity >= config.maxQuantity}
                data-testid="quantity-increase-btn"
                aria-label="Increase quantity"
                className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold disabled:opacity-50">+</button>
              <span className="text-white/50 text-sm">× ${pricePerNft} = ${config.nftSubtotal}</span>
            </div>
          </div>

          {/* Gift Selector */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Add a gift (optional)</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[0, 5, 10, 25, 50].map(gift => (
                <button key={gift} onClick={() => { setGiftAmount(gift); setCustomGiftAmount(''); }}
                  data-testid={`gift-${gift}-btn`}
                  className={`rounded-lg py-2 text-sm font-medium transition-all ${
                    giftAmount === gift && !customGiftAmount ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                  }`}>{gift === 0 ? 'None' : `$${gift}`}</button>
              ))}
              <button
                onClick={() => setCustomGiftAmount(customGiftAmount || '0')}
                data-testid="gift-custom-btn"
                className={`rounded-lg py-2 text-sm font-medium transition-all ${
                  customGiftAmount !== '' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                }`}
              >Custom</button>
            </div>
            {customGiftAmount !== '' && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-white/70">$</span>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={customGiftAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomGiftAmount(val);
                    setGiftAmount(parseFloat(val) || 0);
                  }}
                  placeholder="Enter amount"
                  data-testid="custom-gift-input"
                  className="w-24 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white text-sm"
                />
              </div>
            )}
          </div>

          {/* Total */}
          <div className="flex justify-between items-center pt-2 border-t border-white/10">
            <span className="text-white/70">Total</span>
            <span className="text-xl font-bold text-white">${config.totalAmount}</span>
          </div>

          {/* Personal Note to Creator */}
          <div className="pt-2">
            {!showNoteField ? (
              <button
                onClick={() => setShowNoteField(true)}
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                data-testid="add-note-btn"
              >
                <span>💌</span> Add a personal note to the fundraiser
              </button>
            ) : (
              <div className="space-y-3 bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-white/80">💌 Personal Note</label>
                  <button
                    onClick={() => { setShowNoteField(false); setDonorNote(''); setDonorName(''); }}
                    className="text-xs text-white/50 hover:text-white/70"
                  >✕ Remove</button>
                </div>
                <input
                  type="text"
                  placeholder="Your name (optional, or stay anonymous)"
                  value={donorName}
                  onChange={e => setDonorName(e.target.value)}
                  maxLength={100}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30"
                  data-testid="donor-name-input"
                />
                <textarea
                  placeholder="Write a message to the fundraiser... They'll receive it with their donation notification."
                  value={donorNote}
                  onChange={e => setDonorNote(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 resize-none"
                  data-testid="donor-note-input"
                />
                <p className="text-xs text-white/40">{donorNote.length}/500 characters</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Donation Mode */
        <div>
          <label className="block text-sm font-medium text-white/80 mb-3">Select Amount</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
            {PRESET_AMOUNTS.map((preset: number) => (
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
        <div data-testid="payment-tabs" className="flex rounded-lg bg-white/5 p-1 mb-4">
          {[
            { id: 'card' as const, label: 'Card', icon: '💳' },
            { id: 'crypto' as const, label: 'Crypto', icon: '⛓️' },
            { id: 'other' as const, label: 'Other', icon: '📱' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              data-testid={`payment-tab-${tab.id}`}
              className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white/70'
              }`}><span className="mr-1.5">{tab.icon}</span>{tab.label}</button>
          ))}
        </div>

        {/* Card Tab - Coming Soon */}
        {activeTab === 'card' && (
          <div className="relative">
            {/* Coming Soon Overlay */}
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
              <div className="text-center">
                <span className="text-3xl font-bold text-white/30 rotate-[-15deg] inline-block transform">
                  🚧 Coming Soon
                </span>
                <p className="text-white/50 text-sm mt-2">Card payments launching soon!</p>
              </div>
            </div>
            <div className="opacity-30 pointer-events-none">
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
                  onSuccess={(r) => setCardResult(r)}
                  onError={() => {}}
                />
              </Elements>
            </div>
          </div>
        )}

        {/* Crypto Tab */}
        {activeTab === 'crypto' && (
          <div className="space-y-4">
            {/* Network Selector - Only show Ethereum for Mainnet campaigns */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                {isEthereumMainnet ? 'Payment Network' : 'Select Network'}
              </label>
              <div className={`grid gap-2 ${isEthereumMainnet ? 'grid-cols-1' : 'grid-cols-3'}`}>
                {/* Only show testnet options for non-mainnet campaigns */}
                {!isEthereumMainnet && (
                  <>
                    <button
                      onClick={() => setSelectedNetwork('bdag')}
                      data-testid="network-bdag-btn"
                      className={`rounded-lg py-3 px-3 text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                        selectedNetwork === 'bdag' 
                          ? 'bg-blue-600 text-white ring-2 ring-blue-400' 
                          : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      <span>🔷</span> BlockDAG
                    </button>
                    <button
                      onClick={() => setSelectedNetwork('sepolia')}
                      data-testid="network-sepolia-btn"
                      className={`rounded-lg py-3 px-3 text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                        selectedNetwork === 'sepolia' 
                          ? 'bg-purple-600 text-white ring-2 ring-purple-400' 
                          : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      <span>🧪</span> Sepolia
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedNetwork('ethereum')}
                  data-testid="network-ethereum-btn"
                  className={`rounded-lg py-3 px-3 text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                    selectedNetwork === 'ethereum' 
                      ? 'bg-indigo-600 text-white ring-2 ring-indigo-400' 
                      : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  <span>⟠</span> Ethereum{isEthereumMainnet ? ' Mainnet' : ''}
                </button>
              </div>
              {/* Network Info */}
              <p className="text-xs mt-2">
                {isEthereumMainnet 
                  ? <span className="text-green-400">✓ This campaign only accepts Ethereum Mainnet payments</span>
                  : selectedNetwork === 'ethereum' 
                    ? <span className="text-green-400">✓ Ethereum Mainnet - uses real ETH</span>
                    : selectedNetwork === 'sepolia' 
                      ? <span className="text-yellow-400/80">⚠️ Sepolia is a testnet - uses test ETH only</span>
                      : <span className="text-yellow-400/80">⚠️ BlockDAG Awakening is a testnet - uses test BDAG only</span>}
              </p>
            </div>

            {/* Price Display with Live Rate */}
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="flex justify-between items-center">
                <span className="text-white/70">Amount</span>
                <span className="text-white font-medium">
                  {isEthNetwork
                    ? `${usdToEth(config.totalAmount, ethRate).toFixed(6)} ETH` 
                    : `${config.bdagAmount.toFixed(2)} BDAG`}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm mt-1">
                <span className="text-white/50">≈ USD</span>
                <span className="text-white/50">${config.totalAmount}</span>
              </div>
              
              {/* Live Rate Display */}
              {livePrice && (
                <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50">Live Rate:</span>
                    <span className="text-xs text-emerald-400 font-medium">
                      ${livePrice.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {isEthNetwork ? 'ETH' : 'BDAG'}
                    </span>
                    {livePrice.source === 'coingecko' && (
                      <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                        CoinGecko
                      </span>
                    )}
                  </div>
                  <button
                    onClick={refreshPrice}
                    disabled={priceLoading}
                    className="text-xs text-white/40 hover:text-white/60 transition-colors"
                    title="Refresh price"
                  >
                    {priceLoading ? '⏳' : '🔄'}
                  </button>
                </div>
              )}
            </div>

            {/* Crypto Payment Section */}
            <CryptoPaymentSection
              wallet={wallet}
              bdagAmount={selectedNetwork === 'bdag' ? config.bdagAmount : (ethAmountLive + ethTipAmountLive)}
              totalAmount={config.totalAmount}
              cryptoMsg={activePurchase.cryptoMsg}
              txHash={activePurchase.txHash}
              loading={activePurchase.loading}
              onPurchase={activePurchase.purchaseWithWallet}
              network={selectedNetwork}
            />
          </div>
        )}

        {/* Other Payment Tab - Coming Soon */}
        {activeTab === 'other' && (
          <div className="relative">
            {/* Coming Soon Overlay */}
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
              <div className="text-center">
                <span className="text-3xl font-bold text-white/30 rotate-[-15deg] inline-block transform">
                  🚧 Coming Soon
                </span>
                <p className="text-white/50 text-sm mt-2">PayPal, Cash App & Venmo coming soon!</p>
              </div>
            </div>
            <div className="opacity-30 pointer-events-none space-y-3">
              <p className="text-sm text-white/50 mb-4">Choose an alternative payment method:</p>
              {[
                { name: 'PayPal', color: 'from-blue-600 to-blue-700', endpoint: '/api/payments/paypal/create' },
                { name: 'Cash App', color: 'from-green-600 to-green-700', endpoint: '/api/payments/cashapp' },
                { name: 'Venmo', color: 'from-cyan-600 to-blue-600', endpoint: '/api/payments/venmo' },
              ].map(method => (
                <button key={method.name} disabled
                  data-testid={`payment-${method.name.toLowerCase().replace(' ', '-')}-btn`}
                  className={`w-full rounded-lg bg-gradient-to-r ${method.color} px-6 py-4 font-semibold text-white shadow-lg`}>
                  Pay with {method.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Success Message */}
      {result?.success && (
        <SuccessMessage 
          result={result as any} 
          contractAddress={effectiveContractAddress} 
        />
      )}

      {/* Trust Badges */}
      <div className="flex items-center justify-center gap-2 pt-4 pb-2 text-xs text-white/40 flex-wrap">
        <span>🔒 Secure</span><span>•</span><span>📧 Receipt</span><span>•</span><span>💯 Tax Deductible</span>
      </div>
    </div>
  )
}
