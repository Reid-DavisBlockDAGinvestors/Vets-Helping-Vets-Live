import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getNowNodesProvider } from '@/lib/onchain'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getMintableContracts, ContractVersion } from '@/lib/contracts'

export const dynamic = 'force-dynamic'

const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || process.env.NEXT_PUBLIC_BDAG_USD_RATE || '0.05')

// Convert IPFS URI to HTTP gateway URL
function ipfsToHttp(uri: string | null): string {
  if (!uri) return ''
  if (uri.startsWith('ipfs://')) {
    return `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`
  }
  return uri
}

// Fetch metadata from IPFS with timeout
async function fetchIpfsMetadata(uri: string, timeoutMs = 5000): Promise<any | null> {
  if (!uri) return null
  const httpUrl = ipfsToHttp(uri)
  if (!httpUrl) return null
  
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    
    const res = await fetch(httpUrl, { 
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    })
    clearTimeout(timeout)
    
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    console.log(`[WalletNFTs] IPFS fetch failed for ${uri.slice(0, 50)}...:`, (e as any)?.message)
    return null
  }
}

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

    // Get all mintable contracts (V5, V6, etc.)
    const contracts = getMintableContracts()
    if (contracts.length === 0) {
      return NextResponse.json({ error: 'NO_CONTRACTS_CONFIGURED' }, { status: 500 })
    }
    
    console.log(`[WalletNFTs] Querying ${contracts.length} contracts: ${contracts.map(c => c.version).join(', ')}`)

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

    // Use NowNodes directly - standard RPC is too inconsistent for contract calls
    const provider = getNowNodesProvider()
    console.log('[WalletNFTs] Using NowNodes provider for reliable contract reads')
    const nfts: any[] = []
    const errors: any[] = []
    let totalBalance = 0

    // Query each contract for owned NFTs
    for (const contractInfo of contracts) {
      try {
        const contract = new ethers.Contract(contractInfo.address, contractInfo.abi, provider)
        
        // Get balance (number of NFTs owned on this contract)
        const balance = await contract.balanceOf(address)
        const balanceNum = Number(balance)
        totalBalance += balanceNum
        
        console.log(`[WalletNFTs] ${contractInfo.version}: Wallet ${address.slice(0, 8)}... owns ${balanceNum} NFTs`)
        
        if (balanceNum === 0) continue

        // BATCH 1: Get all token IDs in parallel
        const tokenIdPromises = Array.from({ length: balanceNum }, (_, i) => 
          contract.tokenOfOwnerByIndex(address, i).catch(() => null)
        )
        const tokenIds = (await Promise.all(tokenIdPromises)).filter(t => t !== null).map(t => Number(t))
        console.log(`[WalletNFTs] ${contractInfo.version}: Got ${tokenIds.length} token IDs`)

        // BATCH 2: Get edition info and URIs for all tokens in parallel
        const detailPromises = tokenIds.map(async (tokenIdNum) => {
          try {
            const [editionInfo, uri] = await Promise.all([
              contract.getEditionInfo(tokenIdNum),
              contract.tokenURI(tokenIdNum)
            ])
            return { tokenIdNum, editionInfo, uri }
          } catch {
            return null
          }
        })
        const tokenDetails = (await Promise.all(detailPromises)).filter(d => d !== null)

        // BATCH 3: Get unique campaign data (many tokens may share same campaign)
        const uniqueCampaignIds = [...new Set(tokenDetails.map(d => Number(d!.editionInfo.campaignId ?? d!.editionInfo[0])))]
        const campaignDataMap: Record<number, any> = {}
        
        const campPromises = uniqueCampaignIds.map(async (cid) => {
          try {
            const camp = await contract.getCampaign(BigInt(cid))
            return { cid, camp }
          } catch {
            return null
          }
        })
        const campResults = await Promise.all(campPromises)
        for (const r of campResults) {
          if (r) campaignDataMap[r.cid] = r.camp
        }

        // Now build NFT objects (no more RPC calls needed)
        for (const detail of tokenDetails) {
          if (!detail) continue
          const { tokenIdNum, editionInfo, uri } = detail
          
          const campaignId = Number(editionInfo.campaignId ?? editionInfo[0])
          const editionNumber = Number(editionInfo.editionNumber ?? editionInfo[1])
          const camp = campaignDataMap[campaignId]
          
          if (!camp) {
            errors.push({ contract: contractInfo.version, tokenId: tokenIdNum, error: 'Campaign not found' })
            continue
          }

          const submission = submissionByCampaignId[String(campaignId)] || submissionByTokenId[String(tokenIdNum)] || null

          // Skip IPFS fetch to save time - use Supabase data only
          const editionsMinted = Number(camp.editionsMinted ?? camp[5] ?? 0n)
          const onchainMaxEditions = Number(camp.maxEditions ?? camp[6] ?? 100n)
          const grossRaisedWei = BigInt(camp.grossRaised ?? camp[3] ?? 0n)
          const grossRaisedBDAG = Number(grossRaisedWei) / 1e18
          const grossRaisedUSD = grossRaisedBDAG * BDAG_USD_RATE
          
          const goalUSD = submission?.goal ? Number(submission.goal) : 100
          const maxEditions = Number(submission?.num_copies || submission?.nft_editions || onchainMaxEditions || 100)
          const pricePerEditionUSD = goalUSD > 0 && maxEditions > 0 ? goalUSD / maxEditions : 0
          const nftSalesUSD = editionsMinted * pricePerEditionUSD
          const tipsUSD = Math.max(0, grossRaisedUSD - nftSalesUSD)
          
          const resolvedImage = submission?.image_uri || ''

          nfts.push({
            tokenId: tokenIdNum,
            campaignId,
            editionNumber,
            totalEditions: maxEditions,
            editionsMinted,
            contractAddress: contractInfo.address,
            contractVersion: contractInfo.version,
            uri,
            metadata: null,
            title: submission?.title || `Campaign #${campaignId}`,
            image: resolvedImage,
            story: submission?.story || '',
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
        }
      } catch (contractErr: any) {
        console.error(`[WalletNFTs] Error querying ${contractInfo.version}:`, contractErr?.message)
        errors.push({ contract: contractInfo.version, error: contractErr?.message })
      }
    }

    console.log(`[WalletNFTs] Completed: ${nfts.length} NFTs loaded across ${contracts.length} contracts, ${errors.length} errors`)
    if (errors.length > 0) {
      console.log(`[WalletNFTs] Errors:`, errors)
    }

    return NextResponse.json({
      address,
      balance: totalBalance,
      nfts,
      contracts: contracts.map(c => ({ version: c.version, address: c.address })),
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (e: any) {
    console.error('[WalletNFTs] Error:', e)
    return NextResponse.json({ error: 'FETCH_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
