/**
 * Unified Stats Calculation Service
 * 
 * This module provides a SINGLE SOURCE OF TRUTH for platform statistics.
 * All pages (Homepage, Admin, Dashboard) should use these functions.
 * 
 * PRIMARY DATA SOURCE: Supabase purchases table (most reliable)
 * This ensures accurate data regardless of blockchain RPC availability.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { ethers } from 'ethers'
import { logger } from './logger'
import { isMainnet } from './chains/classification'
import { getProviderForChain, ChainId } from './chains'
import { V8_ABI } from './contracts'

export interface PlatformStats {
  // Aggregated totals
  totalRaisedUSD: number
  totalNFTsMinted: number
  totalCampaigns: number
  
  // Breakdown by chain type (mainnet = real funds, testnet = test funds)
  mainnetRaisedUSD: number
  mainnetNFTsMinted: number
  mainnetCampaigns: number
  testnetRaisedUSD: number
  testnetNFTsMinted: number
  testnetCampaigns: number
  
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

// ETH USD rate for mainnet calculations
const ETH_USD_RATE = Number(process.env.ETH_USD_RATE || '3100')

/**
 * Fetch on-chain data for a mainnet campaign
 */
async function getOnchainCampaignData(
  campaignId: number, 
  contractAddress: string, 
  chainId: number
): Promise<{ grossRaisedUSD: number; editionsMinted: number } | null> {
  try {
    const provider = getProviderForChain(chainId as ChainId)
    const contract = new ethers.Contract(contractAddress, V8_ABI, provider)
    const campaign = await contract.getCampaign(BigInt(campaignId))
    
    const grossRaisedWei = BigInt(campaign.grossRaised ?? 0n)
    const grossRaisedETH = Number(grossRaisedWei) / 1e18
    const grossRaisedUSD = grossRaisedETH * ETH_USD_RATE
    const editionsMinted = Number(campaign.editionsMinted ?? 0)
    
    return { grossRaisedUSD, editionsMinted }
  } catch (e) {
    logger.debug('[Stats] Failed to fetch on-chain data:', e)
    return null
  }
}

/**
 * Calculate platform-wide statistics from DATABASE + ON-CHAIN (for mainnet)
 * Mainnet campaigns use on-chain data (more accurate than DB)
 * Testnet campaigns use purchases table
 */
