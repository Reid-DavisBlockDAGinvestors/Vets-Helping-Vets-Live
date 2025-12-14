import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Admin endpoint to fix/update a submission's on-chain data
 * POST /api/admin/fix-submission
 * Body: { submissionId, campaignId, txHash, contractAddress }
 */
export async function POST(req: NextRequest) {
  try {
    // Simple auth check - require admin token
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { submissionId, campaignId, txHash, contractAddress } = body

    if (!submissionId) {
      return NextResponse.json({ error: 'submissionId required' }, { status: 400 })
    }

    // Build update object with only provided fields
    const updates: Record<string, any> = {}
    if (campaignId !== undefined) updates.campaign_id = campaignId
    if (txHash !== undefined) updates.tx_hash = txHash
    if (contractAddress !== undefined) updates.contract_address = contractAddress
    
    // If we have campaign_id and tx_hash, mark as minted
    if (campaignId && txHash) {
      updates.status = 'minted'
      updates.visible_on_marketplace = true
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .update(updates)
      .eq('id', submissionId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Update failed', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Submission updated',
      submission: {
        id: data.id,
        title: data.title,
        status: data.status,
        campaign_id: data.campaign_id,
        tx_hash: data.tx_hash,
        contract_address: data.contract_address
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Fix submission failed', details: e?.message }, { status: 500 })
  }
}
