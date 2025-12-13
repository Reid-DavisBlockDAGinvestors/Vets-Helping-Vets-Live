import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendPurchaseReceipt } from '@/lib/mailer'

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
      editionMinted,
      buyerEmail // NEW: email for receipt
    } = body

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
          source: 'wallet_direct',
        }
      })

    if (eventError) {
      console.error('Failed to record purchase event:', eventError)
    }

    // Update the submission's sold_count (default 1 for edition mint)
    const qty = quantity ?? 1
    // Try campaign_id first (V5), fallback to token_id
    const { data: subByCampaign } = await supabaseAdmin
      .from('submissions')
      .select('id, sold_count, title, image_uri, campaign_id')
      .eq('campaign_id', effectiveId)
      .maybeSingle()
    
    const sub = subByCampaign || (await supabaseAdmin
      .from('submissions')
      .select('id, sold_count, title, image_uri, campaign_id')
      .eq('token_id', effectiveId)
      .maybeSingle()).data

    if (sub) {
      await supabaseAdmin
        .from('submissions')
        .update({ sold_count: (sub.sold_count || 0) + qty })
        .eq('id', sub.id)
      console.log(`[purchase/record] Updated sold_count for submission ${sub.id}`)
    }

    // Send purchase receipt email if buyer provided email
    if (buyerEmail && sub) {
      try {
        await sendPurchaseReceipt({
          email: buyerEmail,
          campaignTitle: sub.title || 'Campaign',
          campaignId: sub.campaign_id || effectiveId,
          tokenId: tokenId || editionMinted,
          editionNumber: editionMinted,
          amountBDAG: amountBDAG || 0,
          amountUSD: amountUSD,
          txHash,
          walletAddress: walletAddress || '',
          imageUrl: toHttpUrl(sub.image_uri) || undefined
        })
        console.log(`[purchase/record] Sent receipt email to ${buyerEmail}`)
      } catch (emailErr) {
        console.error('[purchase/record] Failed to send receipt email:', emailErr)
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
