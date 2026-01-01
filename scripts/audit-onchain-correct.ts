#!/usr/bin/env node
/**
 * CORRECT ON-CHAIN AUDIT - Using proper ABIs from lib/contracts.ts
 */

const { ethers } = require('ethers')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const V6_CONTRACT = '0xaE54e4E8A75a81780361570c17b8660CEaD27053'
const BDAG_USD_RATE = 0.05

const RPC_URL = 'https://bdag.nownodes.io'
const API_KEY = process.env.NOWNODES_API_KEY || ''

// CORRECT V5 ABI from lib/contracts.ts
const V5_ABI = [
  'function totalSupply() view returns (uint256)',
  'function totalCampaigns() view returns (uint256)',
  'function getCampaign(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, bool active, bool closed)',
  'function campaigns(uint256 campaignId) view returns (string category, string baseURI, uint256 goal, uint256 grossRaised, uint256 netRaised, uint256 tipsReceived, uint256 editionsMinted, uint256 maxEditions, uint256 pricePerEdition, uint256 nonprofitFeeRate, address nonprofit, address submitter, bool active, bool closed)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenToCampaign(uint256 tokenId) view returns (uint256)',
]

// V6 has same getCampaign signature
const V6_ABI = V5_ABI

async function main() {
  console.log('🔍 CORRECT ON-CHAIN AUDIT\n')
  console.log('Using ABIs from lib/contracts.ts\n')
  
  const fetchRequest = new ethers.FetchRequest(RPC_URL)
  fetchRequest.setHeader('api-key', API_KEY)
  const provider = new ethers.JsonRpcProvider(fetchRequest, 1043, { staticNetwork: true })
  
  const block = await provider.getBlockNumber()
  console.log(`✅ Connected. Block: ${block}\n`)
  
  const v5 = new ethers.Contract(V5_CONTRACT, V5_ABI, provider)
  const v6 = new ethers.Contract(V6_CONTRACT, V6_ABI, provider)
  
  // Get total supplies
  console.log('=== TOTAL SUPPLIES ===')
  let v5Supply = 0, v6Supply = 0
  try {
    v5Supply = Number(await v5.totalSupply())
    console.log(`V5 totalSupply: ${v5Supply} NFTs`)
  } catch (e: any) {
    console.log(`V5 totalSupply error: ${e.message?.slice(0, 80)}`)
  }
  
  try {
    v6Supply = Number(await v6.totalSupply())
    console.log(`V6 totalSupply: ${v6Supply} NFTs`)
  } catch (e: any) {
    console.log(`V6 totalSupply error: ${e.message?.slice(0, 80)}`)
  }
  
  // Get total campaigns
  console.log('\n=== TOTAL CAMPAIGNS ===')
  let v5Campaigns = 0, v6Campaigns = 0
  try {
    v5Campaigns = Number(await v5.totalCampaigns())
    console.log(`V5 totalCampaigns: ${v5Campaigns}`)
  } catch (e: any) {
    console.log(`V5 totalCampaigns error: ${e.message?.slice(0, 80)}`)
  }
  
  try {
    v6Campaigns = Number(await v6.totalCampaigns())
    console.log(`V6 totalCampaigns: ${v6Campaigns}`)
  } catch (e: any) {
    console.log(`V6 totalCampaigns error: ${e.message?.slice(0, 80)}`)
  }
  
  // Query ALL V5 campaigns
  console.log('\n=== V5 CAMPAIGNS (querying 1-60) ===\n')
  let v5TotalEditions = 0
  let v5TotalRaisedBDAG = 0
  const v5CampaignData: any[] = []
  
  for (let i = 1; i <= 60; i++) {
    try {
      const camp = await v5.getCampaign(BigInt(i))
      // Returns: category, baseURI, goal, grossRaised, netRaised, editionsMinted, maxEditions, pricePerEdition, active, closed
      const grossRaisedBDAG = Number(BigInt(camp[3])) / 1e18
      const editionsMinted = Number(camp[5])
      const maxEditions = Number(camp[6])
      const active = camp[8]
      const closed = camp[9]
      
      if (maxEditions > 0) {
        v5TotalEditions += editionsMinted
        v5TotalRaisedBDAG += grossRaisedBDAG
        
        const isSoldOut = editionsMinted >= maxEditions
        const status = isSoldOut ? '🔴 SOLD OUT' : closed ? '⚪ Closed' : '🟢 Active'
        
        v5CampaignData.push({ id: i, editionsMinted, maxEditions, grossRaisedBDAG, isSoldOut })
        
        console.log(`#${i}: ${editionsMinted}/${maxEditions} | ${grossRaisedBDAG.toFixed(2)} BDAG ($${(grossRaisedBDAG * BDAG_USD_RATE).toFixed(2)}) | ${status}`)
      }
    } catch (e: any) {
      // Campaign doesn't exist or error
      if (!e.message?.includes('revert') && !e.message?.includes('decode')) {
        console.log(`#${i}: Error - ${e.message?.slice(0, 60)}`)
      }
    }
  }
  
  console.log(`\n📊 V5 TOTALS: ${v5TotalEditions} editions, ${v5TotalRaisedBDAG.toFixed(2)} BDAG ($${(v5TotalRaisedBDAG * BDAG_USD_RATE).toFixed(2)} USD)`)
  
  // Query ALL V6 campaigns
  console.log('\n=== V6 CAMPAIGNS (querying 1-50) ===\n')
  let v6TotalEditions = 0
  let v6TotalRaisedBDAG = 0
  const v6CampaignData: any[] = []
  
  for (let i = 1; i <= 50; i++) {
    try {
      const camp = await v6.getCampaign(BigInt(i))
      const grossRaisedBDAG = Number(BigInt(camp[3])) / 1e18
      const editionsMinted = Number(camp[5])
      const maxEditions = Number(camp[6])
      const active = camp[8]
      const closed = camp[9]
      
      if (maxEditions > 0) {
        v6TotalEditions += editionsMinted
        v6TotalRaisedBDAG += grossRaisedBDAG
        
        const isSoldOut = editionsMinted >= maxEditions
        const status = isSoldOut ? '🔴 SOLD OUT' : closed ? '⚪ Closed' : '🟢 Active'
        
        v6CampaignData.push({ id: i, editionsMinted, maxEditions, grossRaisedBDAG, isSoldOut })
        
        console.log(`#${i}: ${editionsMinted}/${maxEditions} | ${grossRaisedBDAG.toFixed(2)} BDAG ($${(grossRaisedBDAG * BDAG_USD_RATE).toFixed(2)}) | ${status}`)
      }
    } catch (e: any) {
      if (!e.message?.includes('revert') && !e.message?.includes('decode')) {
        console.log(`#${i}: Error - ${e.message?.slice(0, 60)}`)
      }
    }
  }
  
  console.log(`\n📊 V6 TOTALS: ${v6TotalEditions} editions, ${v6TotalRaisedBDAG.toFixed(2)} BDAG ($${(v6TotalRaisedBDAG * BDAG_USD_RATE).toFixed(2)} USD)`)
  
  // Database comparison
  console.log('\n=== DATABASE COMPARISON ===\n')
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, campaign_id, title, sold_count, num_copies, contract_address, status')
    .eq('status', 'minted')
  
  // Find discrepancies
  console.log('DISCREPANCIES (On-Chain vs Database):\n')
  let discrepancyCount = 0
  
  for (const chainCamp of [...v5CampaignData, ...v6CampaignData]) {
    const dbSub = submissions?.find((s: any) => s.campaign_id === chainCamp.id)
    
    if (!dbSub) {
      console.log(`❌ Campaign #${chainCamp.id}: ON-CHAIN (${chainCamp.editionsMinted}/${chainCamp.maxEditions}) but NOT IN DATABASE`)
      discrepancyCount++
      continue
    }
    
    if (chainCamp.editionsMinted !== (dbSub.sold_count || 0)) {
      console.log(`❌ Campaign #${chainCamp.id} "${dbSub.title?.slice(0, 30)}..."`)
      console.log(`   Chain: ${chainCamp.editionsMinted}/${chainCamp.maxEditions} ${chainCamp.isSoldOut ? '🔴 SOLD OUT' : ''}`)
      console.log(`   DB:    ${dbSub.sold_count || 0}/${dbSub.num_copies || 0}`)
      console.log(`   MISSING: ${chainCamp.editionsMinted - (dbSub.sold_count || 0)} purchases not recorded!`)
      discrepancyCount++
    }
  }
  
  // Grand total
  console.log('\n' + '='.repeat(60))
  console.log('GRAND TOTAL')
  console.log('='.repeat(60))
  console.log(`\nON-CHAIN:`)
  console.log(`  V5: ${v5Supply} NFTs (totalSupply), ${v5TotalEditions} editions (sum of campaigns)`)
  console.log(`  V6: ${v6Supply} NFTs (totalSupply), ${v6TotalEditions} editions (sum of campaigns)`)
  console.log(`  TOTAL: ${v5Supply + v6Supply} NFTs`)
  console.log(`  RAISED: $${((v5TotalRaisedBDAG + v6TotalRaisedBDAG) * BDAG_USD_RATE).toFixed(2)} USD`)
  
  const { data: purchases } = await supabase.from('purchases').select('quantity, amount_usd, tip_usd')
  let dbNFTs = 0, dbRaised = 0
  for (const p of purchases || []) {
    dbNFTs += p.quantity || 1
    dbRaised += (p.amount_usd || 0) + (p.tip_usd || 0)
  }
  
  console.log(`\nDATABASE:`)
  console.log(`  Purchases: ${purchases?.length || 0}`)
  console.log(`  NFTs: ${dbNFTs}`)
  console.log(`  Raised: $${dbRaised.toFixed(2)} USD`)
  
  console.log(`\n⚠️  DISCREPANCIES: ${discrepancyCount}`)
  if (v5Supply + v6Supply !== dbNFTs) {
    console.log(`⚠️  NFT COUNT MISMATCH: Chain has ${v5Supply + v6Supply}, DB has ${dbNFTs} (diff: ${(v5Supply + v6Supply) - dbNFTs})`)
  }
}

main().catch(console.error)
