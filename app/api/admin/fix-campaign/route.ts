import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'

export const dynamic = 'force-dynamic'

/**
 * Fix campaign_id mismatch between Supabase and on-chain
 * This endpoint finds the correct on-chain campaign by matching metadata_uri
 */
export async function POST(req: NextRequest) {
  try {
    // Require admin auth
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    
    const { data: userData } = await supabaseAdmin.auth.getUser(token)
    const uid = userData?.user?.id
    if (!uid) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
    if (!['admin', 'super_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const submissionId = body?.submissionId
    
    if (!submissionId) {
      return NextResponse.json({ error: 'submissionId required' }, { status: 400 })
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
    if (!metadataUri) {
      return NextResponse.json({ error: 'Submission has no metadata_uri' }, { status: 400 })
    }

    // Get contract
    const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
    if (!contractAddress) {
      return NextResponse.json({ error: 'No contract address configured' }, { status: 500 })
    }

    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

    // Get total campaigns
    let totalCampaigns: number
    try {
      totalCampaigns = Number(await contract.totalCampaigns())
    } catch (e: any) {
      return NextResponse.json({ error: 'Failed to get totalCampaigns', details: e?.message }, { status: 500 })
    }

    console.log(`[fix-campaign] Searching ${totalCampaigns} campaigns for metadata_uri: ${metadataUri.slice(0, 50)}...`)

    // Search for matching campaign by metadata_uri (baseURI)
    let matchedCampaignId: number | null = null
    let matchedCampaign: any = null

    for (let i = 0; i < totalCampaigns; i++) {
      try {
        const camp = await contract.getCampaign(BigInt(i))
        const baseURI = camp.baseURI ?? camp[1]
        
        if (baseURI === metadataUri) {
          matchedCampaignId = i
          matchedCampaign = {
            campaignId: i,
            category: camp.category ?? camp[0],
            baseURI,
            goal: Number(camp.goal ?? camp[2]),
            active: Boolean(camp.active ?? camp[8]),
            closed: Boolean(camp.closed ?? camp[9]),
            editionsMinted: Number(camp.editionsMinted ?? camp[5]),
            maxEditions: Number(camp.maxEditions ?? camp[6])
          }
          console.log(`[fix-campaign] Found matching campaign: ${i}`)
          break
        }
      } catch (e) {
        // Campaign might not exist at this index
        continue
      }
    }

    if (matchedCampaignId === null) {
      return NextResponse.json({ 
        error: 'No matching campaign found on-chain',
        searched: totalCampaigns,
        metadataUri 
      }, { status: 404 })
    }

    // Check if campaign is active
    if (!matchedCampaign.active) {
      return NextResponse.json({
        error: 'Campaign found but not active on-chain',
        campaignId: matchedCampaignId,
        campaign: matchedCampaign
      }, { status: 400 })
    }

    // Update submission with correct campaign_id
    const oldCampaignId = sub.campaign_id
    const { error: updateErr } = await supabaseAdmin
      .from('submissions')
      .update({ 
        campaign_id: matchedCampaignId,
        status: 'minted',
        visible_on_marketplace: true
      })
      .eq('id', submissionId)

    if (updateErr) {
      return NextResponse.json({ 
        error: 'Failed to update submission', 
        details: updateErr.message 
      }, { status: 500 })
    }

    console.log(`[fix-campaign] Updated submission ${submissionId}: campaign_id ${oldCampaignId} -> ${matchedCampaignId}`)

    return NextResponse.json({
      ok: true,
      submissionId,
      oldCampaignId,
      newCampaignId: matchedCampaignId,
      campaign: matchedCampaign,
      message: `Campaign ID fixed: ${oldCampaignId} -> ${matchedCampaignId}`
    })

  } catch (e: any) {
    console.error('[fix-campaign] Error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}

/**
 * GET: Check all submissions for campaign_id mismatches
 */
export async function GET(req: NextRequest) {
  try {
    // Require admin auth
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    
    const { data: userData } = await supabaseAdmin.auth.getUser(token)
    const uid = userData?.user?.id
    if (!uid) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
    if (!['admin', 'super_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Get all minted submissions
    const { data: submissions, error: subErr } = await supabaseAdmin
      .from('submissions')
      .select('id, title, campaign_id, metadata_uri, status')
      .eq('status', 'minted')
      .not('campaign_id', 'is', null)

    if (subErr) {
      return NextResponse.json({ error: 'Failed to fetch submissions', details: subErr.message }, { status: 500 })
    }

    // Get contract
    const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

    const results: any[] = []

    for (const sub of submissions || []) {
      try {
        // Check if campaign exists and is active at the stored campaign_id
        const camp = await contract.getCampaign(BigInt(sub.campaign_id))
        const baseURI = camp.baseURI ?? camp[1]
        const active = Boolean(camp.active ?? camp[8])
        
        const uriMatches = baseURI === sub.metadata_uri
        
        results.push({
          submissionId: sub.id,
          title: sub.title,
          storedCampaignId: sub.campaign_id,
          onChainActive: active,
          uriMatches,
          needsFix: !active || !uriMatches,
          onChainUri: baseURI?.slice(0, 50) + '...',
          supabaseUri: sub.metadata_uri?.slice(0, 50) + '...'
        })
      } catch (e: any) {
        results.push({
          submissionId: sub.id,
          title: sub.title,
          storedCampaignId: sub.campaign_id,
          error: 'Campaign not found on-chain',
          needsFix: true
        })
      }
    }

    const needsFix = results.filter(r => r.needsFix)

    return NextResponse.json({
      total: results.length,
      needsFix: needsFix.length,
      submissions: results
    })

  } catch (e: any) {
    console.error('[fix-campaign] GET Error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
