import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'

export const dynamic = 'force-dynamic'

const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || process.env.NEXT_PUBLIC_BDAG_USD_RATE || '0.05')

export async function GET(_req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { persistSession: false } }
    )

    const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
    
    // Get minted campaigns from Supabase
    const { data: submissions, error: subError } = await supabase
      .from('submissions')
      .select('id, campaign_id, title, goal, num_copies')
      .eq('status', 'minted')
      .not('campaign_id', 'is', null)

    if (subError) {
      console.error('[Analytics] Supabase error:', subError)
    }

    const campaignIds = (submissions || [])
      .map(s => s.campaign_id)
      .filter((id): id is number => id != null)

    console.log(`[Analytics] Found ${campaignIds.length} minted campaigns: ${campaignIds.join(', ')}`)

    let totalRaisedUSD = 0
    let totalNftsMinted = 0
    let totalCampaigns = campaignIds.length

    // Get on-chain data for each campaign
    if (contractAddress && campaignIds.length > 0) {
      try {
        const provider = getProvider()
        const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

        for (const campaignId of campaignIds) {
          try {
            const camp = await contract.getCampaign(BigInt(campaignId))
            const grossRaisedWei = BigInt(camp.grossRaised ?? camp[3] ?? 0n)
            const grossRaisedBDAG = Number(grossRaisedWei) / 1e18
            const raisedUSD = grossRaisedBDAG * BDAG_USD_RATE
            const minted = Number(camp.editionsMinted ?? camp[5] ?? 0)
            
            totalRaisedUSD += raisedUSD
            totalNftsMinted += minted
            
            console.log(`[Analytics] Campaign #${campaignId}: raised=$${raisedUSD.toFixed(2)}, minted=${minted}`)
          } catch (e: any) {
            console.error(`[Analytics] Error fetching campaign ${campaignId}:`, e?.message)
          }
        }
      } catch (e) {
        console.error('[Analytics] Contract error:', e)
      }
    }
    
    console.log(`[Analytics] TOTALS: raised=$${totalRaisedUSD.toFixed(2)}, nfts=${totalNftsMinted}, campaigns=${totalCampaigns}`)

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
      fundsRaised: Math.round(totalRaisedUSD * 100) / 100,
      purchases: totalNftsMinted, // NFTs sold = purchases
      mints: totalCampaigns, // Campaigns minted
      milestones: milestones || 0,
      donorRetention: 0, // Placeholder
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
