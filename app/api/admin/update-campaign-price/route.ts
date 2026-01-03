import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getSignerForChain, type ChainId } from '@/lib/chains'
import { ethers } from 'ethers'
import { logger } from '@/lib/logger'
import { getPrice, getCurrencyForChain, FALLBACK_RATES } from '@/lib/prices'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

    // Get live price for the chain's native currency
    const currency = getCurrencyForChain(chainId)
    let usdRate: number
    
    try {
      const priceData = await getPrice(currency)
      usdRate = priceData.priceUsd
      logger.debug(`[update-campaign-price] Live price for ${currency}: $${usdRate} (source: ${priceData.source})`)
    } catch (e) {
      usdRate = FALLBACK_RATES[currency] || 1
      logger.debug(`[update-campaign-price] Using fallback rate for ${currency}: $${usdRate}`)
    }
    
    // Convert USD to native currency
    const priceNative = priceUsd / usdRate
    const decimals = currency === 'BDAG' ? 6 : 18
    const priceWei = ethers.parseEther(priceNative.toFixed(decimals))
    
    logger.debug(`[update-campaign-price] $${priceUsd} = ${priceNative.toFixed(8)} ${currency} @ $${usdRate} = ${priceWei} wei`)

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
