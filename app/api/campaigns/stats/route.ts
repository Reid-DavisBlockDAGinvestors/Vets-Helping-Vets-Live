import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PLATFORM_FEE_PERCENT = 1 // 1% platform fee

/**
 * GET /api/campaigns/stats?campaignIds=1,2,3
 * Returns stats for multiple campaigns using DATABASE as source of truth
 * 
 * This ensures accurate data even when blockchain RPC is unavailable
 */
export async function GET(req: NextRequest) {
  try {
    const idsParam = req.nextUrl.searchParams.get('campaignIds')
    if (!idsParam) {
      return NextResponse.json({ error: 'campaignIds required' }, { status: 400 })
    }

    const campaignIds = idsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    if (campaignIds.length === 0) {
      return NextResponse.json({ error: 'No valid campaign IDs' }, { status: 400 })
    }

    // Create fresh Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { persistSession: false } }
    )

    // Fetch submissions with sold_count (source of truth)
    const { data: submissions, error: subError } = await supabase
      .from('submissions')
      .select('campaign_id, goal, num_copies, price_per_copy, contract_address, sold_count, title')
      .eq('status', 'minted')
      .in('campaign_id', campaignIds)
    
    if (subError) {
      logger.error('[CampaignStats] Supabase error:', subError)
      return NextResponse.json({ error: 'DB_ERROR', details: subError.message }, { status: 500 })
    }

    // Fetch purchases for accurate raised amounts
    const { data: purchases } = await supabase
      .from('purchases')
      .select('campaign_id, amount_usd, tip_usd, quantity')
      .in('campaign_id', campaignIds)

    // Build purchase totals by campaign
    const purchaseTotals: Record<number, { raised: number; tips: number; qty: number }> = {}
    for (const p of purchases || []) {
      const cid = p.campaign_id
      if (!purchaseTotals[cid]) {
        purchaseTotals[cid] = { raised: 0, tips: 0, qty: 0 }
      }
      purchaseTotals[cid].raised += p.amount_usd || 0
      purchaseTotals[cid].tips += p.tip_usd || 0
      purchaseTotals[cid].qty += p.quantity || 1
    }

    const stats: Record<number, any> = {}

    for (const campaignId of campaignIds) {
      const submission = (submissions || []).find((s: any) => s.campaign_id === campaignId)
      const purchaseData = purchaseTotals[campaignId] || { raised: 0, tips: 0, qty: 0 }
      
      if (!submission) {
        stats[campaignId] = { error: 'Campaign not found', campaignId }
        continue
      }

      const goalUSD = Number(submission.goal || 100)
      const maxEditions = Number(submission.num_copies || 100)
      const editionsMinted = Number(submission.sold_count || 0)
      
      // Price per edition from database
      let pricePerEditionUSD = 0
      if (submission.price_per_copy && Number(submission.price_per_copy) > 0) {
        pricePerEditionUSD = Number(submission.price_per_copy)
      } else if (goalUSD > 0 && maxEditions > 0) {
        pricePerEditionUSD = goalUSD / maxEditions
      }
      
      // Use purchases table for accurate raised amounts
      const grossRaisedUSD = purchaseData.raised + purchaseData.tips
      const nftSalesUSD = purchaseData.raised
      const tipsUSD = purchaseData.tips
      
      // Net after 1% platform fee
      const netRaisedUSD = grossRaisedUSD * (1 - PLATFORM_FEE_PERCENT / 100)
      
      // Remaining editions
      const remainingEditions = maxEditions > 0 ? Math.max(0, maxEditions - editionsMinted) : null
      
      // Progress percentage
      const progressPercent = maxEditions > 0 ? Math.round((editionsMinted / maxEditions) * 100) : 0
      
      stats[campaignId] = {
        campaignId,
        editionsMinted,
        maxEditions,
        remainingEditions,
        pricePerEditionUSD,
        nftSalesUSD,
        tipsUSD,
        grossRaisedUSD,
        netRaisedUSD,
        totalRaisedUSD: grossRaisedUSD,
        active: remainingEditions === null || remainingEditions > 0,
        closed: remainingEditions === 0,
        progressPercent,
        source: 'database'
      }
      
      logger.debug(`[CampaignStats] Campaign #${campaignId}: sold=${editionsMinted}/${maxEditions}, raised=$${grossRaisedUSD.toFixed(2)}`)
    }

    return NextResponse.json({ stats })
  } catch (e: any) {
    logger.error('Campaign stats error:', e)
    return NextResponse.json({ error: 'FETCH_FAILED', details: e?.message }, { status: 500 })
  }
}
