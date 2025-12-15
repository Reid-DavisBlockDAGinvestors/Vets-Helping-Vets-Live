import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendPurchaseReceipt, sendCreatorPurchaseNotification } from '@/lib/mailer'

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
      amountBDAG, 
      tipBDAG, 
      walletAddress,
      quantity,
      editionMinted, // Token ID of the minted edition (or true for legacy)
      mintedTokenIds, // Array of all token IDs if multiple minted
      buyerEmail, // Email for receipt
      userId, // Logged-in user ID if available
      paymentMethod, // crypto_bdag, stripe, etc.
      referrer // How user found the campaign
    } = body

    // Get request metadata for fraud prevention
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || null
    const userAgent = req.headers.get('user-agent') || null

    // V5: Accept either tokenId or campaignId
    const effectiveId = campaignId ?? tokenId
    
    if (effectiveId == null || !txHash) {
      return NextResponse.json({ error: 'MISSING_REQUIRED_FIELDS', details: 'tokenId/campaignId and txHash required' }, { status: 400 })
    }
    
    console.log(`[purchase/record] Recording purchase: campaignId=${effectiveId}, txHash=${txHash}, amountBDAG=${amountBDAG}`)

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
          tipUSD,
          tipBDAG,
          quantity: quantity ?? 1,
          editionMinted,
          mintedTokenIds: mintedTokenIds || [],
          source: 'wallet_direct',
        }
      })

    if (eventError) {
      console.error('Failed to record purchase event:', eventError)
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
          amount_bdag: amountBDAG || null,
          amount_usd: amountUSD || null,
          tip_bdag: tipBDAG || 0,
          tip_usd: tipUSD || 0,
          quantity: quantity || 1,
          email: buyerEmail || null,
          user_id: userId || null,
          payment_method: paymentMethod || 'crypto_bdag',
          ip_address: ipAddress,
          user_agent: userAgent,
          referrer: referrer || null
        })
      
      if (purchaseError) {
        console.error('[purchase/record] Failed to record to purchases table:', purchaseError)
      } else {
        console.log(`[purchase/record] Recorded purchase for wallet ${walletAddress}, campaign ${effectiveId}`)
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
      console.log(`[purchase/record] Updated sold_count for submission ${sub.id}`)
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
    if (buyerEmail && sub) {
      try {
        await sendPurchaseReceipt({
          email: buyerEmail,
          campaignTitle: sub.title || 'Campaign',
          campaignId: sub.campaign_id || effectiveId,
          tokenId: emailTokenId,
          editionNumber: typeof editionMinted === 'number' ? editionMinted : undefined,
          amountBDAG: amountBDAG || 0,
          amountUSD: amountUSD,
          txHash,
          walletAddress: walletAddress || '',
          imageUrl: toHttpUrl(sub.image_uri) || undefined
        })
        console.log(`[purchase/record] Sent receipt email to ${buyerEmail} with tokenId=${emailTokenId}`)
      } catch (emailErr) {
        console.error('[purchase/record] Failed to send receipt email:', emailErr)
      }
    }

    // Send notification to campaign CREATOR that they received a donation
    if (sub?.creator_email) {
      // Calculate total raised (current sold_count * price per NFT)
      const newSoldCount = (sub.sold_count || 0) + qty
      const pricePerNFT = sub.goal && newSoldCount > 0 ? sub.goal / 100 : amountUSD || 0 // Estimate
      const totalRaised = newSoldCount * pricePerNFT
      
      try {
        await sendCreatorPurchaseNotification({
          creatorEmail: sub.creator_email,
          creatorName: sub.creator_name || undefined,
          campaignTitle: sub.title || 'Your Campaign',
          campaignId: sub.campaign_id || effectiveId,
          donorWallet: walletAddress || 'Anonymous',
          amountBDAG: amountBDAG || 0,
          amountUSD: amountUSD,
          tokenId: emailTokenId,
          editionNumber: typeof editionMinted === 'number' ? editionMinted : newSoldCount,
          totalRaised: totalRaised,
          goalAmount: sub.goal || undefined,
          txHash
        })
        console.log(`[purchase/record] Sent creator notification to ${sub.creator_email}`)
      } catch (creatorEmailErr) {
        console.error('[purchase/record] Failed to send creator notification:', creatorEmailErr)
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Purchase recorded',
      emailSent: !!buyerEmail
    })
  } catch (e: any) {
    console.error('Record purchase error:', e)
    return NextResponse.json({ 
      error: 'RECORD_FAILED', 
      details: e?.message 
    }, { status: 500 })
  }
}
