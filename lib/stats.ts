/**
 * Unified Stats Calculation Service
 * 
 * This module provides a SINGLE SOURCE OF TRUTH for platform statistics.
 * All pages (Homepage, Admin, Dashboard) should use these functions.
 * 
 * Data sources:
 * 1. On-chain: V5 and V6 contracts (grossRaised, editionsMinted, totalSupply)
 * 2. Off-chain (future): Stripe, CashApp, Venmo, PayPal payments via Supabase
 */

import { ethers } from 'ethers'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getProvider } from './onchain'
import { getAllDeployedContracts, V5_ABI, V6_ABI } from './contracts'

// Constants
const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || process.env.NEXT_PUBLIC_BDAG_USD_RATE || '0.05')

export interface PlatformStats {
  // Aggregated totals
  totalRaisedUSD: number
  totalNFTsMinted: number
  totalCampaigns: number
  
  // Breakdown by source
  onchainRaisedUSD: number
  offchainRaisedUSD: number // Future: Stripe, CashApp, etc.
  
  // By contract
  v5RaisedUSD: number
  v6RaisedUSD: number
  v5NFTsMinted: number
  v6NFTsMinted: number
  
  // Metadata
  orphanedSubmissions: number
  calculatedAt: string
}

export interface CampaignStats {
  campaignId: number
  contractAddress: string
  contractVersion: string
  grossRaisedBDAG: number
  grossRaisedUSD: number
  editionsMinted: number
  maxEditions: number
  active: boolean
  closed: boolean
}

/**
 * Calculate platform-wide statistics from all data sources
 */
