/**
 * Platform Stats API - Aggregates contributions from ALL sources
 * 
 * Sources:
 * - On-chain: V5 contract (0x96bB...5890)
 * - On-chain: V6 contract (0xaE54...7053)
 * - Future: Stripe, PayPal, CashApp, Venmo (via contributions table)
 * 
 * Key design decisions:
 * - Track GROSS contributions, not current balance (payouts reduce balance)
 * - Query each campaign's grossRaised from blockchain
 * - Aggregate off-chain payments from database when available
 */

import { NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getProvider } from '@/lib/onchain'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAllDeployedContracts, V5_ABI, V6_ABI } from '@/lib/contracts'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// BDAG to USD conversion rate
const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || process.env.NEXT_PUBLIC_BDAG_USD_RATE || '0.05')

// Payment source types for future expansion
type PaymentSource = 
  | 'contract_v5' 
  | 'contract_v6' 
  | 'contract_v7'
  | 'stripe' 
  | 'paypal' 
  | 'cashapp' 
  | 'venmo'
  | 'crypto_other'

type ContractStats = {
  address: string
  version: string
  totalGrossRaisedBDAG: number
  totalGrossRaisedUSD: number
  totalNFTsMinted: number
  campaignCount: number
  campaigns: Array<{
    campaignId: number
    grossRaisedBDAG: number
    grossRaisedUSD: number
    editionsMinted: number
  }>
}

type PlatformStatsResponse = {
  total_raised_usd: number
  total_raised_bdag: number
  total_campaigns: number
  total_nfts_minted: number
  breakdown_by_source: Record<PaymentSource, number>
  contracts: ContractStats[]
  offchain_total_usd: number
  last_updated: string
  bdag_usd_rate: number
}

