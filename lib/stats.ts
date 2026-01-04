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
import { logger } from './logger'
import { isMainnet } from './chains/classification'

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

/**
 * Calculate platform-wide statistics from DATABASE (source of truth)
 * This ensures accurate data regardless of blockchain RPC availability.
 */
export async function calculatePlatformStats(supabase?: SupabaseClient): Promise<PlatformStats> {
  const client = supabase || createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false } }
  )

  logger.debug('[Stats] Calculating platform stats from DATABASE (source of truth)...')

  // 1. Get purchases with chain info from joined submission
  const { data: purchases, error: purchaseError } = await client
    .from('purchases')
    .select(`
      amount_usd, 
      tip_usd, 
      quantity,
      campaign_id,
      submissions!inner(chain_id)
    `)

  if (purchaseError) {
    console.error('[Stats] Error fetching purchases:', purchaseError.message)
  }

  let totalRaisedUSD = 0
  let totalNFTsMinted = 0
  let mainnetRaisedUSD = 0
  let mainnetNFTsMinted = 0
  let testnetRaisedUSD = 0
  let testnetNFTsMinted = 0
  
  for (const p of purchases || []) {
    const amount = (p.amount_usd || 0) + (p.tip_usd || 0)
    const qty = p.quantity || 1
    const chainId = (p as any).submissions?.chain_id
    
    totalRaisedUSD += amount
    totalNFTsMinted += qty
    
    if (isMainnet(chainId)) {
      mainnetRaisedUSD += amount
      mainnetNFTsMinted += qty
    } else {
      testnetRaisedUSD += amount
      testnetNFTsMinted += qty
    }
  }

  // 2. Get campaign count from submissions with chain breakdown
  const { data: campaigns, error: campaignError } = await client
    .from('submissions')
    .select('id, chain_id')
    .eq('status', 'minted')

  const totalCampaigns = campaigns?.length || 0
  const mainnetCampaigns = campaigns?.filter(c => isMainnet(c.chain_id)).length || 0
  const testnetCampaigns = totalCampaigns - mainnetCampaigns

  logger.debug(`[Stats] TOTALS: $${totalRaisedUSD.toFixed(2)} raised, ${totalNFTsMinted} NFTs, ${totalCampaigns} campaigns`)
  logger.debug(`[Stats] MAINNET: $${mainnetRaisedUSD.toFixed(2)}, TESTNET: $${testnetRaisedUSD.toFixed(2)}`)

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
    onchainRaisedUSD: Math.round(totalRaisedUSD * 100) / 100,
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
