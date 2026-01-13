import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendPurchaseReceipt, sendCreatorPurchaseNotification } from '@/lib/mailer'
import { logger } from '@/lib/logger'
import { CHAIN_CONFIGS, type ChainId } from '@/lib/chains'

export const runtime = 'nodejs'

// Convert IPFS URI to HTTP gateway URL
function toHttpUrl(uri: string | null): string | null {
  if (!uri) return null
  if (uri.startsWith('ipfs://')) {
    return `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`
  }
  return uri
}

/**
 * Record a BDAG on-chain purchase in the database for analytics
 * This is called after the transaction is confirmed on-chain
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { 
      tokenId,
      campaignId, // V5: campaigns use campaignId
      txHash, 
      amountUSD, 
      tipUSD,
      giftUSD, // Renamed from tipUSD in frontend
      amountBDAG,
      amountCrypto, // Multi-chain: generic crypto amount
      tipBDAG,
      giftBDAG, // Renamed from tipBDAG in frontend
      tipCrypto, // Multi-chain: generic tip amount
      giftCrypto, // Renamed from tipCrypto in frontend
      walletAddress,
      quantity,
      editionMinted, // Token ID of the minted edition (or true for legacy)
      mintedTokenIds, // Array of all token IDs if multiple minted
      buyerEmail, // Email for receipt
      userId, // Logged-in user ID if available
      paymentMethod, // crypto_bdag, crypto_eth, stripe, etc.
      chainId, // Multi-chain: which network was used (1043=BDAG, 11155111=Sepolia, 1=ETH)
      referrer, // How user found the campaign
      donorNote, // Optional personal message to campaign creator
      donorName // Optional display name (can stay anonymous)
    } = body
    
    // Support both old (tip) and new (gift) field names
    const effectiveTipUSD = tipUSD ?? giftUSD ?? 0
    const effectiveTipBDAG = tipBDAG ?? giftBDAG ?? 0
    
    // Multi-chain support: use amountCrypto if provided, fallback to amountBDAG
    const effectiveCryptoAmount = amountCrypto ?? amountBDAG ?? 0
    const effectiveTipAmount = tipCrypto ?? giftCrypto ?? effectiveTipBDAG ?? 0

    // Derive chain info from chainId
    const effectiveChainId = (chainId || 1043) as ChainId
    const chainConfig = CHAIN_CONFIGS[effectiveChainId]
    const chainName = chainConfig?.name || (effectiveChainId === 1043 ? 'BlockDAG' : 'Ethereum')
    const isTestnet = chainConfig?.isTestnet ?? true
    const nativeCurrency = chainConfig?.nativeCurrency?.symbol || (effectiveChainId === 1043 ? 'BDAG' : 'ETH')

    // Get request metadata for fraud prevention
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || null
    const userAgent = req.headers.get('user-agent') || null

    // V5: Accept either tokenId or campaignId
    const effectiveId = campaignId ?? tokenId
    
    if (effectiveId == null || !txHash) {
      return NextResponse.json({ error: 'MISSING_REQUIRED_FIELDS', details: 'tokenId/campaignId and txHash required' }, { status: 400 })
    }
    
    logger.debug(`[purchase/record] Recording purchase: campaignId=${effectiveId}, txHash=${txHash}, amountBDAG=${amountBDAG}`)

    // Record the purchase event
    const { error: eventError } = await supabaseAdmin
      .from('events')
      .insert({
        event_type: 'bdag_purchase',
        campaign_id: effectiveId,
        tx_hash: txHash,
        wallet_address: walletAddress,
        amount_bdag: amountBDAG,
        amount_usd: amountUSD,
        metadata: {
          tipUSD: effectiveTipUSD,
          tipBDAG: effectiveTipBDAG,
          quantity: quantity ?? 1,
          editionMinted,
          mintedTokenIds: mintedTokenIds || [],
          source: 'wallet_direct',
        }
      })

    if (eventError) {
      logger.error('Failed to record purchase event:', eventError)
    }

    // Also record to purchases table for my-campaigns tracking
    if (walletAddress) {
      const { error: purchaseError } = await supabaseAdmin
        .from('purchases')
        .insert({
          wallet_address: walletAddress.toLowerCase(),
          campaign_id: effectiveId,
          token_id: typeof editionMinted === 'number' ? editionMinted : (mintedTokenIds?.[0]) || null,
          tx_hash: txHash,
          amount_bdag: effectiveChainId === 1043 ? effectiveCryptoAmount : null,
          amount_usd: amountUSD || null,
          tip_bdag: effectiveChainId === 1043 ? effectiveTipAmount : 0,
          tip_usd: effectiveTipUSD || 0,
          quantity: quantity || 1,
          email: buyerEmail || null,
          user_id: userId || null,
          payment_method: paymentMethod || (effectiveChainId === 1043 ? 'crypto_bdag' : 'crypto_eth'),
          ip_address: ipAddress,
          user_agent: userAgent,
          referrer: referrer || null,
          donor_note: donorNote || null,
          donor_name: donorName || null,
          // Multi-chain fields
          chain_id: effectiveChainId,
          chain_name: chainName,
          is_testnet: isTestnet,
          amount_native: effectiveCryptoAmount || null,
          native_currency: nativeCurrency,
          amount_eth: effectiveChainId !== 1043 ? effectiveCryptoAmount : null,
          tip_eth: effectiveChainId !== 1043 ? effectiveTipAmount : null
        })
      
      if (purchaseError) {
        logger.error('[purchase/record] Failed to record to purchases table:', purchaseError)
      } else {
        logger.debug(`[purchase/record] Recorded purchase for wallet ${walletAddress}, campaign ${effectiveId}`)
      }

      // Cache token(s) in tokens table for fast admin queries
      const tokensToCache = mintedTokenIds?.length ? mintedTokenIds : 
        (typeof editionMinted === 'number' ? [editionMinted] : [])
      
      if (tokensToCache.length > 0) {
        // Get submission for contract info
        const { data: submission } = await supabaseAdmin
          .from('submissions')
          .select('contract_address, contract_version, max_editions')
          .eq('campaign_id', effectiveId)
          .single()

        for (let i = 0; i < tokensToCache.length; i++) {
          const tokenIdToCache = tokensToCache[i]
          const { error: tokenCacheError } = await supabaseAdmin
            .from('tokens')
            .upsert({
              token_id: tokenIdToCache,
              campaign_id: effectiveId,
              chain_id: effectiveChainId,
              contract_address: submission?.contract_address || '',
              contract_version: submission?.contract_version || 'v5',
              owner_wallet: walletAddress.toLowerCase(),
              edition_number: i + 1, // Edition number within this purchase
              total_editions: submission?.max_editions || null,
              is_frozen: false,
              is_soulbound: false,
              metadata_uri: null, // Can be updated later
              mint_tx_hash: txHash,
              minted_at: new Date().toISOString()
            }, {
              onConflict: 'token_id,chain_id,contract_address'
            })

          if (tokenCacheError) {
            logger.error(`[purchase/record] Failed to cache token ${tokenIdToCache}:`, tokenCacheError)
          } else {
            logger.debug(`[purchase/record] Cached token ${tokenIdToCache} in tokens table`)
          }
        }
      }
    }

    // Update the submission's sold_count (default 1 for edition mint)
    const qty = quantity ?? 1
    // Try campaign_id first (V5), fallback to token_id
    // Include creator_email and creator_name for notification
    const { data: subByCampaign } = await supabaseAdmin
      .from('submissions')
      .select('id, sold_count, title, image_uri, campaign_id, creator_email, creator_name, goal')
      .eq('campaign_id', effectiveId)
      .maybeSingle()
    
    const sub = subByCampaign || (await supabaseAdmin
      .from('submissions')
      .select('id, sold_count, title, image_uri, campaign_id, creator_email, creator_name, goal')
      .eq('token_id', effectiveId)
      .maybeSingle()).data

    if (sub) {
      await supabaseAdmin
        .from('submissions')
        .update({ sold_count: (sub.sold_count || 0) + qty })
        .eq('id', sub.id)
      logger.debug(`[purchase/record] Updated sold_count for submission ${sub.id}`)
    }

    // Determine the token ID to include in emails
    // Priority: explicit tokenId > editionMinted (if it's a number) > first from mintedTokenIds array
    let emailTokenId: number | undefined = undefined
    if (typeof tokenId === 'number' && tokenId > 0) {
      emailTokenId = tokenId
    } else if (typeof editionMinted === 'number' && editionMinted > 0) {
      emailTokenId = editionMinted
    } else if (Array.isArray(mintedTokenIds) && mintedTokenIds.length > 0) {
      emailTokenId = mintedTokenIds[mintedTokenIds.length - 1] // Use last minted token
    }

    // Send purchase receipt email if buyer provided email
    logger.debug(`[purchase/record] Email check: buyerEmail=${buyerEmail}, sub=${!!sub}`)
    if (buyerEmail && sub) {
      try {
        logger.debug(`[purchase/record] Attempting to send receipt email to ${buyerEmail}`)
        const emailResult = await sendPurchaseReceipt({
          email: buyerEmail,
          campaignTitle: sub.title || 'Campaign',
          campaignId: sub.campaign_id || effectiveId,
          tokenId: emailTokenId,
          editionNumber: typeof editionMinted === 'number' ? editionMinted : undefined,
          amountCrypto: effectiveCryptoAmount,
          amountBDAG: amountBDAG || 0, // Legacy support
          amountUSD: amountUSD,
          txHash,
          walletAddress: walletAddress || '',
          imageUrl: toHttpUrl(sub.image_uri) || undefined,
          chainId: chainId || 1043 // Default to BlockDAG if not specified
        })
        logger.debug(`[purchase/record] Email result:`, emailResult)
        if (emailResult?.skipped) {
          logger.warn(`[purchase/record] Email SKIPPED - RESEND_API_KEY not configured!`)
        } else if (emailResult?.error) {
          logger.error(`[purchase/record] Email error: ${emailResult.error}`)
        } else {
          logger.debug(`[purchase/record] Sent receipt email to ${buyerEmail} with tokenId=${emailTokenId}, chainId=${chainId}`)
        }
      } catch (emailErr) {
        logger.error('[purchase/record] Failed to send receipt email:', emailErr)
      }
    } else {
      logger.warn(`[purchase/record] Email NOT sent - buyerEmail=${buyerEmail ? 'YES' : 'NO'}, sub=${sub ? 'YES' : 'NO'}`)
    }

    // Send notification to campaign CREATOR that they received a donation
    if (sub?.creator_email) {
      // Calculate total raised ACCURATELY from database
      // Query FRESH sold_count and num_copies to ensure accuracy
      const { data: freshSub } = await supabaseAdmin
        .from('submissions')
        .select('sold_count, num_copies, goal')
        .eq('id', sub.id)
        .single()
      
      const currentSoldCount = freshSub?.sold_count || sub.sold_count || 0
      const numCopies = freshSub?.num_copies || 100
      const goal = freshSub?.goal || sub.goal || 0
      
      // sold_count was already updated earlier in this request, so use it directly
      const pricePerNFT = goal && numCopies > 0 ? goal / numCopies : amountUSD || 0
      const nftSalesTotal = currentSoldCount * pricePerNFT
      
      // Query ACTUAL accumulated tips from all purchases for this campaign
      const { data: tipData } = await supabaseAdmin
        .from('purchases')
        .select('tip_usd')
        .eq('campaign_id', effectiveId)
      
      // Sum all tips - the current purchase tip is already in DB from earlier insert
      const accumulatedTips = (tipData || []).reduce((sum, p) => sum + (p.tip_usd || 0), 0)
      
      const totalRaised = nftSalesTotal + accumulatedTips
      logger.debug(`[purchase/record] Creator email totals: soldCount=${currentSoldCount}, pricePerNFT=$${pricePerNFT.toFixed(2)}, nftSales=$${nftSalesTotal.toFixed(2)}, accumulatedTips=$${accumulatedTips.toFixed(2)}, totalRaised=$${totalRaised.toFixed(2)}`)
      
      try {
        await sendCreatorPurchaseNotification({
          creatorEmail: sub.creator_email,
          creatorName: sub.creator_name || undefined,
          campaignTitle: sub.title || 'Your Campaign',
          campaignId: sub.campaign_id || effectiveId,
          donorWallet: walletAddress || 'Anonymous',
          donorName: donorName || undefined,
          donorNote: donorNote || undefined,
          amountCrypto: effectiveCryptoAmount,
          amountBDAG: amountBDAG || 0, // Legacy support
          amountUSD: amountUSD,
          tokenId: emailTokenId,
          editionNumber: typeof editionMinted === 'number' ? editionMinted : currentSoldCount,
          totalRaised: totalRaised,
          goalAmount: sub.goal || undefined,
          txHash,
          chainId: chainId || 1043 // Default to BlockDAG
        })
        logger.debug(`[purchase/record] Sent creator notification to ${sub.creator_email}, chainId=${chainId}`)
      } catch (creatorEmailErr) {
        logger.error('[purchase/record] Failed to send creator notification:', creatorEmailErr)
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Purchase recorded',
      emailSent: !!buyerEmail
    })
  } catch (e: any) {
    logger.error('Record purchase error:', e)
    return NextResponse.json({ 
      error: 'RECORD_FAILED', 
      details: e?.message 
    }, { status: 500 })
  }
}
