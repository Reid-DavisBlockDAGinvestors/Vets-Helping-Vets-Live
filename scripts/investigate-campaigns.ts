#!/usr/bin/env node
/**
 * Investigate Campaign Issues
 * 
 * 1. Find duplicate campaigns by title
 * 2. Check on-chain sold count vs database
 * 3. Sync data if needed
 */

const { createClient } = require('@supabase/supabase-js')
const { ethers } = require('ethers')

require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RPC_URL = process.env.BLOCKDAG_RPC || 'https://rpc.primev2.bdagscan.com'
const NOWNODES_KEY = process.env.NOWNODES_API_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Contract addresses (from lib/contracts.ts)
const CONTRACT_V5 = process.env.CONTRACT_ADDRESS_V5 || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const CONTRACT_V6 = process.env.CONTRACT_ADDRESS_V6 || '0xaE54e4E8A75a81780361570c17b8660CEaD27053'

// ABI for reading campaign data
const CAMPAIGN_ABI = [
  'function getCampaign(uint256 campaignId) view returns (tuple(uint256 size, uint256 price, uint256 goal, uint256 sold, address creator, string baseURI, uint8 category, bool active))',
  'function campaignCount() view returns (uint256)'
]

async function createProvider() {
  // Create fetch request with headers for NowNodes
  const fetchRequest = new ethers.FetchRequest(RPC_URL)
  if (RPC_URL?.includes('nownodes') && NOWNODES_KEY) {
    fetchRequest.setHeader('api-key', NOWNODES_KEY)
  }
  return new ethers.JsonRpcProvider(fetchRequest)
}

async function findDuplicates() {
  console.log('\n📋 FINDING DUPLICATE CAMPAIGNS...')
  console.log('─'.repeat(60))
  
  const { data: submissions, error } = await supabase
    .from('submissions')
    .select('id, title, campaign_id, status, created_at, sold_count, goal, creator_email')
    .order('title')
  
  if (error) {
    console.error('Error:', error)
    return []
  }
  
  // Group by normalized title
  const groups = new Map<string, any[]>()
  for (const sub of submissions || []) {
    const key = sub.title?.toLowerCase().trim() || ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(sub)
  }
  
  const duplicates = []
  for (const [title, subs] of groups) {
    if (subs.length > 1) {
      duplicates.push({ title: subs[0].title, submissions: subs })
      console.log(`\n⚠️  DUPLICATE: "${subs[0].title}"`)
      for (const s of subs) {
        console.log(`   ID: ${s.id}`)
        console.log(`   Campaign ID: ${s.campaign_id || 'N/A'}`)
        console.log(`   Status: ${s.status}`)
        console.log(`   Sold Count: ${s.sold_count || 0}`)
        console.log(`   Goal: $${s.goal || 0}`)
        console.log(`   Created: ${s.created_at}`)
        console.log(`   Creator: ${s.creator_email || 'N/A'}`)
        console.log('')
      }
    }
  }
  
  if (duplicates.length === 0) {
    console.log('  ✅ No duplicates found by exact title match')
  }
  
  // Also search for "Anthony Turner" specifically
  console.log('\n🔍 SEARCHING FOR "Anthony Turner" CAMPAIGNS...')
  const { data: anthonyCampaigns } = await supabase
    .from('submissions')
    .select('*')
    .ilike('title', '%anthony%turner%')
  
  if (anthonyCampaigns && anthonyCampaigns.length > 0) {
    console.log(`Found ${anthonyCampaigns.length} Anthony Turner campaigns:`)
    for (const c of anthonyCampaigns) {
      console.log(`\n  Title: ${c.title}`)
      console.log(`  ID: ${c.id}`)
      console.log(`  Campaign ID: ${c.campaign_id || 'N/A'}`)
      console.log(`  Status: ${c.status}`)
      console.log(`  Sold Count: ${c.sold_count || 0}`)
      console.log(`  Goal: $${c.goal || 0}`)
      console.log(`  Token ID: ${c.token_id || 'N/A'}`)
      console.log(`  Created: ${c.created_at}`)
    }
  } else {
    console.log('  No Anthony Turner campaigns found')
  }
  
  return { duplicates, anthonyCampaigns }
}

