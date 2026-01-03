import { NextRequest, NextResponse } from 'next/server'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { ethers } from 'ethers'
import { ipfsToHttp } from '@/lib/ipfs'
import { verifyAdminAuth } from '@/lib/adminAuth'
import { debugGuard } from '@/lib/debugGuard'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Debug endpoint to check NFT token data on-chain
 * GET /api/debug/nft/[tokenId]
 */
export async function GET(req: NextRequest, context: { params: { tokenId: string } }) {
  try {
    const blocked = debugGuard()
    if (blocked) return blocked
    
    const auth = await verifyAdminAuth(req)
    if (!auth.authorized) return auth.response

    const tokenId = Number(context.params.tokenId)
    if (!Number.isFinite(tokenId) || tokenId < 0) {
      return NextResponse.json({ error: 'INVALID_TOKEN_ID' }, { status: 400 })
    }

    const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()
    if (!contractAddress) {
      return NextResponse.json({ error: 'NO_CONTRACT_CONFIGURED' }, { status: 500 })
    }

    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

    // Check if token exists
    let owner: string | null = null
    try {
      owner = await contract.ownerOf(BigInt(tokenId))
    } catch (e: any) {
      return NextResponse.json({ 
        error: 'TOKEN_NOT_FOUND', 
        details: e?.message,
        tokenId,
        contractAddress
      }, { status: 404 })
    }

    // Get tokenURI
    let tokenURI: string | null = null
    try {
      tokenURI = await contract.tokenURI(BigInt(tokenId))
    } catch (e: any) {
      logger.error('[debug/nft] tokenURI error:', e)
    }

    // Get campaign mapping
    let campaignId: number | null = null
    let editionNumber: number | null = null
    try {
      campaignId = Number(await contract.tokenToCampaign(BigInt(tokenId)))
      editionNumber = Number(await contract.tokenEditionNumber(BigInt(tokenId)))
    } catch (e: any) {
      logger.error('[debug/nft] Campaign mapping error:', e)
    }

    // Fetch metadata if URI exists
    let metadata: any = null
    let metadataError: string | null = null
    if (tokenURI) {
      try {
        const httpUri = ipfsToHttp(tokenURI)
        logger.debug(`[debug/nft] Fetching metadata from: ${httpUri}`)
        const res = await fetch(httpUri, { 
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 0 }
        })
        if (res.ok) {
          metadata = await res.json()
        } else {
          metadataError = `HTTP ${res.status}: ${res.statusText}`
        }
      } catch (e: any) {
        metadataError = e?.message || 'Failed to fetch metadata'
      }
    }

    // Get campaign data if we have campaignId
    let campaignData: any = null
    if (campaignId != null) {
      try {
        const camp = await contract.getCampaign(BigInt(campaignId))
        campaignData = {
          category: camp.category,
          baseURI: camp.baseURI,
          goal: camp.goal?.toString(),
          grossRaised: camp.grossRaised?.toString(),
          netRaised: camp.netRaised?.toString(),
          editionsMinted: Number(camp.editionsMinted),
          maxEditions: Number(camp.maxEditions),
          pricePerEdition: camp.pricePerEdition?.toString(),
          active: camp.active,
          closed: camp.closed,
        }
      } catch {}
    }

    return NextResponse.json({
      tokenId,
      contractAddress,
      owner,
      tokenURI,
      tokenURIHttp: tokenURI ? ipfsToHttp(tokenURI) : null,
      campaignId,
      editionNumber,
      metadata,
      metadataError,
      campaignData,
      imageUrl: metadata?.image ? ipfsToHttp(metadata.image) : null,
    })
  } catch (e: any) {
    return NextResponse.json({ 
      error: 'DEBUG_FAILED', 
      details: e?.message || String(e) 
    }, { status: 500 })
  }
}
