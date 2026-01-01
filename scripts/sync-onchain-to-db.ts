#!/usr/bin/env node
/**
 * COMPREHENSIVE ON-CHAIN TO DATABASE SYNC SCRIPT
 * 
 * This script:
 * 1. Queries ALL campaigns from V5 and V6 contracts
 * 2. Updates database sold_count to match on-chain editionsMinted
 * 3. Fixes contract_address mismatches
 * 4. Reports all discrepancies found and fixed
 */

import { ethers } from 'ethers'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const V6_CONTRACT = '0xaE54e4E8A75a81780361570c17b8660CEaD27053'

// Use the working RPC (fallback works, NowNodes has issues)
const RPC_URL = 'https://rpc.awakening.bdagscan.com'
const BDAG_USD_RATE = 0.05

const CAMPAIGN_ABI = [
  'function totalSupply() view returns (uint256)',
  'function totalCampaigns() view returns (uint256)',
  'function getCampaign(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenToCampaign(uint256 tokenId) view returns (uint256)',
  'function getEditionInfo(uint256 tokenId) view returns (uint256 campaignId, uint256 editionNumber, uint256 totalEditions)',
]

interface OnChainCampaign {
  campaignId: number
  contract: string
  editionsMinted: number
  maxEditions: number
  grossRaisedBDAG: number
  grossRaisedUSD: number
  active: boolean
  closed: boolean
  isSoldOut: boolean
}

interface DBSubmission {
  id: string
  campaign_id: number
  title: string
  sold_count: number
  num_copies: number
  contract_address: string
  goal: number
}

interface SyncResult {
  campaignId: number
  title: string
  onChain: { sold: number; max: number; contract: string }
  database: { sold: number; max: number; contract: string }
  discrepancies: string[]
  fixed: boolean
}

async function getProvider() {
  const provider = new ethers.JsonRpcProvider(RPC_URL, 1043, { staticNetwork: true })
  await provider.getBlockNumber() // Test connection
  return provider
}

async function queryAllCampaigns(contract: ethers.Contract, contractAddress: string, maxId: number): Promise<OnChainCampaign[]> {
  const campaigns: OnChainCampaign[] = []
  
  for (let i = 1; i <= maxId; i++) {
    try {
      const camp = await contract.getCampaign(BigInt(i))
      const editionsMinted = Number(camp[5])
      const maxEditions = Number(camp[6])
      const grossRaisedBDAG = Number(BigInt(camp[3])) / 1e18
      
      if (maxEditions > 0) {
        campaigns.push({
          campaignId: i,
          contract: contractAddress,
          editionsMinted,
          maxEditions,
          grossRaisedBDAG,
          grossRaisedUSD: grossRaisedBDAG * BDAG_USD_RATE,
          active: camp[8],
          closed: camp[9],
          isSoldOut: editionsMinted >= maxEditions
        })
      }
    } catch (e) {
      // Campaign doesn't exist, skip
    }
  }
  
  return campaigns
}

