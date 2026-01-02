import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getSignerForChain, getContractAddress, type ChainId } from '@/lib/chains'
import { PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/tokens/fix-uri
 * Fix a token's metadata URI
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
    const { tokenId, newUri, chainId, contractVersion } = body

    if (tokenId === undefined) {
      return NextResponse.json({ error: 'tokenId required' }, { status: 400 })
    }
    if (!newUri) {
      return NextResponse.json({ error: 'newUri required' }, { status: 400 })
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
      logger.info(`[admin/tokens/fix-uri] Fixing URI for token ${tokenId} to ${newUri.slice(0, 50)}...`)
      const tx = await contract.fixTokenURI(BigInt(tokenId), newUri)
      const receipt = await tx.wait()

      return NextResponse.json({
        ok: true,
        tokenId,
        newUri,
        txHash: receipt.hash
      })
    } catch (e: any) {
      logger.error(`[admin/tokens/fix-uri] Error: ${e?.message}`)
      return NextResponse.json({
        error: 'Failed to fix token URI',
        details: e?.message
      }, { status: 500 })
    }

  } catch (e: any) {
    logger.error('[admin/tokens/fix-uri] Error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
