'use client'

import { useCallback } from 'react'
import { BrowserProvider, Contract, parseEther, Interface } from 'ethers'
import { useWallet } from '@/hooks/useWallet'
import { withRetry, IRetryConfig } from '@/lib/retry'
import { logger } from '@/lib/logger'

const MINT_EDITION_ABI = [
  'function mintWithBDAG(uint256 campaignId) external payable returns (uint256)',
  'function mintWithBDAGAndTip(uint256 campaignId, uint256 tipAmount) external payable returns (uint256)',
  'function getCampaign(uint256 campaignId) external view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
  'function totalCampaigns() external view returns (uint256)',
  'event EditionMinted(uint256 indexed campaignId, uint256 indexed tokenId, address indexed buyer, uint256 editionNumber, uint256 amount)',
]

interface UseCryptoPaymentOptions {
  campaignId: string
  contractAddress: string
  contractVersion?: string
  isPendingOnchain?: boolean
  userEmail: string | null
  userId: string | null
  isLoggedIn: boolean
  isEmailVerified: boolean
  onMessage: (msg: string) => void
  onTxHash: (hash: string) => void
  onLoading: (loading: boolean) => void
}

interface PurchaseParams {
  quantity: number
  pricePerNftBdag: number
  tipBdagAmount: number
  totalAmountUsd: number
  tipAmountUsd: number
}

/**
 * Hook for BDAG on-chain payment functionality
 */
