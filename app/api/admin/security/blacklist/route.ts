import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getSignerForChain, getContractAddress, type ChainId } from '@/lib/chains'
import { PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/security/blacklist
 * Add or remove an address from the blacklist
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

    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
    if (!['admin', 'super_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const body = await req.json()
    const { address, action, reason, chainId, contractVersion } = body

    if (!address) {
      return NextResponse.json({ error: 'address required' }, { status: 400 })
    }
    if (!['add', 'remove'].includes(action)) {
      return NextResponse.json({ error: 'action must be "add" or "remove"' }, { status: 400 })
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
      if (action === 'add') {
        logger.info(`[security/blacklist] Blacklisting address ${address}`)
        const tx = await contract.blacklistAddress(address)
        await tx.wait()

        // Record in Supabase
        await supabaseAdmin.from('blacklisted_addresses').upsert({
          address: address.toLowerCase(),
          chain_id: targetChainId,
          reason: reason || null,
          created_at: new Date().toISOString()
        }, { onConflict: 'address,chain_id' })

        return NextResponse.json({
          ok: true,
          action: 'blacklisted',
          address,
          txHash: tx.hash
        })
      } else {
        logger.info(`[security/blacklist] Removing blacklist for address ${address}`)
        const tx = await contract.removeBlacklist(address)
        await tx.wait()

        // Remove from Supabase
        await supabaseAdmin.from('blacklisted_addresses')
          .delete()
          .eq('address', address.toLowerCase())
          .eq('chain_id', targetChainId)

        return NextResponse.json({
          ok: true,
          action: 'removed',
          address,
          txHash: tx.hash
        })
      }
    } catch (e: any) {
      logger.error(`[security/blacklist] Error: ${e?.message}`)
      return NextResponse.json({
        error: `Failed to ${action} blacklist`,
        details: e?.message
      }, { status: 500 })
    }

  } catch (e: any) {
    logger.error('[admin/security/blacklist] Error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
