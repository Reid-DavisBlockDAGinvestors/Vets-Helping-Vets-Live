#!/usr/bin/env node
/**
 * Campaign Data Audit Script
 * 
 * Audits:
 * 1. User emails in purchases vs profiles
 * 2. Duplicate campaigns
 * 3. On-chain raised amounts vs database
 * 
 * Run with: npx ts-node scripts/audit-campaign-data.ts
 */

const { createClient } = require('@supabase/supabase-js')
const { ethers } = require('ethers')

// Load environment
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RPC_URL = process.env.BLOCKDAG_RPC || 'https://rpc.primev2.bdagscan.com'
const NOWNODES_KEY = process.env.NOWNODES_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Contract addresses
const CONTRACT_V5 = '0x8626C0888D0eeFEbf44bfe92d0a93C8695D0E0a3'
const CONTRACT_V6 = '0x2567B44ed9Ec4B5eAb4a7e2A251F5d7a56F3e8A2'

// Minimal ABI for reading campaign data
const CAMPAIGN_ABI = [
  'function getCampaign(uint256 campaignId) view returns (tuple(uint256 size, uint256 price, uint256 goal, uint256 sold, address creator, string baseURI, uint8 category, bool active))',
  'function campaignCount() view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)'
]

interface AuditResult {
  emailsInPurchasesOnly: number
  emailsLinkedToProfiles: number
  duplicateCampaigns: { title: string; count: number; ids: string[] }[]
  campaignMismatches: { 
    id: string
    title: string
    dbSold: number
    chainSold: number
    dbRaised: number
    chainRaised: number
  }[]
}

async function createProvider() {
  const headers: Record<string, string> = {}
  if (RPC_URL?.includes('nownodes') && NOWNODES_KEY) {
    headers['api-key'] = NOWNODES_KEY
  }
  
  const connection = {
    url: RPC_URL,
    headers
  }
  
  return new ethers.JsonRpcProvider(connection)
}

async function auditEmails(): Promise<{ inPurchasesOnly: number; linked: number; orphanedEmails: string[] }> {
  console.log('\n📧 AUDITING USER EMAILS...')
  console.log('─'.repeat(50))
  
  // Get all emails from purchases table
  const { data: purchases, error: purchaseError } = await supabase
    .from('purchases')
    .select('email, wallet_address, user_id')
    .not('email', 'is', null)
  
  if (purchaseError) {
    console.error('Error fetching purchases:', purchaseError)
    return { inPurchasesOnly: 0, linked: 0, orphanedEmails: [] }
  }
  
  // Get all profile emails
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, wallet_address')
  
  if (profileError) {
    console.error('Error fetching profiles:', profileError)
    return { inPurchasesOnly: 0, linked: 0, orphanedEmails: [] }
  }
  
  const profileEmails = new Set((profiles || []).map((p: any) => p.email?.toLowerCase()).filter(Boolean))
  const profileWallets = new Set((profiles || []).map((p: any) => p.wallet_address?.toLowerCase()).filter(Boolean))
  
  const purchaseEmails = new Map<string, { wallet: string | null; userId: string | null }>()
  
  for (const p of (purchases || [])) {
    if (p.email) {
      const key = p.email.toLowerCase()
      if (!purchaseEmails.has(key)) {
        purchaseEmails.set(key, { wallet: p.wallet_address, userId: p.user_id })
      }
    }
  }
  
  let linked = 0
  let inPurchasesOnly = 0
  const orphanedEmails: string[] = []
  
  for (const [email, data] of purchaseEmails) {
    const isInProfiles = profileEmails.has(email) || 
                         (data.wallet && profileWallets.has(data.wallet.toLowerCase()))
    
    if (isInProfiles) {
      linked++
    } else {
      inPurchasesOnly++
      orphanedEmails.push(email)
    }
  }
  
  console.log(`  ✅ Emails linked to profiles: ${linked}`)
  console.log(`  ⚠️  Emails in purchases only: ${inPurchasesOnly}`)
  
  if (orphanedEmails.length > 0) {
    console.log('\n  Orphaned emails (not linked to profiles):')
    orphanedEmails.slice(0, 10).forEach(e => console.log(`    - ${e}`))
    if (orphanedEmails.length > 10) {
      console.log(`    ... and ${orphanedEmails.length - 10} more`)
    }
  }
  
  return { inPurchasesOnly, linked, orphanedEmails }
}

