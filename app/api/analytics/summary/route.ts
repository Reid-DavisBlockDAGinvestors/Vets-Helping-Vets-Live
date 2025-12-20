import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calculatePlatformStats } from '@/lib/stats'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { persistSession: false } }
    )

    // Use unified stats calculation
    const platformStats = await calculatePlatformStats(supabase)
    
    console.log(`[Analytics] Using unified stats: $${platformStats.totalRaisedUSD}, ${platformStats.totalNFTsMinted} NFTs, ${platformStats.totalCampaigns} campaigns`)

    // Calculate donor retention from purchases table
    // (% of wallets that purchased from 2+ different campaigns)
    let donorRetention = 0
    let totalUniqueWallets = 0
    let repeatDonors = 0
    
    try {
      // Get all purchases grouped by wallet
      const { data: purchases } = await supabase
        .from('purchases')
        .select('wallet_address, campaign_id')
      
      if (purchases && purchases.length > 0) {
        // Build map of wallet -> Set of campaign IDs
        const walletCampaigns: Record<string, Set<number>> = {}
        for (const p of purchases) {
          const wallet = p.wallet_address?.toLowerCase()
          if (wallet && p.campaign_id != null) {
            if (!walletCampaigns[wallet]) {
              walletCampaigns[wallet] = new Set()
            }
            walletCampaigns[wallet].add(p.campaign_id)
          }
        }
        
        // Calculate retention
        const wallets = Object.keys(walletCampaigns)
        totalUniqueWallets = wallets.length
        repeatDonors = wallets.filter(w => walletCampaigns[w].size >= 2).length
        
        if (totalUniqueWallets > 0) {
          donorRetention = Math.round((repeatDonors / totalUniqueWallets) * 100)
        }
        
        console.log(`[Analytics] Donor Retention: ${repeatDonors}/${totalUniqueWallets} wallets (${donorRetention}%) from purchases table`)
      }
    } catch (e: any) {
      console.error('[Analytics] Donor retention calc error:', e?.message)
      // Table might not exist yet - that's OK
    }

    // Get milestone count (approved campaign updates) and list of campaigns with milestones
    const { data: milestoneData, count: milestones } = await supabase
      .from('campaign_updates')
      .select('submission_id, title, created_at', { count: 'exact' })
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(50)

    // Get submission IDs that have approved milestones
    const milestonedSubmissionIds = [...new Set((milestoneData || []).map(m => m.submission_id))]

    // Count milestones per submission
    const milestonesPerSubmission: Record<string, number> = {}
    for (const m of milestoneData || []) {
      milestonesPerSubmission[m.submission_id] = (milestonesPerSubmission[m.submission_id] || 0) + 1
    }

    return NextResponse.json({
      fundsRaised: platformStats.totalRaisedUSD,
      purchases: platformStats.totalNFTsMinted, // NFTs sold = purchases
      mints: platformStats.totalCampaigns, // Campaigns minted
      milestones: milestones || 0,
      donorRetention, // % of wallets that purchased from 2+ campaigns
      totalUniqueWallets,
      repeatDonors,
      // Detailed breakdown
      onchainRaisedUSD: platformStats.onchainRaisedUSD,
      offchainRaisedUSD: platformStats.offchainRaisedUSD,
      v5RaisedUSD: platformStats.v5RaisedUSD,
      v6RaisedUSD: platformStats.v6RaisedUSD,
      orphanedSubmissions: platformStats.orphanedSubmissions,
      calculatedAt: platformStats.calculatedAt,
      // Detailed milestone info
      milestonedSubmissionIds,
      milestonesPerSubmission,
      recentMilestones: (milestoneData || []).slice(0, 10)
    })
  } catch (e: any) {
    console.error('[Analytics] Error:', e)
    return NextResponse.json({
      fundsRaised: 0,
      purchases: 0,
      mints: 0,
      milestones: 0,
      donorRetention: 0,
      milestonedSubmissionIds: [],
      milestonesPerSubmission: {},
      recentMilestones: [],
      error: e?.message
    })
  }
}
