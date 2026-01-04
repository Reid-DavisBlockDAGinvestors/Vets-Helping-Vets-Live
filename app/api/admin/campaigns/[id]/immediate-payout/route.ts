/**
 * Admin API: Toggle Immediate Payout for a Campaign
 * 
 * POST /api/admin/campaigns/[id]/immediate-payout
 * Body: { enabled: boolean, chainId: number, contractAddress: string, campaignId: number }
 * 
 * This endpoint calls setCampaignImmediatePayout on V7/V8 contracts to enable
 * or disable automatic fund distribution to submitter on each NFT mint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ethers } from 'ethers'
import { logger } from '@/lib/logger'
import { getSignerForChain, getProviderForChain, type ChainId } from '@/lib/chains'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// V8 ABI - functions needed for immediate payout
const V8_ABI = [
  'function setCampaignImmediatePayout(uint256 campaignId, bool enabled) external',
  'function getCampaign(uint256 campaignId) external view returns (tuple(string category, string baseURI, uint256 goalNative, uint256 goalUsd, uint256 maxEditions, uint256 mintedCount, uint256 pricePerEditionNative, uint256 pricePerEditionUsd, uint256 totalRaised, uint256 netRaised, address nonprofit, address submitter, bool active, bool closed, bool refunded, bool paused, bool immediatePayoutEnabled))',
  'function owner() external view returns (address)',
  'event CampaignUpdated(uint256 indexed campaignId, string field)'
]

// V7 ABI - similar but different getCampaign return structure
const V7_ABI = [
  'function setCampaignImmediatePayout(uint256 campaignId, bool enabled) external',
  'function getCampaign(uint256 campaignId) external view returns (tuple(string category, string baseURI, uint256 goal, uint256 maxEditions, uint256 mintedCount, uint256 pricePerEdition, uint256 totalRaised, uint256 netRaised, address nonprofit, address submitter, bool active, bool closed, bool refunded, bool immediatePayoutEnabled))',
  'function owner() external view returns (address)',
  'event CampaignUpdated(uint256 indexed campaignId, string field)'
]

// Supported chains for immediate payout
const SUPPORTED_CHAINS = [1, 11155111] // Ethereum Mainnet, Sepolia

interface RequestBody {
  enabled: boolean
  chainId: number
  contractAddress: string
  campaignId: number
  contractVersion?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const submissionId = params.id
  
  try {
    logger.info(`[ImmediatePayout] Request for submission ${submissionId}`)

    // Authenticate admin user
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      logger.warn('[ImmediatePayout] Auth failed:', authError?.message)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      logger.warn(`[ImmediatePayout] Non-admin user ${user.id} attempted access`)
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Parse request body
    const body: RequestBody = await request.json()
    const { enabled, chainId, contractAddress, campaignId, contractVersion } = body

    logger.info(`[ImmediatePayout] Params: chainId=${chainId}, contract=${contractAddress}, campaignId=${campaignId}, enabled=${enabled}`)

    // Validate chain
    if (!SUPPORTED_CHAINS.includes(chainId)) {
      return NextResponse.json(
        { error: `Chain ${chainId} does not support immediate payout. Supported: ${SUPPORTED_CHAINS.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate contract address
    if (!ethers.isAddress(contractAddress)) {
      return NextResponse.json({ error: 'Invalid contract address' }, { status: 400 })
    }

    // Get signer for chain
    let signer: ethers.Wallet
    try {
      signer = getSignerForChain(chainId as ChainId)
    } catch (e: any) {
      logger.error(`[ImmediatePayout] Failed to get signer:`, e.message)
      return NextResponse.json(
        { error: `Cannot sign for chain ${chainId}: ${e.message}` },
        { status: 500 }
      )
    }

    // Select ABI based on version
    const abi = contractVersion === 'v7' ? V7_ABI : V8_ABI
    
    // Connect to contract
    const contract = new ethers.Contract(contractAddress, abi, signer)

    // Verify ownership
    const owner = await contract.owner()
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
      logger.error(`[ImmediatePayout] Signer ${signer.address} is not owner ${owner}`)
      return NextResponse.json(
        { error: 'Platform wallet is not contract owner' },
        { status: 403 }
      )
    }

    // Get current campaign state
    const campaign = await contract.getCampaign(campaignId)
    logger.info(`[ImmediatePayout] Current state: immediatePayoutEnabled=${campaign.immediatePayoutEnabled}`)

    if (campaign.closed) {
      return NextResponse.json(
        { error: 'Campaign is closed - cannot modify payout settings' },
        { status: 400 }
      )
    }

    if (campaign.immediatePayoutEnabled === enabled) {
      return NextResponse.json({
        success: true,
        message: `Immediate payout is already ${enabled ? 'enabled' : 'disabled'}`,
        alreadySet: true,
        currentState: enabled
      })
    }

    // Estimate gas
    const gasEstimate = await contract.setCampaignImmediatePayout.estimateGas(campaignId, enabled)
    logger.info(`[ImmediatePayout] Gas estimate: ${gasEstimate}`)

    // Send transaction
    logger.info(`[ImmediatePayout] Sending transaction...`)
    const tx = await contract.setCampaignImmediatePayout(campaignId, enabled)
    logger.info(`[ImmediatePayout] Tx submitted: ${tx.hash}`)

    // Wait for confirmation
    const receipt = await tx.wait()
    
    if (receipt.status !== 1) {
      logger.error(`[ImmediatePayout] Transaction failed: ${tx.hash}`)
      return NextResponse.json(
        { error: 'Transaction failed on-chain' },
        { status: 500 }
      )
    }

    logger.info(`[ImmediatePayout] Tx confirmed in block ${receipt.blockNumber}`)

    // Update Supabase record if applicable
    const { error: updateError } = await supabaseAdmin
      .from('submissions')
      .update({ 
        immediate_payout_enabled: enabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', submissionId)

    if (updateError) {
      logger.warn(`[ImmediatePayout] Failed to update Supabase:`, updateError.message)
      // Don't fail - on-chain is the source of truth
    }

    // Log the action
    const { error: auditError } = await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: user.id,
      action: 'set_immediate_payout',
      target_type: 'campaign',
      target_id: submissionId,
      details: {
        chainId,
        contractAddress,
        campaignId,
        enabled,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber
      }
    })
    if (auditError) {
      logger.warn('[ImmediatePayout] Failed to log audit:', auditError.message)
    }

    return NextResponse.json({
      success: true,
      message: `Immediate payout ${enabled ? 'enabled' : 'disabled'} successfully`,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      newState: enabled
    })

  } catch (error: any) {
    logger.error('[ImmediatePayout] Error:', error.message || error)
    return NextResponse.json(
      { error: error.message || 'Failed to update immediate payout' },
      { status: 500 }
    )
  }
}

// GET endpoint to check current status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const chainId = parseInt(searchParams.get('chainId') || '1')
    const contractAddress = searchParams.get('contractAddress')
    const campaignId = parseInt(searchParams.get('campaignId') || '0')
    const contractVersion = searchParams.get('version') || 'v8'

    if (!contractAddress || !ethers.isAddress(contractAddress)) {
      return NextResponse.json({ error: 'Invalid contract address' }, { status: 400 })
    }

    // Get provider (read-only, no signer needed)
    const provider = getProviderForChain(chainId as ChainId)
    const abi = contractVersion === 'v7' ? V7_ABI : V8_ABI
    const contract = new ethers.Contract(contractAddress, abi, provider)

    const campaign = await contract.getCampaign(campaignId)

    return NextResponse.json({
      chainId,
      contractAddress,
      campaignId,
      immediatePayoutEnabled: campaign.immediatePayoutEnabled,
      active: campaign.active,
      closed: campaign.closed,
      submitter: campaign.submitter,
      totalRaised: ethers.formatEther(campaign.totalRaised),
      netRaised: ethers.formatEther(campaign.netRaised)
    })

  } catch (error: any) {
    logger.error('[ImmediatePayout GET] Error:', error.message)
    return NextResponse.json(
      { error: error.message || 'Failed to get campaign status' },
      { status: 500 }
    )
  }
}