async function auditDuplicateCampaigns(): Promise<{ title: string; count: number; ids: string[] }[]> {
  console.log('\n📋 AUDITING DUPLICATE CAMPAIGNS...')
  console.log('─'.repeat(50))
  
  // Find campaigns with same title
  const { data: submissions, error } = await supabase
    .from('submissions')
    .select('id, title, campaign_id, status, created_at, sold_count, goal')
    .order('title')
  
  if (error) {
    console.error('Error fetching submissions:', error)
    return []
  }
  
  // Group by title
  const titleGroups = new Map<string, any[]>()
  for (const sub of (submissions || [])) {
    const title = sub.title?.toLowerCase().trim() || ''
    if (!titleGroups.has(title)) {
      titleGroups.set(title, [])
    }
    titleGroups.get(title)!.push(sub)
  }
  
  const duplicates: { title: string; count: number; ids: string[]; details: any[] }[] = []
  
  for (const [title, subs] of titleGroups) {
    if (subs.length > 1) {
      duplicates.push({
        title: subs[0].title,
        count: subs.length,
        ids: subs.map((s: any) => s.id),
        details: subs
      })
    }
  }
  
  if (duplicates.length === 0) {
    console.log('  ✅ No duplicate campaigns found')
  } else {
    console.log(`  ⚠️  Found ${duplicates.length} sets of duplicate campaigns:`)
    for (const dup of duplicates) {
      console.log(`\n  "${dup.title}" (${dup.count} copies):`)
      for (const d of dup.details) {
        console.log(`    - ID: ${d.id}`)
        console.log(`      Campaign ID: ${d.campaign_id || 'N/A'}`)
        console.log(`      Status: ${d.status}`)
        console.log(`      Sold: ${d.sold_count || 0}`)
        console.log(`      Created: ${d.created_at}`)
      }
    }
  }
  
  return duplicates
}

async function auditOnChainData(): Promise<{ id: string; title: string; dbSold: number; chainSold: number; dbRaised: number; chainRaised: number }[]> {
  console.log('\n⛓️  AUDITING ON-CHAIN VS DATABASE...')
  console.log('─'.repeat(50))
  
  const mismatches: any[] = []
  
  // Get all approved campaigns with campaign_id
  const { data: campaigns, error } = await supabase
    .from('submissions')
    .select('id, title, campaign_id, sold_count, goal, status, contract_version')
    .not('campaign_id', 'is', null)
    .in('status', ['approved', 'live'])
  
  if (error) {
    console.error('Error fetching campaigns:', error)
    return []
  }
  
  if (!campaigns || campaigns.length === 0) {
    console.log('  No approved campaigns with campaign_id found')
    return []
  }
  
  console.log(`  Checking ${campaigns.length} campaigns against blockchain...`)
  
  try {
    const provider = await createProvider()
    
    // Try V6 first, then V5
    const contractAddresses = [CONTRACT_V6, CONTRACT_V5]
    
    for (const campaign of campaigns) {
      const campaignId = campaign.campaign_id
      
      let chainData = null
      let usedContract = null
      
      for (const addr of contractAddresses) {
        try {
          const contract = new ethers.Contract(addr, CAMPAIGN_ABI, provider)
          const data = await contract.getCampaign(campaignId)
          chainData = data
          usedContract = addr
          break
        } catch (e) {
          // Try next contract
        }
      }
      
      if (chainData) {
        const chainSold = Number(chainData.sold)
        const chainPrice = Number(ethers.formatEther(chainData.price))
        const chainRaised = chainSold * chainPrice
        
        const dbSold = campaign.sold_count || 0
        const dbGoal = campaign.goal || 0
        // Estimate DB raised based on sold_count * price per NFT
        const pricePerNFT = dbGoal / 100 // Assuming 100 NFTs per campaign
        const dbRaised = dbSold * pricePerNFT
        
        if (chainSold !== dbSold) {
          mismatches.push({
            id: campaign.id,
            title: campaign.title,
            campaignId: campaignId,
            dbSold,
            chainSold,
            dbRaised: dbRaised.toFixed(2),
            chainRaised: chainRaised.toFixed(2),
            contract: usedContract === CONTRACT_V6 ? 'V6' : 'V5'
          })
        }
      }
    }
    
    if (mismatches.length === 0) {
      console.log('  ✅ All campaigns match on-chain data')
    } else {
      console.log(`\n  ⚠️  Found ${mismatches.length} mismatches:`)
      for (const m of mismatches) {
        console.log(`\n  "${m.title}" (Campaign #${m.campaignId}):`)
        console.log(`    Database sold_count: ${m.dbSold}`)
        console.log(`    On-chain sold:       ${m.chainSold}`)
        console.log(`    Difference:          ${m.chainSold - m.dbSold} NFTs`)
        console.log(`    Contract:            ${m.contract}`)
      }
    }
  } catch (e: any) {
    console.error('  ❌ Failed to query blockchain:', e.message)
  }
  
  return mismatches
}

