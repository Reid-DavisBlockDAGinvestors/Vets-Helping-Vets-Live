import { NextRequest, NextResponse } from 'next/server'
import { PatriotPledgeV5ABI } from '@/lib/onchain'
import { V7_ABI } from '@/lib/contracts'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ethers } from 'ethers'
import { getProviderForChain, ChainId } from '@/lib/chains'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// USD conversion rates
const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || process.env.NEXT_PUBLIC_BDAG_USD_RATE || '0.05')
const ETH_USD_RATE = Number(process.env.ETH_USD_RATE || '3100')

// Contract addresses
const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const V6_CONTRACT = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''
const V7_CONTRACT = '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e'

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  try {
    const campaignId = Number(context.params.id)
    if (!Number.isFinite(campaignId) || campaignId < 0) {
      return NextResponse.json({ error: 'INVALID_CAMPAIGN_ID' }, { status: 400 })
    }

    // Allow contract address override via query param
    const url = new URL(req.url)
    let contractAddress = url.searchParams.get('contract')?.trim() || ''
    let chainId: number = 1043 // Default to BlockDAG
    let contractVersion: string = 'v5'
    
    // If no contract specified, look up from submission in Supabase
    if (!contractAddress) {
      const { data: submission } = await supabaseAdmin
        .from('submissions')
        .select('contract_address, chain_id, contract_version')
        .eq('campaign_id', campaignId)
        .single()
      
      contractAddress = submission?.contract_address || ''
      chainId = submission?.chain_id || 1043
      contractVersion = submission?.contract_version || 'v5'
    } else {
      // Determine version from address
      if (contractAddress.toLowerCase() === V7_CONTRACT.toLowerCase()) {
        chainId = 11155111
        contractVersion = 'v7'
      }
    }
    
    // Fall back to trying both contracts if still no address
    if (!contractAddress) {
      contractAddress = V6_CONTRACT || V5_CONTRACT
    }
    
    if (!contractAddress) {
      return NextResponse.json({ error: 'NO_CONTRACT_CONFIGURED' }, { status: 500 })
    }

    // Get the appropriate provider and ABI for the chain
    const isEthChain = chainId === 1 || chainId === 11155111
    const abi = isEthChain ? V7_ABI : PatriotPledgeV5ABI
    const usdRate = isEthChain ? ETH_USD_RATE : BDAG_USD_RATE
    
    logger.debug(`[OnchainToken] Querying campaign ${campaignId} on chain ${chainId} (${contractVersion}), contract ${contractAddress}`)
    const provider = getProviderForChain(chainId as ChainId)
    const contract = new ethers.Contract(contractAddress, abi, provider)

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

    // Helper to convert wei to native currency then to USD
    const fromWeiToUSD = (val: any): string => {
      const wei = BigInt(val ?? 0n)
      const native = Number(wei) / 1e18
      const usd = native * usdRate
      return usd.toString()
    }

    return NextResponse.json({
      contractAddress,
      chainId,
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
