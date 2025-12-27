import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'
import { debugGuard } from '@/lib/debugGuard'

export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to check sync between on-chain campaigns and Supabase submissions
 * Shows which campaigns exist on-chain but not in Supabase (orphaned)
 * And which submissions exist but have wrong campaign_id
 */
export async function GET(req: NextRequest) {
  const blocked = debugGuard()
  if (blocked) return blocked

  try {
    const contractAddress = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''
    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

    // Get total campaigns on-chain
    const totalCampaigns = Number(await contract.totalCampaigns())

    // Get all submissions with campaign_id
    const { data: submissions, error } = await supabaseAdmin
      .from('submissions')
      .select('id, title, status, campaign_id, metadata_uri')
      .not('campaign_id', 'is', null)
      .order('campaign_id', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'FETCH_ERROR', details: error.message }, { status: 500 })
    }

    // Create a map of campaign_id to submission
    const submissionByCampaignId: Record<number, any> = {}
    for (const sub of submissions || []) {
      if (sub.campaign_id != null) {
        submissionByCampaignId[sub.campaign_id] = sub
      }
    }

    // Check each on-chain campaign
    const orphanedCampaigns: any[] = []
    const mismatchedCampaigns: any[] = []
    const syncedCampaigns: any[] = []

    for (let i = 0; i < totalCampaigns && i < 60; i++) {
      try {
        const camp = await contract.getCampaign(BigInt(i))
        const onChainUri = camp.baseURI ?? camp[1]
        const isActive = camp.active ?? camp[8] ?? false

        // Skip empty/inactive campaigns
        if (!onChainUri || onChainUri === '') continue

        const submission = submissionByCampaignId[i]
        
        if (!submission) {
          // Campaign exists on-chain but no submission
          orphanedCampaigns.push({
            campaignId: i,
            onChainUri: onChainUri.slice(0, 60) + '...',
            isActive
          })
        } else if (submission.metadata_uri !== onChainUri) {
          // Submission exists but metadata_uri doesn't match
          mismatchedCampaigns.push({
            campaignId: i,
            submissionId: submission.id,
            submissionUri: submission.metadata_uri?.slice(0, 60) + '...',
            onChainUri: onChainUri.slice(0, 60) + '...',
            title: submission.title
          })
        } else {
          syncedCampaigns.push({
            campaignId: i,
            title: submission.title,
            status: submission.status
          })
        }
      } catch {
        // Campaign doesn't exist or error reading
        continue
      }
    }

    // Also check for pending submissions
    const { data: pendingSubmissions } = await supabaseAdmin
      .from('submissions')
      .select('id, title, status, campaign_id, metadata_uri')
      .in('status', ['approved', 'pending_onchain', 'pending'])
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      totalOnChainCampaigns: totalCampaigns,
      totalSubmissionsWithCampaignId: submissions?.length || 0,
      orphanedCampaigns: {
        count: orphanedCampaigns.length,
        items: orphanedCampaigns
      },
      mismatchedCampaigns: {
        count: mismatchedCampaigns.length,
        items: mismatchedCampaigns
      },
      syncedCampaigns: {
        count: syncedCampaigns.length,
        sample: syncedCampaigns.slice(0, 5)
      },
      pendingSubmissions: pendingSubmissions || []
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'DEBUG_ERROR', details: e?.message }, { status: 500 })
  }
}
