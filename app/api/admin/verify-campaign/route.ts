import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Verify and fix a campaign's on-chain status
 * POST /api/admin/verify-campaign
 * Body: { submissionId: string }
 * 
 * This endpoint:
 * 1. Checks if the stored campaign_id exists on-chain
 * 2. If not, searches for the campaign by metadata URI
 * 3. Updates Supabase with the correct ID or resets status if not found
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    
    const { data: userData } = await supabaseAdmin.auth.getUser(token)
    const uid = userData?.user?.id
    if (!uid) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
    if (!['admin', 'super_admin'].includes(profile?.role || '')) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const submissionId = body?.submissionId
    if (!submissionId) {
      return NextResponse.json({ error: 'Missing submissionId' }, { status: 400 })
    }

    // Get submission
    const { data: sub, error: subErr } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single()

    if (subErr || !sub) {
      return NextResponse.json({ error: 'Submission not found', details: subErr?.message }, { status: 404 })
    }

    const metadataUri = sub.metadata_uri
    const storedCampaignId = sub.campaign_id

    // Setup contract
    const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
    if (!contractAddress) {
      return NextResponse.json({ error: 'Contract not configured' }, { status: 500 })
    }

    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

    // Get total campaigns
    const totalCampaigns = Number(await contract.totalCampaigns())
    logger.debug(`[verify-campaign] Total campaigns on-chain: ${totalCampaigns}`)

    // Check if stored campaign ID is valid
    let storedIdValid = false
    if (storedCampaignId != null && storedCampaignId < totalCampaigns) {
      try {
        const camp = await contract.getCampaign(BigInt(storedCampaignId))
        const baseURI = camp.baseURI ?? camp[1]
        if (baseURI === metadataUri) {
          storedIdValid = true
          logger.debug(`[verify-campaign] Stored ID ${storedCampaignId} is valid and matches metadata URI`)
        } else {
          logger.debug(`[verify-campaign] Stored ID ${storedCampaignId} exists but has different URI`)
        }
      } catch (e) {
        logger.debug(`[verify-campaign] Stored ID ${storedCampaignId} does not exist on-chain`)
      }
    }

    if (storedIdValid) {
      // Campaign is valid, check if active
      const camp = await contract.getCampaign(BigInt(storedCampaignId))
      const active = camp.active ?? camp[8]
      const closed = camp.closed ?? camp[9]
      
      return NextResponse.json({
        ok: true,
        status: 'valid',
        campaignId: storedCampaignId,
        active,
        closed,
        message: 'Campaign ID is correct and exists on-chain'
      })
    }

    // Search for campaign by metadata URI
    logger.debug(`[verify-campaign] Searching for campaign with URI: ${metadataUri?.slice(0, 50)}...`)
    let foundCampaignId: number | null = null
    let foundCampaign: any = null

    for (let i = 0; i < totalCampaigns; i++) {
      try {
        const camp = await contract.getCampaign(BigInt(i))
        const baseURI = camp.baseURI ?? camp[1]
        if (baseURI === metadataUri) {
          foundCampaignId = i
          foundCampaign = camp
          logger.debug(`[verify-campaign] Found matching campaign at ID ${i}`)
          break
        }
      } catch {
        continue
      }
    }

    if (foundCampaignId !== null) {
      // Update Supabase with correct ID and contract_address
      const { error: updateErr } = await supabaseAdmin
        .from('submissions')
        .update({ 
          campaign_id: foundCampaignId,
          status: 'minted',
          contract_address: contractAddress
        })
        .eq('id', submissionId)

      if (updateErr) {
        return NextResponse.json({ 
          error: 'Failed to update submission', 
          details: updateErr.message 
        }, { status: 500 })
      }

      const active = foundCampaign.active ?? foundCampaign[8]
      const closed = foundCampaign.closed ?? foundCampaign[9]

      return NextResponse.json({
        ok: true,
        status: 'fixed',
        oldCampaignId: storedCampaignId,
        newCampaignId: foundCampaignId,
        active,
        closed,
        message: `Campaign ID corrected from ${storedCampaignId} to ${foundCampaignId}`
      })
    }

    // Campaign not found on-chain - reset status
    logger.debug(`[verify-campaign] Campaign not found on-chain, resetting status`)
    const { error: resetErr } = await supabaseAdmin
      .from('submissions')
      .update({ 
        status: 'approved',
        campaign_id: null,
        tx_hash: null
      })
      .eq('id', submissionId)

    if (resetErr) {
      return NextResponse.json({ 
        error: 'Failed to reset submission', 
        details: resetErr.message 
      }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      status: 'reset',
      totalCampaigns,
      message: 'Campaign not found on-chain. Status reset to "approved" for re-creation.'
    })

  } catch (e: any) {
    console.error('[verify-campaign] Error:', e)
    return NextResponse.json({ 
      error: 'Verification failed', 
      details: e?.message || String(e) 
    }, { status: 500 })
  }
}
