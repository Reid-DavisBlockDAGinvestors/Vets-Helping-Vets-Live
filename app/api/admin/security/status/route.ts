import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getProviderForChain, getContractAddress, type ChainId } from '@/lib/chains'
import { PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const CHAIN_NAMES: Record<number, string> = {
  1043: 'BlockDAG',
  1: 'Ethereum',
  11155111: 'Sepolia',
  137: 'Polygon',
  8453: 'Base',
}

/**
 * GET /api/admin/security/status
 * Get contract security status (paused, owner, treasury, etc.)
 */
export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url)
    const chainId = parseInt(searchParams.get('chainId') || '1043') as ChainId
    const contractVersion = searchParams.get('contractVersion') || 'v6'

    const contractAddress = getContractAddress(chainId, contractVersion as any)
    if (!contractAddress) {
      return NextResponse.json({
        error: 'Contract not found',
        chainId,
        contractVersion
      }, { status: 400 })
    }

    let provider
    try {
      provider = getProviderForChain(chainId)
    } catch (e: any) {
      return NextResponse.json({
        error: 'Failed to get provider',
        details: e?.message,
        chainId
      }, { status: 500 })
    }

    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

    // Fetch contract state
    let isPaused = false
    let owner = ''
    let platformTreasury = ''
    let platformFeeBps = 0
    let bugBountyPool = '0'
    let totalCampaigns = 0

    try {
      isPaused = await contract.paused()
    } catch { /* May not exist on all contracts */ }

    try {
      owner = await contract.owner()
    } catch (e) {
      logger.debug(`[security/status] Error getting owner: ${e}`)
    }

    try {
      platformTreasury = await contract.platformTreasury()
    } catch { /* May not exist */ }

    try {
      const feeConfig = await contract.feeConfig()
      platformFeeBps = Number(feeConfig.platformFeeBps || feeConfig[0] || 0)
    } catch {
      // Try older style
      try {
        platformFeeBps = Number(await contract.platformFeeBps())
      } catch { /* Not all contracts have this */ }
    }

    try {
      const pool = await contract.bugBountyPool()
      bugBountyPool = ethers.formatEther(pool)
    } catch { /* May not exist */ }

    try {
      totalCampaigns = Number(await contract.totalCampaigns())
    } catch { /* May not exist */ }

    // Get blacklisted addresses (would need to track these in Supabase since
    // there's no way to enumerate them from the contract)
    const { data: blacklisted } = await supabaseAdmin
      .from('blacklisted_addresses')
      .select('address, reason, created_at')
      .eq('chain_id', chainId)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      status: {
        isPaused,
        owner,
        platformTreasury,
        platformFeeBps,
        bugBountyPool,
        totalCampaigns,
        chainId,
        chainName: CHAIN_NAMES[chainId] || 'Unknown',
        contractVersion,
        contractAddress
      },
      blacklisted: blacklisted?.map(b => ({
        address: b.address,
        reason: b.reason,
        addedAt: new Date(b.created_at).toLocaleDateString()
      })) || []
    })

  } catch (e: any) {
    logger.error('[admin/security/status] Error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
