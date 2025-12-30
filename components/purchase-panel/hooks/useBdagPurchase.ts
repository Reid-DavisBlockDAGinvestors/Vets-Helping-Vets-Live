'use client'

/**
 * useBdagPurchase Hook
 * 
 * Handles BDAG cryptocurrency purchase flow
 * Following ISP - focused on blockchain transaction logic
 */

import { useState, useCallback } from 'react'
import { BrowserProvider, Contract, parseEther } from 'ethers'
import { withRetry, IRetryConfig } from '@/lib/retry'
import { logger } from '@/lib/logger'
import type { PurchaseResult, AuthState } from '../types'
import { usdToBdag } from './usePurchaseConfig'

const MINT_EDITION_ABI = [
  'function mintWithBDAG(uint256 campaignId) external payable returns (uint256)',
  'function mintWithBDAGAndTip(uint256 campaignId, uint256 tipAmount) external payable returns (uint256)',
  'function getCampaign(uint256 campaignId) external view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
  'function totalCampaigns() external view returns (uint256)',
  'event EditionMinted(uint256 indexed campaignId, uint256 indexed tokenId, address indexed buyer, uint256 editionNumber, uint256 amount)',
]

export interface UseBdagPurchaseProps {
  targetId: string
  contractAddress: string
  contractVersion?: string
  pricePerNft: number | null
  hasNftPrice: boolean
  bdagAmount: number
  bdagTipAmount: number
  totalAmount: number
  tipAmount: number
  quantity: number
  auth: AuthState
  wallet: {
    isConnected: boolean
    address: string | null
    isOnBlockDAG: boolean
    switchToBlockDAG: () => Promise<void>
    updateBalance: () => void
  }
  isPendingOnchain?: boolean
}

export interface UseBdagPurchaseReturn {
  loading: boolean
  cryptoMsg: string
  txHash: string | null
  result: PurchaseResult | null
  purchaseWithWallet: () => Promise<void>
  setCryptoMsg: (msg: string) => void
  setResult: (result: PurchaseResult | null) => void
}

export function useBdagPurchase(props: UseBdagPurchaseProps): UseBdagPurchaseReturn {
  const {
    targetId,
    contractAddress,
    contractVersion,
    pricePerNft,
    hasNftPrice,
    bdagAmount,
    bdagTipAmount,
    totalAmount,
    tipAmount,
    quantity,
    auth,
    wallet,
    isPendingOnchain
  } = props

  const [loading, setLoading] = useState(false)
  const [cryptoMsg, setCryptoMsg] = useState('')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [result, setResult] = useState<PurchaseResult | null>(null)

  const purchaseWithWallet = useCallback(async () => {
    logger.debug(`[useBdagPurchase] ========== PURCHASE INITIATED ==========`)
    
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
    if (!wallet.isOnBlockDAG) {
      setCryptoMsg('Please switch to BlockDAG network')
      await wallet.switchToBlockDAG()
      return
    }
    if (!contractAddress) {
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
      const contract = new Contract(contractAddress, MINT_EDITION_ABI, signer)

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

      const pricePerNftBdag = hasNftPrice ? usdToBdag(pricePerNft!) : bdagAmount
      const pricePerNftWei = parseEther(pricePerNftBdag.toFixed(18))
      const tipBdagWei = bdagTipAmount > 0 ? parseEther(bdagTipAmount.toFixed(18)) : 0n
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
            amountUSD: totalAmount,
            tipUSD: tipAmount,
            amountBDAG: bdagAmount,
            tipBDAG: bdagTipAmount,
            walletAddress: wallet.address,
            mintedTokenIds,
            quantity,
            buyerEmail: auth.userEmail,
            userId: auth.userId,
            paymentMethod: 'crypto_bdag',
            contractVersion: contractVersion || 'v6',
            contractAddress,
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
    targetId, contractAddress, contractVersion, pricePerNft, hasNftPrice,
    bdagAmount, bdagTipAmount, totalAmount, tipAmount, quantity,
    auth, wallet, isPendingOnchain
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
