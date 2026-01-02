import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getSignerForChain, getContractAddress, type ChainId } from '@/lib/chains'
import { PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/campaigns/lifecycle
 * Campaign lifecycle management: close, deactivate, reactivate
 * 
 * Actions:
 * - close: Closes the campaign on-chain (stops new purchases)
 * - deactivate: Hides from marketplace (off-chain only)
 * - reactivate: Restores visibility and optionally reopens on-chain
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin auth
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const { data: userData } = await supabaseAdmin.auth.getUser(token)
    const uid = userData?.user?.id
    if (!uid) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const { data: profile } = await supabaseAdmin.from('profiles').select('role, email').eq('id', uid).single()
    if (!['admin', 'super_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const body = await req.json()
    const { submissionId, action, reason } = body

    if (!submissionId) {
      return NextResponse.json({ error: 'submissionId required' }, { status: 400 })
    }
    if (!['close', 'deactivate', 'reactivate'].includes(action)) {
      return NextResponse.json({ error: 'action must be close, deactivate, or reactivate' }, { status: 400 })
    }

    // Fetch the submission
    const { data: submission, error: fetchError } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single()

    if (fetchError || !submission) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const chainId = (submission.chain_id || 1043) as ChainId
    const contractVersion = submission.contract_version || 'v6'
    const campaignId = submission.campaign_id

    let txHash: string | null = null
    let newStatus = submission.status

    switch (action) {
      case 'close':
        // Close campaign on-chain - requires campaign_id
        if (!campaignId) {
          return NextResponse.json({ 
            error: 'Cannot close: campaign not minted on-chain' 
          }, { status: 400 })
        }

        const closeContractAddress = getContractAddress(chainId, contractVersion as any)
        if (!closeContractAddress) {
          return NextResponse.json({ error: 'Contract not found' }, { status: 400 })
        }

        try {
          const signer = getSignerForChain(chainId)
          const contract = new ethers.Contract(closeContractAddress, PatriotPledgeV5ABI, signer)
          
          logger.info(`[lifecycle] Closing campaign ${campaignId} on chain ${chainId}`)
          const tx = await contract.closeCampaign(campaignId)
          const receipt = await tx.wait()
          txHash = receipt.hash
          newStatus = 'closed'
        } catch (e: any) {
          logger.error(`[lifecycle] Close failed: ${e?.message}`)
          return NextResponse.json({
            error: 'Failed to close campaign on-chain',
            details: e?.message
          }, { status: 500 })
        }
        break

      case 'deactivate':
        // Deactivate is off-chain only - just update status
        newStatus = 'deactivated'
        logger.info(`[lifecycle] Deactivating campaign ${submissionId}`)
        break

      case 'reactivate':
        // Reactivate - if was closed on-chain, might need contract call
        // For now, just update status to minted (if it has campaign_id)
        if (submission.status === 'closed' && campaignId) {
          // Check if we can reopen on-chain (V7+ contracts may support this)
          // For now, just update off-chain status
          logger.warn(`[lifecycle] Campaign was closed on-chain - reactivating off-chain only`)
        }
        newStatus = campaignId ? 'minted' : 'approved'
        logger.info(`[lifecycle] Reactivating campaign ${submissionId} to status: ${newStatus}`)
        break
    }

    // Update submission status
    const { error: updateError } = await supabaseAdmin
      .from('submissions')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', submissionId)

    if (updateError) {
      logger.error(`[lifecycle] Update failed: ${updateError.message}`)
      return NextResponse.json({
        error: 'Failed to update campaign status',
        details: updateError.message
      }, { status: 500 })
    }

    // Log to audit trail
    await supabaseAdmin.from('admin_audit_log').insert({
      user_id: uid,
      action: `campaign_${action}`,
      details: {
        submissionId,
        campaignId,
        chainId,
        contractVersion,
        previousStatus: submission.status,
        newStatus,
        reason: reason || null,
        txHash
      },
      created_at: new Date().toISOString()
    })

    return NextResponse.json({
      ok: true,
      action,
      submissionId,
      previousStatus: submission.status,
      newStatus,
      txHash
    })

  } catch (e: any) {
    logger.error('[admin/campaigns/lifecycle] Error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
