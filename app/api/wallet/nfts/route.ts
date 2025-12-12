import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || process.env.NEXT_PUBLIC_BDAG_USD_RATE || '0.05')

/**
 * GET /api/wallet/nfts?address=0x...
 * Returns all NFTs owned by a wallet address
 */
export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get('address')
    if (!address || !ethers.isAddress(address)) {
      return NextResponse.json({ error: 'INVALID_ADDRESS' }, { status: 400 })
    }

    const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
    if (!contractAddress) {
      return NextResponse.json({ error: 'NO_CONTRACT_CONFIGURED' }, { status: 500 })
    }

    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

    // Get balance (number of NFTs owned)
    const balance = await contract.balanceOf(address)
    const balanceNum = Number(balance)
    
    console.log(`[wallet/nfts] Address ${address} owns ${balanceNum} NFTs`)

    const nfts: any[] = []

    // Iterate through owned tokens
    for (let i = 0; i < balanceNum; i++) {
      try {
        const tokenId = await contract.tokenOfOwnerByIndex(address, i)
        const tokenIdNum = Number(tokenId)
        console.log(`[wallet/nfts] Found token #${tokenIdNum} at index ${i}`)

        // Get edition info
        const [editionInfo, uri] = await Promise.all([
          contract.getEditionInfo(tokenIdNum),
          contract.tokenURI(tokenIdNum)
        ])

        const campaignId = Number(editionInfo.campaignId ?? editionInfo[0])
        const editionNumber = Number(editionInfo.editionNumber ?? editionInfo[1])
        const totalEditions = Number(editionInfo.totalEditions ?? editionInfo[2])

        // Get campaign data
        const camp = await contract.getCampaign(campaignId)

        // Fetch metadata
        let metadata: any = null
        try {
          const mres = await fetch(uri, { cache: 'no-store' })
          metadata = await mres.json()
        } catch {}

        // Get Supabase submission for additional details
        let submission: any = null
        try {
          const { data } = await supabaseAdmin
            .from('submissions')
            .select('id, title, story, goal, creator_wallet, image_uri, nft_price, price_per_copy, num_copies')
            .eq('campaign_id', campaignId)
            .maybeSingle()
          submission = data
        } catch {}

        // Get edition data from on-chain
        const editionsMinted = Number(camp.editionsMinted ?? camp[5] ?? 0n)
        const maxEditions = Number(camp.maxEditions ?? camp[6] ?? 0n)
        const goalUSD = submission?.goal ? Number(submission.goal) : 0
        
        // Calculate price per NFT from Supabase (USD) - most accurate source
        let pricePerNFT = 0
        if (submission?.nft_price && Number(submission.nft_price) > 0) {
          pricePerNFT = Number(submission.nft_price)
        } else if (submission?.price_per_copy && Number(submission.price_per_copy) > 0) {
          pricePerNFT = Number(submission.price_per_copy)
        } else if (goalUSD > 0 && maxEditions > 0) {
          pricePerNFT = goalUSD / maxEditions
        }
        
        // Calculate raised from editions sold × price (more accurate than on-chain)
        const raisedUSD = editionsMinted * pricePerNFT

        nfts.push({
          tokenId: tokenIdNum,
          campaignId,
          editionNumber,
          totalEditions,
          editionsMinted, // Include for progress calculation
          contractAddress,
          uri,
          metadata,
          title: submission?.title || metadata?.name || `Campaign #${campaignId}`,
          image: submission?.image_uri || metadata?.image || '',
          story: submission?.story || metadata?.description || '',
          category: camp.category ?? camp[0],
          goal: goalUSD || Number(camp.goal ?? camp[2]) / 1e18 * BDAG_USD_RATE,
          raised: raisedUSD,
          active: camp.active ?? camp[8] ?? true,
          closed: camp.closed ?? camp[9] ?? false,
          submissionId: submission?.id || null,
          isCreator: submission?.creator_wallet?.toLowerCase() === address.toLowerCase()
        })
      } catch (e: any) {
        console.error(`Error fetching token at index ${i}:`, e?.message)
      }
    }

    return NextResponse.json({
      address,
      balance: balanceNum,
      nfts
    })
  } catch (e: any) {
    console.error('Wallet NFTs error:', e)
    return NextResponse.json({ error: 'FETCH_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
