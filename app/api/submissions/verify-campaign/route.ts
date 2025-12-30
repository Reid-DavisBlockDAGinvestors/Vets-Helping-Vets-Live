import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Verify and fix campaign_id for a submission
 * This endpoint searches the blockchain to find the correct campaign_id
 * based on the metadata_uri stored in the submission
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body?.id) {
      return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })
    }

    const submissionId = body.id

    // Load submission
    const { data: sub, error: fetchErr } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single()

    if (fetchErr || !sub) {
      return NextResponse.json({ error: 'SUBMISSION_NOT_FOUND' }, { status: 404 })
    }

    const metadataUri = sub.metadata_uri
    if (!metadataUri) {
      return NextResponse.json({ error: 'NO_METADATA_URI', message: 'Submission has no metadata_uri' }, { status: 400 })
    }

    // If already minted with valid campaign_id, verify it's still correct
    if (sub.status === 'minted' && sub.campaign_id != null) {
      // Quick verify
      try {
        const provider = getProvider()
        const contractAddress = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''
        const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)
        
        const camp = await contract.getCampaign(BigInt(sub.campaign_id))
        const onChainUri = camp.baseURI ?? camp[1]
        
        if (onChainUri === metadataUri) {
          return NextResponse.json({
            ok: true,
            verified: true,
            campaignId: sub.campaign_id,
            status: 'minted',
            message: 'Campaign ID verified correctly'
          })
        }
      } catch {
        // Continue to search
      }
    }

    // Search blockchain for the correct campaign
    const provider = getProvider()
    const contractAddress = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

    let totalCampaigns: number
    try {
      totalCampaigns = Number(await contract.totalCampaigns())
    } catch (e: any) {
      return NextResponse.json({ 
        error: 'CONTRACT_ERROR', 
        message: 'Could not read totalCampaigns from contract',
        details: e?.message 
      }, { status: 500 })
    }

    logger.blockchain(`[verify-campaign] Searching ${totalCampaigns} campaigns for URI: ${metadataUri.slice(0, 50)}...`)

    // Search from most recent backwards (more likely to find recently created campaigns)
    let foundCampaignId: number | null = null
    for (let i = totalCampaigns - 1; i >= 0; i--) {
      try {
        const camp = await contract.getCampaign(BigInt(i))
        const onChainUri = camp.baseURI ?? camp[1]
        
        if (onChainUri === metadataUri) {
          foundCampaignId = i
          logger.blockchain(`[verify-campaign] Found campaign ${i} matching metadata URI`)
          break
        }
      } catch {
        continue
      }
    }

    if (foundCampaignId === null) {
      return NextResponse.json({
        ok: false,
        verified: false,
        message: 'Campaign not found on blockchain. Transaction may still be pending.',
        totalCampaignsSearched: totalCampaigns,
        status: sub.status
      })
    }

    // Update submission with correct campaign_id and status
    const { error: updateErr } = await supabaseAdmin
      .from('submissions')
      .update({
        campaign_id: foundCampaignId,
        status: 'minted',
        visible_on_marketplace: true
      })
      .eq('id', submissionId)

    if (updateErr) {
      logger.error('[verify-campaign] Update error:', updateErr)
      return NextResponse.json({
        ok: false,
        error: 'UPDATE_FAILED',
        details: updateErr.message,
        campaignId: foundCampaignId
      }, { status: 500 })
    }

    logger.blockchain(`[verify-campaign] Updated submission ${submissionId}: campaign_id=${foundCampaignId}, status=minted`)

    return NextResponse.json({
      ok: true,
      verified: true,
      campaignId: foundCampaignId,
      previousCampaignId: sub.campaign_id,
      previousStatus: sub.status,
      status: 'minted',
      message: `Campaign verified! ID: ${foundCampaignId}. Now available for purchase.`
    })

  } catch (e: any) {
    logger.error('[verify-campaign] Error:', e)
    return NextResponse.json({ 
      error: 'VERIFY_CAMPAIGN_FAILED', 
      details: e?.message 
    }, { status: 500 })
  }
}
