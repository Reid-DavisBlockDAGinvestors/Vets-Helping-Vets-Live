import { NextRequest, NextResponse } from 'next/server'
import { PatriotPledgeV5ABI } from '@/lib/onchain'
import { V7_ABI, V8_ABI } from '@/lib/contracts'
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
const V7_CONTRACT_SEPOLIA = '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e' // V7 Sepolia (deprecated)
const V8_CONTRACT_SEPOLIA = '0x042652292B8f1670b257707C1aDA4D19de9E9399' // V8 Sepolia
const V8_CONTRACT_MAINNET = '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e' // V8 Ethereum Mainnet (same address as V7 Sepolia!)

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  try {
    const campaignId = Number(context.params.id)
    if (!Number.isFinite(campaignId) || campaignId < 0) {
      return NextResponse.json({ error: 'INVALID_CAMPAIGN_ID' }, { status: 400 })
    }

    // Allow contract address and chain_id override via query params
    const url = new URL(req.url)
    let contractAddress = url.searchParams.get('contract')?.trim() || ''
    let chainIdParam = url.searchParams.get('chainId')?.trim() || ''
    let chainId: number = chainIdParam ? parseInt(chainIdParam) : 1043 // Default to BlockDAG
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
    } else if (!chainIdParam) {
      // If contract provided but no chainId, look up from Supabase first
      const { data: submission } = await supabaseAdmin
        .from('submissions')
        .select('chain_id, contract_version')
        .eq('campaign_id', campaignId)
        .eq('contract_address', contractAddress)
        .single()
      
      if (submission) {
        chainId = submission.chain_id || 1043
        contractVersion = submission.contract_version || 'v5'
      } else {
        // Fall back to address-based detection (less reliable)
        if (contractAddress.toLowerCase() === V8_CONTRACT_SEPOLIA.toLowerCase()) {
          chainId = 11155111
          contractVersion = 'v8'
        } else if (contractAddress.toLowerCase() === V8_CONTRACT_MAINNET.toLowerCase()) {
          // Could be V7 Sepolia OR V8 Mainnet - default to checking Mainnet first
          // Since V8 Mainnet is the production contract
          chainId = 1
          contractVersion = 'v8'
        }
      }
    } else {
      // chainId provided, determine version
      if (chainId === 1) {
        contractVersion = 'v8' // Mainnet uses V8
      } else if (chainId === 11155111) {
        // Sepolia could be V7 or V8 based on address
        if (contractAddress.toLowerCase() === V8_CONTRACT_SEPOLIA.toLowerCase()) {
          contractVersion = 'v8'
        } else {
          contractVersion = 'v7'
        }
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
    const isV8 = contractVersion === 'v8' || parseInt(contractVersion?.slice(1) || '0') >= 8
    const abi = isV8 ? V8_ABI : (isEthChain ? V7_ABI : PatriotPledgeV5ABI)
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
    const uri = camp.baseURI || camp[1] // getCampaign returns tuple or struct
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

    // V8 returns struct with different property names (priceNative, goalNative)
    // V7 returns array with positional access
    // V5/V6 return tuple with named properties
    const response: any = {
      contractAddress,
      chainId,
      campaignId,
      tokenId: campaignId, // Legacy compat
      uri,
      metadata,
      contractVersion,
    }
    
    if (isV8) {
      // V8 struct-based response - use direct property access
      response.category = camp.category
      response.goal = fromWeiToUSD(camp.goalNative)
      response.goalUsd = Number(camp.goalUsd) / 100 // V8 stores USD in cents
      response.raised = fromWeiToUSD(camp.netRaised)
      response.grossRaised = fromWeiToUSD(camp.grossRaised)
      response.editionsMinted = Number(camp.editionsMinted ?? 0)
      response.maxEditions = Number(camp.maxEditions ?? 0)
      response.pricePerEdition = fromWeiToUSD(camp.priceNative)
      response.priceUsd = Number(camp.priceUsd) / 100 // V8 stores USD in cents
      response.active = camp.active
      response.paused = camp.paused
      response.closed = camp.closed
      response.refunded = camp.refunded
      response.immediatePayoutEnabled = camp.immediatePayoutEnabled
    } else {
      // V7/V6/V5 - mixed access (named properties or array indices)
      response.category = camp.category || camp[0]
      response.goal = fromWeiToUSD(camp.goal ?? camp[2])
      response.raised = fromWeiToUSD(camp.netRaised ?? camp[4])
      response.grossRaised = fromWeiToUSD(camp.grossRaised ?? camp[3])
      response.editionsMinted = Number(camp.editionsMinted ?? camp[5] ?? 0)
      response.maxEditions = Number(camp.maxEditions ?? camp[6] ?? 0)
      response.pricePerEdition = fromWeiToUSD(camp.pricePerEdition ?? camp[7])
      response.active = camp.active ?? camp[10] ?? true
      response.closed = camp.closed ?? camp[11] ?? false
    }

    return NextResponse.json(response)
  } catch (e: any) {
    return NextResponse.json({ error: 'CAMPAIGN_FETCH_FAILED', details: e?.message || String(e) }, { status: 500 })
  }
}
