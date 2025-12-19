import { NextRequest, NextResponse } from 'next/server'
import { getProvider, PatriotPledgeV5ABI } from '@/lib/onchain'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ethers } from 'ethers'

export const dynamic = 'force-dynamic'

// BDAG to USD conversion rate (configurable via env)
const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || process.env.NEXT_PUBLIC_BDAG_USD_RATE || '0.05')

// Contract addresses
const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const V6_CONTRACT = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  try {
    const campaignId = Number(context.params.id)
    if (!Number.isFinite(campaignId) || campaignId < 0) {
      return NextResponse.json({ error: 'INVALID_CAMPAIGN_ID' }, { status: 400 })
    }

    // Allow contract address override via query param
    const url = new URL(req.url)
    let contractAddress = url.searchParams.get('contract')?.trim() || ''
    
    // If no contract specified, look up from submission in Supabase
    if (!contractAddress) {
      const { data: submission } = await supabaseAdmin
        .from('submissions')
        .select('contract_address')
        .eq('campaign_id', campaignId)
        .single()
      
      contractAddress = submission?.contract_address || ''
    }
    
    // Fall back to trying both contracts if still no address
    if (!contractAddress) {
      contractAddress = V6_CONTRACT || V5_CONTRACT
    }
    
    if (!contractAddress) {
      return NextResponse.json({ error: 'NO_CONTRACT_CONFIGURED' }, { status: 500 })
    }

    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, PatriotPledgeV5ABI, provider)

    // V5: Get campaign data (campaigns exist without NFTs being minted)
    let camp: any
    try {
      camp = await contract.getCampaign(BigInt(campaignId))
    } catch (e: any) {
      return NextResponse.json({ error: 'CAMPAIGN_NOT_FOUND', details: e?.message }, { status: 404 })
    }

    // Fetch metadata from baseURI
    let metadata: any = null
    const uri = camp.baseURI || camp[1] // getCampaign returns tuple
    if (uri) {
      try {
        const mres = await fetch(uri)
        metadata = await mres.json()
      } catch {}
    }

    // Helper to convert wei to BDAG then to USD
    const fromWeiToUSD = (val: any): string => {
      const wei = BigInt(val ?? 0n)
      const bdag = Number(wei) / 1e18
      const usd = bdag * BDAG_USD_RATE
      return usd.toString()
    }

    return NextResponse.json({
      contractAddress,
      campaignId,
      tokenId: campaignId, // Legacy compat
      uri,
      metadata,
      category: camp.category || camp[0],
      goal: fromWeiToUSD(camp.goal ?? camp[2]),
      raised: fromWeiToUSD(camp.netRaised ?? camp[4]),
      grossRaised: fromWeiToUSD(camp.grossRaised ?? camp[3]),
      editionsMinted: Number(camp.editionsMinted ?? camp[5] ?? 0),
      maxEditions: Number(camp.maxEditions ?? camp[6] ?? 0),
      pricePerEdition: fromWeiToUSD(camp.pricePerEdition ?? camp[7]),
      active: camp.active ?? camp[8] ?? true,
      closed: camp.closed ?? camp[9] ?? false,
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'CAMPAIGN_FETCH_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