async function auditPurchasesTable(): Promise<void> {
  console.log('\n💰 AUDITING PURCHASES TABLE...')
  console.log('─'.repeat(50))
  
  // Get summary of purchases
  const { data: purchases, error } = await supabase
    .from('purchases')
    .select('campaign_id, amount_usd, tip_usd, email, wallet_address, created_at')
  
  if (error) {
    console.error('Error fetching purchases:', error)
    return
  }
  
  const totalPurchases = purchases?.length || 0
  const withEmail = purchases?.filter((p: any) => p.email).length || 0
  const withWallet = purchases?.filter((p: any) => p.wallet_address).length || 0
  const totalUSD = purchases?.reduce((sum: number, p: any) => sum + (p.amount_usd || 0) + (p.tip_usd || 0), 0) || 0
  
  console.log(`  Total purchases recorded: ${totalPurchases}`)
  console.log(`  With email:               ${withEmail} (${((withEmail/totalPurchases)*100).toFixed(1)}%)`)
  console.log(`  With wallet:              ${withWallet} (${((withWallet/totalPurchases)*100).toFixed(1)}%)`)
  console.log(`  Total USD recorded:       $${totalUSD.toFixed(2)}`)
  
  // Group by campaign
  const byCampaign = new Map<number, { count: number; total: number }>()
  for (const p of (purchases || [])) {
    const cid = p.campaign_id
    if (!byCampaign.has(cid)) {
      byCampaign.set(cid, { count: 0, total: 0 })
    }
    const entry = byCampaign.get(cid)!
    entry.count++
    entry.total += (p.amount_usd || 0) + (p.tip_usd || 0)
  }
  
  console.log(`\n  Purchases by campaign:`)
  for (const [cid, stats] of Array.from(byCampaign.entries()).sort((a, b) => b[1].total - a[1].total)) {
    console.log(`    Campaign #${cid}: ${stats.count} purchases, $${stats.total.toFixed(2)}`)
  }
}

async function runAudit() {
  console.log('\n' + '='.repeat(60))
  console.log('🔍 PATRIOTPLEDGE DATA INTEGRITY AUDIT')
  console.log('='.repeat(60))
  console.log(`Run at: ${new Date().toISOString()}`)
  
  const emailResult = await auditEmails()
  const duplicates = await auditDuplicateCampaigns()
  await auditPurchasesTable()
  const mismatches = await auditOnChainData()
  
  console.log('\n' + '='.repeat(60))
  console.log('📊 AUDIT SUMMARY')
  console.log('='.repeat(60))
  console.log(`  Orphaned emails (need linking):  ${emailResult.inPurchasesOnly}`)
  console.log(`  Duplicate campaigns:             ${duplicates.length} sets`)
  console.log(`  On-chain mismatches:             ${mismatches.length} campaigns`)
  
  if (emailResult.inPurchasesOnly > 0 || duplicates.length > 0 || mismatches.length > 0) {
    console.log('\n⚠️  Issues found - review above for details')
  } else {
    console.log('\n✅ No issues found')
  }
  
  console.log('\n')
}

runAudit().catch(console.error)
