/**
 * Comprehensive Audit: Supabase vs On-Chain Comparison
 * 
 * This script compares ALL data between Supabase database and on-chain contracts
 * to identify any discrepancies and ensure 100% data accuracy.
 * 
 * Run with: npx ts-node scripts/audit-comparison.ts
 */

import { ethers } from 'ethers'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

// USD conversion rates
const ETH_USD_RATE = Number(process.env.ETH_USD_RATE || '3100')
const BDAG_USD_RATE = Number(process.env.BDAG_USD_RATE || '0.05')

// V8 ABI (simplified for getCampaign)
const V8_ABI = [
  'function totalCampaigns() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function getCampaign(uint256 campaignId) view returns (tuple(address beneficiary, string metadataURI, uint256 priceWei, uint256 priceUSD, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 withdrawn, uint256 editionsMinted, uint256 maxEditions, uint256 platformFee, uint256 nonprofitFee, uint256 createdAt, uint256 pausedAt, bool active, bool paused, bool closed))'
]

// V6 ABI (simplified for getCampaign)
const V6_ABI = [
  'function totalCampaigns() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function getCampaign(uint256 campaignId) view returns (address, string, uint256, uint256, uint256, uint256, uint256, uint256, bool, bool)'
]

// All contracts
const CONTRACTS = [
  {
    name: 'V5-BlockDAG',
    address: '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890',
    chainId: 1043,
    rpcUrl: 'https://rpc.awakening.bdagscan.com',
    isTestnet: true,
    abi: V6_ABI,
    usdRate: BDAG_USD_RATE
  },
  {
    name: 'V6-BlockDAG',
    address: '0xaE54e4E8A75a81780361570c17b8660CEaD27053',
    chainId: 1043,
    rpcUrl: 'https://rpc.awakening.bdagscan.com',
    isTestnet: true,
    abi: V6_ABI,
    usdRate: BDAG_USD_RATE
  },
  {
    name: 'V7-Sepolia',
    address: '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e',
    chainId: 11155111,
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/demo',
    isTestnet: true,
    abi: V8_ABI,
    usdRate: ETH_USD_RATE
  },
  {
    name: 'V8-Sepolia',
    address: '0x042652292B8f1670b257707C1aDA4D19de9E9399',
    chainId: 11155111,
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/demo',
    isTestnet: true,
    abi: V8_ABI,
    usdRate: ETH_USD_RATE
  },
  {
    name: 'V8-Mainnet',
    address: '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e',
    chainId: 1,
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    isTestnet: false,
    abi: V8_ABI,
    usdRate: ETH_USD_RATE
  }
]

interface OnChainCampaign {
  campaignId: number
  contractName: string
  contractAddress: string
  chainId: number
  isTestnet: boolean
  grossRaisedWei: string
  grossRaisedNative: number
  grossRaisedUSD: number
  editionsMinted: number
  maxEditions: number
  active: boolean
}

interface SupabaseCampaign {
  id: string
  title: string
  campaign_id: number | null
  contract_address: string | null
  chain_id: number | null
  sold_count: number
  goal: number
  status: string
  visible_on_marketplace: boolean
}

interface Discrepancy {
  type: 'SOLD_COUNT_MISMATCH' | 'ORPHAN_ON_CHAIN' | 'MISSING_ON_CHAIN' | 'DELETED_WITH_FUNDS'
  description: string
  supabaseId?: string
  supabaseTitle?: string
  campaignId?: number
  contractName?: string
  contractAddress?: string
  supabaseValue?: any
  onChainValue?: any
  fundsAtRisk?: number
}

async function getSupabaseData(): Promise<SupabaseCampaign[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )

  const { data, error } = await supabase
    .from('submissions')
    .select('id, title, campaign_id, contract_address, chain_id, sold_count, goal, status, visible_on_marketplace')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Supabase error:', error)
    return []
  }

  return data || []
}

