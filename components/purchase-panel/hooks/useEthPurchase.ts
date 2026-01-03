'use client'

/**
 * useEthPurchase Hook
 * 
 * Handles ETH/Sepolia cryptocurrency purchase flow for V7 contracts
 * Supports immediate payout and single mint per transaction
 */

import { useState, useCallback, useEffect } from 'react'
import { BrowserProvider, Contract, parseEther } from 'ethers'
import { withRetry, IRetryConfig } from '@/lib/retry'
import { logger } from '@/lib/logger'
import type { PurchaseResult, AuthState } from '../types'

// V7 Contract ABI - using legacy mint functions for compatibility
// Legacy functions don't have onlyThisChain modifier, so they work across chains
const V7_MINT_ABI = [
  // Legacy mint functions (V5/V6 compatible, no onlyThisChain)
  'function mintWithBDAG(uint256 campaignId) external payable returns (uint256)',
  'function mintWithBDAGAndTip(uint256 campaignId, uint256 tipAmount) external payable returns (uint256)',
  // V7 getCampaign: 13 fields total - active at index 10, closed at 11
  'function getCampaign(uint256 campaignId) external view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, address nonprofit, address submitter, bool active, bool closed, bool immediatePayoutEnabled)',
  'function totalCampaigns() external view returns (uint256)',
  'event EditionMinted(uint256 indexed campaignId, uint256 indexed tokenId, address indexed donor, uint256 editionNumber, uint256 amountPaid)',
]

// Default fallback rate if live price fetch fails
const DEFAULT_ETH_USD_RATE = 3100

export function usdToEth(usd: number, rate: number = DEFAULT_ETH_USD_RATE): number {
  return usd / rate
}

// Fetch live ETH price from our price API
async function fetchLiveEthPrice(): Promise<number> {
  try {
    const response = await fetch('/api/prices/convert?usd=1&chainId=11155111')
    if (!response.ok) throw new Error('Price fetch failed')
    const data = await response.json()
    return data.rate || DEFAULT_ETH_USD_RATE
  } catch (e) {
    logger.debug('[useEthPurchase] Live price fetch failed, using fallback')
    return DEFAULT_ETH_USD_RATE
  }
}

export interface UseEthPurchaseProps {
  targetId: string
  contractAddress: string
  contractVersion?: string
  chainId: number
  pricePerNft: number | null
  hasNftPrice: boolean
  ethAmount: number
  ethTipAmount: number
  totalAmountUsd: number
  tipAmountUsd: number
  quantity: number
  auth: AuthState
  wallet: {
    isConnected: boolean
    address: string | null
    chainId: number | null
    isOnSepolia: boolean
    switchToSepolia: () => Promise<void>
    updateBalance: () => void
  }
  isPendingOnchain?: boolean
  donorNote?: string
  donorName?: string
}

export interface UseEthPurchaseReturn {
  loading: boolean
  cryptoMsg: string
  txHash: string | null
  result: PurchaseResult | null
  purchaseWithWallet: () => Promise<void>
  setCryptoMsg: (msg: string) => void
  setResult: (result: PurchaseResult | null) => void
}

