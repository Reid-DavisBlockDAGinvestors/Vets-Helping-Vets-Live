import { NextRequest, NextResponse } from 'next/server'
import { getRpcProvider } from '@/lib/ethers'
import { Contract } from 'ethers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: { tokenId: string } }) {
  try {
    const tokenIdStr = params?.tokenId
    if (!tokenIdStr) return NextResponse.json({ error: 'MISSING_TOKEN_ID' }, { status: 400 })
    const tokenId = BigInt(tokenIdStr)

    const contractAddr = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
    if (!contractAddr) return NextResponse.json({ error: 'CONTRACT_NOT_CONFIGURED' }, { status: 500 })

    const rpc = process.env.BLOCKDAG_RPC || process.env.BLOCKDAG_RPC_FALLBACK || process.env.BLOCKDAG_RELAYER_RPC || process.env.RELAYER_RPC
    const { createProvider } = await import('@/lib/ethers')
    const provider = rpc ? createProvider(rpc) : getRpcProvider()

    const ABI = [
      'function tokenCampaign(uint256) view returns (uint256)',
      'function campaigns(uint256) view returns (uint256 priceWei, uint256 goalWei, uint256 raisedWei, uint256 releasedWei, uint256 startTokenId, uint256 size, uint256 sold, address creator, string baseURI, string cat, bool active)',
      'function getCampaignProgress(uint256) view returns (uint8)',
      'function ownerOf(uint256) view returns (address)',
      'function tokenURI(uint256) view returns (string)'
    ]
    const contract = new Contract(contractAddr, ABI, provider)

    let campaignId: bigint
    try {
      campaignId = await contract.tokenCampaign(tokenId)
    } catch (e) {
      return NextResponse.json({ error: 'TOKEN_CAMPAIGN_LOOKUP_FAILED' }, { status: 500 })
    }

    let camp: any
    try {
      camp = await contract.campaigns(campaignId)
    } catch (e) {
      return NextResponse.json({ error: 'CAMPAIGN_READ_FAILED' }, { status: 500 })
    }

    const progress: number = Number(await contract.getCampaignProgress(campaignId))
    const owner: string = await contract.ownerOf(tokenId)
    const baseTokenURI: string = await contract.tokenURI(tokenId)

    const priceWei = BigInt(camp?.priceWei ?? camp?.[0] ?? 0)
    const goalWei = BigInt(camp?.goalWei ?? camp?.[1] ?? 0)
    const raisedWei = BigInt(camp?.raisedWei ?? camp?.[2] ?? 0)
    const releasedWei = BigInt(camp?.releasedWei ?? camp?.[3] ?? 0)
    const startTokenId = BigInt(camp?.startTokenId ?? camp?.[4] ?? 0)
    const size = Number(camp?.size ?? camp?.[5] ?? 0)
    const sold = Number(camp?.sold ?? camp?.[6] ?? 0)
    const creator: string = String(camp?.creator ?? camp?.[7] ?? '')
    const baseURI: string = String(camp?.baseURI ?? camp?.[8] ?? '')
    const cat: string = String(camp?.cat ?? camp?.[9] ?? '')
    const active: boolean = Boolean(camp?.active ?? camp?.[10] ?? false)

    const numberInSeries = Number(tokenId - startTokenId + 1n)

    const metadata = {
      name: `PatriotPledge #${tokenId.toString()} (${cat})`,
      description: `Campaign ${campaignId.toString()} – ${cat} – token ${numberInSeries}/${size}`,
      image: baseURI || baseTokenURI,
      external_url: process.env.NEXT_PUBLIC_SITE_URL || undefined,
      attributes: [
        { trait_type: 'Campaign ID', value: campaignId.toString() },
        { trait_type: 'Category', value: cat },
        { trait_type: 'Active', value: active ? 'yes' : 'no' },
        { trait_type: 'Series Size', value: size },
        { trait_type: 'Series Index', value: numberInSeries },
        { trait_type: 'Progress', value: progress, max_value: 100 },
        { trait_type: 'Raised (wei)', value: raisedWei.toString() },
        { trait_type: 'Released (wei)', value: releasedWei.toString() },
        { trait_type: 'Goal (wei)', value: goalWei.toString() },
        { trait_type: 'Price (wei)', value: priceWei.toString() },
        { trait_type: 'Creator', value: creator },
        { trait_type: 'Owner', value: owner }
      ]
    }

    return NextResponse.json(metadata, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    const details = process.env.NODE_ENV === 'production' ? undefined : (e?.message || String(e))
    return NextResponse.json({ error: 'METADATA_FAILED', details }, { status: 500 })
  }
}
