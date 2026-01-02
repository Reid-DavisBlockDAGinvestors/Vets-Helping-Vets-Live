import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getSignerForChain, getContractAddress, type ChainId } from '@/lib/chains'
import { PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/settings/immediate-payout
 * Toggle immediate payout setting
 * Less sensitive than fee/treasury changes, executes directly
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
    const { chainId, contractVersion, enabled, reason } = body

    if (enabled === undefined) {
      return NextResponse.json({ error: 'enabled (true/false) required' }, { status: 400 })
    }

    const targetChainId = (chainId || 1043) as ChainId
    const targetVersion = contractVersion || 'v6'

    const contractAddress = getContractAddress(targetChainId, targetVersion as any)
    if (!contractAddress) {
      return NextResponse.json({
        error: 'Contract not found',
        chainId: targetChainId,
        contractVersion: targetVersion
      }, { status: 400 })
    }

    let signer
    try {
      signer = getSignerForChain(targetChainId)
    } catch (e: any) {
      return NextResponse.json({
        error: 'Failed to get signer',
        details: e?.message
      }, { status: 500 })
    }

    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, signer)

    try {
      // Get current fee to preserve it
      let currentFeeBps = 100 // default 1%
      try {
        const feeConfig = await contract.feeConfig()
        currentFeeBps = Number(feeConfig.platformFeeBps || feeConfig[0] || 100)
      } catch {}

      logger.info(`[immediate-payout] Setting immediate payout to ${enabled} on chain ${targetChainId}`)
      
      const tx = await contract.setFeeConfig(currentFeeBps, enabled)
      const receipt = await tx.wait()

      // Log to audit trail
      await supabaseAdmin.from('admin_audit_log').insert({
        user_id: uid,
        action: 'settings_immediate_payout_toggle',
        details: {
          chainId: targetChainId,
          contractVersion: targetVersion,
          enabled,
          reason: reason || 'No reason provided',
          txHash: receipt.hash
        },
        created_at: new Date().toISOString()
      })

      return NextResponse.json({
        ok: true,
        enabled,
        txHash: receipt.hash
      })

    } catch (e: any) {
      logger.error(`[immediate-payout] Error: ${e?.message}`)
      return NextResponse.json({
        error: 'Failed to toggle immediate payout',
        details: e?.message
      }, { status: 500 })
    }

  } catch (e: any) {
    logger.error('[admin/settings/immediate-payout] Error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
