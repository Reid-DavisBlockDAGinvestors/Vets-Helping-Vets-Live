#!/usr/bin/env node
/**
 * FULL ON-CHAIN AUDIT - Query both V5 and V6 contracts directly
 * This verifies actual blockchain state vs database
 */

const { ethers } = require('ethers')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const V5_CONTRACT = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const V6_CONTRACT = '0xaE54e4E8A75a81780361570c17b8660CEaD27053'
const BDAG_USD_RATE = 0.05

// NowNodes RPC with API key
const RPC_URL = process.env.BLOCKDAG_RPC || 'https://bdag.nownodes.io'
const API_KEY = process.env.NOWNODES_API_KEY || ''

// Minimal ABI for what we need
const CAMPAIGN_ABI = [
  'function totalSupply() view returns (uint256)',
  'function getCampaign(uint256 campaignId) view returns (tuple(address recipient, string metadataURI, uint256 pricePerEdition, uint256 grossRaised, uint256 tipsCollected, uint256 editionsMinted, uint256 maxEditions, uint256 createdAt, bool active, bool closed))',
  'function nextCampaignId() view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)'
]

async function createProvider() {
  const fetchRequest = new ethers.FetchRequest(RPC_URL)
  if (API_KEY && RPC_URL.includes('nownodes')) {
    fetchRequest.setHeader('api-key', API_KEY)
  }
  return new ethers.JsonRpcProvider(fetchRequest, 1043, { staticNetwork: true })
}

async function auditContract(name: string, address: string, provider: any) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`AUDITING ${name} CONTRACT: ${address}`)
  console.log('='.repeat(60))
  
  const contract = new ethers.Contract(address, CAMPAIGN_ABI, provider)
  
  // Get total NFT supply
  let totalSupply = 0
  try {
    totalSupply = Number(await contract.totalSupply())
    console.log(`\n✅ Total NFTs Minted (totalSupply): ${totalSupply}`)
  } catch (e: any) {
    console.log(`❌ Error getting totalSupply: ${e.message}`)
  }
  
  // Get next campaign ID to know how many campaigns exist
  let nextCampaignId = 0
  try {
    nextCampaignId = Number(await contract.nextCampaignId())
    console.log(`✅ Next Campaign ID: ${nextCampaignId} (means campaigns 1-${nextCampaignId - 1} exist)`)
  } catch (e: any) {
    console.log(`❌ Error getting nextCampaignId: ${e.message}`)
  }
  
  // Query each campaign
  const campaigns: any[] = []
  let totalRaisedBDAG = 0
  let totalEditionsMinted = 0
  
  console.log(`\n--- Querying all ${nextCampaignId - 1} campaigns ---\n`)
  
  for (let i = 1; i < nextCampaignId; i++) {
    try {
      const camp = await contract.getCampaign(BigInt(i))
      const grossRaisedWei = BigInt(camp.grossRaised ?? camp[3] ?? 0n)
      const grossRaisedBDAG = Number(grossRaisedWei) / 1e18
      const tipsWei = BigInt(camp.tipsCollected ?? camp[4] ?? 0n)
      const tipsBDAG = Number(tipsWei) / 1e18
      const editionsMinted = Number(camp.editionsMinted ?? camp[5] ?? 0)
      const maxEditions = Number(camp.maxEditions ?? camp[6] ?? 0)
      const priceWei = BigInt(camp.pricePerEdition ?? camp[2] ?? 0n)
      const priceBDAG = Number(priceWei) / 1e18
      const active = camp.active ?? camp[8] ?? true
      const closed = camp.closed ?? camp[9] ?? false
      
      totalRaisedBDAG += grossRaisedBDAG
      totalEditionsMinted += editionsMinted
      
      const isSoldOut = editionsMinted >= maxEditions
      const statusEmoji = isSoldOut ? '🔴 SOLD OUT' : (active ? '🟢 Active' : '⚪ Inactive')
      
      campaigns.push({
        id: i,
        editionsMinted,
        maxEditions,
        grossRaisedBDAG,
        grossRaisedUSD: grossRaisedBDAG * BDAG_USD_RATE,
        tipsBDAG,
        priceBDAG,
        priceUSD: priceBDAG * BDAG_USD_RATE,
        active,
        closed,
        isSoldOut
      })
      
      console.log(`Campaign #${i}: ${editionsMinted}/${maxEditions} sold | $${(grossRaisedBDAG * BDAG_USD_RATE).toFixed(2)} raised | ${statusEmoji}`)
    } catch (e: any) {
      console.log(`Campaign #${i}: ❌ Error - ${e.message?.slice(0, 50)}`)
    }
  }
  
  console.log(`\n--- ${name} TOTALS ---`)
  console.log(`Total Editions Minted (sum): ${totalEditionsMinted}`)
  console.log(`Total Raised: ${totalRaisedBDAG.toFixed(2)} BDAG = $${(totalRaisedBDAG * BDAG_USD_RATE).toFixed(2)} USD`)
  console.log(`Total Supply (from contract): ${totalSupply}`)
  
  return { 
    contract: name, 
    address, 
    totalSupply, 
    totalEditionsMinted, 
    totalRaisedBDAG,
    totalRaisedUSD: totalRaisedBDAG * BDAG_USD_RATE,
    campaigns 
  }
}

