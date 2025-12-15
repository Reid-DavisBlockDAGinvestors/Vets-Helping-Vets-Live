import { NextRequest, NextResponse } from 'next/server'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'
import { verifyAdminAuth } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to check the actual on-chain state
 * GET /api/debug/chain-state
 * 
 * Returns:
 * - totalCampaigns: number of campaigns on-chain
 * - campaigns: array of campaign data for each ID
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminAuth(req)
    if (!auth.authorized) return auth.response

    const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
    if (!contractAddress) {
      return NextResponse.json({ error: 'NO_CONTRACT_CONFIGURED' }, { status: 500 })
    }

    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

    // Get total campaigns
    let totalCampaigns = 0
    try {
      const total = await contract.totalCampaigns()
      totalCampaigns = Number(total)
    } catch (e: any) {
      return NextResponse.json({ 
        error: 'FAILED_TO_GET_TOTAL_CAMPAIGNS', 
        details: e?.message,
        contractAddress 
      }, { status: 500 })
    }

    // Fetch all campaigns
    const campaigns: any[] = []
    for (let i = 0; i < totalCampaigns; i++) {
      try {
        const camp = await contract.getCampaign(BigInt(i))
        campaigns.push({
          id: i,
          category: camp.category || camp[0],
          baseURI: (camp.baseURI || camp[1])?.slice(0, 100) + '...',
          goal: ethers.formatEther(camp.goal ?? camp[2]),
          grossRaised: ethers.formatEther(camp.grossRaised ?? camp[3]),
          netRaised: ethers.formatEther(camp.netRaised ?? camp[4]),
          editionsMinted: Number(camp.editionsMinted ?? camp[5]),
          maxEditions: Number(camp.maxEditions ?? camp[6]),
          pricePerEdition: ethers.formatEther(camp.pricePerEdition ?? camp[7]),
          active: camp.active ?? camp[8],
          closed: camp.closed ?? camp[9],
        })
      } catch (e: any) {
        campaigns.push({
          id: i,
          error: e?.message?.slice(0, 100)
        })
      }
    }

    return NextResponse.json({
      contractAddress,
      totalCampaigns,
      campaigns,
      timestamp: new Date().toISOString()
    })
  } catch (e: any) {
    return NextResponse.json({ 
      error: 'CHAIN_STATE_FETCH_FAILED', 
      details: e?.message || String(e) 
    }, { status: 500 })
  }
}