export async function calculatePlatformStats(supabase?: SupabaseClient): Promise<PlatformStats> {
  const client = supabase || createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false } }
  )

  const provider = getProvider()
  const deployedContracts = getAllDeployedContracts()
  
  console.log(`[Stats] Calculating platform stats from ${deployedContracts.length} contracts...`)

  // 1. Get minted submissions from database
  const { data: submissions, error: subError } = await client
    .from('submissions')
    .select('campaign_id, contract_address')
    .eq('status', 'minted')
    .not('campaign_id', 'is', null)

  if (subError) {
    console.error('[Stats] Supabase error:', subError.message)
  }

  // 2. Group campaigns by contract address (fall back to V5 for orphaned)
  const campaignsByContract: Record<string, number[]> = {}
  let orphanedSubmissions = 0

  for (const sub of submissions || []) {
    let addr = (sub.contract_address || '').toLowerCase()
    if (!addr && sub.campaign_id != null) {
      addr = V5_CONTRACT.toLowerCase()
      orphanedSubmissions++
    }
    if (addr && sub.campaign_id != null) {
      if (!campaignsByContract[addr]) campaignsByContract[addr] = []
      if (!campaignsByContract[addr].includes(sub.campaign_id)) {
        campaignsByContract[addr].push(sub.campaign_id)
      }
    }
  }

  if (orphanedSubmissions > 0) {
    console.log(`[Stats] ${orphanedSubmissions} orphaned submissions assigned to V5`)
  }

  // 3. Query each contract
  let onchainRaisedUSD = 0
  let totalNFTsMinted = 0
  let totalCampaigns = 0
  let v5RaisedUSD = 0
  let v6RaisedUSD = 0
  let v5NFTsMinted = 0
  let v6NFTsMinted = 0

  for (const contractInfo of deployedContracts) {
    const addr = contractInfo.address.toLowerCase()
    const abi = contractInfo.version === 'v5' ? V5_ABI : V6_ABI
    const contract = new ethers.Contract(contractInfo.address, abi, provider)
    
    const campaignIds = campaignsByContract[addr] || []
    
    // Get total NFT supply for this contract
    try {
      const supply = await contract.totalSupply()
      const supplyNum = Number(supply)
      totalNFTsMinted += supplyNum
      
      if (contractInfo.version === 'v5') {
        v5NFTsMinted = supplyNum
      } else if (contractInfo.version === 'v6') {
        v6NFTsMinted = supplyNum
      }
      
      console.log(`[Stats] ${contractInfo.version} totalSupply: ${supplyNum}`)
    } catch (e: any) {
      console.error(`[Stats] Error getting totalSupply for ${contractInfo.version}:`, e?.message)
    }
    
    // Query each campaign's grossRaised
    for (const campaignId of campaignIds) {
      try {
        const camp = await contract.getCampaign(BigInt(campaignId))
        const grossRaisedWei = BigInt(camp.grossRaised ?? camp[3] ?? 0n)
        const grossRaisedBDAG = Number(grossRaisedWei) / 1e18
        const raisedUSD = grossRaisedBDAG * BDAG_USD_RATE
        
        onchainRaisedUSD += raisedUSD
        totalCampaigns++
        
        if (contractInfo.version === 'v5') {
          v5RaisedUSD += raisedUSD
        } else if (contractInfo.version === 'v6') {
          v6RaisedUSD += raisedUSD
        }
        
        console.log(`[Stats] ${contractInfo.version} Campaign #${campaignId}: $${raisedUSD.toFixed(2)}`)
      } catch (e: any) {
        console.error(`[Stats] Error fetching ${contractInfo.version} campaign ${campaignId}:`, e?.message)
      }
    }
  }

  // 4. Get off-chain payments (future implementation)
  let offchainRaisedUSD = 0
  try {
    // Query the events table for off-chain payments
    const { data: offchainPayments } = await client
      .from('events')
      .select('amount_usd')
      .eq('event_type', 'payment')
      .eq('is_onchain', false)
    
    if (offchainPayments && offchainPayments.length > 0) {
      offchainRaisedUSD = offchainPayments.reduce((sum, p) => sum + (Number(p.amount_usd) || 0), 0)
      console.log(`[Stats] Off-chain payments: $${offchainRaisedUSD.toFixed(2)} from ${offchainPayments.length} payments`)
    }
  } catch (e: any) {
    // Events table might not exist yet - that's OK
    console.log('[Stats] No off-chain payments found (events table may not exist)')
  }

  const totalRaisedUSD = onchainRaisedUSD + offchainRaisedUSD

  console.log(`[Stats] TOTALS: $${totalRaisedUSD.toFixed(2)} raised, ${totalNFTsMinted} NFTs, ${totalCampaigns} campaigns`)

  return {
    totalRaisedUSD: Math.round(totalRaisedUSD * 100) / 100,
    totalNFTsMinted,
    totalCampaigns,
    onchainRaisedUSD: Math.round(onchainRaisedUSD * 100) / 100,
    offchainRaisedUSD: Math.round(offchainRaisedUSD * 100) / 100,
    v5RaisedUSD: Math.round(v5RaisedUSD * 100) / 100,
    v6RaisedUSD: Math.round(v6RaisedUSD * 100) / 100,
    v5NFTsMinted,
    v6NFTsMinted,
    orphanedSubmissions,
    calculatedAt: new Date().toISOString()
  }
}

/**
 * Get stats for a specific campaign
 */
export async function getCampaignStats(
  campaignId: number,
  contractAddress?: string
): Promise<CampaignStats | null> {
  const provider = getProvider()
  const addr = contractAddress || V5_CONTRACT
  const isV5 = addr.toLowerCase() === V5_CONTRACT.toLowerCase()
  const abi = isV5 ? V5_ABI : V6_ABI
  const contract = new ethers.Contract(addr, abi, provider)

  try {
    const camp = await contract.getCampaign(BigInt(campaignId))
    const grossRaisedWei = BigInt(camp.grossRaised ?? camp[3] ?? 0n)
    const grossRaisedBDAG = Number(grossRaisedWei) / 1e18

    return {
      campaignId,
      contractAddress: addr,
      contractVersion: isV5 ? 'v5' : 'v6',
      grossRaisedBDAG,
      grossRaisedUSD: grossRaisedBDAG * BDAG_USD_RATE,
      editionsMinted: Number(camp.editionsMinted ?? camp[5] ?? 0),
      maxEditions: Number(camp.maxEditions ?? camp[6] ?? 0),
      active: Boolean(camp.active ?? camp[8] ?? true),
      closed: Boolean(camp.closed ?? camp[9] ?? false)
    }
  } catch (e: any) {
    console.error(`[Stats] Error fetching campaign ${campaignId}:`, e?.message)
    return null
  }
}
