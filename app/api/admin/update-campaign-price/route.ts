import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getSignerForChain, type ChainId } from '@/lib/chains'
import { ethers } from 'ethers'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Currency/USD conversion rates
const BDAG_USD_RATE = parseFloat(process.env.BDAG_USD_RATE || '0.05')
const ETH_USD_RATE = parseFloat(process.env.ETH_USD_RATE || '2300')

// Chain ID constants
const SEPOLIA_CHAIN_ID = 11155111
const ETHEREUM_CHAIN_ID = 1

// V7 ABI for updateCampaignPrice
const V7_UPDATE_PRICE_ABI = [
  'function updateCampaignPrice(uint256 campaignId, uint256 newPrice) external',
  'function getCampaign(uint256 campaignId) external view returns (tuple(string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, uint256 tipsReceived, address submitter, bool active, bool closed, bool refunded, bool immediatePayoutEnabled, address nonprofit))'
]

/**
 * Update campaign price on-chain
 * POST /api/admin/update-campaign-price
 * Body: { campaignId: number, priceUsd: number, chainId: number, contractAddress: string }
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check admin role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await req.json()
    const { campaignId, priceUsd, chainId, contractAddress } = body

    if (typeof campaignId !== 'number' || campaignId < 0) {
      return NextResponse.json({ error: 'Invalid campaignId' }, { status: 400 })
    }
    if (typeof priceUsd !== 'number' || priceUsd <= 0) {
      return NextResponse.json({ error: 'Invalid priceUsd' }, { status: 400 })
    }
    if (!contractAddress) {
      return NextResponse.json({ error: 'contractAddress required' }, { status: 400 })
    }

    // Calculate price in wei based on chain
    const isEthChain = chainId === SEPOLIA_CHAIN_ID || chainId === ETHEREUM_CHAIN_ID
    let priceWei: bigint
    
    if (isEthChain) {
      const priceEth = priceUsd / ETH_USD_RATE
      priceWei = ethers.parseEther(priceEth.toFixed(18))
      logger.debug(`[update-campaign-price] ETH chain: $${priceUsd} = ${priceEth} ETH = ${priceWei} wei`)
    } else {
      const priceBdag = priceUsd / BDAG_USD_RATE
      priceWei = ethers.parseEther(priceBdag.toFixed(6))
      logger.debug(`[update-campaign-price] BDAG chain: $${priceUsd} = ${priceBdag} BDAG = ${priceWei} wei`)
    }

    // Get signer for the chain
    const signer = getSignerForChain(chainId as ChainId)
    const contract = new ethers.Contract(contractAddress, V7_UPDATE_PRICE_ABI, signer)

    // Get current price
    const campaign = await contract.getCampaign(BigInt(campaignId))
    const currentPriceWei = campaign.pricePerEdition || campaign[7]
    
    logger.debug(`[update-campaign-price] Current price: ${currentPriceWei} wei, New price: ${priceWei} wei`)

    // Update the price
    const tx = await contract.updateCampaignPrice(BigInt(campaignId), priceWei)
    logger.debug(`[update-campaign-price] Tx submitted: ${tx.hash}`)

    const receipt = await tx.wait(1)
    logger.debug(`[update-campaign-price] Tx confirmed: ${receipt.hash}`)

    return NextResponse.json({
      ok: true,
      campaignId,
      priceUsd,
      priceWei: priceWei.toString(),
      oldPriceWei: currentPriceWei.toString(),
      txHash: receipt.hash,
      chainId,
    })
  } catch (e: any) {
    logger.error('[update-campaign-price] Error:', e)
    return NextResponse.json({ 
      error: 'Failed to update campaign price', 
      details: e?.message || String(e) 
    }, { status: 500 })
  }
}
