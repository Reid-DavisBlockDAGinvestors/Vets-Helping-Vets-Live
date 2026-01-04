/**
 * Comprehensive Platform Audit API
 * 
 * Queries ALL contracts across ALL chains to provide 100% accurate statistics.
 * Cross-references on-chain data with database submissions to identify:
 * - Total campaigns (on-chain vs database)
 * - Total NFTs minted (on-chain)
 * - Total funds raised (on-chain, in native currency and USD)
 * - Deleted campaigns with on-chain funds
 * - Discrepancies between on-chain and database
 * 
 * @version 1.0 - Initial comprehensive audit
 */

import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { V5_ABI, V6_ABI, V7_ABI, V8_ABI } from '@/lib/contracts'
import { getProviderForChain, ChainId } from '@/lib/chains'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60 // Allow up to 60 seconds for comprehensive audit

// USD conversion rates
const ETH_USD_RATE = Number(process.env.ETH_USD_RATE || '3100')
const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || '0.05')

// Contract configurations - ALL contracts that have ever been deployed
const ALL_CONTRACTS = [
  {
    name: 'V5-BlockDAG',
    address: '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890',
    chainId: 1043,
    chainName: 'BlockDAG Testnet',
    isTestnet: true,
    abi: V5_ABI,
    version: 'v5',
    usdRate: BDAG_USD_RATE,
    nativeSymbol: 'BDAG'
  },
  {
    name: 'V6-BlockDAG',
    address: '0xaE54e4E8A75a81780361570c17b8660CEaD27053',
    chainId: 1043,
    chainName: 'BlockDAG Testnet',
    isTestnet: true,
    abi: V6_ABI,
    version: 'v6',
    usdRate: BDAG_USD_RATE,
    nativeSymbol: 'BDAG'
  },
  {
    name: 'V7-Sepolia',
    address: '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e',
    chainId: 11155111,
    chainName: 'Sepolia Testnet',
    isTestnet: true,
    abi: V7_ABI,
    version: 'v7',
    usdRate: ETH_USD_RATE,
    nativeSymbol: 'ETH'
  },
  {
    name: 'V8-Sepolia',
    address: '0x042652292B8f1670b257707C1aDA4D19de9E9399',
    chainId: 11155111,
    chainName: 'Sepolia Testnet',
    isTestnet: true,
    abi: V8_ABI,
    version: 'v8',
    usdRate: ETH_USD_RATE,
    nativeSymbol: 'ETH'
  },
  {
    name: 'V8-Mainnet',
    address: '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e',
    chainId: 1,
    chainName: 'Ethereum Mainnet',
    isTestnet: false,
    abi: V8_ABI,
    version: 'v8',
    usdRate: ETH_USD_RATE,
    nativeSymbol: 'ETH'
  }
]

interface CampaignOnChain {
  campaignId: number
  grossRaisedWei: bigint
  grossRaisedNative: number
  grossRaisedUSD: number
  editionsMinted: number
  maxEditions: number
  active: boolean
  closed: boolean
}

interface ContractAudit {
  name: string
  address: string
  chainId: number
  chainName: string
  isTestnet: boolean
  version: string
  nativeSymbol: string
  
  // On-chain data
  totalCampaigns: number
  totalSupply: number
  campaigns: CampaignOnChain[]
  totalRaisedNative: number
  totalRaisedUSD: number
  
  // Status
  reachable: boolean
  error?: string
}

interface DatabaseSubmission {
  id: string
  campaign_id: number | null
  contract_address: string | null
  chain_id: number | null
  sold_count: number | null
  goal: number | null
  status: string
  visible_on_marketplace: boolean | string | null
  title: string
  deleted_at?: string | null
}

interface AuditResult {
  timestamp: string
  summary: {
    totalCampaignsOnChain: number
    totalCampaignsInDatabase: number
    totalNFTsMinted: number
    totalRaisedUSD: number
    mainnetRaisedUSD: number
    testnetRaisedUSD: number
    deletedCampaignsWithFunds: number
    discrepancies: number
  }
  contracts: ContractAudit[]
  database: {
    totalSubmissions: number
    mintedSubmissions: number
    visibleSubmissions: number
    deletedSubmissions: number
  }
  discrepancies: Array<{
    type: string
    description: string
    contractAddress: string
    campaignId: number
    details: any
  }>
}

function getFreshSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false } }
  )
}

