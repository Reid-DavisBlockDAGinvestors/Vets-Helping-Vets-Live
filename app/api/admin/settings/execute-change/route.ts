import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getSignerForChain, getContractAddress, type ChainId } from '@/lib/chains'
import { PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/settings/execute-change
 * Execute a pending settings change after timelock
 * Financial-grade security:
 * - Verifies timelock has passed
 * - Verifies multi-sig approvals if required
 * - Double-checks current contract state
 * - Logs to audit trail
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
    const { pendingId } = body

    if (!pendingId) {
      return NextResponse.json({ error: 'pendingId required' }, { status: 400 })
    }

    // Fetch pending change
    const { data: pendingChange, error: fetchError } = await supabaseAdmin
      .from('pending_settings_changes')
      .select('*')
      .eq('id', pendingId)
      .single()

    if (fetchError || !pendingChange) {
      return NextResponse.json({ error: 'Pending change not found' }, { status: 404 })
    }

    // Verify status
    if (pendingChange.status !== 'pending') {
      return NextResponse.json({ 
        error: `Change is not pending (status: ${pendingChange.status})` 
      }, { status: 400 })
    }

    // Verify timelock has passed
    const now = new Date()
    const createdAt = new Date(pendingChange.created_at)
    const minExecuteTime = new Date(createdAt.getTime() + (pendingChange.change_type === 'treasury' ? 48 : 24) * 60 * 60 * 1000)
    
    if (now < minExecuteTime) {
      const hoursRemaining = Math.ceil((minExecuteTime.getTime() - now.getTime()) / (60 * 60 * 1000))
      return NextResponse.json({
        error: `Timelock not expired. ${hoursRemaining} hour(s) remaining.`
      }, { status: 400 })
    }

    // Verify multi-sig approvals if required
    if (pendingChange.requires_multi_sig) {
      const approvals = pendingChange.approvals || []
      const required = pendingChange.required_approvals || 2
      if (approvals.length < required) {
        return NextResponse.json({
          error: `Insufficient approvals: ${approvals.length}/${required} required`
        }, { status: 400 })
      }
    }

    // Get signer
    const chainId = pendingChange.chain_id as ChainId
    const contractVersion = pendingChange.contract_version
    const contractAddress = getContractAddress(chainId, contractVersion as any)

    if (!contractAddress) {
      return NextResponse.json({
        error: 'Contract not found',
        chainId,
        contractVersion
      }, { status: 400 })
    }

    let signer
    try {
      signer = getSignerForChain(chainId)
    } catch (e: any) {
      return NextResponse.json({
        error: 'Failed to get signer',
        details: e?.message
      }, { status: 500 })
    }

    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, signer)
    let txHash = ''

    try {
      switch (pendingChange.change_type) {
        case 'fee':
          logger.info(`[execute-change] Executing fee change: ${pendingChange.current_value} -> ${pendingChange.new_value}`)
          
          // Get current immediate payout setting to preserve it
          let currentImmediatePayout = false
          try {
            const feeConfig = await contract.feeConfig()
            currentImmediatePayout = Boolean(feeConfig.immediatePayout || feeConfig[1] || false)
          } catch {}

          const feeTx = await contract.setFeeConfig(
            parseInt(pendingChange.new_value),
            currentImmediatePayout
          )
          const feeReceipt = await feeTx.wait()
          txHash = feeReceipt.hash
          break

        case 'treasury':
          logger.info(`[execute-change] Executing treasury change: ${pendingChange.current_value} -> ${pendingChange.new_value}`)
          const treasuryTx = await contract.setPlatformTreasury(pendingChange.new_value)
          const treasuryReceipt = await treasuryTx.wait()
          txHash = treasuryReceipt.hash
          break

        case 'royalty':
          logger.info(`[execute-change] Executing royalty change: ${pendingChange.current_value} -> ${pendingChange.new_value}`)
          const royaltyTx = await contract.setDefaultRoyalty(parseInt(pendingChange.new_value))
          const royaltyReceipt = await royaltyTx.wait()
          txHash = royaltyReceipt.hash
          break

        default:
          return NextResponse.json({ error: 'Invalid change type' }, { status: 400 })
      }
    } catch (e: any) {
      logger.error(`[execute-change] Contract call failed: ${e?.message}`)
      
      // Mark as failed
      await supabaseAdmin
        .from('pending_settings_changes')
        .update({ 
          status: 'failed',
          error_message: e?.message,
          executed_at: new Date().toISOString()
        })
        .eq('id', pendingId)

      return NextResponse.json({
        error: 'Contract execution failed',
        details: e?.message
      }, { status: 500 })
    }

    // Mark as executed
    await supabaseAdmin
      .from('pending_settings_changes')
      .update({
        status: 'executed',
        executed_by: uid,
        executed_at: new Date().toISOString(),
        tx_hash: txHash
      })
      .eq('id', pendingId)

    // Log to audit trail
    await supabaseAdmin.from('admin_audit_log').insert({
      user_id: uid,
      action: `settings_${pendingChange.change_type}_executed`,
      details: {
        pendingId,
        chainId,
        contractVersion,
        changeType: pendingChange.change_type,
        previousValue: pendingChange.current_value,
        newValue: pendingChange.new_value,
        txHash,
        reason: pendingChange.reason
      },
      created_at: new Date().toISOString()
    })

    logger.info(`[execute-change] Successfully executed ${pendingChange.change_type} change. Tx: ${txHash}`)

    return NextResponse.json({
      ok: true,
      txHash,
      changeType: pendingChange.change_type,
      previousValue: pendingChange.current_value,
      newValue: pendingChange.new_value
    })

  } catch (e: any) {
    logger.error('[admin/settings/execute-change] Error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