async function getOnChainData(contract: typeof CONTRACTS[0]): Promise<OnChainCampaign[]> {
  const campaigns: OnChainCampaign[] = []
  
  try {
    const provider = new ethers.JsonRpcProvider(contract.rpcUrl)
    const contractInstance = new ethers.Contract(contract.address, contract.abi, provider)
    
    const totalCampaigns = await contractInstance.totalCampaigns()
    console.log(`  ${contract.name}: ${totalCampaigns} campaigns on-chain`)
    
    for (let i = 0; i < Number(totalCampaigns); i++) {
      try {
        const data = await contractInstance.getCampaign(BigInt(i))
        
        let grossRaisedWei: bigint
        let editionsMinted: number
        let maxEditions: number
        let active: boolean
        
        if (contract.chainId === 1 || contract.chainId === 11155111) {
          // V8 struct format
          grossRaisedWei = BigInt(data.grossRaised ?? data[5] ?? 0n)
          editionsMinted = Number(data.editionsMinted ?? data[8] ?? 0)
          maxEditions = Number(data.maxEditions ?? data[9] ?? 0)
          active = data.active ?? data[14] ?? false
        } else {
          // V6 format
          grossRaisedWei = BigInt(data[3] ?? 0n)
          editionsMinted = Number(data[5] ?? 0)
          maxEditions = Number(data[6] ?? 0)
          active = data[8] ?? false
        }
        
        const grossRaisedNative = Number(grossRaisedWei) / 1e18
        const grossRaisedUSD = grossRaisedNative * contract.usdRate
        
        campaigns.push({
          campaignId: i,
          contractName: contract.name,
          contractAddress: contract.address,
          chainId: contract.chainId,
          isTestnet: contract.isTestnet,
          grossRaisedWei: grossRaisedWei.toString(),
          grossRaisedNative,
          grossRaisedUSD,
          editionsMinted,
          maxEditions,
          active
        })
      } catch (e) {
        // Skip campaigns that fail
      }
    }
  } catch (e: any) {
    console.error(`  ${contract.name}: Failed to connect - ${e.message}`)
  }
  
  return campaigns
}

