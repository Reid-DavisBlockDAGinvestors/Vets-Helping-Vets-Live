import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getSignerForChain, getContractAddress, type ChainId } from '@/lib/chains'
import { PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/security/emergency-withdraw
 * Emergency withdraw funds from the contract
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin auth - require super_admin for emergency withdraw
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const { data: userData } = await supabaseAdmin.auth.getUser(token)
    const uid = userData?.user?.id
    if (!uid) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
    // Emergency withdraw requires super_admin
    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'SUPER_ADMIN_REQUIRED' }, { status: 403 })
    }

    const body = await req.json()
    const { to, amount, chainId, contractVersion } = body

    if (!to) {
      return NextResponse.json({ error: 'to address required' }, { status: 400 })
    }
    if (!amount) {
      return NextResponse.json({ error: 'amount required' }, { status: 400 })
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
        details: e?.message,
        chainId: targetChainId
      }, { status: 500 })
    }

    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, signer)

    try {
      logger.warn(`[security/emergency-withdraw] EMERGENCY WITHDRAW: ${amount} wei to ${to} on chain ${targetChainId}`)
      
      // Log to Supabase for audit trail
      await supabaseAdmin.from('admin_audit_log').insert({
        user_id: uid,
        action: 'emergency_withdraw',
        details: { to, amount, chainId: targetChainId, contractVersion: targetVersion },
        created_at: new Date().toISOString()
      })

      const tx = await contract.emergencyWithdraw(to, BigInt(amount))
      await tx.wait()

      return NextResponse.json({
        ok: true,
        action: 'emergency_withdraw',
        to,
        amount,
        txHash: tx.hash
      })
    } catch (e: any) {
      logger.error(`[security/emergency-withdraw] Error: ${e?.message}`)
      return NextResponse.json({
        error: 'Emergency withdraw failed',
        details: e?.message
      }, { status: 500 })
    }

  } catch (e: any) {
    logger.error('[admin/security/emergency-withdraw] Error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