export async function GET() {
  try {
    const provider = getProvider()
    const deployedContracts = getAllDeployedContracts()
    
    console.log(`[PlatformStats] Querying ${deployedContracts.length} deployed contracts...`)
    
    // Get campaign IDs from database (submissions are source of truth)
    const { data: submissions } = await supabaseAdmin
      .from('submissions')
      .select('campaign_id, contract_address')
      .not('campaign_id', 'is', null)
    
    // Group campaigns by contract address
    const campaignsByContract: Record<string, number[]> = {}
    for (const sub of submissions || []) {
      const addr = (sub.contract_address || '').toLowerCase()
      if (addr && sub.campaign_id != null) {
        if (!campaignsByContract[addr]) {
          campaignsByContract[addr] = []
        }
        // Avoid duplicates
        if (!campaignsByContract[addr].includes(sub.campaign_id)) {
          campaignsByContract[addr].push(sub.campaign_id)
        }
      }
    }
    
    console.log('[PlatformStats] Campaigns by contract:', 
      Object.entries(campaignsByContract).map(([addr, ids]) => `${addr.slice(0, 10)}...: ${ids.length} campaigns`)
    )
    
    // Query each deployed contract
    const contractStats: ContractStats[] = []
    let totalRaisedBDAG = 0
    let totalNFTsMinted = 0
    let totalCampaigns = 0
    
    for (const contractInfo of deployedContracts) {
      const addr = contractInfo.address.toLowerCase()
      const abi = contractInfo.version === 'v5' ? V5_ABI : V6_ABI
      const contract = new ethers.Contract(contractInfo.address, abi, provider)
      
      const campaignIds = campaignsByContract[addr] || []
      const campaigns: ContractStats['campaigns'] = []
      let contractGrossRaisedBDAG = 0
      let contractNFTsMinted = 0
      
      // Get total NFT supply for this contract
      try {
        const supply = await contract.totalSupply()
        contractNFTsMinted = Number(supply)
      } catch (e: any) {
        console.error(`[PlatformStats] Error getting totalSupply for ${contractInfo.version}:`, e?.message)
      }
      
      // Query each campaign's grossRaised
      for (const campaignId of campaignIds) {
        try {
          const campaign = await contract.getCampaign(campaignId)
          const grossRaisedWei = BigInt(campaign.grossRaised ?? campaign[3] ?? 0n)
          const grossRaisedBDAG = Number(grossRaisedWei) / 1e18
          const editionsMinted = Number(campaign.editionsMinted ?? campaign[5] ?? 0)
          
          campaigns.push({
            campaignId,
            grossRaisedBDAG,
            grossRaisedUSD: grossRaisedBDAG * BDAG_USD_RATE,
            editionsMinted
          })
          
          contractGrossRaisedBDAG += grossRaisedBDAG
          
          console.log(`[PlatformStats] ${contractInfo.version} Campaign ${campaignId}: ${grossRaisedBDAG.toFixed(2)} BDAG ($${(grossRaisedBDAG * BDAG_USD_RATE).toFixed(2)})`)
        } catch (e: any) {
          console.log(`[PlatformStats] ${contractInfo.version} Campaign ${campaignId}: error - ${e?.message}`)
        }
      }
      
      contractStats.push({
        address: contractInfo.address,
        version: contractInfo.version,
        totalGrossRaisedBDAG: contractGrossRaisedBDAG,
        totalGrossRaisedUSD: contractGrossRaisedBDAG * BDAG_USD_RATE,
        totalNFTsMinted: contractNFTsMinted,
        campaignCount: campaigns.length,
        campaigns
      })
      
      totalRaisedBDAG += contractGrossRaisedBDAG
      totalNFTsMinted += contractNFTsMinted
      totalCampaigns += campaigns.length
    }
    
    // Future: Query off-chain contributions from database
    // This will be populated when Stripe/PayPal/etc are integrated
    let offchainTotalUSD = 0
    const offchainBreakdown: Record<string, number> = {}
    
    try {
      // Check if contributions table exists and has data
      const { data: contributions } = await supabaseAdmin
        .from('contributions')
        .select('source, amount_usd')
        .eq('is_onchain', false)
      
      if (contributions && contributions.length > 0) {
        for (const c of contributions) {
          offchainBreakdown[c.source] = (offchainBreakdown[c.source] || 0) + Number(c.amount_usd || 0)
          offchainTotalUSD += Number(c.amount_usd || 0)
        }
      }
    } catch (e) {
      // Table may not exist yet - that's fine
      console.log('[PlatformStats] No contributions table or no off-chain records')
    }
    
    // Build breakdown by source
    const breakdown: Record<PaymentSource, number> = {
      contract_v5: 0,
      contract_v6: 0,
      contract_v7: 0,
      stripe: offchainBreakdown['stripe'] || 0,
      paypal: offchainBreakdown['paypal'] || 0,
      cashapp: offchainBreakdown['cashapp'] || 0,
      venmo: offchainBreakdown['venmo'] || 0,
      crypto_other: offchainBreakdown['crypto_other'] || 0,
    }
    
    // Fill in contract totals
    for (const cs of contractStats) {
      if (cs.version === 'v5') breakdown.contract_v5 = cs.totalGrossRaisedUSD
      if (cs.version === 'v6') breakdown.contract_v6 = cs.totalGrossRaisedUSD
      if (cs.version === 'v7') breakdown.contract_v7 = cs.totalGrossRaisedUSD
    }
    
    const totalRaisedUSD = (totalRaisedBDAG * BDAG_USD_RATE) + offchainTotalUSD
    
    console.log(`[PlatformStats] TOTAL: ${totalRaisedBDAG.toFixed(2)} BDAG = $${totalRaisedUSD.toFixed(2)} USD`)
    console.log(`[PlatformStats] Campaigns: ${totalCampaigns}, NFTs: ${totalNFTsMinted}`)
    
    const response: PlatformStatsResponse = {
      total_raised_usd: totalRaisedUSD,
      total_raised_bdag: totalRaisedBDAG,
      total_campaigns: totalCampaigns,
      total_nfts_minted: totalNFTsMinted,
      breakdown_by_source: breakdown,
      contracts: contractStats,
      offchain_total_usd: offchainTotalUSD,
      last_updated: new Date().toISOString(),
      bdag_usd_rate: BDAG_USD_RATE
    }
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    })
  } catch (e: any) {
    console.error('[PlatformStats] Error:', e?.message || e)
    return NextResponse.json(
      { error: 'Failed to fetch platform stats', details: e?.message },
      { status: 500 }
    )
  }
}