async function auditContract(contractConfig: typeof ALL_CONTRACTS[0]): Promise<ContractAudit> {
  const result: ContractAudit = {
    name: contractConfig.name,
    address: contractConfig.address,
    chainId: contractConfig.chainId,
    chainName: contractConfig.chainName,
    isTestnet: contractConfig.isTestnet,
    version: contractConfig.version,
    nativeSymbol: contractConfig.nativeSymbol,
    totalCampaigns: 0,
    totalSupply: 0,
    campaigns: [],
    totalRaisedNative: 0,
    totalRaisedUSD: 0,
    reachable: false
  }

  try {
    const provider = getProviderForChain(contractConfig.chainId as ChainId)
    const contract = new ethers.Contract(contractConfig.address, contractConfig.abi, provider)

    // Get total supply (NFTs minted)
    try {
      const supply = await contract.totalSupply()
      result.totalSupply = Number(supply)
    } catch (e) {
      logger.warn(`[Audit] Could not get totalSupply for ${contractConfig.name}`)
    }

    // Get total campaigns
    try {
      const totalCampaigns = await contract.totalCampaigns()
      result.totalCampaigns = Number(totalCampaigns)
    } catch (e) {
      logger.warn(`[Audit] Could not get totalCampaigns for ${contractConfig.name}`)
    }

    // Query each campaign
    for (let i = 0; i < result.totalCampaigns; i++) {
      try {
        const campaignData = await contract.getCampaign(BigInt(i))
        
        let grossRaisedWei: bigint
        let editionsMinted: number
        let maxEditions: number
        let active: boolean
        let closed: boolean

        // Handle different ABI return formats
        if (contractConfig.version === 'v8') {
          // V8 returns struct
          grossRaisedWei = BigInt(campaignData.grossRaised ?? campaignData[5] ?? 0n)
          editionsMinted = Number(campaignData.editionsMinted ?? campaignData[8] ?? 0n)
          maxEditions = Number(campaignData.maxEditions ?? campaignData[9] ?? 0n)
          active = campaignData.active ?? campaignData[14] ?? false
          closed = campaignData.closed ?? campaignData[16] ?? false
        } else if (contractConfig.version === 'v7') {
          // V7 returns 13 fields
          grossRaisedWei = BigInt(campaignData[3] ?? 0n)
          editionsMinted = Number(campaignData[5] ?? 0n)
          maxEditions = Number(campaignData[6] ?? 0n)
          active = campaignData[10] ?? false
          closed = campaignData[11] ?? false
        } else {
          // V5/V6 returns 10 fields
          grossRaisedWei = BigInt(campaignData[3] ?? 0n)
          editionsMinted = Number(campaignData[5] ?? 0n)
          maxEditions = Number(campaignData[6] ?? 0n)
          active = campaignData[8] ?? false
          closed = campaignData[9] ?? false
        }

        const grossRaisedNative = Number(grossRaisedWei) / 1e18
        const grossRaisedUSD = grossRaisedNative * contractConfig.usdRate

        result.campaigns.push({
          campaignId: i,
          grossRaisedWei,
          grossRaisedNative,
          grossRaisedUSD,
          editionsMinted,
          maxEditions,
          active,
          closed
        })

        result.totalRaisedNative += grossRaisedNative
        result.totalRaisedUSD += grossRaisedUSD
      } catch (e: any) {
        logger.warn(`[Audit] Could not get campaign ${i} from ${contractConfig.name}: ${e.message}`)
      }
    }

    result.reachable = true
  } catch (e: any) {
    result.error = e.message
    logger.error(`[Audit] Failed to audit ${contractConfig.name}: ${e.message}`)
  }

  return result
}