export function useEthPurchase(props: UseEthPurchaseProps): UseEthPurchaseReturn {
  const {
    targetId,
    contractAddress,
    contractVersion,
    chainId,
    pricePerNft,
    hasNftPrice,
    ethAmount,
    ethTipAmount,
    totalAmountUsd,
    tipAmountUsd,
    quantity,
    auth,
    wallet,
    isPendingOnchain,
    donorNote,
    donorName
  } = props

  const [loading, setLoading] = useState(false)
  const [cryptoMsg, setCryptoMsg] = useState('')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [result, setResult] = useState<PurchaseResult | null>(null)

  const purchaseWithWallet = useCallback(async () => {
    logger.debug(`[useEthPurchase] ========== ETH PURCHASE INITIATED ==========`)
    
    if (!auth.isLoggedIn || !auth.userEmail) {
      setCryptoMsg('⚠️ Account required: Please log in or create an account first.')
      return
    }
    if (!auth.isEmailVerified) {
      setCryptoMsg('Please verify your email address before purchasing.')
      return
    }
    if (!wallet.isConnected || !wallet.address) {
      setCryptoMsg('Please connect your wallet first')
      return
    }
    if (!wallet.isOnSepolia) {
      setCryptoMsg('Please switch to Sepolia network')
      await wallet.switchToSepolia()
      return
    }
    if (!contractAddress) {
      setCryptoMsg('V7 Contract not configured for Sepolia')
      return
    }
    if (isPendingOnchain) {
      setCryptoMsg('⏳ Campaign awaiting blockchain confirmation.')
      return
    }

    try {
      setLoading(true)
      setCryptoMsg('Fetching live ETH price...')
      setTxHash(null)

      // Fetch live ETH price for accurate USD to ETH conversion
      const liveEthPrice = await fetchLiveEthPrice()
      logger.debug(`[useEthPurchase] Live ETH price: $${liveEthPrice}`)
      
      setCryptoMsg('Verifying campaign on blockchain...')

      const ethereum = (window as any).ethereum
      if (!ethereum) {
        setCryptoMsg('No wallet detected. Please install MetaMask.')
        setLoading(false)
        return
      }

      const provider = new BrowserProvider(ethereum)
      const signer = await provider.getSigner()
      const signerAddress = await signer.getAddress()
      
      // Get signer's balance and check if sufficient
      const signerBalance = await provider.getBalance(signerAddress)
      const requiredAmount = parseEther('0.005') // ~$15 worth of ETH for payment + gas
      
      logger.debug('[useEthPurchase] Wallet check:', {
        signerAddress,
        expectedWalletAddress: wallet.address,
        signerBalanceEth: Number(signerBalance) / 1e18,
        addressMatch: signerAddress.toLowerCase() === wallet.address?.toLowerCase(),
      })
      
      // Check for wallet mismatch
      if (wallet.address && signerAddress.toLowerCase() !== wallet.address.toLowerCase()) {
        logger.warn('[useEthPurchase] WALLET MISMATCH detected!')
        setCryptoMsg(`⚠️ Wallet mismatch! Expected ${wallet.address?.slice(0,6)}...${wallet.address?.slice(-4)} but transaction will use ${signerAddress.slice(0,6)}...${signerAddress.slice(-4)}. Please check MetaMask account selection.`)
        setLoading(false)
        return
      }
      
      // Check for sufficient balance
      if (signerBalance < requiredAmount) {
        const balanceEth = (Number(signerBalance) / 1e18).toFixed(4)
        setCryptoMsg(`⚠️ Insufficient balance! Your wallet (${signerAddress.slice(0,6)}...${signerAddress.slice(-4)}) has ${balanceEth} ETH. Need ~0.005 ETH for payment + gas.`)
        setLoading(false)
        return
      }
      
      const contract = new Contract(contractAddress, V7_MINT_ABI, signer)

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
      // V7 campaign structure: active is at index 10, closed at index 11
      if (!campaign[10]) {
        setCryptoMsg(`Campaign #${targetId} is not active.`)
        setLoading(false)
        return
      }
      if (campaign[11]) {
        setCryptoMsg(`Campaign #${targetId} is closed.`)
        setLoading(false)
        return
      }

      setCryptoMsg('Preparing transaction...')

      // Calculate price using LIVE ETH rate
      // USD price is the source of truth - convert to ETH at current market rate
      const usdPricePerNft = hasNftPrice ? pricePerNft! : (totalAmountUsd - tipAmountUsd) / quantity
      const liveCalculatedEth = usdToEth(usdPricePerNft, liveEthPrice)
      
      // Add 1% buffer to handle price fluctuations and ensure contract accepts payment
      // This protects against the on-chain minimum while still using live pricing
      const bufferedEth = liveCalculatedEth * 1.01
      const finalPriceWei = parseEther(bufferedEth.toFixed(18))
      
      // Log for transparency
      const onChainPriceWei = BigInt(campaign[7].toString())
      
      const tipEthWei = tipAmountUsd > 0 ? parseEther(usdToEth(tipAmountUsd, liveEthPrice).toFixed(18)) : 0n
      const gasLimit = 800000n // V7 needs higher gas for mint + immediate payout distribution

      // Debug logging
      logger.debug('[useEthPurchase] Transaction params (LIVE PRICE):', {
        contractAddress,
        targetId,
        usdPricePerNft,
        liveEthPrice,
        liveCalculatedEth,
        bufferedEth,
        finalPriceWei: finalPriceWei.toString(),
        onChainPriceWei: onChainPriceWei.toString(),
        onChainPriceEth: Number(onChainPriceWei) / 1e18,
        tipUsd: tipAmountUsd,
        tipEthWei: tipEthWei.toString(),
        gasLimit: gasLimit.toString(),
      })

      const txHashes: string[] = []
      const mintedTokenIds: number[] = []

      // Mint one at a time (as requested by user)
      for (let i = 0; i < quantity; i++) {
        const isLast = i === quantity - 1
        setCryptoMsg(`Minting NFT ${i + 1} of ${quantity}... Please confirm in wallet.`)

        let tx
        try {
          // Log the exact call being made
          const campaignIdBigInt = BigInt(targetId)
          logger.debug('[useEthPurchase] Calling mintWithBDAG:', {
            campaignId: campaignIdBigInt.toString(),
            value: finalPriceWei.toString(),
          })

          if (isLast && tipEthWei > 0n) {
            // Last NFT includes tip - use legacy mintWithBDAGAndTip
            const valueWithTip = finalPriceWei + tipEthWei
            logger.debug('[useEthPurchase] Using mintWithBDAGAndTip with tip:', tipEthWei.toString())
            tx = await contract.mintWithBDAGAndTip(campaignIdBigInt, tipEthWei, {
              value: valueWithTip,
              gasLimit,
            })
          } else {
            // Regular mint without tip - use legacy mintWithBDAG
            tx = await contract.mintWithBDAG(campaignIdBigInt, {
              value: finalPriceWei,
              gasLimit,
            })
          }
          logger.debug('[useEthPurchase] Transaction submitted:', tx.hash)
        } catch (mintErr: any) {
          logger.error('[useEthPurchase] Mint error:', mintErr)
          let errorMsg = mintErr?.reason || mintErr?.message || 'Transaction failed'
          if (mintErr?.code) errorMsg += ` (code: ${mintErr.code})`
          if (mintErr?.data) errorMsg += ` (data: ${JSON.stringify(mintErr.data)})`
          if (errorMsg.includes('user rejected')) errorMsg = 'Transaction cancelled'
          else if (errorMsg.includes('insufficient funds')) errorMsg = 'Insufficient ETH balance'
          setCryptoMsg(`❌ ${errorMsg}`)
          setLoading(false)
          return
        }

        txHashes.push(tx.hash)
        setTxHash(tx.hash)
        
        setCryptoMsg(`Waiting for NFT ${i + 1} confirmation...`)
        const receipt = await tx.wait(2) // Wait for 2 confirmations on Sepolia

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

      // Record purchase in database
      try {
        await fetch('/api/purchase/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: targetId,
            tokenId: mintedTokenIds[mintedTokenIds.length - 1] || null,
            txHash: txHashes[txHashes.length - 1],
            amountUSD: totalAmountUsd,
            tipUSD: tipAmountUsd,
            amountCrypto: ethAmount + ethTipAmount, // Multi-chain: generic crypto amount
            tipCrypto: ethTipAmount,
            amountBDAG: 0, // Legacy field
            tipBDAG: 0,
            walletAddress: wallet.address,
            mintedTokenIds,
            quantity,
            buyerEmail: auth.userEmail,
            userId: auth.userId,
            paymentMethod: 'crypto_eth',
            contractVersion: contractVersion || 'v7',
            contractAddress,
            chainId: chainId,
            donorNote: donorNote || null,
            donorName: donorName || null,
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
  }, [
    targetId, contractAddress, contractVersion, chainId, pricePerNft, hasNftPrice,
    ethAmount, ethTipAmount, totalAmountUsd, tipAmountUsd, quantity,
    auth, wallet, isPendingOnchain, donorNote, donorName
  ])

  return {
    loading,
    cryptoMsg,
    txHash,
    result,
    purchaseWithWallet,
    setCryptoMsg,
    setResult
  }
}