async function main() {
  console.log('=' .repeat(70))
  console.log('COMPREHENSIVE ON-CHAIN TO DATABASE SYNC')
  console.log('=' .repeat(70))
  console.log()
  
  // Initialize
  const provider = await getProvider()
  console.log('✅ Connected to BlockDAG RPC')
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  console.log('✅ Connected to Supabase')
  
  const v5 = new ethers.Contract(V5_CONTRACT, CAMPAIGN_ABI, provider)
  const v6 = new ethers.Contract(V6_CONTRACT, CAMPAIGN_ABI, provider)
  
  // Get contract stats
  console.log('\n--- CONTRACT OVERVIEW ---')
  const v5Supply = Number(await v5.totalSupply())
  const v6Supply = Number(await v6.totalSupply())
  console.log(`V5 totalSupply: ${v5Supply} NFTs`)
  console.log(`V6 totalSupply: ${v6Supply} NFTs`)
  console.log(`TOTAL ON-CHAIN: ${v5Supply + v6Supply} NFTs`)
  
  // Query all campaigns from both contracts
  console.log('\n--- QUERYING ALL CAMPAIGNS ---')
  console.log('Querying V5 campaigns 1-60...')
  const v5Campaigns = await queryAllCampaigns(v5, V5_CONTRACT, 60)
  console.log(`Found ${v5Campaigns.length} V5 campaigns with editions`)
  
  console.log('Querying V6 campaigns 1-20...')
  const v6Campaigns = await queryAllCampaigns(v6, V6_CONTRACT, 20)
  console.log(`Found ${v6Campaigns.length} V6 campaigns with editions`)
  
  const allOnChain = [...v5Campaigns, ...v6Campaigns]
  
  // Get database submissions
  console.log('\n--- LOADING DATABASE ---')
  const { data: dbSubmissions, error: dbError } = await supabase
    .from('submissions')
    .select('id, campaign_id, title, sold_count, num_copies, contract_address, goal, status')
    .eq('status', 'minted')
  
  if (dbError) {
    console.error('Database error:', dbError)
    return
  }
  
  console.log(`Found ${dbSubmissions?.length || 0} minted submissions in DB`)
  
  // Compare and sync
  console.log('\n' + '=' .repeat(70))
  console.log('DISCREPANCY ANALYSIS & SYNC')
  console.log('=' .repeat(70))
  
  const results: SyncResult[] = []
  let fixedCount = 0
  let discrepancyCount = 0
  
  for (const dbSub of dbSubmissions || []) {
    const onChain = allOnChain.find(c => c.campaignId === dbSub.campaign_id)
    const discrepancies: string[] = []
    
    if (!onChain) {
      // Check if campaign exists on either contract
      const v5Check = v5Campaigns.find(c => c.campaignId === dbSub.campaign_id)
      const v6Check = v6Campaigns.find(c => c.campaignId === dbSub.campaign_id)
      
      if (!v5Check && !v6Check) {
        discrepancies.push(`Campaign #${dbSub.campaign_id} NOT FOUND on-chain`)
      }
    } else {
      // Check sold_count
      if (dbSub.sold_count !== onChain.editionsMinted) {
        discrepancies.push(`sold_count: DB=${dbSub.sold_count}, Chain=${onChain.editionsMinted}`)
      }
      
      // Check contract address
      if (dbSub.contract_address?.toLowerCase() !== onChain.contract.toLowerCase()) {
        discrepancies.push(`contract_address: DB=${dbSub.contract_address?.slice(0,10)}..., Chain=${onChain.contract.slice(0,10)}...`)
      }
      
      // Check max editions
      if (dbSub.num_copies !== onChain.maxEditions) {
        discrepancies.push(`num_copies: DB=${dbSub.num_copies}, Chain=${onChain.maxEditions}`)
      }
    }
    
    if (discrepancies.length > 0) {
      discrepancyCount++
      console.log(`\n❌ Campaign #${dbSub.campaign_id}: "${dbSub.title?.slice(0, 40)}..."`)
      for (const d of discrepancies) {
        console.log(`   ${d}`)
      }
      
      // FIX: Update database to match on-chain
      if (onChain) {
        const updates: any = {}
        
        if (dbSub.sold_count !== onChain.editionsMinted) {
          updates.sold_count = onChain.editionsMinted
        }
        if (dbSub.contract_address?.toLowerCase() !== onChain.contract.toLowerCase()) {
          updates.contract_address = onChain.contract
        }
        if (dbSub.num_copies !== onChain.maxEditions) {
          updates.num_copies = onChain.maxEditions
        }
        
        if (Object.keys(updates).length > 0) {
          console.log(`   🔧 FIXING: ${JSON.stringify(updates)}`)
          
          const { error: updateError } = await supabase
            .from('submissions')
            .update(updates)
            .eq('id', dbSub.id)
          
          if (updateError) {
            console.log(`   ❌ Update failed: ${updateError.message}`)
          } else {
            console.log(`   ✅ Fixed!`)
            fixedCount++
          }
        }
      }
      
      results.push({
        campaignId: dbSub.campaign_id,
        title: dbSub.title || '',
        onChain: onChain ? { sold: onChain.editionsMinted, max: onChain.maxEditions, contract: onChain.contract } : { sold: 0, max: 0, contract: 'NOT FOUND' },
        database: { sold: dbSub.sold_count || 0, max: dbSub.num_copies || 0, contract: dbSub.contract_address || '' },
        discrepancies,
        fixed: onChain !== undefined
      })
    }
  }
  
  // Check for on-chain campaigns not in DB
  console.log('\n--- ON-CHAIN CAMPAIGNS NOT IN DATABASE ---')
  for (const onChain of allOnChain) {
    const dbSub = dbSubmissions?.find(s => s.campaign_id === onChain.campaignId)
    if (!dbSub) {
      console.log(`⚠️  Campaign #${onChain.campaignId} on ${onChain.contract.slice(0,10)}... (${onChain.editionsMinted}/${onChain.maxEditions}) - NOT in DB`)
    }
  }
  
  // Summary
  console.log('\n' + '=' .repeat(70))
  console.log('SYNC SUMMARY')
  console.log('=' .repeat(70))
  console.log(`\nOn-Chain Totals:`)
  console.log(`  V5: ${v5Supply} NFTs across ${v5Campaigns.length} campaigns`)
  console.log(`  V6: ${v6Supply} NFTs across ${v6Campaigns.length} campaigns`)
  console.log(`  TOTAL: ${v5Supply + v6Supply} NFTs`)
  
  const v5SoldSum = v5Campaigns.reduce((s, c) => s + c.editionsMinted, 0)
  const v6SoldSum = v6Campaigns.reduce((s, c) => s + c.editionsMinted, 0)
  console.log(`\nEditions Minted (sum of campaigns):`)
  console.log(`  V5: ${v5SoldSum}`)
  console.log(`  V6: ${v6SoldSum}`)
  console.log(`  TOTAL: ${v5SoldSum + v6SoldSum}`)
  
  console.log(`\nSync Results:`)
  console.log(`  Discrepancies found: ${discrepancyCount}`)
  console.log(`  Fixed: ${fixedCount}`)
  
  // Print specific campaigns user asked about
  console.log('\n--- KEY CAMPAIGNS STATUS ---')
  const larry = v5Campaigns.find(c => c.campaignId === 4)
  const anthony = v5Campaigns.find(c => c.campaignId === 38) || v6Campaigns.find(c => c.campaignId === 38)
  
  if (larry) {
    console.log(`\nLarry Odom #4 (V5):`)
    console.log(`  On-Chain: ${larry.editionsMinted}/${larry.maxEditions} ${larry.isSoldOut ? '🔴 SOLD OUT' : '🟢 Available'}`)
    console.log(`  Raised: $${larry.grossRaisedUSD.toFixed(2)} USD`)
  }
  
  if (anthony) {
    console.log(`\nAnthony Turner #38 (${anthony.contract === V5_CONTRACT ? 'V5' : 'V6'}):`)
    console.log(`  On-Chain: ${anthony.editionsMinted}/${anthony.maxEditions} ${anthony.isSoldOut ? '🔴 SOLD OUT' : '🟢 Available'}`)
    console.log(`  Raised: $${anthony.grossRaisedUSD.toFixed(2)} USD`)
  }
  
  console.log('\n✅ Sync complete!')
}

main().catch(console.error)
