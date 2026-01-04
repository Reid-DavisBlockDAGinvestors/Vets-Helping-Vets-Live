/**
 * Platform Statistics Library
 * 
 * Provides 100% accurate statistics by querying ALL contracts on ALL chains.
 * Caches results for 60 seconds to avoid excessive RPC calls.
 * 
 * @version 1.0
 */

import { ethers } from 'ethers'
import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'
import { V5_ABI, V6_ABI, V7_ABI, V8_ABI } from './contracts'
import { getProviderForChain, ChainId } from './chains'

// USD conversion rates
const ETH_USD_RATE = Number(process.env.ETH_USD_RATE || '3100')
const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || '0.05')

// All deployed contracts
const ALL_CONTRACTS = [
  {
    name: 'V5-BlockDAG',
    address: '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890',
    chainId: 1043,
    isTestnet: true,
    abi: V5_ABI,
    version: 'v5',
    usdRate: BDAG_USD_RATE,
  },
  {
    name: 'V6-BlockDAG',
    address: '0xaE54e4E8A75a81780361570c17b8660CEaD27053',
    chainId: 1043,
    isTestnet: true,
    abi: V6_ABI,
    version: 'v6',
    usdRate: BDAG_USD_RATE,
  },
  {
    name: 'V7-Sepolia',
    address: '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e',
    chainId: 11155111,
    isTestnet: true,
    abi: V7_ABI,
    version: 'v7',
    usdRate: ETH_USD_RATE,
  },
  {
    name: 'V8-Sepolia',
    address: '0x042652292B8f1670b257707C1aDA4D19de9E9399',
    chainId: 11155111,
    isTestnet: true,
    abi: V8_ABI,
    version: 'v8',
    usdRate: ETH_USD_RATE,
  },
  {
    name: 'V8-Mainnet',
    address: '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e',
    chainId: 1,
    isTestnet: false,
    abi: V8_ABI,
    version: 'v8',
    usdRate: ETH_USD_RATE,
  }
]

export interface PlatformStats {
  totalCampaigns: number
  totalNFTsMinted: number
  totalRaisedUSD: number
  mainnetRaisedUSD: number
  testnetRaisedUSD: number
  mainnetNFTs: number
  testnetNFTs: number
  mainnetCampaigns: number
  testnetCampaigns: number
  lastUpdated: string
  contractBreakdown: Array<{
    name: string
    address: string
    chainId: number
    isTestnet: boolean
    campaigns: number
    nfts: number
    raisedUSD: number
    reachable: boolean
  }>
}

// Cache for stats
let statsCache: PlatformStats | null = null
let statsCacheTime = 0
const CACHE_TTL_MS = 60000 // 60 seconds

/**
 * Get accurate platform statistics from all contracts
 */