async function auditDatabase() {
  console.log(`\n${'='.repeat(60)}`)
  console.log('DATABASE AUDIT')
  console.log('='.repeat(60))
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  // Get all minted submissions
  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, campaign_id, title, sold_count, num_copies, goal, contract_address, status')
    .eq('status', 'minted')
    .order('campaign_id', { ascending: true })
  
  console.log(`\nMinted submissions in DB: ${submissions?.length || 0}`)
  
  for (const sub of submissions || []) {
    const contractVersion = sub.contract_address?.toLowerCase() === V6_CONTRACT.toLowerCase() ? 'V6' : 'V5'
    console.log(`DB #${sub.campaign_id} (${contractVersion}): "${sub.title?.slice(0, 40)}" | sold_count=${sub.sold_count}/${sub.num_copies}`)
  }
  
  // Get purchases
  const { data: purchases } = await supabase
    .from('purchases')
    .select('campaign_id, amount_usd, tip_usd, quantity')
  
  console.log(`\nTotal purchases in DB: ${purchases?.length || 0}`)
  
  // Aggregate by campaign
  const byCampaign: Record<number, { qty: number, usd: number }> = {}
  for (const p of purchases || []) {
    if (!byCampaign[p.campaign_id]) byCampaign[p.campaign_id] = { qty: 0, usd: 0 }
    byCampaign[p.campaign_id].qty += p.quantity || 1
    byCampaign[p.campaign_id].usd += (p.amount_usd || 0) + (p.tip_usd || 0)
  }
  
  console.log('\nPurchases by campaign:')
  for (const [cid, data] of Object.entries(byCampaign).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`  Campaign #${cid}: ${data.qty} NFTs, $${data.usd.toFixed(2)}`)
  }
  
  return { submissions, purchases, byCampaign }
}

