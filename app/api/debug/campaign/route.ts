import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'

export const runtime = 'nodejs'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { verifyAdminAuth } from '@/lib/adminAuth'
import { debugGuard } from '@/lib/debugGuard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const blocked = debugGuard()
    if (blocked) return blocked

    const auth = await verifyAdminAuth(req)
    if (!auth.authorized) return auth.response

    const campaignId = req.nextUrl.searchParams.get('id')
    if (!campaignId) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
    if (!contractAddress) {
      return NextResponse.json({ error: 'No contract address configured' }, { status: 500 })
    }

    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

    // Get campaign data
    const camp = await contract.getCampaign(BigInt(campaignId))
    
    const campaignData = {
      campaignId: Number(campaignId),
      category: camp.category ?? camp[0],
      baseURI: camp.baseURI ?? camp[1],
      goal: Number(camp.goal ?? camp[2]),
      grossRaised: Number(camp.grossRaised ?? camp[3]) / 1e18,
      netRaised: Number(camp.netRaised ?? camp[4]) / 1e18,
      editionsMinted: Number(camp.editionsMinted ?? camp[5]),
      maxEditions: Number(camp.maxEditions ?? camp[6]),
      pricePerEdition: Number(camp.pricePerEdition ?? camp[7]) / 1e18,
      active: Boolean(camp.active ?? camp[8]),
      closed: Boolean(camp.closed ?? camp[9])
    }

    // Get all token IDs for this campaign
    let tokenIds: number[] = []
    try {
      const tokens = await contract.getCampaignEditions(BigInt(campaignId))
      tokenIds = tokens.map((t: any) => Number(t))
    } catch (e: any) {
      // Function might not exist or campaign has no tokens
    }

    return NextResponse.json({
      ...campaignData,
      tokenIds,
      tokenCount: tokenIds.length
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
