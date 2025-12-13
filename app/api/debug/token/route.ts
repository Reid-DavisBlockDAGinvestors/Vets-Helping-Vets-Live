import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || process.env.NEXT_PUBLIC_BDAG_USD_RATE || '0.05')

export async function GET(req: NextRequest) {
  try {
    const tokenId = req.nextUrl.searchParams.get('tokenId')
    if (!tokenId) {
      return NextResponse.json({ error: 'tokenId required' }, { status: 400 })
    }

    const tokenIdNum = Number(tokenId)
    const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim()

    if (!contractAddress) {
      return NextResponse.json({ error: 'No contract address configured' }, { status: 500 })
    }

    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

    const results: any = {
      tokenId: tokenIdNum,
      contractAddress,
      rpcUrl: (process.env.BLOCKDAG_RPC || 'not set').substring(0, 50) + '...',
      steps: []
    }

    // Step 0: Check total supply
    try {
      const totalSupply = await contract.totalSupply()
      results.totalSupply = Number(totalSupply)
      results.steps.push({ step: 'totalSupply', success: true, value: Number(totalSupply) })
    } catch (e: any) {
      results.steps.push({ step: 'totalSupply', success: false, error: e?.message })
    }

    // Step 0.5: Try tokenByIndex to see if token 75 is in the enumeration
    try {
      // Get all token IDs up to min(totalSupply, 100)
      const supply = results.totalSupply || 0
      const maxCheck = Math.min(supply, 100)
      const tokenIds: number[] = []
      for (let i = 0; i < maxCheck; i++) {
        try {
          const tid = await contract.tokenByIndex(i)
          tokenIds.push(Number(tid))
        } catch { break }
      }
      results.allTokenIds = tokenIds
      results.tokenIdExists = tokenIds.includes(tokenIdNum)
      results.steps.push({ step: 'enumTokenIds', success: true, count: tokenIds.length, includes75: tokenIds.includes(tokenIdNum) })
    } catch (e: any) {
      results.steps.push({ step: 'enumTokenIds', success: false, error: e?.message })
    }

    // Step 1: Check if token exists by getting owner
    try {
      const owner = await contract.ownerOf(tokenIdNum)
      results.owner = owner
      results.steps.push({ step: 'ownerOf', success: true, value: owner })
    } catch (e: any) {
      results.steps.push({ step: 'ownerOf', success: false, error: e?.message })
      return NextResponse.json(results)
    }

    // Step 2: Get edition info
    try {
      const editionInfo = await contract.getEditionInfo(tokenIdNum)
      results.editionInfo = {
        campaignId: Number(editionInfo.campaignId ?? editionInfo[0]),
        editionNumber: Number(editionInfo.editionNumber ?? editionInfo[1]),
        totalEditions: Number(editionInfo.totalEditions ?? editionInfo[2])
      }
      results.steps.push({ step: 'getEditionInfo', success: true, value: results.editionInfo })
    } catch (e: any) {
      results.steps.push({ step: 'getEditionInfo', success: false, error: e?.message })
      return NextResponse.json(results)
    }

    // Step 3: Get token URI
    try {
      const uri = await contract.tokenURI(tokenIdNum)
      results.tokenURI = uri
      results.steps.push({ step: 'tokenURI', success: true, value: uri })
    } catch (e: any) {
      results.steps.push({ step: 'tokenURI', success: false, error: e?.message })
    }

    // Step 4: Get campaign data
    const campaignId = results.editionInfo?.campaignId
    if (campaignId !== undefined) {
      try {
        const camp = await contract.getCampaign(BigInt(campaignId))
        results.campaignData = {
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
        results.steps.push({ step: 'getCampaign', success: true })
      } catch (e: any) {
        results.steps.push({ step: 'getCampaign', success: false, error: e?.message })
      }
    }

    // Step 5: Fetch metadata
    if (results.tokenURI) {
      try {
        const mres = await fetch(results.tokenURI, { cache: 'no-store' })
        results.metadata = await mres.json()
        results.steps.push({ step: 'fetchMetadata', success: true })
      } catch (e: any) {
        results.steps.push({ step: 'fetchMetadata', success: false, error: e?.message })
      }
    }

    // Step 6: Check Supabase for submission
    if (campaignId !== undefined) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_ROLE_KEY || '',
          { auth: { persistSession: false } }
        )
        
        const { data: submission, error } = await supabase
          .from('submissions')
          .select('id, title, campaign_id, token_id, image_uri, status')
          .or(`campaign_id.eq.${campaignId},token_id.eq.${tokenIdNum}`)
          .limit(1)
          .maybeSingle()
        
        if (error) {
          results.steps.push({ step: 'supabaseLookup', success: false, error: error.message })
        } else {
          results.submission = submission
          results.steps.push({ step: 'supabaseLookup', success: true, found: !!submission })
        }
      } catch (e: any) {
        results.steps.push({ step: 'supabaseLookup', success: false, error: e?.message })
      }
    }

    return NextResponse.json(results)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
