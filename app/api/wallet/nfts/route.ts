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

    // Pre-fetch all minted submissions to avoid individual lookups
    const { data: allSubmissions } = await supabaseAdmin
      .from('submissions')
      .select('id, title, story, goal, creator_wallet, image_uri, nft_price, num_copies, nft_editions, campaign_id, token_id')
      .eq('status', 'minted')
    
    // Build lookup maps by campaign_id and token_id
    const submissionByCampaignId: Record<number, any> = {}
    const submissionByTokenId: Record<number, any> = {}
    for (const sub of allSubmissions || []) {
      if (sub.campaign_id != null) submissionByCampaignId[sub.campaign_id] = sub
      if (sub.token_id != null) submissionByTokenId[sub.token_id] = sub
    }

    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

    // Get balance (number of NFTs owned)
    const balance = await contract.balanceOf(address)
    const balanceNum = Number(balance)

    const nfts: any[] = []

    // Iterate through owned tokens
    for (let i = 0; i < balanceNum; i++) {
      try {
        const tokenId = await contract.tokenOfOwnerByIndex(address, i)
        const tokenIdNum = Number(tokenId)

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

        // Get Supabase submission from pre-fetched maps
        const submission = submissionByCampaignId[campaignId] || submissionByTokenId[campaignId] || null
        
        console.log(`[WalletNFTs] Campaign ${campaignId}: submission found=${!!submission}, image=${submission?.image_uri?.substring(0, 50) || 'none'}`)

        // Get on-chain values - try named properties first, then array indices
        const onchainMaxEditions = Number(camp.maxEditions ?? camp[6] ?? 100)
        const editionsMinted = Number(camp.editionsMinted ?? camp[5] ?? 0)
        
        console.log(`[WalletNFTs] Campaign ${campaignId} on-chain: maxEditions=${onchainMaxEditions}, editionsMinted=${editionsMinted}, camp[5]=${camp[5]}, camp[6]=${camp[6]}`)
        
        // Convert on-chain goal to USD
        const onchainGoalWei = BigInt(camp.goal ?? camp[2] ?? 0n)
        const onchainGoalBDAG = Number(onchainGoalWei) / 1e18
        const onchainGoalUSD = onchainGoalBDAG * BDAG_USD_RATE
        
        // Use Supabase goal/editions for display, fallback to on-chain
        const goalUSD = submission?.goal ? Number(submission.goal) : onchainGoalUSD
        const maxEditions = Number(submission?.num_copies || submission?.nft_editions || onchainMaxEditions)
        
        // Price = goal / editions (use same source for both) - default $1 per NFT
        const pricePerEditionUSD = goalUSD > 0 && maxEditions > 0 ? goalUSD / maxEditions : 1
        
        // Convert gross raised to USD
        const grossRaisedWei = BigInt(camp.grossRaised ?? camp[3] ?? 0n)
        const grossRaisedBDAG = Number(grossRaisedWei) / 1e18
        const grossRaisedUSD = grossRaisedBDAG * BDAG_USD_RATE
        
        // Calculate NFT sales = editions × price (but cap at gross raised)
        const calculatedNftSales = editionsMinted * pricePerEditionUSD
        const nftSalesUSD = Math.min(calculatedNftSales, grossRaisedUSD) // Can't exceed total raised
        
        // Tips = gross raised - NFT sales
        const tipsUSD = Math.max(0, grossRaisedUSD - nftSalesUSD)
        
        console.log(`[WalletNFTs] Campaign ${campaignId} calc: goal=${goalUSD}, editions=${maxEditions}, minted=${editionsMinted}, price=${pricePerEditionUSD.toFixed(2)}, raised=${grossRaisedUSD.toFixed(2)}, nft=${nftSalesUSD.toFixed(2)}, tips=${tipsUSD.toFixed(2)}`)

        // Resolve image: try submission, metadata, and metadata.image_url
        const resolvedImage = submission?.image_uri || metadata?.image || metadata?.image_url || ''
        
        console.log(`[WalletNFTs] Campaign ${campaignId} image: sub=${submission?.image_uri?.substring(0, 30) || 'none'}, meta=${metadata?.image?.substring(0, 30) || 'none'}, resolved=${resolvedImage?.substring(0, 30) || 'none'}`)
        
        nfts.push({
          tokenId: tokenIdNum,
          campaignId,
          editionNumber,
          totalEditions: maxEditions,
          editionsMinted,
          contractAddress,
          uri,
          metadata,
          title: submission?.title || metadata?.name || `Campaign #${campaignId}`,
          image: resolvedImage,
          story: submission?.story || metadata?.description || '',
          category: camp.category ?? camp[0],
          goal: goalUSD,
          raised: grossRaisedUSD,
          nftSalesUSD,
          tipsUSD,
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