async function runAudit() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('       COMPREHENSIVE AUDIT: SUPABASE vs ON-CHAIN')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log()
  
  // Get Supabase data
  console.log('📊 Fetching Supabase data...')
  const supabaseData = await getSupabaseData()
  console.log(`   Found ${supabaseData.length} total submissions`)
  console.log()
  
  // Get on-chain data from all contracts
  console.log('⛓️  Fetching on-chain data from all contracts...')
  const allOnChainCampaigns: OnChainCampaign[] = []
  
  for (const contract of CONTRACTS) {
    const campaigns = await getOnChainData(contract)
    allOnChainCampaigns.push(...campaigns)
  }
  console.log(`   Found ${allOnChainCampaigns.length} total campaigns on-chain`)
  console.log()
  
  // Find discrepancies
  const discrepancies: Discrepancy[] = []
  
  // 1. Check each Supabase submission against on-chain
  console.log('🔍 Comparing Supabase submissions to on-chain data...')
  for (const sub of supabaseData) {
    if (sub.campaign_id === null || !sub.contract_address) continue
    
    const onChain = allOnChainCampaigns.find(
      c => c.contractAddress.toLowerCase() === sub.contract_address?.toLowerCase() &&
           c.campaignId === sub.campaign_id
    )
    
    if (!onChain) {
      discrepancies.push({
        type: 'MISSING_ON_CHAIN',
        description: `Supabase has campaign_id ${sub.campaign_id} but not found on-chain`,
        supabaseId: sub.id,
        supabaseTitle: sub.title,
        campaignId: sub.campaign_id,
        contractAddress: sub.contract_address
      })
    } else {
      // Check sold count mismatch
      if (sub.sold_count !== onChain.editionsMinted) {
        discrepancies.push({
          type: 'SOLD_COUNT_MISMATCH',
          description: `Sold count mismatch: Supabase=${sub.sold_count}, On-chain=${onChain.editionsMinted}`,
          supabaseId: sub.id,
          supabaseTitle: sub.title,
          campaignId: sub.campaign_id,
          contractName: onChain.contractName,
          contractAddress: sub.contract_address,
          supabaseValue: sub.sold_count,
          onChainValue: onChain.editionsMinted
        })
      }
      
      // Check if hidden but has funds
      if (!sub.visible_on_marketplace && onChain.grossRaisedUSD > 0) {
        discrepancies.push({
          type: 'DELETED_WITH_FUNDS',
          description: `Hidden campaign has $${onChain.grossRaisedUSD.toFixed(2)} on-chain`,
          supabaseId: sub.id,
          supabaseTitle: sub.title,
          campaignId: sub.campaign_id,
          contractName: onChain.contractName,
          fundsAtRisk: onChain.grossRaisedUSD
        })
      }
    }
  }
  
  // 2. Check for orphan on-chain campaigns (not in Supabase)
  console.log('🔍 Checking for orphan on-chain campaigns...')
  for (const onChain of allOnChainCampaigns) {
    if (onChain.editionsMinted === 0) continue // Skip empty campaigns
    
    const inSupabase = supabaseData.find(
      s => s.contract_address?.toLowerCase() === onChain.contractAddress.toLowerCase() &&
           s.campaign_id === onChain.campaignId
    )
    
    if (!inSupabase) {
      discrepancies.push({
        type: 'ORPHAN_ON_CHAIN',
        description: `On-chain campaign ${onChain.campaignId} has ${onChain.editionsMinted} NFTs but no Supabase entry`,
        campaignId: onChain.campaignId,
        contractName: onChain.contractName,
        contractAddress: onChain.contractAddress,
        onChainValue: {
          editionsMinted: onChain.editionsMinted,
          grossRaisedUSD: onChain.grossRaisedUSD
        }
      })
    }
  }
  
  // Calculate totals
  console.log()
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('                         SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  
  // On-chain totals
  let totalOnChainNFTs = 0
  let totalOnChainUSD = 0
  let mainnetOnChainUSD = 0
  let testnetOnChainUSD = 0
  let mainnetNFTs = 0
  let testnetNFTs = 0
  
  for (const c of allOnChainCampaigns) {
    totalOnChainNFTs += c.editionsMinted
    totalOnChainUSD += c.grossRaisedUSD
    if (c.isTestnet) {
      testnetOnChainUSD += c.grossRaisedUSD
      testnetNFTs += c.editionsMinted
    } else {
      mainnetOnChainUSD += c.grossRaisedUSD
      mainnetNFTs += c.editionsMinted
    }
  }
  
  // Supabase totals (visible only)
  const visibleSubs = supabaseData.filter(s => s.visible_on_marketplace)
  let supabaseTotalSold = 0
  for (const s of visibleSubs) {
    supabaseTotalSold += s.sold_count || 0
  }
  
  console.log()
  console.log('📈 ON-CHAIN TOTALS (Source of Truth):')
  console.log(`   Total NFTs Minted: ${totalOnChainNFTs}`)
  console.log(`   Total Raised: $${totalOnChainUSD.toFixed(2)}`)
  console.log(`   ├─ 💎 Mainnet: $${mainnetOnChainUSD.toFixed(2)} (${mainnetNFTs} NFTs)`)
  console.log(`   └─ 🧪 Testnet: $${testnetOnChainUSD.toFixed(2)} (${testnetNFTs} NFTs)`)
  console.log()
  console.log('📊 SUPABASE TOTALS (Visible campaigns only):')
  console.log(`   Total Campaigns: ${visibleSubs.length}`)
  console.log(`   Total Sold Count: ${supabaseTotalSold}`)
  console.log()
  console.log('📝 DATABASE BREAKDOWN:')
  console.log(`   Total Submissions: ${supabaseData.length}`)
  console.log(`   Visible on Marketplace: ${visibleSubs.length}`)
  console.log(`   Hidden (not visible): ${supabaseData.filter(s => !s.visible_on_marketplace).length}`)
  
  // Show discrepancies
  console.log()
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('                       DISCREPANCIES')
  console.log('═══════════════════════════════════════════════════════════════')
  
  if (discrepancies.length === 0) {
    console.log()
    console.log('✅ No discrepancies found! Supabase and on-chain data match.')
  } else {
    console.log()
    console.log(`⚠️  Found ${discrepancies.length} discrepancies:`)
    console.log()
    
    // Group by type
    const soldMismatches = discrepancies.filter(d => d.type === 'SOLD_COUNT_MISMATCH')
    const orphans = discrepancies.filter(d => d.type === 'ORPHAN_ON_CHAIN')
    const missing = discrepancies.filter(d => d.type === 'MISSING_ON_CHAIN')
    const deletedWithFunds = discrepancies.filter(d => d.type === 'DELETED_WITH_FUNDS')
    
    if (soldMismatches.length > 0) {
      console.log(`📊 SOLD COUNT MISMATCHES (${soldMismatches.length}):`)
      for (const d of soldMismatches) {
        console.log(`   • "${d.supabaseTitle}" (${d.contractName})`)
        console.log(`     Supabase: ${d.supabaseValue} | On-chain: ${d.onChainValue}`)
      }
      console.log()
    }
    
    if (orphans.length > 0) {
      console.log(`🔗 ORPHAN ON-CHAIN CAMPAIGNS (${orphans.length}):`)
      for (const d of orphans) {
        console.log(`   • Campaign #${d.campaignId} on ${d.contractName}`)
        console.log(`     ${d.onChainValue.editionsMinted} NFTs, $${d.onChainValue.grossRaisedUSD.toFixed(2)} raised`)
      }
      console.log()
    }
    
    if (missing.length > 0) {
      console.log(`❌ MISSING ON-CHAIN (${missing.length}):`)
      for (const d of missing) {
        console.log(`   • "${d.supabaseTitle}" - campaign_id ${d.campaignId} not found`)
      }
      console.log()
    }
    
    if (deletedWithFunds.length > 0) {
      console.log(`🗑️  DELETED CAMPAIGNS WITH FUNDS (${deletedWithFunds.length}):`)
      for (const d of deletedWithFunds) {
        console.log(`   • "${d.supabaseTitle}" - $${d.fundsAtRisk?.toFixed(2)} still on-chain`)
      }
      console.log()
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('                     AUDIT COMPLETE')
  console.log('═══════════════════════════════════════════════════════════════')
}

// Run the audit
runAudit().catch(console.error)
