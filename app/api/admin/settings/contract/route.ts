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
 * GET /api/admin/settings/contract
 * Fetch current contract settings with financial-grade detail
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

    // Fetch all contract settings
    let platformFeeBps = 0
    let maxFeeBps = 3000
    let platformTreasury = ''
    let owner = ''
    let defaultRoyaltyBps = 250
    let isPaused = false
    let immediatePayoutEnabled = false
    let totalCampaigns = 0
    let contractBalance = '0'
    let bugBountyPool = '0'

    // Platform fee
    try {
      const feeConfig = await contract.feeConfig()
      platformFeeBps = Number(feeConfig.platformFeeBps || feeConfig[0] || 0)
      immediatePayoutEnabled = Boolean(feeConfig.immediatePayout || feeConfig[1] || false)
    } catch {
      try {
        platformFeeBps = Number(await contract.platformFeeBps?.() || 0)
      } catch {}
    }

    // Max fee
    try {
      maxFeeBps = Number(await contract.MAX_FEE_BPS())
    } catch {}

    // Treasury
    try {
      platformTreasury = await contract.platformTreasury()
    } catch {}

    // Owner
    try {
      owner = await contract.owner()
    } catch {}

    // Default royalty
    try {
      defaultRoyaltyBps = Number(await contract.defaultRoyaltyBps())
    } catch {}

    // Paused status
    try {
      isPaused = await contract.paused()
    } catch {}

    // Total campaigns
    try {
      totalCampaigns = Number(await contract.totalCampaigns?.() || 0)
    } catch {}

    // Contract balance
    try {
      const balance = await provider.getBalance(contractAddress)
      contractBalance = ethers.formatEther(balance)
    } catch {}

    // Bug bounty pool
    try {
      const pool = await contract.bugBountyPool()
      bugBountyPool = ethers.formatEther(pool)
    } catch {}

    // Fetch pending changes from database
    const { data: pendingChanges } = await supabaseAdmin
      .from('pending_settings_changes')
      .select('*')
      .eq('chain_id', chainId)
      .eq('contract_version', contractVersion)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    // Fetch last change timestamp for rate limiting
    const { data: lastChange } = await supabaseAdmin
      .from('admin_audit_log')
      .select('created_at')
      .eq('user_id', uid)
      .in('action', ['settings_fee_change', 'settings_treasury_change', 'settings_royalty_change'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      settings: {
        chainId,
        chainName: CHAIN_NAMES[chainId] || 'Unknown',
        contractVersion,
        contractAddress,
        platformFeeBps,
        maxFeeBps,
        platformTreasury,
        owner,
        defaultRoyaltyBps,
        isPaused,
        immediatePayoutEnabled,
        totalCampaigns,
        contractBalance,
        bugBountyPool
      },
      pendingChanges: pendingChanges?.map(c => ({
        id: c.id,
        chainId: c.chain_id,
        contractVersion: c.contract_version,
        changeType: c.change_type,
        currentValue: c.current_value,
        newValue: c.new_value,
        requestedBy: c.requested_by,
        requestedAt: c.created_at,
        expiresAt: c.expires_at,
        status: c.status,
        requiresMultiSig: c.requires_multi_sig,
        approvals: c.approvals || [],
        requiredApprovals: c.required_approvals || 1
      })) || [],
      lastChangeAt: lastChange?.created_at || null
    })

  } catch (e: any) {
    logger.error('[admin/settings/contract] Error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