async function checkOnChainData() {
  console.log('\n⛓️  CHECKING ON-CHAIN DATA FOR ALL CAMPAIGNS...')
  console.log('─'.repeat(60))
  
  const { data: campaigns } = await supabase
    .from('submissions')
    .select('id, title, campaign_id, sold_count, goal, status')
    .not('campaign_id', 'is', null)
    .order('campaign_id')
  
  if (!campaigns || campaigns.length === 0) {
    console.log('  No campaigns with campaign_id found')
    return []
  }
  
  console.log(`  Checking ${campaigns.length} campaigns...`)
  
  const provider = await createProvider()
  const mismatches = []
  
  // Try V5 contract
  try {
    const contract = new ethers.Contract(CONTRACT_V5, CAMPAIGN_ABI, provider)
    const campaignCount = await contract.campaignCount()
    console.log(`\n  V5 Contract has ${campaignCount} campaigns`)
    
    for (const campaign of campaigns) {
      const cid = campaign.campaign_id
      try {
        const data = await contract.getCampaign(cid)
        const chainSold = Number(data.sold)
        const chainPrice = Number(ethers.formatEther(data.price))
        const chainSize = Number(data.size)
        const chainGoal = Number(ethers.formatEther(data.goal))
        const dbSold = campaign.sold_count || 0
        
        if (chainSold !== dbSold) {
          mismatches.push({
            id: campaign.id,
            title: campaign.title,
            campaignId: cid,
            dbSold,
            chainSold,
            chainPrice,
            chainSize,
            chainGoal,
            difference: chainSold - dbSold
          })
          console.log(`\n  ⚠️  MISMATCH: Campaign #${cid} "${campaign.title}"`)
          console.log(`     DB sold_count:    ${dbSold}`)
          console.log(`     On-chain sold:    ${chainSold}`)
          console.log(`     Difference:       ${chainSold - dbSold} NFTs`)
          console.log(`     On-chain price:   ${chainPrice} BDAG`)
          console.log(`     On-chain size:    ${chainSize} editions`)
        } else {
          console.log(`  ✓ Campaign #${cid}: ${dbSold}/${chainSize} sold (matches)`)
        }
      } catch (e: any) {
        if (!e.message.includes('campaign does not exist')) {
          console.log(`  ❌ Error reading campaign #${cid}:`, e.message)
        }
      }
    }
  } catch (e: any) {
    console.error('  Failed to query V5 contract:', e.message)
  }
  
  return mismatches
}

async function checkPurchasesForCampaigns(campaignIds: number[]) {
  console.log('\n💰 CHECKING PURCHASES TABLE FOR CAMPAIGNS...')
  console.log('─'.repeat(60))
  
  for (const cid of campaignIds) {
    const { data: purchases, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('campaign_id', cid)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.log(`  Error for campaign #${cid}:`, error)
      continue
    }
    
    console.log(`\n  Campaign #${cid}: ${purchases?.length || 0} purchases recorded`)
    if (purchases && purchases.length > 0) {
      const totalUSD = purchases.reduce((sum: number, p: any) => sum + (p.amount_usd || 0), 0)
      console.log(`    Total USD: $${totalUSD.toFixed(2)}`)
      console.log(`    Last purchase: ${purchases[0].created_at}`)
    }
  }
}

async function run() {
  console.log('\n' + '='.repeat(60))
  console.log('🔍 CAMPAIGN INVESTIGATION')
  console.log('='.repeat(60))
  
  const { duplicates, anthonyCampaigns } = await findDuplicates()
  const mismatches = await checkOnChainData()
  
  // Check purchases for mismatched campaigns
  if (mismatches.length > 0) {
    const campaignIds = mismatches.map((m: any) => m.campaignId)
    await checkPurchasesForCampaigns(campaignIds)
  }
  
  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 INVESTIGATION SUMMARY')
  console.log('='.repeat(60))
  console.log(`  Duplicate campaign sets: ${duplicates.length}`)
  console.log(`  Anthony Turner campaigns: ${anthonyCampaigns?.length || 0}`)
  console.log(`  On-chain mismatches: ${mismatches.length}`)
  
  if (mismatches.length > 0) {
    console.log('\n⚠️  RECOMMENDED ACTIONS:')
    for (const m of mismatches) {
      console.log(`  - Campaign #${m.campaignId}: Update sold_count from ${m.dbSold} to ${m.chainSold}`)
    }
  }
  
  console.log('\n')
}

run().catch(console.error)
