import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getSignerForChain, getContractAddress, type ChainId } from '@/lib/chains'
import { PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/tokens/freeze
 * Freeze or unfreeze a token or batch of tokens
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
    const { tokenId, tokenIds, freeze, chainId, contractVersion } = body

    // Validate input
    const idsToProcess = tokenIds || (tokenId !== undefined ? [tokenId] : [])
    if (idsToProcess.length === 0) {
      return NextResponse.json({ error: 'tokenId or tokenIds required' }, { status: 400 })
    }
    if (freeze === undefined) {
      return NextResponse.json({ error: 'freeze (true/false) required' }, { status: 400 })
    }

    // Determine chain and contract version from first token's campaign
    // For now, we'll require these to be passed or default to BlockDAG v6
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

    const results: any[] = []

    // Process batch or single
    if (idsToProcess.length > 1) {
      // Batch freeze/unfreeze
      try {
        logger.info(`[admin/tokens/freeze] Batch ${freeze ? 'freeze' : 'unfreeze'} ${idsToProcess.length} tokens`)
        const tx = await contract.batchFreezeTokens(idsToProcess.map(BigInt), freeze)
        const receipt = await tx.wait()
        
        results.push({
          action: 'batchFreeze',
          tokenIds: idsToProcess,
          freeze,
          txHash: receipt.hash,
          success: true
        })
      } catch (e: any) {
        logger.error(`[admin/tokens/freeze] Batch freeze error: ${e?.message}`)
        return NextResponse.json({ 
          error: 'Batch freeze failed',
          details: e?.message
        }, { status: 500 })
      }
    } else {
      // Single token freeze/unfreeze
      const id = idsToProcess[0]
      try {
        logger.info(`[admin/tokens/freeze] ${freeze ? 'Freezing' : 'Unfreezing'} token ${id}`)
        const tx = freeze 
          ? await contract.freezeToken(BigInt(id))
          : await contract.unfreezeToken(BigInt(id))
        const receipt = await tx.wait()
        
        results.push({
          tokenId: id,
          freeze,
          txHash: receipt.hash,
          success: true
        })
      } catch (e: any) {
        logger.error(`[admin/tokens/freeze] Freeze token ${id} error: ${e?.message}`)
        return NextResponse.json({ 
          error: `Failed to ${freeze ? 'freeze' : 'unfreeze'} token`,
          tokenId: id,
          details: e?.message
        }, { status: 500 })
      }
    }

    return NextResponse.json({ 
      ok: true,
      results
    })

  } catch (e: any) {
    logger.error('[admin/tokens/freeze] Error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