export async function calculatePlatformStats(supabase?: SupabaseClient): Promise<PlatformStats> {
  const client = supabase || createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false } }
  )

  logger.debug('[Stats] Calculating platform stats (on-chain for mainnet, DB for testnet)...')

  // 1. Get all minted campaigns with contract info
  const { data: campaigns, error: campaignError } = await client
    .from('submissions')
    .select('id, chain_id, contract_address, campaign_id, goal, num_copies, sold_count')
    .eq('status', 'minted')

  if (campaignError) {
    logger.error('[Stats] Error fetching campaigns:', campaignError.message)
  }

  const allCampaigns = campaigns || []
  const mainnetCampaignsList = allCampaigns.filter(c => isMainnet(c.chain_id))
  const testnetCampaignsList = allCampaigns.filter(c => !isMainnet(c.chain_id))
  
  // Build a map of campaign_id -> chain_id for testnet lookups
  const campaignChainMap = new Map<number, number>()
  for (const c of allCampaigns) {
    if (c.campaign_id != null) {
      campaignChainMap.set(c.campaign_id, c.chain_id)
    }
  }

  let mainnetRaisedUSD = 0
  let mainnetNFTsMinted = 0
  let testnetRaisedUSD = 0
  let testnetNFTsMinted = 0

  // 2. For MAINNET campaigns: fetch on-chain data (source of truth for real funds)
  for (const c of mainnetCampaignsList) {
    if (c.campaign_id != null && c.contract_address) {
      const onchainData = await getOnchainCampaignData(
        c.campaign_id,
        c.contract_address,
        c.chain_id
      )
      if (onchainData) {
        mainnetRaisedUSD += onchainData.grossRaisedUSD
        mainnetNFTsMinted += onchainData.editionsMinted
        logger.debug(`[Stats] Mainnet campaign ${c.campaign_id}: $${onchainData.grossRaisedUSD.toFixed(2)}, ${onchainData.editionsMinted} NFTs`)
      }
    }
  }

  // 3. For TESTNET campaigns: use DB purchases table (no foreign key join needed)
  const { data: allPurchases, error: purchaseError } = await client
    .from('purchases')
    .select('amount_usd, tip_usd, quantity, campaign_id')

  if (purchaseError) {
    logger.error('[Stats] Error fetching purchases:', purchaseError.message)
  }

  for (const p of allPurchases || []) {
    const chainId = campaignChainMap.get(p.campaign_id)
    // Only count testnet purchases (mainnet uses on-chain data)
    if (chainId && !isMainnet(chainId)) {
      const amount = (p.amount_usd || 0) + (p.tip_usd || 0)
      const qty = p.quantity || 1
      testnetRaisedUSD += amount
      testnetNFTsMinted += qty
    }
  }

  const totalRaisedUSD = mainnetRaisedUSD + testnetRaisedUSD
  const totalNFTsMinted = mainnetNFTsMinted + testnetNFTsMinted
  const totalCampaigns = allCampaigns.length
  const mainnetCampaigns = mainnetCampaignsList.length
  const testnetCampaigns = testnetCampaignsList.length

  logger.debug(`[Stats] TOTALS: $${totalRaisedUSD.toFixed(2)} raised, ${totalNFTsMinted} NFTs, ${totalCampaigns} campaigns`)
  logger.debug(`[Stats] MAINNET (on-chain): $${mainnetRaisedUSD.toFixed(2)}, ${mainnetNFTsMinted} NFTs`)
  logger.debug(`[Stats] TESTNET (db): $${testnetRaisedUSD.toFixed(2)}, ${testnetNFTsMinted} NFTs`)

  return {
    totalRaisedUSD: Math.round(totalRaisedUSD * 100) / 100,
    totalNFTsMinted,
    totalCampaigns,
    mainnetRaisedUSD: Math.round(mainnetRaisedUSD * 100) / 100,
    mainnetNFTsMinted,
    mainnetCampaigns,
    testnetRaisedUSD: Math.round(testnetRaisedUSD * 100) / 100,
    testnetNFTsMinted,
    testnetCampaigns,
    onchainRaisedUSD: Math.round(mainnetRaisedUSD * 100) / 100,
    offchainRaisedUSD: 0,
    v5RaisedUSD: 0,
    v6RaisedUSD: 0,
    v5NFTsMinted: 0,
    v6NFTsMinted: 0,
    orphanedSubmissions: 0,
    calculatedAt: new Date().toISOString()
  }
}

/**
 * Get stats for a specific campaign from DATABASE
 */
export async function getCampaignStats(
  campaignId: number,
  contractAddress?: string
): Promise<CampaignStats | null> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false } }
  )

  try {
    // Get submission data
    const { data: submission } = await client
      .from('submissions')
      .select('campaign_id, contract_address, sold_count, num_copies, goal')
      .eq('campaign_id', campaignId)
      .single()

    if (!submission) return null

    // Get purchases for this campaign
    const { data: purchases } = await client
      .from('purchases')
      .select('amount_usd, tip_usd')
      .eq('campaign_id', campaignId)

    let grossRaisedUSD = 0
    for (const p of purchases || []) {
      grossRaisedUSD += (p.amount_usd || 0) + (p.tip_usd || 0)
    }

    const maxEditions = submission.num_copies || 100
    const editionsMinted = submission.sold_count || 0

    return {
      campaignId,
      contractAddress: submission.contract_address || '',
      contractVersion: 'v5', // Default
      grossRaisedBDAG: 0, // Not tracking BDAG anymore
      grossRaisedUSD,
      editionsMinted,
      maxEditions,
      active: editionsMinted < maxEditions,
      closed: editionsMinted >= maxEditions
    }
  } catch (e: any) {
    console.error(`[Stats] Error fetching campaign ${campaignId}:`, e?.message)
    return null
  }
}
