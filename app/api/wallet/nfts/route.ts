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

    // Pre-fetch ALL minted submissions to build lookup maps
    const { data: allSubmissions, error: subError } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('status', 'minted')
    
    if (subError) {
      console.error('[WalletNFTs] Supabase error:', subError)
    }
    
    console.log(`[WalletNFTs] Loaded ${allSubmissions?.length || 0} minted submissions`)
    
    // Build lookup maps - use string keys to avoid type issues
    const submissionByCampaignId: Record<string, any> = {}
    const submissionByTokenId: Record<string, any> = {}
    for (const sub of allSubmissions || []) {
      if (sub.campaign_id != null) {
        submissionByCampaignId[String(sub.campaign_id)] = sub
      }
      if (sub.token_id != null) {
        submissionByTokenId[String(sub.token_id)] = sub
      }
    }

    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

    // Get balance (number of NFTs owned)
    const balance = await contract.balanceOf(address)
    const balanceNum = Number(balance)
    
    console.log(`[WalletNFTs] Wallet ${address.slice(0, 8)}... owns ${balanceNum} NFTs`)

    const nfts: any[] = []
    const errors: any[] = []

    // Iterate through owned tokens
    for (let i = 0; i < balanceNum; i++) {
      try {
        const tokenId = await contract.tokenOfOwnerByIndex(address, i)
        const tokenIdNum = Number(tokenId)
        console.log(`[WalletNFTs] Processing token ${i+1}/${balanceNum}: tokenId=${tokenIdNum}`)

        // Get edition info
        const [editionInfo, uri] = await Promise.all([
          contract.getEditionInfo(tokenIdNum),
          contract.tokenURI(tokenIdNum)
        ])

        const campaignId = Number(editionInfo.campaignId ?? editionInfo[0])
        const editionNumber = Number(editionInfo.editionNumber ?? editionInfo[1])

        // Get campaign data from contract
        const camp = await contract.getCampaign(BigInt(campaignId))

        // Look up Supabase submission using string key
        const submission = submissionByCampaignId[String(campaignId)] || submissionByTokenId[String(campaignId)] || null

        // Fetch metadata from tokenURI
        let metadata: any = null
        try {
          const mres = await fetch(uri, { cache: 'no-store' })
          metadata = await mres.json()
        } catch {}

        // === Get on-chain values (these are the source of truth for calculations) ===
        // getCampaign returns: category, baseURI, goal, grossRaised, netRaised, editionsMinted, maxEditions, pricePerEdition, active, closed
        const editionsMinted = Number(camp.editionsMinted ?? camp[5] ?? 0n)
        const onchainMaxEditions = Number(camp.maxEditions ?? camp[6] ?? 100n)
        const grossRaisedWei = BigInt(camp.grossRaised ?? camp[3] ?? 0n)
        const grossRaisedBDAG = Number(grossRaisedWei) / 1e18
        const grossRaisedUSD = grossRaisedBDAG * BDAG_USD_RATE
        
        // === Get goal and editions from Supabase (source of truth for display) ===
        const goalUSD = submission?.goal ? Number(submission.goal) : 100 // Default $100 goal
        const maxEditions = Number(submission?.num_copies || submission?.nft_editions || onchainMaxEditions || 100)
        
        // === Calculate price per NFT: Goal ÷ Max Editions ===
        const pricePerEditionUSD = goalUSD > 0 && maxEditions > 0 ? goalUSD / maxEditions : 1
        
        // === Calculate NFT sales revenue ===
        // NFT Sales = Editions Sold × Price Per Edition
        const nftSalesUSD = editionsMinted * pricePerEditionUSD
        
        // === Calculate tips ===
        // Tips = Gross Raised - NFT Sales (but never negative)
        const tipsUSD = Math.max(0, grossRaisedUSD - nftSalesUSD)
        
        // === Resolve image: prioritize Supabase, then metadata ===
        const resolvedImage = submission?.image_uri || metadata?.image || ''

        console.log(`[WalletNFTs] Campaign #${campaignId}: goal=$${goalUSD}, editions=${maxEditions}, minted=${editionsMinted}, price=$${pricePerEditionUSD.toFixed(2)}, raised=$${grossRaisedUSD.toFixed(2)}, nftSales=$${nftSalesUSD.toFixed(2)}, tips=$${tipsUSD.toFixed(2)}, image=${resolvedImage ? 'yes' : 'no'}`)

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
          category: String(camp.category ?? camp[0] ?? 'general'),
          goal: goalUSD,
          raised: grossRaisedUSD,
          nftSalesUSD,
          tipsUSD,
          active: Boolean(camp.active ?? camp[8] ?? true),
          closed: Boolean(camp.closed ?? camp[9] ?? false),
          submissionId: submission?.id || null,
          isCreator: submission?.creator_wallet?.toLowerCase() === address.toLowerCase()
        })
      } catch (e: any) {
        console.error(`[WalletNFTs] Error fetching token at index ${i}:`, e?.message)
        errors.push({ index: i, error: e?.message })
      }
    }

    console.log(`[WalletNFTs] Completed: ${nfts.length} NFTs loaded, ${errors.length} errors`)
    if (errors.length > 0) {
      console.log(`[WalletNFTs] Errors:`, errors)
    }

    return NextResponse.json({
      address,
      balance: balanceNum,
      nfts,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (e: any) {
    console.error('[WalletNFTs] Error:', e)
    return NextResponse.json({ error: 'FETCH_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
