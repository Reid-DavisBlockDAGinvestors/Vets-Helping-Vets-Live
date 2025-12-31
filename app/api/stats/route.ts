import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const revalidate = 0 // No cache - always fresh data

/**
 * Stats API - Uses purchases table as source of truth
 * This ensures accurate data regardless of blockchain RPC status
 */
export async function GET() {
  try {
    // Get total raised from purchases table (source of truth)
    const { data: purchases, error: purchaseError } = await supabaseAdmin
      .from('purchases')
      .select('amount_usd, tip_usd, quantity')
    
    if (purchaseError) {
      logger.error('[Stats] Error fetching purchases:', purchaseError)
      return NextResponse.json({
        totalRaisedUSD: 0,
        totalCampaigns: 0,
        totalNFTsMinted: 0,
        error: purchaseError.message
      })
    }

    // Calculate totals from purchases
    let totalRaisedUSD = 0
    let totalNFTsSold = 0
    
    for (const p of purchases || []) {
      totalRaisedUSD += (p.amount_usd || 0) + (p.tip_usd || 0)
      totalNFTsSold += p.quantity || 1
    }

    // Get campaign count from submissions
    const { data: campaigns, error: campaignError } = await supabaseAdmin
      .from('submissions')
      .select('id')
      .eq('status', 'minted')
    
    const totalCampaigns = campaigns?.length || 0

    logger.api(`[Stats] Campaigns: ${totalCampaigns}, NFTs: ${totalNFTsSold}, Raised: $${totalRaisedUSD.toFixed(2)}`)

    return NextResponse.json({
      totalRaisedUSD: Math.round(totalRaisedUSD * 100) / 100,
      totalCampaigns,
      totalNFTsMinted: totalNFTsSold,
      totalPurchases: purchases?.length || 0,
      source: 'database'
    })
  } catch (e: any) {
    logger.error('[Stats] Error:', e)
    return NextResponse.json({
      totalRaisedUSD: 0,
      totalCampaigns: 0,
      totalNFTsMinted: 0,
      error: e?.message || 'Failed to fetch stats'
    })
  }
}
