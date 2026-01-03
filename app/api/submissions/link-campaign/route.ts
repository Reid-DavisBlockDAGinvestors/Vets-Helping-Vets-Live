import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Link an on-chain campaign to a Supabase submission by matching metadata_uri
 * This fixes orphaned campaigns where the campaign_id wasn't correctly stored
 * 
 * POST body: { campaignId: number } or { metadataUri: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const campaignId = body?.campaignId
    const metadataUri = body?.metadataUri

    if (campaignId == null && !metadataUri) {
      return NextResponse.json({ error: 'MISSING_CAMPAIGN_ID_OR_URI' }, { status: 400 })
    }

    const contractAddress = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''
    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

    let targetCampaignId = campaignId
    let onChainUri: string | null = null

    // If campaignId provided, get the metadata URI from chain
    if (targetCampaignId != null) {
      try {
        const camp = await contract.getCampaign(BigInt(targetCampaignId))
        onChainUri = camp.baseURI ?? camp[1]
        if (!onChainUri) {
          return NextResponse.json({ error: 'CAMPAIGN_HAS_NO_URI' }, { status: 400 })
        }
      } catch (e: any) {
        return NextResponse.json({ error: 'CAMPAIGN_NOT_FOUND', details: e?.message }, { status: 404 })
      }
    } else {
      // Search for campaign by metadataUri
      onChainUri = metadataUri
      const totalCampaigns = Number(await contract.totalCampaigns())
      
      for (let i = totalCampaigns - 1; i >= 0; i--) {
        try {
          const camp = await contract.getCampaign(BigInt(i))
          const uri = camp.baseURI ?? camp[1]
          if (uri === metadataUri) {
            targetCampaignId = i
            break
          }
        } catch {
          continue
        }
      }

      if (targetCampaignId == null) {
        return NextResponse.json({ error: 'CAMPAIGN_NOT_FOUND_FOR_URI' }, { status: 404 })
      }
    }

    // Find submission with matching metadata_uri
    const { data: submissions, error: fetchErr } = await supabaseAdmin
      .from('submissions')
      .select('id, title, status, campaign_id, metadata_uri')
      .eq('metadata_uri', onChainUri)
      .order('created_at', { ascending: false })

    if (fetchErr) {
      return NextResponse.json({ error: 'FETCH_ERROR', details: fetchErr.message }, { status: 500 })
    }

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({ 
        error: 'NO_SUBMISSION_FOUND',
        message: 'No submission found with matching metadata_uri',
        campaignId: targetCampaignId,
        metadataUri: onChainUri
      }, { status: 404 })
    }

    const submission = submissions[0]

    // Check if already correctly linked
    if (submission.campaign_id === targetCampaignId && submission.status === 'minted') {
      return NextResponse.json({
        ok: true,
        alreadyLinked: true,
        campaignId: targetCampaignId,
        submissionId: submission.id,
        title: submission.title
      })
    }

    // Update the submission with correct campaign_id
    const { error: updateErr } = await supabaseAdmin
      .from('submissions')
      .update({
        campaign_id: targetCampaignId,
        status: 'minted',
        visible_on_marketplace: true,
        contract_address: contractAddress
      })
      .eq('id', submission.id)

    if (updateErr) {
      return NextResponse.json({ error: 'UPDATE_ERROR', details: updateErr.message }, { status: 500 })
    }

    logger.blockchain(`[link-campaign] Linked campaign ${targetCampaignId} to submission ${submission.id} (${submission.title})`)

    return NextResponse.json({
      ok: true,
      linked: true,
      campaignId: targetCampaignId,
      submissionId: submission.id,
      title: submission.title,
      previousCampaignId: submission.campaign_id,
      previousStatus: submission.status
    })

  } catch (e: any) {
    logger.error('[link-campaign] Error:', e)
    return NextResponse.json({ error: 'LINK_ERROR', details: e?.message }, { status: 500 })
  }
}