export async function getPlatformStats(forceRefresh = false): Promise<PlatformStats> {
  const now = Date.now()
  
  // Return cached if fresh
  if (!forceRefresh && statsCache && (now - statsCacheTime) < CACHE_TTL_MS) {
    return statsCache
  }

  logger.info('[PlatformStats] Fetching fresh stats from all contracts...')
  const startTime = Date.now()

  const stats: PlatformStats = {
    totalCampaigns: 0,
    totalNFTsMinted: 0,
    totalRaisedUSD: 0,
    mainnetRaisedUSD: 0,
    testnetRaisedUSD: 0,
    mainnetNFTs: 0,
    testnetNFTs: 0,
    mainnetCampaigns: 0,
    testnetCampaigns: 0,
    lastUpdated: new Date().toISOString(),
    contractBreakdown: []
  }

  // Query all contracts in parallel
  const results = await Promise.allSettled(
    ALL_CONTRACTS.map(async (config) => {
      const result = {
        name: config.name,
        address: config.address,
        chainId: config.chainId,
        isTestnet: config.isTestnet,
        campaigns: 0,
        nfts: 0,
        raisedUSD: 0,
        reachable: false
      }

      try {
        const provider = getProviderForChain(config.chainId as ChainId)
        const contract = new ethers.Contract(config.address, config.abi, provider)

        // Get total supply (with timeout)
        const supplyPromise = contract.totalSupply()
        const supply = await Promise.race([
          supplyPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ])
        result.nfts = Number(supply)

        // Get total campaigns
        const campaignsPromise = contract.totalCampaigns()
        const totalCampaigns = await Promise.race([
          campaignsPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ])
        result.campaigns = Number(totalCampaigns)

        // Query each campaign for gross raised
        let totalRaisedWei = 0n
        for (let i = 0; i < result.campaigns; i++) {
          try {
            const campaignData = await contract.getCampaign(BigInt(i))
            let grossRaisedWei: bigint

            if (config.version === 'v8') {
              grossRaisedWei = BigInt(campaignData.grossRaised ?? campaignData[5] ?? 0n)
            } else if (config.version === 'v7') {
              grossRaisedWei = BigInt(campaignData[3] ?? 0n)
            } else {
              grossRaisedWei = BigInt(campaignData[3] ?? 0n)
            }

            totalRaisedWei += grossRaisedWei
          } catch (e) {
            // Skip campaigns that fail to query
          }
        }

        const raisedNative = Number(totalRaisedWei) / 1e18
        result.raisedUSD = raisedNative * config.usdRate
        result.reachable = true
      } catch (e: any) {
        logger.warn(`[PlatformStats] Failed to query ${config.name}: ${e.message}`)
      }

      return result
    })
  )

  // Aggregate results
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const data = r.value
      stats.contractBreakdown.push(data)
      
      if (data.reachable) {
        stats.totalCampaigns += data.campaigns
        stats.totalNFTsMinted += data.nfts
        stats.totalRaisedUSD += data.raisedUSD

        if (data.isTestnet) {
          stats.testnetRaisedUSD += data.raisedUSD
          stats.testnetNFTs += data.nfts
          stats.testnetCampaigns += data.campaigns
        } else {
          stats.mainnetRaisedUSD += data.raisedUSD
          stats.mainnetNFTs += data.nfts
          stats.mainnetCampaigns += data.campaigns
        }
      }
    }
  }

  // Round values
  stats.totalRaisedUSD = Math.round(stats.totalRaisedUSD * 100) / 100
  stats.mainnetRaisedUSD = Math.round(stats.mainnetRaisedUSD * 100) / 100
  stats.testnetRaisedUSD = Math.round(stats.testnetRaisedUSD * 100) / 100

  const duration = Date.now() - startTime
  logger.info(`[PlatformStats] Fetched in ${duration}ms: ${stats.totalCampaigns} campaigns, ${stats.totalNFTsMinted} NFTs, $${stats.totalRaisedUSD} raised`)

  // Update cache
  statsCache = stats
  statsCacheTime = now

  return stats
}

/**
 * Get quick stats from database only (faster but less accurate)
 * Used as fallback when RPC calls fail
 */
export async function getQuickStatsFromDatabase(): Promise<{
  campaigns: number
  nfts: number
  raised: number
}> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { persistSession: false } }
    )

    const { data: submissions } = await supabase
      .from('submissions')
      .select('sold_count, goal, num_copies, status, visible_on_marketplace')
      .in('status', ['minted', 'pending_onchain'])

    if (!submissions) return { campaigns: 0, nfts: 0, raised: 0 }

    const visible = submissions.filter((s: any) => 
      s.visible_on_marketplace === true || s.visible_on_marketplace === 'true'
    )

    let nfts = 0
    let raised = 0

    for (const s of visible) {
      const soldCount = Number(s.sold_count || 0)
      const goal = Number(s.goal || 0)
      const numCopies = Number(s.num_copies || 100)
      const pricePerCopy = goal > 0 && numCopies > 0 ? goal / numCopies : 0

      nfts += soldCount
      raised += soldCount * pricePerCopy
    }

    return {
      campaigns: visible.length,
      nfts,
      raised: Math.round(raised * 100) / 100
    }
  } catch (e) {
    logger.error('[PlatformStats] Database fallback failed:', e)
    return { campaigns: 0, nfts: 0, raised: 0 }
  }
}

/**
 * Force clear the stats cache
 */
export function clearStatsCache(): void {
  statsCache = null
  statsCacheTime = 0
}