async function findDiscrepancies(v5Data: any, v6Data: any, dbData: any) {
  console.log(`\n${'='.repeat(60)}`)
  console.log('DISCREPANCY ANALYSIS')
  console.log('='.repeat(60))
  
  const discrepancies: any[] = []
  
  // Check each on-chain campaign against DB
  const allChainCampaigns = [
    ...v5Data.campaigns.map((c: any) => ({ ...c, contract: 'V5' })),
    ...v6Data.campaigns.map((c: any) => ({ ...c, contract: 'V6' }))
  ]
  
  for (const chainCamp of allChainCampaigns) {
    const dbSub = dbData.submissions?.find((s: any) => s.campaign_id === chainCamp.id)
    const dbPurchases = dbData.byCampaign[chainCamp.id]
    
    if (!dbSub) {
      discrepancies.push({
        type: 'MISSING_IN_DB',
        campaignId: chainCamp.id,
        contract: chainCamp.contract,
        message: `Campaign #${chainCamp.id} exists on-chain but NOT in submissions table`,
        chainData: chainCamp
      })
      continue
    }
    
    // Check sold_count mismatch
    if (chainCamp.editionsMinted !== (dbSub.sold_count || 0)) {
      discrepancies.push({
        type: 'SOLD_COUNT_MISMATCH',
        campaignId: chainCamp.id,
        contract: chainCamp.contract,
        title: dbSub.title,
        chainEditions: chainCamp.editionsMinted,
        dbSoldCount: dbSub.sold_count || 0,
        message: `Chain shows ${chainCamp.editionsMinted} sold, DB shows ${dbSub.sold_count || 0}`
      })
    }
    
    // Check if sold out on chain but not marked in DB
    if (chainCamp.isSoldOut && (dbSub.sold_count || 0) < (dbSub.num_copies || 100)) {
      discrepancies.push({
        type: 'SOLD_OUT_NOT_REFLECTED',
        campaignId: chainCamp.id,
        contract: chainCamp.contract,
        title: dbSub.title,
        message: `Campaign is SOLD OUT on-chain (${chainCamp.editionsMinted}/${chainCamp.maxEditions}) but DB shows ${dbSub.sold_count}/${dbSub.num_copies}`
      })
    }
  }
  
  // Summary
  console.log(`\n🔍 Found ${discrepancies.length} discrepancies:\n`)
  for (const d of discrepancies) {
    console.log(`❌ [${d.type}] Campaign #${d.campaignId} (${d.contract})`)
    console.log(`   ${d.message}`)
    if (d.title) console.log(`   Title: "${d.title}"`)
    console.log('')
  }
  
  return discrepancies
}

async function main() {
  console.log('\n🔍 FULL ON-CHAIN AUDIT - PatriotPledge NFTs')
  console.log('=========================================\n')
  
  const provider = await createProvider()
  
  // Test connection
  try {
    const blockNum = await provider.getBlockNumber()
    console.log(`✅ Connected to BlockDAG. Current block: ${blockNum}`)
  } catch (e: any) {
    console.error(`❌ Failed to connect to RPC: ${e.message}`)
    return
  }
  
  // Audit both contracts
  const v5Data = await auditContract('V5', V5_CONTRACT, provider)
  const v6Data = await auditContract('V6', V6_CONTRACT, provider)
  
  // Audit database
  const dbData = await auditDatabase()
  
  // Find discrepancies
  const discrepancies = await findDiscrepancies(v5Data, v6Data, dbData)
  
  // Final summary
  console.log(`\n${'='.repeat(60)}`)
  console.log('FINAL SUMMARY')
  console.log('='.repeat(60))
  console.log(`\nON-CHAIN TOTALS:`)
  console.log(`  V5: ${v5Data.totalSupply} NFTs, $${v5Data.totalRaisedUSD.toFixed(2)} raised`)
  console.log(`  V6: ${v6Data.totalSupply} NFTs, $${v6Data.totalRaisedUSD.toFixed(2)} raised`)
  console.log(`  TOTAL: ${v5Data.totalSupply + v6Data.totalSupply} NFTs, $${(v5Data.totalRaisedUSD + v6Data.totalRaisedUSD).toFixed(2)} raised`)
  
  console.log(`\nDATABASE TOTALS:`)
  console.log(`  Purchases: ${dbData.purchases?.length || 0}`)
  let dbTotal = 0
  let dbNFTs = 0
  for (const p of dbData.purchases || []) {
    dbTotal += (p.amount_usd || 0) + (p.tip_usd || 0)
    dbNFTs += p.quantity || 1
  }
  console.log(`  Total: ${dbNFTs} NFTs, $${dbTotal.toFixed(2)} raised`)
  
  console.log(`\nDISCREPANCIES: ${discrepancies.length}`)
}

main().catch(console.error)
