import { NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const revalidate = 60 // Cache for 60 seconds

const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || process.env.NEXT_PUBLIC_BDAG_USD_RATE || '0.05')

export async function GET() {
  try {
    const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
    
    if (!contractAddress) {
      return NextResponse.json({
        totalRaisedUSD: 0,
        totalCampaigns: 0,
        totalNFTsMinted: 0,
        error: 'No contract configured'
      })
    }

    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

    // Get total NFTs minted (totalSupply)
    let totalNFTs = 0
    try {
      const supply = await contract.totalSupply()
      totalNFTs = Number(supply)
    } catch (e) {
      logger.error('[Stats] Error getting total supply:', e)
    }

    // Get campaign IDs from database (only real campaigns with submissions)
    let campaignIds: number[] = []
    try {
      const { data: submissions } = await supabaseAdmin
        .from('submissions')
        .select('campaign_id')
        .not('campaign_id', 'is', null)
      
      campaignIds = (submissions || [])
        .map((s: any) => s.campaign_id)
        .filter((id: any): id is number => id != null)
    } catch (e) {
      logger.error('[Stats] Error getting campaigns from DB:', e)
    }

    // Calculate total raised for these campaigns only
    let totalGrossRaisedWei = BigInt(0)
    
    for (const campaignId of campaignIds) {
      try {
        const campaign = await contract.getCampaign(campaignId)
        const grossRaised = BigInt(campaign.grossRaised ?? campaign[3] ?? 0n)
        totalGrossRaisedWei += grossRaised
      } catch {
        // Campaign might not exist on chain
      }
    }

    // Convert to BDAG then USD
    const totalRaisedBDAG = Number(totalGrossRaisedWei) / 1e18
    const totalRaisedUSD = totalRaisedBDAG * BDAG_USD_RATE

    logger.api(`[Stats] Campaigns: ${campaignIds.length}, NFTs: ${totalNFTs}, Raised: $${totalRaisedUSD.toFixed(2)}`)

    return NextResponse.json({
      totalRaisedUSD: Math.round(totalRaisedUSD * 100) / 100,
      totalRaisedBDAG: totalRaisedBDAG,
      totalCampaigns: campaignIds.length,
      totalNFTsMinted: totalNFTs,
      bdagUsdRate: BDAG_USD_RATE
    })
  } catch (e: any) {
    logger.error('[Stats] Error:', e)
    return NextResponse.json({
      totalRaisedUSD: 0,
      totalCampaigns: 0,
      totalNFTsMinted: 0,
      error: e?.message || 'Failed to fetch stats'
    })
  }
}