export function useCryptoPayment({
  campaignId,
  contractAddress,
  contractVersion,
  isPendingOnchain,
  userEmail,
  userId,
  isLoggedIn,
  isEmailVerified,
  onMessage,
  onTxHash,
  onLoading,
}: UseCryptoPaymentOptions) {
  const wallet = useWallet()

  const purchaseWithWallet = useCallback(async (params: PurchaseParams) => {
    const { quantity, pricePerNftBdag, tipBdagAmount, totalAmountUsd, tipAmountUsd } = params

    logger.debug('[CryptoPayment] Starting purchase...', { campaignId, quantity })

    // Validation checks
    if (!isLoggedIn || !userEmail) {
      onMessage('⚠️ Account required: Please log in or create an account.')
      return { success: false }
    }

    if (!isEmailVerified) {
      onMessage('Please verify your email address before making a purchase.')
      return { success: false }
    }

    if (!wallet.isConnected || !wallet.address) {
      onMessage('Please connect your wallet first')
      return { success: false }
    }

    if (!wallet.isOnBlockDAG) {
      onMessage('Please switch to BlockDAG network')
      await wallet.switchToBlockDAG()
      return { success: false }
    }

    if (!contractAddress) {
      onMessage('Contract not configured')
      return { success: false }
    }

    if (isPendingOnchain) {
      onMessage('⏳ Campaign is awaiting blockchain confirmation.')
      return { success: false }
    }

    try {
      onLoading(true)
      onMessage('Verifying campaign on blockchain...')

      const ethereum = (window as any).ethereum
      if (!ethereum) {
        onMessage('No wallet detected. Please install MetaMask.')
        return { success: false }
      }

      const provider = new BrowserProvider(ethereum)
      const signer = await provider.getSigner()
      const contract = new Contract(contractAddress, MINT_EDITION_ABI, signer)

      // Verify campaign exists on-chain with retry logic
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
          if (Number(campaignId) >= Number(totalCampaigns)) {
            throw new Error(`CAMPAIGN_NOT_FOUND:${totalCampaigns}`)
          }
          const campaign = await contract.getCampaign(BigInt(campaignId))
          return { campaign, totalCampaigns: Number(totalCampaigns) }
        },
        verifyConfig,
        (status) => {
          onMessage(`Verifying campaign... Attempt ${status.attempt}/${status.maxAttempts}`)
        }
      )

      if (!verifyResult.success) {
        const errorMsg = verifyResult.error?.message || ''
        if (errorMsg.startsWith('CAMPAIGN_NOT_FOUND:')) {
          onMessage(`Campaign #${campaignId} does not exist on-chain yet.`)
        } else {
          onMessage(`Failed to verify campaign. Please try again.`)
        }
        return { success: false }
      }

      const { campaign } = verifyResult.data!

      if (!campaign[8]) {
        onMessage(`Campaign #${campaignId} is not active.`)
        return { success: false }
      }

      if (campaign[9]) {
        onMessage(`Campaign #${campaignId} is closed.`)
        return { success: false }
      }

      onMessage('Preparing transaction...')

      const pricePerNftWei = parseEther(pricePerNftBdag.toFixed(18))
      const tipBdagWei = tipBdagAmount > 0 ? parseEther(tipBdagAmount.toFixed(18)) : 0n
      const gasLimit = 600000n

      const txHashes: string[] = []
      const mintedTokenIds: number[] = []

      for (let i = 0; i < quantity; i++) {
        const isLast = i === quantity - 1
        onMessage(`Minting NFT ${i + 1} of ${quantity}... Please confirm in wallet.`)

        let tx
        try {
          if (isLast && tipBdagWei > 0n) {
            const valueWithTip = pricePerNftWei + tipBdagWei
            tx = await contract.mintWithBDAGAndTip(BigInt(campaignId), tipBdagWei, {
              value: valueWithTip,
              gasLimit,
            })
          } else {
            const populatedTx = await contract.mintWithBDAG.populateTransaction(BigInt(campaignId), {
              value: pricePerNftWei,
              gasLimit,
            })
            tx = await signer.sendTransaction(populatedTx)
          }
        } catch (mintErr: any) {
          let errorMsg = mintErr?.reason || mintErr?.message || 'Transaction failed'
          if (errorMsg.includes('user rejected')) {
            errorMsg = 'Transaction cancelled by user'
          } else if (errorMsg.includes('insufficient funds')) {
            errorMsg = 'Insufficient BDAG balance'
          }
          onMessage(`❌ ${errorMsg}`)
          return { success: false }
        }

        txHashes.push(tx.hash)
        onTxHash(tx.hash)

        onMessage(`Waiting for NFT ${i + 1} of ${quantity} to confirm...`)
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
            if (tokenId > 0) {
              mintedTokenIds.push(tokenId)
            }
          }
        } catch (e) {
          logger.warn('[CryptoPayment] Could not parse event:', e)
        }
      }

      // Record purchase
      try {
        await fetch('/api/purchase/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId,
            tokenId: mintedTokenIds[mintedTokenIds.length - 1],
            txHash: txHashes[txHashes.length - 1],
            amountUSD: totalAmountUsd,
            tipUSD: tipAmountUsd,
            walletAddress: wallet.address,
            mintedTokenIds,
            quantity,
            buyerEmail: userEmail,
            userId,
            paymentMethod: 'crypto_bdag',
            contractVersion: contractVersion || 'v6',
            contractAddress,
          })
        })
      } catch (e) {
        logger.warn('Failed to record purchase:', e)
      }

      wallet.updateBalance()

      if (mintedTokenIds.length === 1) {
        onMessage(`🎉 NFT minted! Token ID: #${mintedTokenIds[0]}`)
      } else if (mintedTokenIds.length > 1) {
        onMessage(`🎉 ${quantity} NFTs minted! IDs: ${mintedTokenIds.join(', ')}`)
      } else {
        onMessage(`🎉 ${quantity} NFT${quantity > 1 ? 's' : ''} minted!`)
      }

      return {
        success: true,
        txHash: txHashes[txHashes.length - 1],
        txHashes,
        quantity,
        mintedTokenIds,
      }
    } catch (e: any) {
      logger.error('BDAG purchase error:', e)
      if (e?.code === 'ACTION_REJECTED' || e?.code === 4001) {
        onMessage('Transaction cancelled')
      } else {
        onMessage(e?.reason || e?.message || 'Transaction failed')
      }
      return { success: false }
    } finally {
      onLoading(false)
    }
  }, [campaignId, contractAddress, contractVersion, isPendingOnchain, userEmail, userId, isLoggedIn, isEmailVerified, wallet, onMessage, onTxHash, onLoading])

  return {
    wallet,
    purchaseWithWallet,
  }
}
