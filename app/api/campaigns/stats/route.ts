import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'

export const dynamic = 'force-dynamic'

const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || process.env.NEXT_PUBLIC_BDAG_USD_RATE || '0.05')

/**
 * GET /api/campaigns/stats?campaignIds=1,2,3
 * Returns on-chain stats for multiple campaigns
 */
export async function GET(req: NextRequest) {
  try {
    const idsParam = req.nextUrl.searchParams.get('campaignIds')
    if (!idsParam) {
      return NextResponse.json({ error: 'campaignIds required' }, { status: 400 })
    }

    const campaignIds = idsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    if (campaignIds.length === 0) {
      return NextResponse.json({ error: 'No valid campaign IDs' }, { status: 400 })
    }

    const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
    if (!contractAddress) {
      return NextResponse.json({ error: 'Contract not configured' }, { status: 500 })
    }

    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

    const stats: Record<number, any> = {}

    await Promise.all(campaignIds.map(async (campaignId) => {
      try {
        const camp = await contract.getCampaign(BigInt(campaignId))
        
        const pricePerEditionWei = BigInt(camp.pricePerEdition ?? 0n)
        const grossRaisedWei = BigInt(camp.grossRaised ?? 0n)
        const netRaisedWei = BigInt(camp.netRaised ?? 0n)
        const editionsMinted = Number(camp.editionsMinted ?? 0)
        const maxEditions = Number(camp.maxEditions ?? 0)
        
        // Convert from BDAG (wei) to USD
        const pricePerEditionBDAG = Number(pricePerEditionWei) / 1e18
        const pricePerEditionUSD = pricePerEditionBDAG * BDAG_USD_RATE
        
        const grossRaisedBDAG = Number(grossRaisedWei) / 1e18
        const grossRaisedUSD = grossRaisedBDAG * BDAG_USD_RATE
        
        const netRaisedBDAG = Number(netRaisedWei) / 1e18
        const netRaisedUSD = netRaisedBDAG * BDAG_USD_RATE
        
        // Calculate NFT sales revenue = editions sold × price per edition
        const nftSalesUSD = editionsMinted * pricePerEditionUSD
        
        // Tips = gross raised - (editions × price) 
        // Note: This is approximate since grossRaised includes NFT sales
        const tipsUSD = Math.max(0, grossRaisedUSD - nftSalesUSD)
        
        // Remaining editions
        const remainingEditions = maxEditions > 0 ? maxEditions - editionsMinted : null
        
        stats[campaignId] = {
          campaignId,
          editionsMinted,
          maxEditions,
          remainingEditions,
          pricePerEditionUSD,
          nftSalesUSD,
          tipsUSD,
          grossRaisedUSD,
          netRaisedUSD,
          totalRaisedUSD: grossRaisedUSD, // Alias for clarity
          active: camp.active ?? true,
          closed: camp.closed ?? false,
          // Progress percentage based on editions
          progressPercent: maxEditions > 0 ? Math.round((editionsMinted / maxEditions) * 100) : 0,
        }
      } catch (e: any) {
        // Campaign not found or error - skip
        console.error(`Error fetching campaign ${campaignId}:`, e?.message)
        stats[campaignId] = { error: 'Campaign not found', campaignId }
      }
    }))

    return NextResponse.json({ stats })
  } catch (e: any) {
    console.error('Campaign stats error:', e)
    return NextResponse.json({ error: 'FETCH_FAILED', details: e?.message }, { status: 500 })
  }
}