export async function GET(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    logger.info('[Audit] Starting comprehensive platform audit...')

    // 1. Audit all contracts in parallel
    const contractAudits = await Promise.all(
      ALL_CONTRACTS.map(config => auditContract(config))
    )

    // 2. Get all database submissions
    const supabase = getFreshSupabase()
    const { data: allSubmissions, error: dbError } = await supabase
      .from('submissions')
      .select('id, campaign_id, contract_address, chain_id, sold_count, goal, status, visible_on_marketplace, title, deleted_at')
      .order('created_at', { ascending: false })

    if (dbError) {
      logger.error('[Audit] Database error:', dbError.message)
    }

    const submissions = allSubmissions || []

    // 3. Calculate summary statistics
    let totalCampaignsOnChain = 0
    let totalNFTsMinted = 0
    let totalRaisedUSD = 0
    let mainnetRaisedUSD = 0
    let testnetRaisedUSD = 0

    for (const audit of contractAudits) {
      totalCampaignsOnChain += audit.totalCampaigns
      totalNFTsMinted += audit.totalSupply
      totalRaisedUSD += audit.totalRaisedUSD
      
      if (audit.isTestnet) {
        testnetRaisedUSD += audit.totalRaisedUSD
      } else {
        mainnetRaisedUSD += audit.totalRaisedUSD
      }
    }

    // 4. Identify discrepancies
    const discrepancies: AuditResult['discrepancies'] = []

    // Check for campaigns in database that don't match on-chain
    for (const sub of submissions) {
      if (sub.campaign_id === null || !sub.contract_address) continue

      const contractAudit = contractAudits.find(
        a => a.address.toLowerCase() === sub.contract_address?.toLowerCase()
      )

      if (contractAudit && contractAudit.reachable) {
        const onChainCampaign = contractAudit.campaigns.find(
          c => c.campaignId === sub.campaign_id
        )

        if (!onChainCampaign) {
          discrepancies.push({
            type: 'CAMPAIGN_NOT_ON_CHAIN',
            description: `Campaign ${sub.campaign_id} exists in database but not on-chain`,
            contractAddress: sub.contract_address,
            campaignId: sub.campaign_id,
            details: { submissionId: sub.id, title: sub.title }
          })
        } else {
          // Check sold_count mismatch
          const dbSoldCount = sub.sold_count || 0
          if (dbSoldCount !== onChainCampaign.editionsMinted) {
            discrepancies.push({
              type: 'SOLD_COUNT_MISMATCH',
              description: `Database shows ${dbSoldCount} sold, on-chain shows ${onChainCampaign.editionsMinted}`,
              contractAddress: sub.contract_address,
              campaignId: sub.campaign_id,
              details: {
                submissionId: sub.id,
                title: sub.title,
                databaseCount: dbSoldCount,
                onChainCount: onChainCampaign.editionsMinted
              }
            })
          }
        }
      }
    }

    // Check for on-chain campaigns not in database (orphan campaigns)
    for (const audit of contractAudits) {
      if (!audit.reachable) continue

      for (const campaign of audit.campaigns) {
        const dbMatch = submissions.find(
          s => s.contract_address?.toLowerCase() === audit.address.toLowerCase() &&
               s.campaign_id === campaign.campaignId
        )

        if (!dbMatch && campaign.editionsMinted > 0) {
          discrepancies.push({
            type: 'ORPHAN_CAMPAIGN',
            description: `Campaign ${campaign.campaignId} on ${audit.name} has ${campaign.editionsMinted} NFTs but no database entry`,
            contractAddress: audit.address,
            campaignId: campaign.campaignId,
            details: {
              editionsMinted: campaign.editionsMinted,
              grossRaisedUSD: campaign.grossRaisedUSD,
              chainName: audit.chainName
            }
          })
        }
      }
    }

    // Count deleted campaigns with funds
    const deletedWithFunds = submissions.filter(s => {
      if (!s.deleted_at || !s.contract_address || s.campaign_id === null) return false
      
      const contractAudit = contractAudits.find(
        a => a.address.toLowerCase() === s.contract_address?.toLowerCase()
      )
      if (!contractAudit) return false

      const onChainCampaign = contractAudit.campaigns.find(
        c => c.campaignId === s.campaign_id
      )
      return onChainCampaign && onChainCampaign.grossRaisedUSD > 0
    })

    // 5. Build result
    const result: AuditResult = {
      timestamp: new Date().toISOString(),
      summary: {
        totalCampaignsOnChain,
        totalCampaignsInDatabase: submissions.filter(s => s.status === 'minted').length,
        totalNFTsMinted,
        totalRaisedUSD: Math.round(totalRaisedUSD * 100) / 100,
        mainnetRaisedUSD: Math.round(mainnetRaisedUSD * 100) / 100,
        testnetRaisedUSD: Math.round(testnetRaisedUSD * 100) / 100,
        deletedCampaignsWithFunds: deletedWithFunds.length,
        discrepancies: discrepancies.length
      },
      contracts: contractAudits,
      database: {
        totalSubmissions: submissions.length,
        mintedSubmissions: submissions.filter(s => s.status === 'minted').length,
        visibleSubmissions: submissions.filter(s => 
          s.visible_on_marketplace === true || s.visible_on_marketplace === 'true'
        ).length,
        deletedSubmissions: submissions.filter(s => s.deleted_at).length
      },
      discrepancies
    }

    const duration = Date.now() - startTime
    logger.info(`[Audit] Comprehensive audit completed in ${duration}ms`)
    logger.info(`[Audit] Summary: ${JSON.stringify(result.summary)}`)

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Audit-Duration-Ms': String(duration)
      }
    })
  } catch (e: any) {
    logger.error('[Audit] Failed:', e.message)
    return NextResponse.json(
      { error: 'AUDIT_FAILED', message: e.message },
      { status: 500 }
    )
  }
}
