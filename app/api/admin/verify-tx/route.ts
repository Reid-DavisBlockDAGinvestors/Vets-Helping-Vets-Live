import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'

export const dynamic = 'force-dynamic'

/**
 * Verify a pending campaign transaction and extract the real campaign ID
 * POST /api/admin/verify-tx
 * Body: { submissionId: string }
 * 
 * This endpoint:
 * 1. Gets the stored tx_hash from the submission
 * 2. Checks if the transaction is confirmed on-chain
 * 3. Parses the CampaignCreated event to get the real campaign ID
 * 4. Updates Supabase with the confirmed campaign ID and status
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }
    const token = authHeader.slice(7)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }
    // Check admin role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

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

    const txHash = sub.tx_hash
    if (!txHash || txHash.startsWith('(')) {
      return NextResponse.json({ 
        error: 'No valid transaction hash stored',
        status: sub.status,
        tx_hash: txHash
      }, { status: 400 })
    }

    // Setup provider
    const provider = getProvider()
    const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
    
    if (!contractAddress) {
      return NextResponse.json({ error: 'Contract not configured' }, { status: 500 })
    }

    // Check transaction receipt
    console.log(`[verify-tx] Checking tx: ${txHash}`)
    let receipt
    try {
      receipt = await provider.getTransactionReceipt(txHash)
    } catch (e: any) {
      console.log(`[verify-tx] Error getting receipt: ${e?.message}`)
      return NextResponse.json({ 
        verified: false,
        status: 'pending',
        message: 'Transaction not found or still pending',
        txHash
      })
    }

    if (!receipt) {
      return NextResponse.json({ 
        verified: false,
        status: 'pending',
        message: 'Transaction still pending confirmation',
        txHash
      })
    }

    if (receipt.status === 0) {
      // Transaction failed
      console.log(`[verify-tx] Transaction failed (reverted)`)
      await supabaseAdmin
        .from('submissions')
        .update({ 
          status: 'approved', // Reset to approved for retry
          campaign_id: null,
          tx_hash: null
        })
        .eq('id', submissionId)

      return NextResponse.json({ 
        verified: false,
        status: 'failed',
        message: 'Transaction failed (reverted). Status reset to approved for retry.',
        txHash,
        blockNumber: Number(receipt.blockNumber)
      })
    }

    // Transaction succeeded - parse CampaignCreated event
    console.log(`[verify-tx] Transaction confirmed in block ${receipt.blockNumber}`)
    
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)
    let confirmedCampaignId: number | null = null

    for (const log of receipt.logs || []) {
      try {
        const parsed = contract.interface.parseLog({ 
          topics: log.topics as string[], 
          data: log.data 
        })
        if (parsed && parsed.name === 'CampaignCreated') {
          confirmedCampaignId = Number(parsed.args[0])
          console.log(`[verify-tx] Found CampaignCreated event, campaignId: ${confirmedCampaignId}`)
          break
        }
      } catch {
        // Not our event
      }
    }

    if (confirmedCampaignId === null) {
      // Fallback: search by metadata URI
      console.log(`[verify-tx] CampaignCreated event not found, searching by metadata URI`)
      const metadataUri = sub.metadata_uri
      const totalCampaigns = Number(await contract.totalCampaigns())
      
      for (let i = totalCampaigns - 1; i >= 0; i--) {
        try {
          const camp = await contract.getCampaign(BigInt(i))
          const baseURI = camp.baseURI ?? camp[1]
          if (baseURI === metadataUri) {
            confirmedCampaignId = i
            console.log(`[verify-tx] Found campaign by URI match at ID ${i}`)
            break
          }
        } catch {
          continue
        }
      }
    }

    if (confirmedCampaignId === null) {
      return NextResponse.json({ 
        verified: false,
        status: 'error',
        message: 'Transaction confirmed but could not find campaign ID',
        txHash,
        blockNumber: Number(receipt.blockNumber)
      }, { status: 500 })
    }

    // Verify the campaign is active
    const campaign = await contract.getCampaign(BigInt(confirmedCampaignId))
    const active = campaign.active ?? campaign[8]
    const closed = campaign.closed ?? campaign[9]

    // Update Supabase with confirmed data including contract_address
    const { error: updateErr } = await supabaseAdmin
      .from('submissions')
      .update({ 
        status: 'minted',
        campaign_id: confirmedCampaignId,
        contract_address: contractAddress
      })
      .eq('id', submissionId)

    if (updateErr) {
      return NextResponse.json({ 
        error: 'Failed to update submission', 
        details: updateErr.message,
        confirmedCampaignId
      }, { status: 500 })
    }

    return NextResponse.json({ 
      verified: true,
      status: 'confirmed',
      campaignId: confirmedCampaignId,
      active,
      closed,
      txHash,
      blockNumber: Number(receipt.blockNumber),
      message: `Campaign verified! ID: ${confirmedCampaignId}`
    })

  } catch (e: any) {
    console.error('[verify-tx] Error:', e)
    return NextResponse.json({ 
      error: 'Verification failed', 
      details: e?.message || String(e) 
    }, { status: 500 })
  }
}
